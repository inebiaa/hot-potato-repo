/** Matches EventCard date display: YYYY-MM-DD → en-US weekday + short month. */
export function formatEventDateDisplay(dateString: string): string {
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const y = parseInt(year, 10);
    const mo = parseInt(month, 10) - 1;
    const d = parseInt(day, 10);
    if (!Number.isNaN(y) && !Number.isNaN(mo) && !Number.isNaN(d)) {
      const date = new Date(y, mo, d);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
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
