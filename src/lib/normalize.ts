/** Remove accents/diacritics for search (é→e, ñ→n, etc.) */
export function normalizeForSearch(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Check if tag matches query: each query word must match start of some tag word (accent-insensitive) */
export function tagMatchesQuery(tag: string, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const tagNorm = normalizeForSearch(tag);
  const queryWords = q.split(/\s+/).filter(Boolean);
  const tagWords = tagNorm.split(/\s+/).filter(Boolean);
  return queryWords.every((qw) =>
    tagWords.some((tw) => tw.startsWith(qw))
  );
}
