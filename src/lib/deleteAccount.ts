import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

export async function deleteOwnAccount(password: string): Promise<{ error: string | null }> {
  const trimmed = password.trim();
  if (!trimmed) return { error: 'Password is required.' };

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return { error: 'Sign in to delete your account.' };

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/delete-account`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: trimmed }),
  });

  let body: { error?: string; ok?: boolean } = {};
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return { error: body.error || 'Could not delete account.' };
  }
  return { error: null };
}
