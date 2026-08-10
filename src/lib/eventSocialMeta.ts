import type { Event } from './eventTypes';
import { canonicalEventUrl, canonicalEventUrlFromParts, publicSiteOrigin } from './siteBase';
import type { EventJsonLdPrerender } from './eventJsonLd';
import { eventAbsoluteImageUrl } from './eventJsonLd';
import { formatEventDateDisplay } from './formatEventDate';
import { appName } from './brandMeta';

export const SITE_SOCIAL_ATTR = 'data-secret-blogger-site-social';
export const EVENT_SOCIAL_ATTR = 'data-secret-blogger-event-social';

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
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

export function buildEventOgDescription(event: Event, maxLen = 200): string {
  const bits: string[] = [event.name];
  if (event.date?.trim()) bits.push(formatEventDateDisplay(event.date.trim()));
  const place = [event.location?.trim(), event.city?.trim()].filter(Boolean).join(' · ');
  if (place) bits.push(place);
  const line = bits.join(' · ');
  if (line.length <= maxLen) return line;
  return `${line.slice(0, Math.max(1, maxLen - 1))}…`;
}

function eventShareImageUrl(event: Event, prerender?: EventJsonLdPrerender): string | undefined {
  const fromEvent = eventAbsoluteImageUrl(event.image_url, prerender);
  if (fromEvent) return fromEvent;
  const origin = prerender ? prerender.siteOrigin.replace(/\/$/, '') : publicSiteOrigin();
  return `${origin}/og-default.png`;
}

/**
 * Strip homepage Open Graph tags from prerendered HTML so event pages don't ship
 * both `og-default.png` and the event poster (scrapers often take the first image).
 */
export function stripSiteSocialFromHtml(html: string): string {
  return html
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bdata-secret-blogger-site-social\b[^>]*>\s*/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>\s*/gi, '');
}

/**
 * Open Graph tags for link previews (email, Slack, iMessage, etc.).
 * Safe to inject in `<head>` when attribute values are escaped.
 */
export function buildEventSocialMetaTagsHtml(event: Event, prerender?: EventJsonLdPrerender): string {
  const canonical = prerender
    ? canonicalEventUrlFromParts(event.id, prerender.siteOrigin, prerender.viteBase)
    : canonicalEventUrl(event.id);
  const title = event.name;
  const description = buildEventOgDescription(event);
  const image = eventShareImageUrl(event, prerender);

  const titleEsc = escapeHtmlAttr(title);
  const descEsc = escapeHtmlAttr(description);
  const urlEsc = escapeHtmlAttr(canonical);
  const siteNameEsc = escapeHtmlAttr(appName());

  const sb = `${EVENT_SOCIAL_ATTR}=""`;
  const lines: string[] = [
    `<meta property="og:site_name" content="${siteNameEsc}" ${sb} />`,
    `<meta property="og:locale" content="en_US" ${sb} />`,
    `<meta property="og:type" content="website" ${sb} />`,
    `<meta property="og:title" content="${titleEsc}" ${sb} />`,
    `<meta property="og:description" content="${descEsc}" ${sb} />`,
    `<meta property="og:url" content="${urlEsc}" ${sb} />`,
  ];
  if (image) {
    const mime = ogImageMimeFromUrl(image);
    lines.push(`<meta property="og:image" content="${escapeHtmlAttr(image)}" ${sb} />`);
    lines.push(`<meta property="og:image:secure_url" content="${escapeHtmlAttr(image)}" ${sb} />`);
    if (mime) lines.push(`<meta property="og:image:type" content="${mime}" ${sb} />`);
    lines.push(`<meta property="og:image:alt" content="${titleEsc}" ${sb} />`);
  }
  return lines.map((l) => `  ${l}`).join('\n');
}

export type SocialMetaTagSpec =
  | { kind: 'property'; key: string; content: string }
  | { kind: 'name'; key: string; content: string };

/** DOM-friendly list for runtime injection (same fields as HTML string). */
export function buildEventSocialMetaTagSpecs(event: Event, prerender?: EventJsonLdPrerender): SocialMetaTagSpec[] {
  const canonical = prerender
    ? canonicalEventUrlFromParts(event.id, prerender.siteOrigin, prerender.viteBase)
    : canonicalEventUrl(event.id);
  const title = event.name;
  const description = buildEventOgDescription(event);
  const image = eventShareImageUrl(event, prerender);
  const siteName = appName();
  const specs: SocialMetaTagSpec[] = [
    { kind: 'property', key: 'og:site_name', content: siteName },
    { kind: 'property', key: 'og:locale', content: 'en_US' },
    { kind: 'property', key: 'og:type', content: 'website' },
    { kind: 'property', key: 'og:title', content: title },
    { kind: 'property', key: 'og:description', content: description },
    { kind: 'property', key: 'og:url', content: canonical },
  ];
  if (image) {
    const mime = ogImageMimeFromUrl(image);
    specs.push({ kind: 'property', key: 'og:image', content: image });
    specs.push({ kind: 'property', key: 'og:image:secure_url', content: image });
    if (mime) specs.push({ kind: 'property', key: 'og:image:type', content: mime });
    specs.push({ kind: 'property', key: 'og:image:alt', content: title });
  }
  return specs;
}
