import { legacySupabaseStorageRef } from './imageCdn';
import { deletePublicImage, storePublicImageFile } from './storePublicImage';

export const PROFILE_IMAGES_BUCKET = 'profile-images';

const MAX_EDGE_PX = 512;
const JPEG_QUALITY = 0.88;

async function compressToJpeg(file: Blob, maxEdge: number, quality: number): Promise<Blob> {
  if (typeof createImageBitmap === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}

export async function compressImageForProfile(file: Blob): Promise<Blob> {
  return compressToJpeg(file, MAX_EDGE_PX, JPEG_QUALITY);
}

export async function uploadProfileImageFile(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  if (!userId) return { error: 'Sign in to upload a photo.' };
  if (!file.type.startsWith('image/')) return { error: 'Choose an image file.' };

  let body: Blob;
  try {
    body = await compressImageForProfile(file);
  } catch {
    body = file;
  }

  return storePublicImageFile({ blob: body, kind: 'profile' });
}

const COVER_MAX_EDGE_PX = 1600;

async function compressImageForProfileCover(file: Blob): Promise<Blob> {
  return compressToJpeg(file, COVER_MAX_EDGE_PX, JPEG_QUALITY);
}

/** Wide cover for the profile page. */
export async function uploadProfileCoverFile(
  file: File,
  userId: string,
): Promise<{ url: string } | { error: string }> {
  if (!userId) return { error: 'Sign in to upload a photo.' };
  if (!file.type.startsWith('image/')) return { error: 'Choose an image file.' };

  let body: Blob;
  try {
    body = await compressImageForProfileCover(file);
  } catch {
    body = file;
  }

  return storePublicImageFile({ blob: body, kind: 'profile-cover' });
}

export function profileImageStoragePathFromUrl(url: string | null | undefined): string | null {
  const ref = legacySupabaseStorageRef(url);
  if (ref?.bucket !== PROFILE_IMAGES_BUCKET) return null;
  return ref.path;
}

export async function deleteStoredProfileImage(url: string | null | undefined): Promise<void> {
  await deletePublicImage(url);
}
