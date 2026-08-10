import { normalizeEventTagArrays } from './eventTagArray';
import type { Event } from './eventTypes';
import type { EventRatingStatRow } from './eventRatingStats';
import type { Rating } from './supabase';

/** How many shows to pull per home-feed request. */
export const FEED_PAGE_SIZE = 24;

/** Keep about this many viewports of content below the fold before pausing prefetch. */
export const FEED_PREFETCH_VIEWPORTS = 3;

/** Columns needed for cards / search — avoid select('*'). */
export const EVENT_FEED_COLUMNS =
  'id, name, date, city, season, show_type, location, formatted_address, image_url, countdown_link, producers, featured_designers, featured_artists, models, hair_makeup, header_tags, footer_tags, custom_tags, custom_tag_meta, created_by, created_at';

export type EventWithStats = Event & {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
};

function parseJsonObjectField<T extends object>(value: unknown, fallback: T): T {
  let parsed: unknown = value ?? null;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return fallback;
    }
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return fallback;
  }
  return parsed as T;
}

/** Normalize a raw events row and attach rating stats. */
export function toEventWithStats(
  event: Event,
  stats?: EventRatingStatRow | null,
  userRating?: Rating,
): EventWithStats {
  const customTags = parseJsonObjectField<Record<string, string[]>>(event.custom_tags, {});
  const customTagMeta = parseJsonObjectField<Record<string, { icon?: string }>>(
    event.custom_tag_meta,
    {},
  );

  return {
    ...normalizeEventTagArrays(event),
    custom_tags: customTags,
    custom_tag_meta: customTagMeta,
    average_rating: stats?.average_rating ?? 0,
    rating_count: stats?.rating_count ?? 0,
    user_rating: userRating,
  };
}

export function mapEventsWithStats(
  rows: Event[],
  statsByEventId: Map<string, EventRatingStatRow>,
  userRatingsByEventId: Map<string, Rating>,
): EventWithStats[] {
  return rows.map((event) =>
    toEventWithStats(event, statsByEventId.get(event.id), userRatingsByEventId.get(event.id)),
  );
}
