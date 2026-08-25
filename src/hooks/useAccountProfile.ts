import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { deleteStoredProfileImage } from '../lib/profileImageUpload';
import { supabase } from '../lib/supabase';

type UseAccountProfileOptions = {
  onAccountUpdated?: () => void;
  onSavedMessage?: (message: string) => void;
};

export function useAccountProfile({ onAccountUpdated, onSavedMessage }: UseAccountProfileOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const fetchAccountProfile = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('username, user_id_public, avatar_url, cover_image_url')
      .eq('user_id', userId)
      .maybeSingle();
    setEditName(data?.username || '');
    setEditEmail((user?.email || '').trim());
    setEditUsername(data?.user_id_public || '');
    setEditAvatarUrl(data?.avatar_url || '');
    setEditCoverUrl(data?.cover_image_url || '');
  }, [userId, user?.email]);

  useEffect(() => {
    if (userId) void fetchAccountProfile();
  }, [userId, fetchAccountProfile]);

  const persistCoverUrl = async (nextUrl: string) => {
    const previous = editCoverUrl;
    setEditCoverUrl(nextUrl);
    if (!userId) return;
    setProfileSaveError('');
    const newCover = nextUrl.trim() || null;
    const { error } = await supabase
      .from('user_profiles')
      .update({
        cover_image_url: newCover,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) {
      setEditCoverUrl(previous);
      setProfileSaveError(error.message || 'Could not save cover photo.');
      return;
    }
    const prevCover = previous.trim() || null;
    if (prevCover && prevCover !== newCover) {
      await deleteStoredProfileImage(prevCover);
    }
    onAccountUpdated?.();
  };

  const saveAccountProfile = async () => {
    setProfileSaveError('');
    setProfileSaving(true);
    try {
      const newName = editName.trim();
      const newUsername = editUsername.trim();
      const newEmail = editEmail.trim().toLowerCase();
      if (!newName || newName.length < 1) {
        setProfileSaveError('Your name is required.');
        setProfileSaving(false);
        return;
      }
      if (!newEmail) {
        setProfileSaveError('Email is required.');
        setProfileSaving(false);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        setProfileSaveError('Enter a valid email.');
        setProfileSaving(false);
        return;
      }
      if (!newUsername || newUsername.length < 4) {
        setProfileSaveError('Username must be at least 4 characters.');
        setProfileSaving(false);
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        setProfileSaveError('Username may only contain letters, numbers, underscores, and hyphens.');
        setProfileSaving(false);
        return;
      }
      const newAvatar = editAvatarUrl.trim() || null;
      const newCover = editCoverUrl.trim() || null;
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('avatar_url, cover_image_url')
        .eq('user_id', userId)
        .maybeSingle();
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: userId,
            username: newName,
            user_id_public: newUsername,
            avatar_url: newAvatar,
            cover_image_url: newCover,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        const msg =
          error.code === '23505'
            ? 'That username is already taken.'
            : error.message || 'Could not save profile.';
        setProfileSaveError(msg);
        setProfileSaving(false);
        return;
      }
      const prevAvatar = existingProfile?.avatar_url?.trim() || null;
      if (prevAvatar && prevAvatar !== newAvatar) {
        await deleteStoredProfileImage(prevAvatar);
      }
      const prevCover = existingProfile?.cover_image_url?.trim() || null;
      if (prevCover && prevCover !== newCover) {
        await deleteStoredProfileImage(prevCover);
      }

      const currentEmail = (user?.email || '').trim().toLowerCase();
      let emailPendingConfirm = false;
      if (newEmail !== currentEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
        if (emailError) {
          setProfileSaveError(emailError.message || 'Could not update email.');
          setProfileSaving(false);
          return;
        }
        emailPendingConfirm = true;
      }

      await fetchAccountProfile();
      onSavedMessage?.(
        emailPendingConfirm
          ? 'Profile saved. Confirm the new email from your inbox.'
          : 'Profile saved',
      );
      onAccountUpdated?.();
    } catch {
      setProfileSaveError('Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  return {
    userId,
    editName,
    setEditName,
    editEmail,
    setEditEmail,
    editUsername,
    setEditUsername,
    editAvatarUrl,
    setEditAvatarUrl,
    editCoverUrl,
    setEditCoverUrl: (url: string) => {
      void persistCoverUrl(url);
    },
    profileSaveError,
    profileSaving,
    saveAccountProfile,
    fetchAccountProfile,
  };
}
