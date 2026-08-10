export type BrandShareImageSource = {
  app_logo_url?: string | null;
  app_icon_url?: string | null;
  app_favicon_url?: string | null;
};

function cleanUrl(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Guess OG image MIME from URL extension (omit when unknown — don't lie as PNG). */
export function ogImageMimeFromUrl(url: string): string | undefined {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.gif')) return 'image/gif';
  return undefined;
}

/**
 * Image scrapers should use for the site (and as event fallback): logo, else icon, else favicon.
 * Matches what Branding settings drive in the header.
 */
export function brandShareImageUrl(source: BrandShareImageSource): string | undefined {
  for (const key of ['app_logo_url', 'app_icon_url', 'app_favicon_url'] as const) {
    const url = cleanUrl(source[key]);
    if (url) return url;
  }
  return undefined;
}

/** Set from App when settings load so event pages can fall back to the brand image. */
let runtimeBrandShareImage: string | undefined;

export function setRuntimeBrandShareImage(url: string | undefined): void {
  runtimeBrandShareImage = cleanUrl(url) || undefined;
}

export function getRuntimeBrandShareImage(): string | undefined {
  return runtimeBrandShareImage;
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const SITE_SOCIAL_ATTR = 'data-secret-blogger-site-social';

/**
 * Rewrite homepage Open Graph image tags in built HTML to the brand asset.
 * Drops fixed 1200×630 dimensions (those only applied to the old generated card).
 */
export function applyBrandShareImageToSiteHtml(
  html: string,
  imageUrl: string,
  imageAlt: string,
): string {
  const url = cleanUrl(imageUrl);
  if (!url) return html;

  const escUrl = escapeHtmlAttr(url);
  const escAlt = escapeHtmlAttr(imageAlt || 'Secret Blogger');
  const mime = ogImageMimeFromUrl(url);
  const sb = `${SITE_SOCIAL_ATTR}=""`;

  let out = html
    .replace(
      /<meta\b[^>]*\bproperty=["']og:image["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>/gi,
      `<meta property="og:image" content="${escUrl}" ${sb} />`,
    )
    .replace(
      /<meta\b[^>]*\bproperty=["']og:image:secure_url["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>/gi,
      `<meta property="og:image:secure_url" content="${escUrl}" ${sb} />`,
    )
    .replace(
      /<meta\b[^>]*\bproperty=["']og:image:alt["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>/gi,
      `<meta property="og:image:alt" content="${escAlt}" ${sb} />`,
    )
    .replace(
      /<meta\b[^>]*\bproperty=["']og:image:width["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>\s*/gi,
      '',
    )
    .replace(
      /<meta\b[^>]*\bproperty=["']og:image:height["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>\s*/gi,
      '',
    );

  if (mime) {
    if (/property=["']og:image:type["'][^>]*\bdata-secret-blogger-site-social\b/i.test(out)) {
      out = out.replace(
        /<meta\b[^>]*\bproperty=["']og:image:type["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>/gi,
        `<meta property="og:image:type" content="${escapeHtmlAttr(mime)}" ${sb} />`,
      );
    } else {
      out = out.replace(
        /(<meta property="og:image:secure_url"[^>]*>)/i,
        `$1\n    <meta property="og:image:type" content="${escapeHtmlAttr(mime)}" ${sb} />`,
      );
    }
  } else {
    out = out.replace(
      /<meta\b[^>]*\bproperty=["']og:image:type["'][^>]*\bdata-secret-blogger-site-social\b[^>]*>\s*/gi,
      '',
    );
  }

  return out;
}

/** Update live document head site OG image (after settings load). */
export function syncSiteSocialOgImageInDocument(imageUrl: string | undefined, imageAlt: string): void {
  const url = cleanUrl(imageUrl);
  if (!url || typeof document === 'undefined') return;

  const setMeta = (property: string, content: string) => {
    let el = document.querySelector<HTMLMetaElement>(
      `meta[${SITE_SOCIAL_ATTR}][property="${property}"]`,
    );
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(SITE_SOCIAL_ATTR, '');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('og:image', url);
  setMeta('og:image:secure_url', url);
  setMeta('og:image:alt', imageAlt || 'Secret Blogger');

  const mime = ogImageMimeFromUrl(url);
  const typeEl = document.querySelector<HTMLMetaElement>(
    `meta[${SITE_SOCIAL_ATTR}][property="og:image:type"]`,
  );
  if (mime) {
    setMeta('og:image:type', mime);
  } else {
    typeEl?.remove();
  }

  document
    .querySelectorAll(
      `meta[${SITE_SOCIAL_ATTR}][property="og:image:width"], meta[${SITE_SOCIAL_ATTR}][property="og:image:height"]`,
    )
    .forEach((el) => el.remove());
}
