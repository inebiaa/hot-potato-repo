/**
 * Card-sized display URLs for feed thumbnails (h-48 ≈ 192 CSS px).
 * Keeps DB / OG / JSON-LD on the original; only the on-screen card img should use this.
 */

const CARD_MAX_WIDTH = 960;

function rewritePinimg(url: string): string | null {
  // i.pinimg.com/{size}/... prefer ~736w for cards
  const m = url.match(/^(https?:\/\/i\.pinimg\.com)\/(\d+x\d*|\d+x)\/(.+)$/i);
  if (!m) return null;
  const size = m[2].toLowerCase();
  if (size === '736x' || size === '474x' || size === '236x') return url;
  return `${m[1]}/736x/${m[3]}`;
}

function rewriteTicketmaster(url: string): string | null {
  // Prefer mid size over TABLET_LANDSCAPE_LARGE when present.
  if (!/ticketm\.net\/dam\//i.test(url)) return null;
  if (/_TABLET_LANDSCAPE_LARGE_/i.test(url)) {
    return url.replace(/_TABLET_LANDSCAPE_LARGE_/i, '_TABLET_LANDSCAPE_');
  }
  if (/_SOURCE\./i.test(url)) {
    return url.replace(/_SOURCE\./i, '_TABLET_LANDSCAPE_16_9.');
  }
  return null;
}

function rewriteCloudflareImage(url: string): string | null {
  // …/cdn-cgi/image/width=1600,…/…
  if (!/\/cdn-cgi\/image\//i.test(url)) return null;
  return url.replace(/width=\d+/i, `width=${CARD_MAX_WIDTH}`);
}

function rewriteShopify(url: string): string | null {
  // cdn.shopify.com or *.myshopify.com / store.* with /cdn/shop/
  if (!/\/cdn\/shop\//i.test(url) && !/cdn\.shopify\.com/i.test(url)) return null;
  try {
    const u = new URL(url);
    u.searchParams.set('width', String(CARD_MAX_WIDTH));
    return u.toString();
  } catch {
    return null;
  }
}

/** Display URL for EventCard / feed thumbs — never mutate the stored image_url. */
export function eventCardImageUrl(imageUrl: string | null | undefined): string | undefined {
  const raw = (imageUrl || '').trim();
  if (!raw) return undefined;

  return (
    rewritePinimg(raw) ||
    rewriteTicketmaster(raw) ||
    rewriteCloudflareImage(raw) ||
    rewriteShopify(raw) ||
    raw
  );
}
