/**
 * Public image CDN (Cloudflare R2 + custom domain).
 * Object keys are UUID paths so Cache-Control: immutable is safe.
 */

const viteEnv: Record<string, string | undefined> =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env) ?? {};

/** Browser-facing origin for hosted photos. Must be the R2 custom domain, not r2.dev. */
export const IMAGE_CDN_BASE = (
  viteEnv.VITE_IMAGE_CDN_URL || 'https://images.secretblogger.app'
).replace(/\/$/, '');

/** Stored on every R2 object. Cloudflare honors this; browsers can keep the file. */
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

function cdnHostname(): string | null {
  try {
    return new URL(IMAGE_CDN_BASE).hostname;
  } catch {
    return null;
  }
}

export function isCdnImageUrl(url: string | null | undefined): boolean {
  const raw = (url || '').trim();
  if (!raw) return false;
  const host = cdnHostname();
  if (!host) return false;
  try {
    return new URL(raw).hostname === host;
  } catch {
    return false;
  }
}

/** R2 object key from a public CDN URL, or null. */
export function r2KeyFromPublicUrl(url: string | null | undefined): string | null {
  const raw = (url || '').trim();
  if (!raw || !isCdnImageUrl(raw)) return null;
  try {
    const path = decodeURIComponent(new URL(raw).pathname.replace(/^\//, ''));
    return path || null;
  } catch {
    return null;
  }
}

/** Feed variant key: `event/…/id.jpg` → `event/…/id.card.jpg`. */
export function cardKeyFromFullKey(key: string): string {
  if (/\.card\.[a-z0-9]+$/i.test(key)) return key;
  if (/\.[a-z0-9]+$/i.test(key)) return key.replace(/(\.[a-z0-9]+)$/i, '.card$1');
  return `${key}.card.jpg`;
}

/**
 * Feed display URL for our CDN event photos.
 * DB / OG keep the full object; cards are a sibling `.card.` object.
 */
export function cdnCardImageUrl(imageUrl: string): string | null {
  if (!isCdnImageUrl(imageUrl)) return null;
  try {
    const u = new URL(imageUrl);
    if (!u.pathname.startsWith('/event/')) return null;
    if (/\.card\.[a-z0-9]+$/i.test(u.pathname)) return imageUrl;
    u.pathname = u.pathname.replace(/(\.[a-z0-9]+)$/i, '.card$1');
    return u.toString();
  } catch {
    return null;
  }
}

export function legacySupabaseStorageRef(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  const raw = (url || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const marker = '/storage/v1/object/public/';
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    const rest = decodeURIComponent(u.pathname.slice(idx + marker.length));
    const slash = rest.indexOf('/');
    if (slash <= 0) return null;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    if (!path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}
