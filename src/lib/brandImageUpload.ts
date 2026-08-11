import { supabase } from './supabase';

export const BRANDING_IMAGES_BUCKET = 'branding-images';

export type BrandImageSlot = 'icon' | 'logo' | 'favicon';

const MAX_EDGE_PX = 1600;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extForMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('icon')) return 'ico';
  return 'jpg';
}

/** Resize branding assets; preserve PNG/WebP when possible (logos often need alpha). */
export async function compressBrandImage(
  file: Blob,
): Promise<{ blob: Blob; contentType: string }> {
  const inputType = (file.type || 'image/jpeg').toLowerCase();
  if (inputType === 'image/gif' || inputType.includes('icon')) {
    return { blob: file, contentType: inputType };
  }
  if (typeof createImageBitmap === 'undefined') {
    return { blob: file, contentType: inputType };
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
    if (!ctx) return { blob: file, contentType: inputType };
    ctx.drawImage(bitmap, 0, 0, w, h);

    const outType = inputType.includes('png')
      ? 'image/png'
      : inputType.includes('webp')
        ? 'image/webp'
        : 'image/jpeg';
    const quality = outType === 'image/jpeg' ? 0.9 : undefined;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });
    return { blob: blob ?? file, contentType: outType };
  } finally {
    bitmap.close();
  }
}

/**
 * Upload an admin-picked branding image.
 * Path: `{slot}/{uuid}.{ext}`
 */
export async function uploadBrandImageFile(
  file: File,
  slot: BrandImageSlot,
): Promise<{ url: string } | { error: string }> {
  if (!file.type.startsWith('image/') && !file.type.includes('icon')) {
    return { error: 'Choose an image file.' };
  }

  let body: Blob;
  let contentType: string;
  try {
    const compressed = await compressBrandImage(file);
    body = compressed.blob;
    contentType = compressed.contentType;
  } catch {
    body = file;
    contentType = file.type || 'image/jpeg';
  }

  const path = `${slot}/${randomId()}.${extForMime(contentType)}`;
  const { error } = await supabase.storage.from(BRANDING_IMAGES_BUCKET).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: '31536000',
  });

  if (error) return { error: error.message || 'Upload failed.' };

  const { data } = supabase.storage.from(BRANDING_IMAGES_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload succeeded but no public URL.' };
  return { url: data.publicUrl };
}

export function brandImageStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${BRANDING_IMAGES_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
    return path || null;
  } catch {
    return null;
  }
}

export async function deleteStoredBrandImage(url: string | null | undefined): Promise<void> {
  const path = brandImageStoragePathFromUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(BRANDING_IMAGES_BUCKET).remove([path]);
  if (error) console.warn('Failed to delete branding image from storage:', error.message);
}

export async function ensureBrandImageStored(
  url: string | null | undefined,
  slot: BrandImageSlot,
): Promise<{ url: string | null } | { error: string }> {
  const trimmed = (url || '').trim();
  if (!trimmed) return { url: null };
  if (brandImageStoragePathFromUrl(trimmed)) return { url: trimmed };

  const { data, error } = await supabase.functions.invoke('ingest-branding-image', {
    body: { url: trimmed, slot },
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
