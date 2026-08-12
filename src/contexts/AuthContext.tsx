import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { validateProfileDisplayName, validateProfileHandle } from '../lib/userProfile';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    handle: string,
  ) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function validationError(message: string): AuthError {
  return { message, name: 'ValidationError', status: 400 } as AuthError;
}

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
    let mounted = true;

    const applySession = (session: Session | null, event?: string) => {
      if (!mounted) return;
      // Token rotation must not poke React state — App refetches on user identity changes.
      if (event === 'TOKEN_REFRESHED') return;

      const nextUser = session?.user ?? null;
      setUser((prev) => (prev?.id === nextUser?.id ? prev : nextUser));
      void checkAdmin(nextUser?.id);
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      applySession(session, event);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    handle: string,
  ) => {
    const nameError = validateProfileDisplayName(displayName);
    if (nameError) return { error: validationError(nameError) };

    const handleError = validateProfileHandle(handle);
    if (handleError) return { error: validationError(handleError) };

    const name = displayName.trim();
    const publicHandle = handle.trim();

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (!error && data.user) {
      const { error: profileError } = await supabase.from('user_profiles').insert({
        user_id: data.user.id,
        username: name,
        user_id_public: publicHandle,
      });

      if (profileError) {
        const msg =
          profileError.code === '23505'
            ? 'That username is already taken.'
            : profileError.message || 'Could not create profile.';
        return { error: validationError(msg) };
      }
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return { error: validationError('Email is required') };
    }

    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return { error };
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
