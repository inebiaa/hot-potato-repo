/**
 * Canonical tag pill metrics — EventCard, TagInput, and TagPillSplitLabel must share these
 * so add-form chips and feed pills stay the same size/shape.
 */
export const TAG_PILL_SIZE_CLASS = 'rounded-md px-2 py-1 text-xs';

/** One solid pill shell (icon + label) — city/season/header. */
export const tagPillShellClass = `inline-flex max-w-full min-w-0 items-center gap-1 ${TAG_PILL_SIZE_CLASS}`;

/** Per-chunk mini-pill inside TagPillSplitLabel when `segmentColors` is set. */
export const tagPillSegmentShellClass = `inline-flex whitespace-nowrap ${TAG_PILL_SIZE_CLASS}`;

/** Neutral grey fill for editable TagInput chips (same segment shell as EventCard). */
export const TAG_INPUT_EDIT_PILL_COLORS = {
  backgroundColor: '#e5e5e5',
  color: '#404040',
} as const;