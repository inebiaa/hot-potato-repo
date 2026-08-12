import { supabase } from './supabase';

export const LIST_COVERS_BUCKET = 'list-covers';

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.88;

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function compressImageForListCover(file: Blob): Promise<Blob> {
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

export async function uploadListCoverFile(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  if (!userId) return { error: 'Sign in to upload a photo.' };
  if (!file.type.startsWith('image/')) return { error: 'Choose an image file.' };

  let body: Blob;
  try {
    body = await compressImageForListCover(file);
  } catch {
    body = file;
  }

  const path = `${userId}/${randomId()}.jpg`;
  const { error } = await supabase.storage.from(LIST_COVERS_BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  });

  if (error) return { error: error.message || 'Upload failed.' };

  const { data } = supabase.storage.from(LIST_COVERS_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) return { error: 'Upload succeeded but no public URL.' };
  return { url: data.publicUrl };
}

export function listCoverStoragePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const marker = `/storage/v1/object/public/${LIST_COVERS_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + marker.length));
    return path || null;
  } catch {
    return null;
  }
}

export async function deleteStoredListCover(url: string | null | undefined): Promise<void> {
  const path = listCoverStoragePathFromUrl(url);
  if (!path) return;
  const { error } = await supabase.storage.from(LIST_COVERS_BUCKET).remove([path]);
  if (error) console.warn('Failed to delete list cover from storage:', error.message);
}
