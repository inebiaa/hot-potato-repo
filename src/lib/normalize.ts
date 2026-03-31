/**
 * Lowercase and strip combining marks (Unicode NFD). Used for search and tag identity keys
 * so "Jose" matches "José", "Montréal" matches "Montreal", etc.
 */
export function foldCaseAndDiacritics(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Trimmed string for substring search across events, suggestions, and comments. */
export function normalizeForSearch(s: string): string {
  return foldCaseAndDiacritics(s).trim();
}

/**
 * Collapse whitespace, trim, fold case/diacritics — same rules as tag DB keys (`tagIdentity.normalizeTagName`).
 * Use from UI code that must not import `tagIdentity` (avoids pulling in the Supabase client).
 */
export function normalizeTagNameKey(input: string): string {
  return foldCaseAndDiacritics(input.trim())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * First substring of `haystack` (from `startAt`) whose folded form equals `normalizeForSearch(needle)`.
 * Returns indices into the original string so highlights preserve user spelling.
 */
export function findAccentInsensitiveMatch(
  haystack: string,
  needle: string,
  startAt = 0
): { index: number; length: number } | null {
  const nF = normalizeForSearch(needle);
  if (!nF) return null;
  const from = Math.max(0, startAt);
  const h = haystack;
  for (let i = from; i < h.length; i++) {
    for (let j = i + 1; j <= h.length; j++) {
      const sub = h.slice(i, j);
      if (normalizeForSearch(sub) === nF) {
        return { index: i, length: sub.length };
      }
    }
  }
  return null;
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
