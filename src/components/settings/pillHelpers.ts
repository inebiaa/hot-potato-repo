import {
  tagPillSplitSegmentGroupClass,
  type TagPillSegmentColors,
} from '../TagPillSplitLabel';

import type { TagType } from '../../lib/tagIdentity';

export function formatTagTypeLabel(tagType: string): string {
  if (tagType.startsWith('custom:')) {
    const slug = tagType.slice(7) || 'custom';
    return `Custom: ${slug.replace(/-/g, ' ')}`;
  }
  const map: Record<string, string> = {
    producer: 'Producer',
    designer: 'Designer',
    artist: 'Artist',
    model: 'Model',
    hair_makeup: 'Hair & Makeup',
    venue: 'Venue',
    header_tags: 'Genre',
    footer_tags: 'Collection',
  };
  return map[tagType] || tagType;
}

/** Same pattern as App.tsx tag search: "Producer: ", "Designer: ", "Genre: ", etc. */
export function connectSearchTypePrefix(tagType: string): string {
  if (tagType.startsWith('custom:')) return 'Custom: ';
  const map: Record<string, string> = {
    producer: 'Producer',
    designer: 'Designer',
    artist: 'Artist',
    model: 'Model',
    hair_makeup: 'Hair & Makeup',
    venue: 'Venue',
    header_tags: 'Genre',
    footer_tags: 'Collection',
  };
  const label = map[tagType] ?? tagType.replace(/_/g, ' ');
  return `${label}: `;
}

export const CONNECT_CREATE_TYPE_PILLS: { value: TagType; label: string }[] = [
  { value: 'producer', label: 'Producer' },
  { value: 'designer', label: 'Designer' },
  { value: 'artist', label: 'Artist' },
  { value: 'model', label: 'Model' },
  { value: 'hair_makeup', label: 'Hair & Makeup' },
  { value: 'header_tags', label: 'Genre' },
  { value: 'footer_tags', label: 'Collection' },
];

export const CREDIT_PILL_SEGMENT_ACTIVE: TagPillSegmentColors = {
  backgroundColor: '#d1d5db',
  color: '#4b5563',
};
export const CREDIT_PILL_SEGMENT_IDLE: TagPillSegmentColors = {
  backgroundColor: '#e5e7eb',
  color: '#4b5563',
};
/** EventCard-aligned: selected adds ring; fill is on each text chunk via segmentColors. */
export function creditPillClass(active: boolean) {
  return [
    `${tagPillSplitSegmentGroupClass} p-0 max-w-full text-xs transition-colors hover:opacity-80`,
    active ? 'ring-2 ring-neutral-400 ring-offset-1' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function creditPillSegmentColors(active: boolean): TagPillSegmentColors {
  return active ? CREDIT_PILL_SEGMENT_ACTIVE : CREDIT_PILL_SEGMENT_IDLE;
}
