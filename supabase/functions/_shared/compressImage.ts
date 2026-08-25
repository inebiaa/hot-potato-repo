import { Image } from "npm:imagescript@1.3.0";

export const MAX_EDGE_PX = 1200;
export const JPEG_QUALITY = 82;
export const CARD_MAX_EDGE_PX = 640;
export const CARD_JPEG_QUALITY = 70;

function resizeMaxEdge(image: Image, maxEdge: number): Image {
  const current = Math.max(image.width, image.height);
  if (current <= maxEdge) return image;
  if (image.width >= image.height) {
    image.resize(maxEdge, Image.RESIZE_AUTO);
  } else {
    image.resize(Image.RESIZE_AUTO, maxEdge);
  }
  return image;
}

/** Full / OG JPEG. Null = keep original bytes. */
export async function compressEventPhoto(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const image = await Image.decode(bytes);
    const maxEdge = Math.max(image.width, image.height);
    resizeMaxEdge(image, MAX_EDGE_PX);
    const encoded = await image.encodeJPEG(JPEG_QUALITY);
    if (!encoded.byteLength) return null;
    if (maxEdge <= MAX_EDGE_PX && encoded.byteLength >= bytes.byteLength) {
      return null;
    }
    return { bytes: encoded, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    return null;
  }
}

/** Feed thumb JPEG (always produced when decode works). */
export async function encodeEventCardJpeg(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; contentType: string; ext: string } | null> {
  try {
    const image = await Image.decode(bytes);
    resizeMaxEdge(image, CARD_MAX_EDGE_PX);
    const encoded = await image.encodeJPEG(CARD_JPEG_QUALITY);
    if (!encoded.byteLength) return null;
    return { bytes: encoded, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    return null;
  }
}
