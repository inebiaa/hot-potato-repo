import React from 'react';
import { findAccentInsensitiveMatch, normalizeTagNameKey } from '../lib/normalize';
import { Event } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';

interface TagStyle {
  value: string;
  bg: string;
  text: string;
}

interface CommentWithTagsProps {
  comment: string;
  event: Event;
  tagColors?: {
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
  };
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  className?: string;
  /** When true, tag pills get the wiggle animation (e.g. when card is in reorder mode) */
  wiggle?: boolean;
}

export interface TagStyleResult {
  value: string;
  bg: string;
  text: string;
}

/** Get styled tag list for an event (for use in RatingModal insert buttons, etc.) */
export function getEventTagStyles(
  event: Event,
  tagColors?: CommentWithTagsProps['tagColors'],
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
  (event.genre || event.header_tags || []).forEach((v: string) => add(v, 'header_tags'));
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

/** Parse comment into segments for display/editing. Uses same logic as CommentWithTags. */
export function parseCommentToSegments(
  comment: string,
  event: Event,
  tagColors?: CommentWithTagsProps['tagColors'],
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

export default function CommentWithTags({
  comment,
  event,
  tagColors,
  customPerformerTags = [],
  className = '',
  wiggle = false
}: CommentWithTagsProps) {
  if (!comment || typeof comment !== 'string') return <span className={className}>{comment ?? ''}</span>;
  if (!event || !event.id) return <span className={className}>"{comment}"</span>;

  const tags: TagStyle[] = [];
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
  (event.genre || event.header_tags || []).forEach((v: string) => add(v, 'header_tags'));
  (event.footer_tags || []).forEach((v) => add(v, 'footer_tags'));
  if (event.city) add(event.city, 'city');
  if (event.date) add(getSeasonFromDate(event.date), 'season');
  if (event.custom_tags && typeof event.custom_tags === 'object') {
    Object.entries(event.custom_tags).forEach(([slug, vals]) => {
      (vals || []).forEach((v) => add(v, 'custom', slug));
    });
  }

  // Sort by value length descending so "Dior Homme" matches before "Dior"
  tags.sort((a, b) => b.value.length - a.value.length);

  const segments: { type: 'text' | 'tag'; value: string; tag?: TagStyle }[] = [];
  let remaining = comment;

  while (remaining.length > 0) {
    let earliest = -1;
    let matchTag: TagStyle | null = null;
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
      if (earliest > 0) {
        segments.push({ type: 'text', value: remaining.slice(0, earliest) });
      }
      const matched = remaining.slice(earliest, earliest + matchLen);
      segments.push({ type: 'tag', value: matched, tag: matchTag });
      remaining = remaining.slice(earliest + matchLen);
    } else {
      segments.push({ type: 'text', value: remaining });
      remaining = '';
    }
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === 'tag' && seg.tag ? (
          <span
            key={i}
            data-tag-pill
            className={`inline-flex items-center justify-center text-xs px-2 py-1 rounded-md not-italic font-normal mx-0.5 transition-colors hover:opacity-80 ${wiggle ? 'pill-wiggle' : ''}`}
            style={{ backgroundColor: seg.tag.bg, color: seg.tag.text }}
          >
            {seg.value}
          </span>
        ) : (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        )
      )}
    </span>
  );
}
