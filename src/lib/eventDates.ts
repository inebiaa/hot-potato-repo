/**
 * Event `date` values may be:
 * - Plain calendar: `YYYY-MM-DD`
 * - Postgres / JSON: `YYYY-MM-DDT00:00:00.000Z` (UTC midnight) — still a **calendar** day, not a
 *   showtime. If we used `new Date()` on that string, we'd get UTC midnight, which is 5–8 hours
 *   **before** local midnight in the Americas — the countdown would end "early."
 *
 * Calendar-only shows use the user's **local** midnight at the **start** of the listed date:
 * countdown hits 0 and the event becomes past when the clock reaches that local midnight.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** UTC (or offset +00:00) midnight — treat as calendar date, not a venue showtime. */
const ISO_UTC_DATE_MIDNIGHT = /^(\d{4}-\d{2}-\d{2})T00:00:00(\.\d+)?(Z|[+-]00:00)$/;

function parseYmdParts(ymd: string): [number, number, number] | null {
  const parts = ymd.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/**
 * If this row is a calendar date (plain YYYY-MM-DD or UTC-midnight ISO from the DB), returns
 * `YYYY-MM-DD` for local interpretation; otherwise `null` (use full datetime semantics).
 */
export function getCalendarYmd(dateStr: string): string | null {
  const s = dateStr.trim();
  if (DATE_ONLY.test(s)) return s;
  const m = s.match(ISO_UTC_DATE_MIDNIGHT);
  if (m) return m[1];
  return null;
}

/** Local midnight at the start of the listed calendar day. */
function startOfListedLocalDay(ymd: string): Date {
  const p = parseYmdParts(ymd);
  if (!p) return new Date(NaN);
  const [y, m, d] = p;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Instant the countdown counts down to: **local midnight when the listed date begins** for
 * calendar rows; the event instant when a real time is stored (non–UTC-midnight ISO).
 */
export function getCountdownTargetDate(dateStr: string): Date {
  const s = (dateStr || '').trim();
  if (!s) return new Date(NaN);
  const ymd = getCalendarYmd(s);
  if (ymd) return startOfListedLocalDay(ymd);
  return new Date(s);
}

/**
 * True until the countdown reaches zero (calendar: local midnight at start of listed date;
 * datetime: event start time).
 */
export function isEventUpcoming(dateStr: string, now: Date = new Date()): boolean {
  const s = (dateStr || '').trim();
  if (!s) return false;
  const ymd = getCalendarYmd(s);
  if (ymd) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const eventDayStart = startOfListedLocalDay(ymd);
    return eventDayStart.getTime() > startOfToday.getTime();
  }
  return new Date(s).getTime() > now.getTime();
}

/** Chronological sort key (start of listed day for calendar dates; event instant otherwise). */
export function eventSortKey(dateStr: string): number {
  const s = (dateStr || '').trim();
  if (!s) return 0;
  const ymd = getCalendarYmd(s);
  if (ymd) return startOfListedLocalDay(ymd).getTime();
  return new Date(s).getTime();
}
