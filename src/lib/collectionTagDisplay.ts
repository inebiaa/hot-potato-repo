/**
 * Shorten event.name for display using only that event's footer_tags as the allowlist
 * of abbreviations (initials, season-aware tags, CoF-style, ordered subsequence for creative tags).
 *
 * Does not rely on ":" punctuation — season+year is found anywhere in the title.
 */

const SMALL_WORDS = new Set([
  'of',
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'in',
  'on',
  'at',
]);

/** First alphanumeric char per word; small words contribute lowercase. */
function cofStyleAcronym(words: string[]): string {
  let s = '';
  for (const w of words) {
    const m = w.match(/[A-Za-z0-9]/);
    if (!m) continue;
    const letters = w.toLowerCase().replace(/[^a-z]/g, '');
    if (SMALL_WORDS.has(letters)) s += m[0].toLowerCase();
    else s += m[0].toUpperCase();
  }
  return s;
}

/** All-caps initials from first alphanumeric of each word. */
function upperInitials(words: string[]): string {
  return words
    .map((w) => {
      const m = w.match(/[A-Za-z0-9]/);
      return m ? m[0].toUpperCase() : '';
    })
    .join('');
}

function tokenizeClause(clause: string): string[] {
  return clause.trim().split(/\s+/).filter(Boolean);
}

function normYear(y: string): string {
  const d = y.replace(/^'/, '').trim();
  if (d.length === 4) return d.slice(2);
  return d;
}

function yearsMatch(a: string, b: string): boolean {
  return normYear(a) === normYear(b);
}

type SeasonKind = 'ss' | 'fw';

function seasonTokenToKind(tok: string): SeasonKind | null {
  const t = tok.toLowerCase().replace(/\s+/g, '');
  if (t === 's/s' || t === 'ss' || t === 'spring' || t === 'summer') return 'ss';
  if (t === 'f/w' || t === 'fw' || t === 'fall' || t === 'winter' || t === 'autumn') return 'fw';
  return null;
}

/** First Spring/Summer/…/SS/FW + year anywhere in the string. */
function findFirstSeasonYearInName(name: string): { index: number; end: number; kind: SeasonKind; year: string } | null {
  const re = /\b(Spring|Summer|Fall|Winter|Autumn|SS|FW|S\/S|F\/W)\s*'?\s*(\d{2,4})\b/gi;
  const m = re.exec(name);
  if (!m) return null;
  const kind = seasonTokenToKind(m[1]);
  if (!kind) return null;
  return { index: m.index, end: m.index + m[0].length, kind, year: m[2] };
}

/** Parsed seasoned footer: SS/FW style vs spelled Spring/Fall/… — used for tie-break. */
interface ParsedSeasonedFooter {
  base: string;
  kind: SeasonKind;
  year: string;
  /** True when season token is SS/FW (not spelled-out Spring/Fall, …). */
  isSsFwStyle: boolean;
}

/** Parse "DFW SS '21", "ABQFW SS '28", or "DFW Fall 2025" / "DFW Spring '26". */
function parseSeasonedFooterTag(tag: string): ParsedSeasonedFooter | null {
  const t = tag.trim();
  const m1 = t.match(/^([A-Za-z0-9]+)\s+(SS|FW|S\/S|F\/W)\s*'?\s*(\d{2,4})\b/i);
  if (m1) {
    const kind = seasonTokenToKind(m1[2]);
    if (!kind) return null;
    return { base: m1[1], kind, year: m1[3], isSsFwStyle: true };
  }
  const m2 = t.match(
    /^([A-Za-z0-9]+)\s+(Spring|Summer|Fall|Winter|Autumn)\s*'?\s*(\d{2,4})\b/i
  );
  if (m2) {
    const kind = seasonTokenToKind(m2[2]);
    if (!kind) return null;
    return { base: m2[1], kind, year: m2[3], isSsFwStyle: false };
  }
  return null;
}

function baseMatchesClause(base: string, words: string[]): boolean {
  const u = upperInitials(words);
  const c = cofStyleAcronym(words);
  const b = base.toLowerCase();
  return b === u.toLowerCase() || b === c.toLowerCase();
}

/** Ordered subsequence: tag letters/digits appear in order in name (normalized). */
export function tagMatchesNameSubsequence(tag: string, name: string): boolean {
  const normTag = tag.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (normTag.length < 2) return false;
  const normName = name.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  let i = 0;
  for (const ch of normTag) {
    const j = normName.indexOf(ch, i);
    if (j < 0) return false;
    i = j + 1;
  }
  return true;
}

/** Match footer seasoned tags to collection words before first season+year in name. */
function trySeasonedSpan(name: string, tags: string[]): string | null {
  const sy = findFirstSeasonYearInName(name);
  if (!sy) return null;

  const before = name.slice(0, sy.index).trimEnd();
  const words0 = tokenizeClause(before);
  if (words0.length < 2) return null;

  const matches: { tag: string; p: ParsedSeasonedFooter }[] = [];
  for (const tag of tags) {
    const p = parseSeasonedFooterTag(tag);
    if (!p) continue;
    if (!baseMatchesClause(p.base, words0)) continue;
    if (p.kind !== sy.kind || !yearsMatch(p.year, sy.year)) continue;
    matches.push({ tag, p });
  }
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (a.p.isSsFwStyle !== b.p.isSsFwStyle) return a.p.isSsFwStyle ? -1 : 1;
    return b.tag.length - a.tag.length;
  });

  const best = matches[0].tag;
  // Season/year is already encoded in the winning footer tag; skip duplicate season text from the name.
  const rest = name.slice(sy.end).trim();
  return rest ? `${best} ${rest}` : best;
}

