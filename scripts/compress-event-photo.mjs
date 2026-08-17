import { Image } from 'imagescript';

export const MAX_EDGE_PX = 1200;
export const JPEG_QUALITY = 82;

/**
 * Resize / JPEG-recompress event photos to card + OG size.
 * Returns null when the original should be kept (decode failure, or no savings).
 */
export async function compressEventPhoto(bytes) {
  try {
    const image = await Image.decode(bytes);
    const maxEdge = Math.max(image.width, image.height);
    if (maxEdge > MAX_EDGE_PX) {
      if (image.width >= image.height) {
        image.resize(MAX_EDGE_PX, Image.RESIZE_AUTO);
      } else {
        image.resize(Image.RESIZE_AUTO, MAX_EDGE_PX);
      }
    }
    const encoded = await image.encodeJPEG(JPEG_QUALITY);
    if (!encoded?.byteLength) return null;
    if (maxEdge <= MAX_EDGE_PX && encoded.byteLength >= bytes.byteLength) {
      return null;
    }
    return { bytes: encoded, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    return null;
  }
}
