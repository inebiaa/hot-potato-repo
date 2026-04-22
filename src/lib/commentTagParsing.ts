import { findAccentInsensitiveMatch, normalizeTagNameKey } from './normalize';
import type { Event } from './supabase';
import { getSeasonFromDate } from './season';

/** Tag pill colors aligned with CommentWithTags / EventCard */
export interface CommentTagColors {
  producer_bg_color?: string;
  producer_text_color?: string;
  designer_bg_color?: string;
  designer_text_color?: string;
  model_bg_color?: string;
  model_text_color?: string;
  hair_makeup_bg_color?: string;
  hair_makeup_text_color?: string;
  city_bg_color?: string;
  city_text_color?: string;
  season_bg_color?: string;
  season_text_color?: string;
  header_tags_bg_color?: string;
  header_tags_text_color?: string;
  footer_tags_bg_color?: string;
  footer_tags_text_color?: string;
  optional_tags_bg_color?: string;
  optional_tags_text_color?: string;
}

export interface TagStyleResult {
  value: string;
  bg: string;
  text: string;
}

/** Get styled tag list for an event (for use in RatingModal insert buttons, etc.) */
export function getEventTagStyles(
  event: Event,
  tagColors?: CommentTagColors,
  customPerformerTags: { slug: string; bg_color: string; text_color: string }[] = []
): TagStyleResult[] {
  const tags: TagStyleResult[] = [];
  const add = (value: string, type: string, slug?: string) => {
    if (!value || tags.some((t) => normalizeTagNameKey(t.value) === normalizeTagNameKey(value))) return;
    let bg = '#e5e7eb';
    let text = '#374151';
    if (type === 'producer') {
      bg = tagColors?.producer_bg_color || '#f3f4f6';
      text = tagColors?.producer_text_color || '#374151';
    } else if (type === 'designer') {
      bg = tagColors?.designer_bg_color || '#fef3c7';
      text = tagColors?.designer_text_color || '#b45309';
    } else if (type === 'model') {
      bg = tagColors?.model_bg_color || '#fce7f3';
      text = tagColors?.model_text_color || '#be185d';
    } else if (type === 'hair_makeup') {
      bg = tagColors?.hair_makeup_bg_color || '#f3e8ff';
      text = tagColors?.hair_makeup_text_color || '#7e22ce';
    } else if (type === 'city') {
      bg = tagColors?.city_bg_color || '#dbeafe';
      text = tagColors?.city_text_color || '#1e40af';
    } else if (type === 'season') {
      bg = tagColors?.season_bg_color || '#ffedd5';
      text = tagColors?.season_text_color || '#c2410c';
    } else if (type === 'header_tags') {
      bg = tagColors?.header_tags_bg_color || '#ccfbf1';
      text = tagColors?.header_tags_text_color || '#0f766e';
    } else if (type === 'footer_tags') {
      bg = tagColors?.footer_tags_bg_color || '#d1fae5';
      text = tagColors?.footer_tags_text_color || '#065f46';
    } else if (type === 'custom' && slug) {
      const cp = customPerformerTags.find((c) => c.slug === slug);
      const fallbackBg = tagColors?.optional_tags_bg_color ?? '#e0e7ff';
      const fallbackText = tagColors?.optional_tags_text_color ?? '#3730a3';
      bg = (cp?.bg_color && cp.bg_color) ? cp.bg_color : fallbackBg;
      text = (cp?.text_color && cp.text_color) ? cp.text_color : fallbackText;
    }
    tags.push({ value, bg, text });
  };
  (event.producers || []).forEach((v) => add(v, 'producer'));
  (event.featured_designers || []).forEach((v) => add(v, 'designer'));
  (event.models || []).forEach((v) => add(v, 'model'));
  (event.hair_makeup || []).forEach((v) => add(v, 'hair_makeup'));
  (event.header_tags || []).forEach((v: string) => add(v, 'header_tags'));
  (event.footer_tags || []).forEach((v) => add(v, 'footer_tags'));
  if (event.city) add(event.city, 'city');
  if (event.date) add(getSeasonFromDate(event.date), 'season');
  if (event.custom_tags && typeof event.custom_tags === 'object') {
    Object.entries(event.custom_tags).forEach(([slug, vals]) => {
      (vals || []).forEach((v) => add(v, 'custom', slug));
    });
  }
  return tags;
}

export interface ParsedSegment {
  type: 'text' | 'tag';
  value: string;
  tag?: TagStyleResult;
}

/**
 * Split tag labels only when a single line would be too long (character budget as a
 * simple stand-in for “doesn’t fit”). Uses greedy line-filling: each segment is as
 * long as possible up to `maxLineChars`, breaking at the last space in that window;
 * only hard-splits when there is no space (one very long word/token).
 */
export function splitTagPillLabel(label: string, maxLineChars = 48): string[] {
  const t = label.trim();
  if (!t) return [];
  if (t.length <= maxLineChars) return [t];

  const out: string[] = [];
  let rest = t;
  while (rest.length > 0) {
    if (rest.length <= maxLineChars) {
      out.push(rest);
      break;
    }

    let splitAt = -1;
    const scanEnd = Math.min(maxLineChars, rest.length - 1);
    for (let i = scanEnd; i >= 1; i--) {
      if (rest[i] === ' ') {
        splitAt = i;
        break;
      }
    }

    if (splitAt > 0) {
      const head = rest.slice(0, splitAt).trimEnd();
      const tail = rest.slice(splitAt + 1).trimStart();
      if (head) out.push(head);
      rest = tail;
      if (!rest) break;
    } else {
      out.push(rest.slice(0, maxLineChars));
      rest = rest.slice(maxLineChars).trimStart();
    }
  }
  return out.filter(Boolean);
}

/** Parse comment into segments for display/editing. Uses same logic as CommentWithTags. */
export function parseCommentToSegments(
  comment: string,
  event: Event,
  tagColors?: CommentTagColors,
  customPerformerTags: { slug: string; bg_color: string; text_color: string }[] = []
): ParsedSegment[] {
  const tagStyles = getEventTagStyles(event, tagColors, customPerformerTags);
  if (tagStyles.length === 0) return comment ? [{ type: 'text', value: comment }] : [];
  const tags = tagStyles;
  tags.sort((a, b) => b.value.length - a.value.length);
  const segments: ParsedSegment[] = [];
  let remaining = comment;
  while (remaining.length > 0) {
    let earliest = -1;
    let matchTag: TagStyleResult | null = null;
    let matchLen = 0;
    for (const tag of tags) {
      const found = findAccentInsensitiveMatch(remaining, tag.value, 0);
      if (!found) continue;
      const { index: idx, length: len } = found;
      if (earliest < 0 || idx < earliest || (idx === earliest && len > matchLen)) {
        earliest = idx;
        matchTag = tag;
        matchLen = len;
      }
    }
    if (earliest >= 0 && matchTag) {
      if (earliest > 0) segments.push({ type: 'text', value: remaining.slice(0, earliest) });
      segments.push({ type: 'tag', value: remaining.slice(earliest, earliest + matchLen), tag: matchTag });
      remaining = remaining.slice(earliest + matchLen);
    } else {
      segments.push({ type: 'text', value: remaining });
      remaining = '';
    }
  }
  return segments;
}
