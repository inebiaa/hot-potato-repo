import { supabase } from './supabase';

export const EVENT_IMAGES_BUCKET = 'event-images';

const MAX_EDGE_PX = 1200;
const JPEG_QUALITY = 0.82;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Resize / recompress for card + OG use; returns a JPEG blob. */
export async function compressImageForEvent(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
    });
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

/**
 * Upload a user-picked image into the public `event-images` bucket.
 * Path: `{userId}/{uuid}.jpg`
 */
export async function uploadEventImageFile(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  if (!userId) return { error: 'Sign in to upload a photo.' };
  if (!file.type.startsWith('image/')) return { error: 'Choose an image file.' };

  let body: Blob;
  try {
    body = await compressImageForEvent(file);
  } catch {
    body = file;
  }

  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage.from(EVENT_IMAGES_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  });

  if (error) return { error: error.message || 'Upload failed.' };

  const { data } = supabase.storage.from(EVENT_IMAGES_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload succeeded but no public URL.' };
  return { url: data.publicUrl };
}

/** Object path inside `event-images`, or null if URL is not from our bucket. */
export function eventImageStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${EVENT_IMAGES_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
    return path || null;
  } catch {
    return null;
  }
}

/** Best-effort remove of a file we host; no-op for external/hotlinked URLs. */
export async function deleteStoredEventImage(url: string | null | undefined): Promise<void> {
  const path = eventImageStoragePathFromUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(EVENT_IMAGES_BUCKET).remove([path]);
  if (error) console.warn('Failed to delete event image from storage:', error.message);
}

/**
 * Download an external image URL via Edge Function and store a durable copy in `event-images`.
 * No-op (returns same URL) if already hosted in our bucket.
 */
export async function ensureEventImageStored(
  url: string | null | undefined,
): Promise<{ url: string | null } | { error: string }> {
  const trimmed = (url || '').trim();
  if (!trimmed) return { url: null };
  if (eventImageStoragePathFromUrl(trimmed)) return { url: trimmed };

  const { data, error } = await supabase.functions.invoke('ingest-event-image', {
    body: { url: trimmed },
  });

  if (error) {
    const msg = error.message || 'Could not save image from URL.';
    // Functions often put JSON `{ error }` in the body on non-2xx; surface that when present.
    const bodyError =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : null;
    return { error: bodyError || msg };
  }
  if (data && typeof data === 'object' && 'error' in data && (data as { error: unknown }).error) {
    return { error: String((data as { error: unknown }).error) };
  }
  const stored =
    data && typeof data === 'object' && 'url' in data
      ? String((data as { url: unknown }).url || '').trim()
      : '';
  if (!stored) return { error: 'Could not save image from URL.' };
  return { url: stored };
}
