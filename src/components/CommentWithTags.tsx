import React from 'react';
import { findAccentInsensitiveMatch, normalizeTagNameKey } from '../lib/normalize';
import { Event } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import { effectiveHeaderTags } from '../lib/eventHeaderTags';
import type { CommentTagColors } from '../lib/commentTagParsing';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';

interface TagStyle {
  value: string;
  bg: string;
  text: string;
  type: string;
  slug?: string;
}

interface CommentWithTagsProps {
  comment: string;
  event: Event;
  tagColors?: CommentTagColors;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  className?: string;
  /** When true, tag pills get the wiggle animation (e.g. when card is in reorder mode) */
  wiggle?: boolean;
  /** When true, tag pill splits follow the card/tag row width (event card). */
  fitTagPillsToContainer?: boolean;
  onTagClick?: (type: string, value: string, displayLabel?: string) => void;
}

export default function CommentWithTags({
  comment,
  event,
  tagColors,
  customPerformerTags = [],
  className = '',
  wiggle = false,
  fitTagPillsToContainer = false,
  onTagClick
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
    tags.push({ value, bg, text, type, slug });
  };

  (event.producers || []).forEach((v) => add(v, 'producer'));
  (event.featured_designers || []).forEach((v) => add(v, 'designer'));
  (event.models || []).forEach((v) => add(v, 'model'));
  (event.hair_makeup || []).forEach((v) => add(v, 'hair_makeup'));
  effectiveHeaderTags(event).forEach((v) => add(v, 'header_tags'));
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
          <button
            type="button"
            key={i}
            data-tag-pill
            className={`${tagPillSplitSegmentGroupClass} p-0 text-xs not-italic font-normal mx-0.5 transition-colors hover:opacity-80 ${onTagClick ? 'cursor-pointer' : ''} ${wiggle ? 'pill-wiggle' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (!onTagClick) return;
              if (seg.tag.type === 'custom' && seg.tag.slug) {
                onTagClick('custom_performer', `${seg.tag.slug}\x00${seg.tag.value}`, seg.value);
                return;
              }
              onTagClick(seg.tag.type, seg.tag.value, seg.value);
            }}
          >
            <TagPillSplitLabel
              fitToContainer={fitTagPillsToContainer}
              text={seg.value}
              segmentColors={{ backgroundColor: seg.tag.bg, color: seg.tag.text }}
            />
          </button>
        ) : (
          <React.Fragment key={i}>{seg.value}</React.Fragment>
        )
      )}
    </span>
  );
}
