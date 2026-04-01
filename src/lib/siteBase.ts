/** Vite base path, e.g. "/" or "/repo/" — normalized with leading/trailing slashes. */
export function viteBasePath(): string {
  let b = import.meta.env.BASE_URL || '/';
  if (b === './') b = '/';
  if (!b.startsWith('/')) b = `/${b}`;
  return b.endsWith('/') ? b : `${b}/`;
}

/**
 * Absolute site origin for canonical URLs (JSON-LD, sitemap).
 * Prefer VITE_PUBLIC_SITE_URL in production; fallback to current origin in the browser.
 */
export function publicSiteOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (env && typeof env === 'string' && env.startsWith('http')) {
    return env.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://www.secretblogger.app';
}

/** Path to an event page, with Vite base prefix. */
export function eventPagePath(eventId: string): string {
  const base = viteBasePath();
  const prefix = base === '/' ? '' : base.slice(0, -1);
  return `${prefix}/event/${eventId}`.replace(/\/{2,}/g, '/');
}

/** Full canonical URL for an event page. */
export function canonicalEventUrl(eventId: string): string {
  return `${publicSiteOrigin()}${eventPagePath(eventId)}`;
}

/**
 * Canonical event URL when `import.meta.env` is not available (e.g. Node prerender).
 * `viteBase` is `process.env.VITE_BASE` (e.g. `/` or `/repo/`).
 */
export function canonicalEventUrlFromParts(
  eventId: string,
  siteOrigin: string,
  viteBase: string
): string {
  const origin = siteOrigin.replace(/\/$/, '');
  let b = viteBase || '/';
  if (b === './') b = '/';
  if (!b.startsWith('/')) b = `/${b}`;
  const prefix = b === '/' ? '' : b.replace(/\/$/, '');
  const path = `${prefix}/event/${eventId}`.replace(/\/{2,}/g, '/');
  return `${origin}${path}`;
}
