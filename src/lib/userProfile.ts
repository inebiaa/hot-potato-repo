import { supabase } from './supabase';

/** Usernames blocked at signup (existing accounts may still use them in URLs). */
export const RESERVED_PROFILE_HANDLES = new Set([
  'event',
  'settings',
  'stats',
  'profile',
  'list',
  'embed',
  'admin',
  'auth',
  'signin',
  'signup',
]);

export type ResolvedUserProfile = {
  user_id: string;
  username: string;
  user_id_public: string;
  avatar_url: string | null;
  cover_image_url: string | null;
};

/** Handle shape only — used for URL routing and DB lookup. */
export function isProfileHandlePathSegment(handle: string): boolean {
  const trimmed = handle.trim();
  if (!trimmed || trimmed.length < 4) return false;
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/** New signup handles: shape + not reserved. */
export function isValidProfileHandle(handle: string): boolean {
  const trimmed = handle.trim();
  if (!isProfileHandlePathSegment(trimmed)) return false;
  if (RESERVED_PROFILE_HANDLES.has(trimmed.toLowerCase())) return false;
  return true;
}

export function validateProfileDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Your name is required.';
  if (trimmed.length > 80) return 'Your name is too long.';
  return null;
}

export function validateProfileHandle(handle: string): string | null {
  const trimmed = handle.trim();
  if (!trimmed) return 'Username is required.';
  if (!isProfileHandlePathSegment(trimmed)) {
    return 'Username must be at least 4 characters and contain only letters, numbers, underscores, and hyphens.';
  }
  if (RESERVED_PROFILE_HANDLES.has(trimmed.toLowerCase())) {
    return 'That username is reserved.';
  }
  return null;
}

/** Case-insensitive lookup of a profile by public handle (shown as @handle in the UI). */
export async function resolveProfileByHandle(handle: string): Promise<ResolvedUserProfile | null> {
  if (!isProfileHandlePathSegment(handle)) return null;

  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, username, user_id_public, avatar_url, cover_image_url')
    .ilike('user_id_public', handle.trim())
    .maybeSingle();

  if (error || !data) return null;
  return data as ResolvedUserProfile;
}

/** Parse a profile handle from `/handle`. */
export function parseProfileHandleFromPath(pathname: string): string | null {
  const match = pathname.match(/\/([a-zA-Z0-9_-]+)\/?$/);
  if (!match) return null;
  const handle = match[1];
  return isProfileHandlePathSegment(handle) ? handle : null;
}
