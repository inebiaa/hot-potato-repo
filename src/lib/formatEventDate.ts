import { getCalendarYmd } from './eventDates';
import { normalizeForSearch } from './normalize';
import { getYearFromDate } from './season';

function localDateFromYmd(ymd: string): Date | null {
  const parts = ymd.split('-');
  if (parts.length !== 3) return null;
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(mo) || Number.isNaN(d)) return null;
  const date = new Date(y, mo, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Matches EventCard date display: YYYY-MM-DD → en-US weekday + short month. */
export function formatEventDateDisplay(dateString: string): string {
  const ymd = getCalendarYmd(dateString.trim()) ?? dateString.trim().slice(0, 10);
  const fromYmd = localDateFromYmd(ymd);
  if (fromYmd) {
    return fromYmd.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  try {
    const dt = new Date(dateString);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  } catch {
    /* fall through */
  }
  return dateString;
}

/**
 * Stable calendar key for date filters / search chips (`YYYY-MM-DD` when possible).
 */
export function eventDateFilterValue(dateString: string): string {
  const s = (dateString || '').trim();
  if (!s) return '';
  return getCalendarYmd(s) ?? (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s);
}

/**
 * Forms of an event date that free-text search can match (card display, long month,
 * ISO / numeric spellings, year).
 */
export function eventDateSearchHaystacks(dateString: string): string[] {
  const s = (dateString || '').trim();
  if (!s) return [];
  const out = new Set<string>([s, formatEventDateDisplay(s)]);
  const ymd = getCalendarYmd(s) ?? (/^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);
  if (ymd) {
    out.add(ymd);
    out.add(ymd.replace(/-/g, '/'));
    const date = localDateFromYmd(ymd);
    if (date) {
      out.add(
        date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const mm = String(month).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      out.add(`${month}/${day}/${year}`);
      out.add(`${month}/${day}`);
      out.add(`${mm}/${dd}/${year}`);
      out.add(`${mm}/${dd}`);
    }
    const year = getYearFromDate(ymd);
    if (year) out.add(year);
  }
  return [...out];
}

/**
 * Collapse date punctuation so "aug 1 2026" matches "Sun, Aug 1, 2026".
 */
function foldDateSearch(s: string): string {
  return normalizeForSearch(s)
    .replace(/[,/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True if `queryNorm` (from normalizeForSearch) matches any date search form. */
export function eventDateMatchesSearch(dateString: string, queryNorm: string): boolean {
  if (!queryNorm) return false;
  const q = foldDateSearch(queryNorm);
  if (!q) return false;
  const qWords = q.split(' ').filter(Boolean);
  return eventDateSearchHaystacks(dateString).some((h) => {
    const folded = foldDateSearch(h);
    if (folded.includes(q)) return true;
    // Word match (order-independent): "1 aug 2026" still hits the display date
    const hWords = folded.split(' ').filter(Boolean);
    return qWords.every((qw) => hWords.some((hw) => hw === qw || hw.startsWith(qw)));
  });
}
