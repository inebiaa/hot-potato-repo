export const MAX_EDGE_PX = 1200;
export const JPEG_QUALITY = 82;
export const CARD_MAX_EDGE_PX = 640;
export const CARD_JPEG_QUALITY = 70;

type ImageScriptImage = {
  width: number;
  height: number;
  resize: (w: number, h: number) => void;
  encodeJPEG: (quality: number) => Promise<Uint8Array>;
};

type ImageScriptModule = {
  Image: {
    decode: (bytes: Uint8Array) => Promise<ImageScriptImage>;
    RESIZE_AUTO: number;
  };
};

async function loadImageScript(): Promise<ImageScriptModule> {
  return import("npm:imagescript@1.3.0") as Promise<ImageScriptModule>;
}

function resizeMaxEdge(
  image: ImageScriptImage,
  maxEdge: number,
  Image: ImageScriptModule["Image"],
): ImageScriptImage {
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
    const { Image } = await loadImageScript();
    const image = await Image.decode(bytes);
    const maxEdge = Math.max(image.width, image.height);
    resizeMaxEdge(image, MAX_EDGE_PX, Image);
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
    const { Image } = await loadImageScript();
    const image = await Image.decode(bytes);
    resizeMaxEdge(image, CARD_MAX_EDGE_PX, Image);
    const encoded = await image.encodeJPEG(CARD_JPEG_QUALITY);
    if (!encoded.byteLength) return null;
    return { bytes: encoded, contentType: "image/jpeg", ext: "jpg" };
  } catch {
    return null;
  }
}
