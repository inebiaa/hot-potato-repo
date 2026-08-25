import {
  addCalendarMonthsYmd,
  isEventUpcoming,
  localCalendarYmd,
} from './eventDates';
import { normalizeEventTagArrays } from './eventTagArray';
import type { Event } from './eventTypes';
import { fetchRatingBundleForEvent, type EventRatingStatRow } from './eventRatingStats';
import { supabase, type Rating } from './supabase';
import { compareEventsForFeed, mergeEventsByFeedOrder } from './eventsFeedOrder';

export { compareEventsForFeed, mergeEventsByFeedOrder } from './eventsFeedOrder';

/** How many past shows to pull per home-feed request. */
export const FEED_PAGE_SIZE = 24;

/** Keep about this many viewports of content below the fold before pausing prefetch. */
export const FEED_PREFETCH_VIEWPORTS = 3;

/** Browse feed only lists upcoming shows within this many months; farther dates stay searchable. */
export const FEED_UPCOMING_HORIZON_MONTHS = 6;

export function feedUpcomingHorizonYmd(todayYmd: string = localCalendarYmd()): string {
  return addCalendarMonthsYmd(todayYmd, FEED_UPCOMING_HORIZON_MONTHS);
}

/** Columns needed for cards / search — avoid select('*'). */
export const EVENT_FEED_COLUMNS =
  'id, name, date, city, season, show_type, location, formatted_address, image_url, countdown_link, producers, featured_designers, featured_artists, hair_makeup, header_tags, footer_tags, custom_tags, custom_tag_meta, created_by, created_at';

export type EventWithStats = Event & {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
};

/** Local calendar YYYY-MM-DD (matches `isEventUpcoming` day math). */
export function localYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First calendar day that counts as upcoming (tomorrow). */
export function upcomingFromYmd(now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1);
  return localYmd(start);
}

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

/** One show with ratings. Overlay, embed, and deep links use this instead of the home feed. */
export async function fetchEventWithStats(
  eventId: string,
  userId?: string,
): Promise<{ data: EventWithStats | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FEED_COLUMNS)
    .eq('id', eventId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  if (!data) return { data: null, error: null };
  const bundle = await fetchRatingBundleForEvent(data.id, userId);
  if (bundle.error) return { data: null, error: bundle.error };
  return {
    data: toEventWithStats(
      data as Event,
      {
        event_id: data.id,
        average_rating: bundle.average_rating,
        rating_count: bundle.rating_count,
      },
      bundle.user_rating,
    ),
    error: null,
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

type FeedQueryResult = { data: Event[]; error: Error | null };

/**
 * Upcoming shows for the home browse feed: soonest first, capped at the 6-month horizon.
 * Pass `{ withinHorizon: false }` to load every future date (search/tag catalog).
 */
export async function fetchUpcomingEvents(opts?: {
  withinHorizon?: boolean;
}): Promise<FeedQueryResult> {
  const withinHorizon = opts?.withinHorizon ?? true;
  const fromYmd = upcomingFromYmd();
  const horizonYmd = feedUpcomingHorizonYmd();
  const pageSize = 100;
  const all: Event[] = [];
  let from = 0;

  for (;;) {
    let query = supabase
      .from('events')
      .select(EVENT_FEED_COLUMNS)
      .gte('date', fromYmd)
      .order('date', { ascending: true })
      .order('id', { ascending: true });
    if (withinHorizon) {
      query = query.lte('date', horizonYmd);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) return { data: [], error: new Error(error.message) };
    const rows = (data || []) as Event[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

/** Upcoming shows after the browse horizon (for search/tag hydration). */
export async function fetchBeyondHorizonUpcomingEvents(): Promise<FeedQueryResult> {
  const horizonYmd = feedUpcomingHorizonYmd();
  const pageSize = 100;
  const all: Event[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_FEED_COLUMNS)
      .gt('date', horizonYmd)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) return { data: [], error: new Error(error.message) };
    const rows = (data || []) as Event[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { data: all, error: null };
}

/** Every event, paged. For stats and other pages that are not the home browse feed. */
export async function fetchAllEvents(): Promise<FeedQueryResult> {
  const pageSize = 100;
  const all: Event[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_FEED_COLUMNS)
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return { data: [], error: new Error(error.message) };
    const rows = (data || []) as Event[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { data: all.map((event) => normalizeEventTagArrays(event)), error: null };
}

/** Events by id, chunked. For profile library search (saved shows only). */
export async function fetchEventsByIds(ids: string[]): Promise<FeedQueryResult> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return { data: [], error: null };
  const pageSize = 100;
  const all: Event[] = [];
  for (let i = 0; i < unique.length; i += pageSize) {
    const chunk = unique.slice(i, i + pageSize);
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_FEED_COLUMNS)
      .in('id', chunk);
    if (error) return { data: [], error: new Error(error.message) };
    all.push(...((data || []) as Event[]));
  }
  return { data: all.map((event) => normalizeEventTagArrays(event)), error: null };
}

/** One page of past/today shows, newest first. */
export async function fetchPastEventsPage(offset: number, pageSize = FEED_PAGE_SIZE): Promise<FeedQueryResult & { hasMore: boolean }> {
  const fromYmd = upcomingFromYmd();
  const to = offset + pageSize - 1;
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_FEED_COLUMNS)
    .lt('date', fromYmd)
    .order('date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, to);

  if (error) return { data: [], error: new Error(error.message), hasMore: false };
  const rows = (data || []) as Event[];
  return { data: rows, error: null, hasMore: rows.length === pageSize };
}
