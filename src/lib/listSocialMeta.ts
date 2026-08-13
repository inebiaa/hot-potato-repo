import { appName } from './brandMeta';
import { getRuntimeBrandShareImage, ogImageMimeFromUrl } from './brandSocial';
import { eventAbsoluteImageUrl, type EventJsonLdPrerender } from './eventJsonLd';
import {
  canonicalListUrl,
  canonicalListUrlFromParts,
  publicSiteOrigin,
} from './siteBase';
import type { SocialMetaTagSpec } from './eventSocialMeta';

export { ogImageMimeFromUrl } from './brandSocial';
export const LIST_SOCIAL_ATTR = 'data-secret-blogger-list-social';

export type ListSharePayload = {
  id: string;
  title: string;
  description?: string | null;
  /** Cover or first board event image (may be relative). */
  imageUrl?: string | null;
  /** Public profile handle used in `/:handle/list/:id` URLs. */
  ownerHandle?: string | null;
  /** Display name for titles / author (not the URL handle). */
  ownerUsername?: string | null;
  eventCount?: number;
};

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function buildListOgDescription(list: ListSharePayload, maxLen = 200): string {
  const custom = list.description?.trim();
  if (custom) {
    if (custom.length <= maxLen) return custom;
    return `${custom.slice(0, Math.max(1, maxLen - 1))}…`;
  }
  const bits: string[] = [];
  if (typeof list.eventCount === 'number' && list.eventCount >= 0) {
    bits.push(list.eventCount === 1 ? '1 show' : `${list.eventCount} shows`);
  }
  const handle = list.ownerHandle?.trim() || list.ownerUsername?.trim();
  if (handle) bits.push(`curated by @${handle}`);
  const line = bits.length > 0 ? bits.join(' · ') : `A shared list on ${appName()}`;
  if (line.length <= maxLen) return line;
  return `${line.slice(0, Math.max(1, maxLen - 1))}…`;
}

function listShareImageUrl(
  list: ListSharePayload,
  prerender?: EventJsonLdPrerender & { brandImageUrl?: string; shareImageUrl?: string },
): string | undefined {
  const mirrored = prerender?.shareImageUrl?.trim();
  if (mirrored) return mirrored;
  const fromList = eventAbsoluteImageUrl(list.imageUrl, prerender);
  if (fromList) return fromList;
  const brand = prerender?.brandImageUrl?.trim() || getRuntimeBrandShareImage();
  if (brand) return brand;
  return undefined;
}

function listCanonical(
  list: ListSharePayload,
  prerender?: EventJsonLdPrerender,
): string {
  const handle = (list.ownerHandle || '').trim();
  if (!handle) {
    // Fallback only if handle missing (should not ship in prerender).
    const origin = prerender
      ? prerender.siteOrigin.replace(/\/$/, '')
      : publicSiteOrigin();
    return `${origin}/list/${list.id}`;
  }
  return prerender
    ? canonicalListUrlFromParts(handle, list.id, prerender.siteOrigin, prerender.viteBase)
    : canonicalListUrl(handle, list.id);
}

/** Open Graph / Twitter tags for shared library lists. */
export function buildListSocialMetaTagsHtml(
  list: ListSharePayload,
  prerender?: EventJsonLdPrerender & { brandImageUrl?: string; shareImageUrl?: string },
): string {
  const canonical = listCanonical(list, prerender);
  const title = list.title.trim() || 'Shared list';
  const description = buildListOgDescription(list);
  const image = listShareImageUrl(list, prerender);

  const titleEsc = escapeHtmlAttr(title);
  const descEsc = escapeHtmlAttr(description);
  const urlEsc = escapeHtmlAttr(canonical);
  const siteNameEsc = escapeHtmlAttr(appName());
  const sb = `${LIST_SOCIAL_ATTR}=""`;

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
    const imgEsc = escapeHtmlAttr(image);
    lines.push(`<meta property="og:image" content="${imgEsc}" ${sb} />`);
    lines.push(`<meta property="og:image:secure_url" content="${imgEsc}" ${sb} />`);
    if (mime) lines.push(`<meta property="og:image:type" content="${mime}" ${sb} />`);
    lines.push(`<meta property="og:image:alt" content="${titleEsc}" ${sb} />`);
    lines.push(`<meta name="twitter:card" content="summary_large_image" ${sb} />`);
    lines.push(`<meta name="twitter:title" content="${titleEsc}" ${sb} />`);
    lines.push(`<meta name="twitter:description" content="${descEsc}" ${sb} />`);
    lines.push(`<meta name="twitter:image" content="${imgEsc}" ${sb} />`);
  }
  return lines.map((l) => `  ${l}`).join('\n');
}

export function buildListSocialMetaTagSpecs(
  list: ListSharePayload,
  prerender?: EventJsonLdPrerender & { brandImageUrl?: string; shareImageUrl?: string },
): SocialMetaTagSpec[] {
  const canonical = listCanonical(list, prerender);
  const title = list.title.trim() || 'Shared list';
  const description = buildListOgDescription(list);
  const image = listShareImageUrl(list, prerender);
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
    specs.push({ kind: 'name', key: 'twitter:card', content: 'summary_large_image' });
    specs.push({ kind: 'name', key: 'twitter:title', content: title });
    specs.push({ kind: 'name', key: 'twitter:description', content: description });
    specs.push({ kind: 'name', key: 'twitter:image', content: image });
  }
  return specs;
}

export function buildListJsonLd(
  list: ListSharePayload,
  prerender?: EventJsonLdPrerender,
): Record<string, unknown> {
  const url = listCanonical(list, prerender);
  const image = listShareImageUrl(list, prerender ? { ...prerender } : undefined);
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: list.title.trim() || 'Shared list',
    description: buildListOgDescription(list),
    url,
  };
  if (image) jsonLd.image = image;
  const authorName = list.ownerUsername?.trim() || list.ownerHandle?.trim();
  if (authorName) {
    jsonLd.author = {
      '@type': 'Person',
      name: authorName,
    };
  }
  return jsonLd;
}

export function listJsonLdScriptContent(list: ListSharePayload): string {
  return JSON.stringify(buildListJsonLd(list));
}

export function listJsonLdScriptContentPrerender(
  list: ListSharePayload,
  prerender: EventJsonLdPrerender & { brandImageUrl?: string; shareImageUrl?: string },
): string {
  return JSON.stringify(buildListJsonLd(list, prerender));
}
