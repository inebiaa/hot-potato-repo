import { DEFAULT_SITE_ORIGIN } from './brandMeta';

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
  return DEFAULT_SITE_ORIGIN;
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

/** Path to a shared library list (`/list/:id`), with Vite base prefix. */
export function listPagePath(listId: string): string {
  const base = viteBasePath();
  const prefix = base === '/' ? '' : base.slice(0, -1);
  return `${prefix}/list/${listId}`.replace(/\/{2,}/g, '/');
}

/** Full canonical URL for a shared library list. */
export function canonicalListUrl(listId: string): string {
  return `${publicSiteOrigin()}${listPagePath(listId)}`;
}

/**
 * Canonical list URL when `import.meta.env` is not available (e.g. Node prerender).
 * `viteBase` is `process.env.VITE_BASE` (e.g. `/` or `/repo/`).
 */
export function canonicalListUrlFromParts(
  listId: string,
  siteOrigin: string,
  viteBase: string,
): string {
  const origin = siteOrigin.replace(/\/$/, '');
  let b = viteBase || '/';
  if (b === './') b = '/';
  if (!b.startsWith('/')) b = `/${b}`;
  const prefix = b === '/' ? '' : b.replace(/\/$/, '');
  const path = `${prefix}/list/${listId}`.replace(/\/{2,}/g, '/');
  return `${origin}${path}`;
}

/** Path to a public profile page (`/handle`; @ is display-only in the app). */
export function profilePagePath(handle: string): string {
  const base = viteBasePath();
  const prefix = base === '/' ? '' : base.slice(0, -1);
  const safe = encodeURIComponent(handle.trim());
  return `${prefix}/${safe}`.replace(/\/{2,}/g, '/');
}

/** Full canonical URL for a public profile page. */
export function canonicalProfileUrl(handle: string): string {
  return `${publicSiteOrigin()}${profilePagePath(handle)}`;
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
