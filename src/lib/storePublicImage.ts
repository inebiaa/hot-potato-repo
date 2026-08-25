import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { isCdnImageUrl, legacySupabaseStorageRef } from './imageCdn';
import { supabase } from './supabase';

export type PublicImageKind =
  | 'event'
  | 'profile'
  | 'profile-cover'
  | 'list-cover'
  | 'branding';

type AuthResult =
  | { ok: true; headers: Record<string, string> }
  | { ok: false; error: string };

async function authHeaders(): Promise<AuthResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: 'Sign in to upload a photo.' };
  return {
    ok: true,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  };
}

export async function storePublicImageFile(options: {
  blob: Blob;
  kind: PublicImageKind;
  slot?: string;
}): Promise<{ url: string } | { error: string }> {
  const auth = await authHeaders();
  if (auth.ok === false) return { error: auth.error };

  const contentType = options.blob.type || 'image/jpeg';
  const reqHeaders: Record<string, string> = {
    ...auth.headers,
    'Content-Type': contentType,
    'x-image-kind': options.kind,
  };
  if (options.slot) reqHeaders['x-brand-slot'] = options.slot;

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/store-public-image`, {
      method: 'POST',
      headers: reqHeaders,
      body: options.blob,
    });
  } catch {
    return { error: 'Could not upload image.' };
  }

  let payload: { url?: unknown; error?: unknown } = {};
  try {
    payload = (await res.json()) as { url?: unknown; error?: unknown };
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const msg = payload.error != null ? String(payload.error) : `Upload failed (${res.status}).`;
    return { error: msg };
  }
  const url = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!url) return { error: 'Upload succeeded but no public URL.' };
  return { url };
}

export async function deletePublicImage(url: string | null | undefined): Promise<void> {
  const trimmed = (url || '').trim();
  if (!trimmed) return;

  const legacy = legacySupabaseStorageRef(trimmed);
  if (legacy) {
    const { error } = await supabase.storage.from(legacy.bucket).remove([legacy.path]);
    if (error) console.warn('Failed to delete legacy storage image:', error.message);
  }

  if (!isCdnImageUrl(trimmed)) return;

  const auth = await authHeaders();
  if (auth.ok === false) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/store-public-image`, {
      method: 'DELETE',
      headers: {
        ...auth.headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('Failed to delete CDN image:', res.status, text.slice(0, 200));
    }
  } catch (err) {
    console.warn('Failed to delete CDN image:', err);
  }
}
