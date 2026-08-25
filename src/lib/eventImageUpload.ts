import { isCdnImageUrl, legacySupabaseStorageRef } from './imageCdn';
import { deletePublicImage, storePublicImageFile } from './storePublicImage';
import { supabase } from './supabase';

export const EVENT_IMAGES_BUCKET = 'event-images';

const MAX_EDGE_PX = 1200;
const JPEG_QUALITY = 0.82;

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
 * Upload a user-picked image to the public image CDN.
 * Path: `event/{userId}/{uuid}.jpg` plus a `.card.jpg` feed variant.
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

  return storePublicImageFile({ blob: body, kind: 'event' });
}

/** Object path inside legacy `event-images`, or null. */
export function eventImageStoragePathFromUrl(url: string | null | undefined): string | null {
  const ref = legacySupabaseStorageRef(url);
  if (ref?.bucket !== EVENT_IMAGES_BUCKET) return null;
  return ref.path;
}

/** Best-effort remove of a file we host; no-op for external/hotlinked URLs. */
export async function deleteStoredEventImage(url: string | null | undefined): Promise<void> {
  await deletePublicImage(url);
}

/**
 * Download an external image URL and store a durable CDN copy.
 * No-op if already on the public image CDN.
 */
export async function ensureEventImageStored(
  url: string | null | undefined,
): Promise<{ url: string | null } | { error: string }> {
  const trimmed = (url || '').trim();
  if (!trimmed) return { url: null };
  if (isCdnImageUrl(trimmed)) return { url: trimmed };

  const { data, error } = await supabase.functions.invoke('ingest-event-image', {
    body: { url: trimmed },
  });

  if (error) {
    const msg = error.message || 'Could not save image from URL.';
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