/**
 * Single-token footer tags (DFW, MW): replace longest matching word-prefix with tag.
 * If a season+year exists in the name, only the words *before* it are used for initials;
 * tail is kept from the season token onward (so DFW + Spring '26 … without requiring ':').
 */
function tryInitialsPrefix(name: string, tags: string[]): string | null {
  const singles = tags.map((t) => t.trim()).filter((t) => t.length > 0 && !/\s/.test(t));
  if (singles.length === 0) return null;

  const sy = findFirstSeasonYearInName(name);

  if (sy) {
    const before = name.slice(0, sy.index).trimEnd();
    const words = tokenizeClause(before);
    if (words.length < 2) return null;
    for (let k = words.length; k >= 2; k--) {
      const wk = words.slice(0, k);
      const u = upperInitials(wk);
      const c = cofStyleAcronym(wk);
      const hits = singles.filter(
        (t) => t.toLowerCase() === u.toLowerCase() || t.toLowerCase() === c.toLowerCase()
      );
      if (hits.length === 1) {
        const tail = name.slice(sy.index).trim();
        return tail ? `${hits[0]} ${tail}` : hits[0];
      }
    }
    return null;
  }

  const words = tokenizeClause(name);
  if (words.length < 2) return null;
  for (let k = words.length; k >= 2; k--) {
    const wk = words.slice(0, k);
    const u = upperInitials(wk);
    const c = cofStyleAcronym(wk);
    const hits = singles.filter(
      (t) => t.toLowerCase() === u.toLowerCase() || t.toLowerCase() === c.toLowerCase()
    );
    if (hits.length === 1) {
      const tail = words.slice(k).join(' ').trim();
      return tail ? `${hits[0]} ${tail}` : hits[0];
    }
  }
  return null;
}

/** Tags that look “creative” (mixed case / digits / long) — avoids DFW matching random titles via subsequence. */
function allowSubsequenceHeuristic(tag: string): boolean {
  const t = tag.trim();
  if (t.length < 3) return false;
  if (/[a-z]/.test(t) || /\d/.test(t)) return true;
  return t.length >= 5;
}

/** Whole-name replacement when exactly one tag matches subsequence and name is clearly longer. */
function trySubsequenceWholeName(name: string, tags: string[]): string | null {
  if (name.length < 12) return null;

  const hits = tags.filter((t) => {
    const tr = t.trim();
    if (tr.length < 2 || tr.length + 8 >= name.length) return false;
    if (!allowSubsequenceHeuristic(tr)) return false;
    return tagMatchesNameSubsequence(tr, name);
  });

  if (hits.length !== 1) return null;
  return hits[0].trim();
}

export function shortenEventNameUsingFooterTags(
  eventName: string,
  footerTags: string[] | null | undefined
): string {
  if (!eventName?.trim() || !footerTags?.length) return eventName;

  const tags = [...new Set(footerTags.map((t) => t.trim()).filter(Boolean))];
  if (tags.length === 0) return eventName;

  const a = trySeasonedSpan(eventName, tags);
  if (a) return a;

  const c = tryInitialsPrefix(eventName, tags);
  if (c) return c;

  const e = trySubsequenceWholeName(eventName, tags);
  if (e) return e;

  return eventName;
}
