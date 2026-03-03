/** Jan–May = Spring, Jun–Jul = Summer, Aug–Dec = Fall */
export function getSeasonFromDate(dateString: string): 'Spring' | 'Summer' | 'Fall' {
  const [year, monthStr] = dateString.split('-');
  const month = parseInt(monthStr || '1', 10);
  if (month >= 1 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 7) return 'Summer';
  return 'Fall';
}

/** Order for sorting seasons by calendar date (Spring → Summer → Fall) */
export const SEASON_ORDER: Record<string, number> = { Spring: 0, Summer: 1, Fall: 2 };

export function sortSeasonsByDate(seasons: string[]): string[] {
  return [...seasons].sort((a, b) => (SEASON_ORDER[a] ?? 99) - (SEASON_ORDER[b] ?? 99));
}
