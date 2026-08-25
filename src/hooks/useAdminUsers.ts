import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { AdminUser } from '../components/settings/settingsConstants';

type UseAdminUsersOptions = {
  enabled: boolean;
  flashSuccess: (message: string) => void;
  setError: (message: string) => void;
};

export function useAdminUsers({ enabled, flashSuccess, setError }: UseAdminUsersOptions) {
  const [adminUserIdPublic, setAdminUserIdPublic] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('id, user_id, created_at');
      if (error) throw error;
      const adminRows = data || [];
      const userIds = adminRows.map((admin) => admin.user_id);
      if (userIds.length === 0) {
        setAdminUsers([]);
        return;
      }
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, username, user_id_public')
        .in('user_id', userIds);
      if (profileError) throw profileError;
      const profileByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile]));
      setAdminUsers(
        adminRows.map((admin) => {
          const profile = profileByUserId.get(admin.user_id);
          return {
            ...admin,
            username: profile?.username ?? 'Unknown',
            user_id_public: profile?.user_id_public ?? undefined,
          };
        }),
      );
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  useEffect(() => {
    if (enabled) void fetchAdminUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const handleAddAdmin = async () => {
    const newAdminId = adminUserIdPublic.trim();
    if (!newAdminId) {
      setError('Please enter a user ID');
      return;
    }
    setError('');
    setAdminLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id_public', newAdminId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.user_id) {
        setError('No user found with that ID');
        setAdminLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('admin_users').insert({ user_id: profile.user_id });
      if (insertError) {
        setError(insertError.code === '23505' ? 'User is already an admin' : insertError.message);
        setAdminLoading(false);
        return;
      }
      flashSuccess('Admin added');
      setAdminUserIdPublic('');
      void fetchAdminUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (adminUsers.length <= 1) {
      setError('Cannot remove the last admin');
      return;
    }
    if (!confirm('Remove this admin?')) return;
    setError('');
    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', adminId);
      if (error) throw error;
      flashSuccess('Admin removed');
      void fetchAdminUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  return {
    adminUserIdPublic,
    setAdminUserIdPublic,
    adminUsers,
    adminLoading,
    handleAddAdmin,
    handleRemoveAdmin,
  };
}
