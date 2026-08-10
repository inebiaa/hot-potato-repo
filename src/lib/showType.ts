import type { ShowType } from './eventTypes';

export type { ShowType };

const SHOW_TYPE_LABELS: Record<ShowType, string> = {
  fashion: 'Fashion',
  music: 'Music',
};

/** Coerce unknown/null/legacy values to a valid show type (default fashion). */
export function normalizeShowType(value: unknown): ShowType {
  return value === 'music' ? 'music' : 'fashion';
}

export function showTypeLabel(value: unknown): string {
  return SHOW_TYPE_LABELS[normalizeShowType(value)];
}

export const SHOW_TYPE_OPTIONS: { value: ShowType; label: string }[] = [
  { value: 'fashion', label: 'Fashion' },
  { value: 'music', label: 'Music' },
];

/** Fixed pill colors for the show-type badge on event cards. */
export function showTypePillColors(value: unknown): { backgroundColor: string; color: string } {
  if (normalizeShowType(value) === 'music') {
    return { backgroundColor: '#d1fae5', color: '#065f46' };
  }
  return { backgroundColor: '#fce7f3', color: '#9d174d' };
}

/** Card / form label for starring credits (designers or artists). */
export function featuredCreditLabel(_value?: unknown): string {
  return 'Starring';
}

export function featuredCreditPlaceholder(value: unknown): string {
  return normalizeShowType(value) === 'music'
    ? 'e.g., Artist Name, Band Name'
    : 'e.g., Valentino, Gucci, Alexander McQueen';
}

/** Event column used for Starring, by show type. */
export function starringColumn(value: unknown): 'featured_artists' | 'featured_designers' {
  return normalizeShowType(value) === 'music' ? 'featured_artists' : 'featured_designers';
}

/** Tag identity type for Starring, by show type. */
export function starringTagType(value: unknown): 'artist' | 'designer' {
  return normalizeShowType(value) === 'music' ? 'artist' : 'designer';
}
