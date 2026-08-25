import {
  eventSortKey,
  isEventUpcoming,
} from './eventDates';
import type { Event } from './eventTypes';

/**
 * Same order as the home masonry:
 * upcoming (soonest first), then past (newest past first).
 */
export function compareEventsForFeed(
  a: Pick<Event, 'id' | 'date'>,
  b: Pick<Event, 'id' | 'date'>,
  now: Date = new Date(),
): number {
  const aUp = isEventUpcoming(a.date, now);
  const bUp = isEventUpcoming(b.date, now);
  if (aUp !== bUp) return aUp ? -1 : 1;
  if (aUp) {
    const byDate = eventSortKey(a.date) - eventSortKey(b.date);
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  }
  const byDate = eventSortKey(b.date) - eventSortKey(a.date);
  if (byDate !== 0) return byDate;
  return b.id.localeCompare(a.id);
}

export function mergeEventsByFeedOrder<T extends Pick<Event, 'id' | 'date'>>(
  existing: T[],
  incoming: T[],
  now: Date = new Date(),
): T[] {
  if (incoming.length === 0) return existing;
  const byId = new Map<string, T>();
  for (const row of existing) byId.set(row.id, row);
  for (const row of incoming) byId.set(row.id, row);
  return [...byId.values()].sort((a, b) => compareEventsForFeed(a, b, now));
}
