import { legacySupabaseStorageRef } from './imageCdn';
import { deletePublicImage, storePublicImageFile } from './storePublicImage';

export const LIST_COVERS_BUCKET = 'list-covers';

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.88;

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

  return storePublicImageFile({ blob: body, kind: 'list-cover' });
}

export function listCoverStoragePathFromUrl(url: string | null | undefined): string | null {
  const ref = legacySupabaseStorageRef(url);
  if (ref?.bucket !== LIST_COVERS_BUCKET) return null;
  return ref.path;
}

export async function deleteStoredListCover(url: string | null | undefined): Promise<void> {
  await deletePublicImage(url);
}
