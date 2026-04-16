import type { Event } from './eventTypes';
import { canonicalEventUrl, canonicalEventUrlFromParts } from './siteBase';
import type { EventJsonLdPrerender } from './eventJsonLd';
import { eventAbsoluteImageUrl } from './eventJsonLd';
import { formatEventDateDisplay } from './formatEventDate';

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildEventOgDescription(event: Event, maxLen = 200): string {
  const desc = event.description?.trim();
  if (desc) {
    if (desc.length <= maxLen) return desc;
    return `${desc.slice(0, Math.max(1, maxLen - 1))}…`;
  }
  const bits: string[] = [event.name];
  if (event.date?.trim()) bits.push(formatEventDateDisplay(event.date.trim()));
  const place = [event.location?.trim(), event.city?.trim()].filter(Boolean).join(' · ');
  if (place) bits.push(place);
  const line = bits.join(' · ');
  if (line.length <= maxLen) return line;
  return `${line.slice(0, Math.max(1, maxLen - 1))}…`;
}

/**
 * Open Graph + Twitter Card tags for link previews (email, Slack, etc.).
 * Safe to inject in `<head>` when attribute values are escaped.
 */
export function buildEventSocialMetaTagsHtml(event: Event, prerender?: EventJsonLdPrerender): string {
  const canonical = prerender
    ? canonicalEventUrlFromParts(event.id, prerender.siteOrigin, prerender.viteBase)
    : canonicalEventUrl(event.id);
  const title = event.name;
  const description = buildEventOgDescription(event);
  const image = eventAbsoluteImageUrl(event.image_url, prerender);

  const titleEsc = escapeHtmlAttr(title);
  const descEsc = escapeHtmlAttr(description);
  const urlEsc = escapeHtmlAttr(canonical);

  const sb = 'data-secret-blogger-event-social=""';
  const lines: string[] = [
    `<meta property="og:type" content="website" ${sb} />`,
    `<meta property="og:title" content="${titleEsc}" ${sb} />`,
    `<meta property="og:description" content="${descEsc}" ${sb} />`,
    `<meta property="og:url" content="${urlEsc}" ${sb} />`,
  ];
  if (image) {
    lines.push(`<meta property="og:image" content="${escapeHtmlAttr(image)}" ${sb} />`);
    lines.push(`<meta property="og:image:alt" content="${titleEsc}" ${sb} />`);
  }
  const twitterCard = image ? 'summary_large_image' : 'summary';
  lines.push(`<meta name="twitter:card" content="${twitterCard}" ${sb} />`);
  lines.push(`<meta name="twitter:title" content="${titleEsc}" ${sb} />`);
  lines.push(`<meta name="twitter:description" content="${descEsc}" ${sb} />`);
  if (image) {
    lines.push(`<meta name="twitter:image" content="${escapeHtmlAttr(image)}" ${sb} />`);
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
  const image = eventAbsoluteImageUrl(event.image_url, prerender);
  const specs: SocialMetaTagSpec[] = [
    { kind: 'property', key: 'og:type', content: 'website' },
    { kind: 'property', key: 'og:title', content: title },
    { kind: 'property', key: 'og:description', content: description },
    { kind: 'property', key: 'og:url', content: canonical },
  ];
  if (image) {
    specs.push({ kind: 'property', key: 'og:image', content: image });
    specs.push({ kind: 'property', key: 'og:image:alt', content: title });
  }
  const twitterCard = image ? 'summary_large_image' : 'summary';
  specs.push({ kind: 'name', key: 'twitter:card', content: twitterCard });
  specs.push({ kind: 'name', key: 'twitter:title', content: title });
  specs.push({ kind: 'name', key: 'twitter:description', content: description });
  if (image) {
    specs.push({ kind: 'name', key: 'twitter:image', content: image });
  }
  return specs;
}
