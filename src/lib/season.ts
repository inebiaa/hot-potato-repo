/**
 * Four equal meteorological seasons (3 months each).
 * Winter Dec–Feb, Spring Mar–May, Summer Jun–Aug, Fall Sep–Nov.
 * Returns "Winter 2024", "Fall 2024", etc. (calendar year of the date).
 */
export function getSeasonFromDate(dateString: string): string {
  const [year, monthStr] = dateString.split('-');
  const month = parseInt(monthStr || '1', 10);
  const y = year || new Date().getFullYear().toString();
  if (month === 12 || month === 1 || month === 2) return `Winter ${y}`;
  if (month >= 3 && month <= 5) return `Spring ${y}`;
  if (month >= 6 && month <= 8) return `Summer ${y}`;
  return `Fall ${y}`;
}

/** Calendar year as YYYY from the date string (ISO prefix), same basis as getSeasonFromDate. */
export function getYearFromDate(dateString: string): string {
  const [y] = (dateString || '').split('-');
  return y && /^\d{4}$/.test(y) ? y : '';
}

/** Order for sorting season names (e.g. "Spring 2024") by calendar date */
export const SEASON_ORDER: Record<string, number> = {
  Winter: 0,
  Spring: 1,
  Summer: 2,
  Fall: 3,
};

export function sortSeasonsByDate(seasons: string[]): string[] {
  return [...seasons].sort((a, b) => {
    const matchA = a.match(/^(.+?)\s+(\d{4})$/) || [null, a, '0'];
    const matchB = b.match(/^(.+?)\s+(\d{4})$/) || [null, b, '0'];
    const yA = parseInt(matchA[2] || '0', 10);
    const yB = parseInt(matchB[2] || '0', 10);
    const seasonA = matchA[1] || a;
    const seasonB = matchB[1] || b;
    if (yA !== yB) return yA - yB;
    return (SEASON_ORDER[seasonA] ?? 99) - (SEASON_ORDER[seasonB] ?? 99);
  });
}
