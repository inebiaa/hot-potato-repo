import { supabase, type Rating } from './supabase';

export type EventRatingStatRow = {
  event_id: string;
  average_rating: number;
  rating_count: number;
};

/** Per-event avg/count from `event_rating_stats` (no per-rating rows). */
export async function fetchEventRatingStats(): Promise<{
  data: Map<string, EventRatingStatRow>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('event_rating_stats')
    .select('event_id, average_rating, rating_count');

  if (!error) {
    const map = new Map<string, EventRatingStatRow>();
    for (const row of data || []) {
      map.set(row.event_id, {
        event_id: row.event_id,
        average_rating: Number(row.average_rating) || 0,
        rating_count: Number(row.rating_count) || 0,
      });
    }
    return { data: map, error: null };
  }

  // Fallback if migration not applied yet: pull only event_id + rating (no comments).
  const missingView =
    /event_rating_stats|does not exist|schema cache|could not find/i.test(error.message);
  if (!missingView) {
    return { data: new Map(), error: new Error(error.message) };
  }

  const { data: rows, error: fallbackErr } = await supabase
    .from('ratings')
    .select('event_id, rating');

  if (fallbackErr) {
    return { data: new Map(), error: new Error(fallbackErr.message) };
  }

  const sums = new Map<string, { total: number; count: number }>();
  for (const row of rows || []) {
    const cur = sums.get(row.event_id) || { total: 0, count: 0 };
    cur.total += Number(row.rating) || 0;
    cur.count += 1;
    sums.set(row.event_id, cur);
  }

  const map = new Map<string, EventRatingStatRow>();
  for (const [event_id, { total, count }] of sums) {
    map.set(event_id, {
      event_id,
      average_rating: count > 0 ? total / count : 0,
      rating_count: count,
    });
  }
  return { data: map, error: null };
}

/** Current user's ratings only (one row per rated event). */
export async function fetchUserRatingsByEventId(userId: string): Promise<{
  data: Map<string, Rating>;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from('ratings')
    .select('id, event_id, user_id, rating, comment, created_at')
    .eq('user_id', userId);

  if (error) {
    return { data: new Map(), error: new Error(error.message) };
  }

  const map = new Map<string, Rating>();
  for (const row of (data || []) as Rating[]) {
    map.set(row.event_id, row);
  }
  return { data: map, error: null };
}

export async function fetchRatingBundleForEvent(
  eventId: string,
  userId?: string | null
): Promise<{
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
  error: Error | null;
}> {
  const statsPromise = supabase
    .from('event_rating_stats')
    .select('average_rating, rating_count')
    .eq('event_id', eventId)
    .maybeSingle();

  const userPromise = userId
    ? supabase
        .from('ratings')
        .select('id, event_id, user_id, rating, comment, created_at')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [statsRes, userRes] = await Promise.all([statsPromise, userPromise]);

  if (statsRes.error) {
    return {
      average_rating: 0,
      rating_count: 0,
      error: new Error(statsRes.error.message),
    };
  }
  if (userRes.error) {
    return {
      average_rating: 0,
      rating_count: 0,
      error: new Error(userRes.error.message),
    };
  }

  return {
    average_rating: Number(statsRes.data?.average_rating) || 0,
    rating_count: Number(statsRes.data?.rating_count) || 0,
    user_rating: (userRes.data as Rating | null) ?? undefined,
    error: null,
  };
}
