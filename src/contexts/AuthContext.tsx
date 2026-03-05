import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, username: string, userId?: string) => Promise<{ error: AuthError | null }>;
  signIn: (emailOrUserId: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const checkAdmin = async (userId: string | undefined) => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    setIsAdmin(!!data && !error);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      checkAdmin(session?.user?.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        await checkAdmin(session?.user?.id);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string, userId?: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (!error && data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          username,
          user_id_public: userId || null
        });

      if (profileError) {
        return { error: { message: profileError.message, name: 'ProfileError', status: 400 } as AuthError };
      }
    }

    return { error };
  };

  const signIn = async (emailOrUserId: string, password: string) => {
    const isEmail = emailOrUserId.includes('@');

    if (isEmail) {
      const { error } = await supabase.auth.signInWithPassword({ email: emailOrUserId, password });
      return { error };
    } else {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id_public', emailOrUserId)
        .maybeSingle();

      if (profileError || !profile) {
        return { error: { message: 'User ID not found', name: 'UserIdNotFound', status: 404 } as AuthError };
      }

      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id);

      if (userError || !userData.user?.email) {
        return { error: { message: 'Unable to sign in with User ID', name: 'SignInError', status: 400 } as AuthError };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: userData.user.email,
        password
      });
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
