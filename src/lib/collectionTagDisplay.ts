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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * If the first whitespace-separated token of `tail` equals the footer tag (case-insensitive),
 * drop it — titles often spell an acronym in words and repeat the stylized token once.
 */
function stripLeadingDuplicateTagToken(tail: string, tag: string): string {
  const t = tag.trim();
  if (!t) return tail;
  const trimmed = tail.trim();
  if (!trimmed) return tail;
  const m = /^(\S+)/.exec(trimmed);
  if (!m || m[1].toLowerCase() !== t.toLowerCase()) return tail;
  return trimmed.slice(m[0].length).trim();
}

/** Exclusive index after the whitespace-delimited word containing `name[idx]`. */
function exclusiveEndAfterWordContaining(name: string, idx: number): number {
  if (idx < 0 || idx >= name.length) return name.length;
  let end = idx;
  while (end < name.length && !/\s/.test(name[end])) end++;
  return end;
}

/**
 * If `tag` appears as a whole token (word boundaries), return text after its **last**
 * occurrence so the acronym token is fully “finished” before any following words.
 */
function suffixAfterWholeTagToken(tag: string, name: string): string | null {
  const t = tag.trim();
  if (t.length < 2) return null;
  const re = new RegExp(`\\b${escapeRegex(t)}\\b`, 'gi');
  let lastEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name)) !== null) {
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < 0) return null;
  return name.slice(lastEnd).trim();
}

/**
 * Rightmost subsequence embedding of `tag` in `name` (same chars as
 * {@link tagMatchesNameSubsequence}, but prefers the latest match so an early letter
 * does not steal from a later real acronym token), then cut after the word that holds
 * the last matched character.
 */
function suffixAfterLatestSubsequenceMatch(tag: string, name: string): string | null {
  const normTag = tag.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (normTag.length < 2) return null;
  const chars: { idx: number; ch: string }[] = [];
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if (/[A-Za-z0-9]/.test(c)) {
      chars.push({ idx: i, ch: c.toLowerCase() });
    }
  }
  let ti = normTag.length - 1;
  /** Forward last index of the embedding (the tag’s last letter in the title). */
  let lastCharIdx = -1;
  for (let ci = chars.length - 1; ci >= 0 && ti >= 0; ci--) {
    if (chars[ci].ch === normTag[ti]) {
      if (ti === normTag.length - 1) {
        lastCharIdx = chars[ci].idx;
      }
      ti--;
    }
  }
  if (ti >= 0) return null;
  if (lastCharIdx < 0) return null;
  const end = exclusiveEndAfterWordContaining(name, lastCharIdx);
  return name.slice(end).trim();
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
 * “Creative” footer tags (mixed case, digits, or long tokens) — matched by ordered
 * subsequence in the title, not by the initials-of-words shortcut, so every letter
 * in the tag (including new ones like iF in iW2BiF) maps onto characters in {@link name}.
 *
 * This is a property of the tag string alone; it does not depend on footer list order.
 */
function allowSubsequenceHeuristic(tag: string): boolean {
  const t = tag.trim();
  if (t.length < 3) return false;
  if (/[a-z]/.test(t) || /\d/.test(t)) return true;
  return t.length >= 5;
}

/** True if the footer tag should use subsequence-style matching (vs initials-of-words). */
export function isCreativeFooterTag(tag: string): boolean {
  return allowSubsequenceHeuristic(tag.trim());
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
        if (allowSubsequenceHeuristic(hits[0])) continue;
        const tail = stripLeadingDuplicateTagToken(name.slice(sy.index).trim(), hits[0]);
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
      if (allowSubsequenceHeuristic(hits[0])) continue;
      const tail = stripLeadingDuplicateTagToken(words.slice(k).join(' ').trim(), hits[0]);
      return tail ? `${hits[0]} ${tail}` : hits[0];
    }
  }
  return null;
}

/** When exactly one creative tag matches as subsequence, show tag + remainder of title (like initials + tail). */
function trySubsequenceWholeName(name: string, tags: string[]): string | null {
  if (name.length < 12) return null;

  const hits = tags.filter((t) => {
    const tr = t.trim();
    if (tr.length < 2 || tr.length + 8 >= name.length) return false;
    if (!allowSubsequenceHeuristic(tr)) return false;
    return tagMatchesNameSubsequence(tr, name);
  });

  if (hits.length !== 1) return null;
  const tag = hits[0].trim();
  const suffix =
    suffixAfterWholeTagToken(tag, name) ?? suffixAfterLatestSubsequenceMatch(tag, name);
  if (suffix === null) return tag;
  return suffix ? `${tag} ${suffix}` : tag;
}

/**
 * Tail after matching {@link tag} to the start of {@link name} via initials / CoF-style
 * (same rules as {@link tryInitialsPrefix}, but only for this tag).
 */
function consumeInitialsPrefixForTag(name: string, tag: string): string | null {
  const t = tag.trim();
  if (!t || allowSubsequenceHeuristic(t)) return null;

  const sy = findFirstSeasonYearInName(name);
  if (sy) {
    const before = name.slice(0, sy.index).trimEnd();
    const words = tokenizeClause(before);
    if (words.length < 2) return null;
    for (let k = words.length; k >= 2; k--) {
      const wk = words.slice(0, k);
      const u = upperInitials(wk);
      const c = cofStyleAcronym(wk);
      if (t.toLowerCase() !== u.toLowerCase() && t.toLowerCase() !== c.toLowerCase()) continue;
      return stripLeadingDuplicateTagToken(name.slice(sy.index).trim(), t);
    }
    return null;
  }

  const words = tokenizeClause(name);
  if (words.length < 2) return null;
  for (let k = words.length; k >= 2; k--) {
    const wk = words.slice(0, k);
    const u = upperInitials(wk);
    const c = cofStyleAcronym(wk);
    if (t.toLowerCase() !== u.toLowerCase() && t.toLowerCase() !== c.toLowerCase()) continue;
    return stripLeadingDuplicateTagToken(words.slice(k).join(' ').trim(), t);
  }
  return null;
}

/** Remaining text after a creative footer tag match in {@link name} (whole token or latest subsequence + word end). */
function consumeCreativeTagForTag(name: string, tag: string): string | null {
  const t = tag.trim();
  if (!allowSubsequenceHeuristic(t)) return null;
  if (t.length < 2 || t.length + 8 >= name.length) return null;
  if (!tagMatchesNameSubsequence(t, name)) return null;
  return suffixAfterWholeTagToken(t, name) ?? suffixAfterLatestSubsequenceMatch(t, name);
}

/**
 * Creative acronym must **start** at the current segment: first alphanumeric of the remainder
 * matches the tag’s first alphanumeric. Otherwise a creative tag could match too late in the string.
 * Order of tags in the footer list does not matter; this only gates whether we may consume here.
 */
function creativeMatchesAtCurrentSegmentStart(remaining: string, tag: string): boolean {
  const t = tag.trim();
  if (!allowSubsequenceHeuristic(t)) return false;
  const normTag = t.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (normTag.length < 1) return false;
  const trimmed = remaining.trimStart();
  let fc: string | null = null;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (/[A-Za-z0-9]/.test(c)) {
      fc = c.toLowerCase();
      break;
    }
  }
  if (fc === null) return false;
  if (fc !== normTag[0]) return false;
  return tagMatchesNameSubsequence(t, trimmed);
}

/** First index of each tag in the footer list (for tie-breaks only). */
function footerTagOrderIndex(tagsOrdered: string[]): Map<string, number> {
  const m = new Map<string, number>();
  tagsOrdered.forEach((raw, i) => {
    const k = raw.trim().toLowerCase();
    if (k && !m.has(k)) m.set(k, i);
  });
  return m;
}

/**
 * Multiple footer tags: walk the title **left to right**. At each step, every unused tag is
 * tried on the current remainder — basic tags via initials, creative tags via subsequence only
 * if they match at the segment start. Among matches, the **earliest-listed** tag in the footer
 * wins (tie-break). Output order follows **title order**, not footer order.
 *
 * Tags that never match a segment (extra/noise footers like ABQSF) are **omitted** — we stop
 * when nothing matches, not when every footer tag has been consumed.
 */
function shortenMultiFooterTagsGreedy(eventName: string, tagsOrdered: string[]): string | null {
  if (tagsOrdered.length < 2) return null;

  const orderIdx = footerTagOrderIndex(tagsOrdered);
  const tagKey = (s: string) => s.trim().toLowerCase();
  const used = new Set<string>();

  let remaining = eventName.trim();
  const out: string[] = [];

  while (true) {
    remaining = remaining.trimStart();
    if (!remaining) break;

    type Cand = { tag: string; next: string; idx: number };
    let best: Cand | null = null;

    for (const raw of tagsOrdered) {
      const tag = raw.trim();
      if (!tag) continue;
      const k = tagKey(tag);
      if (used.has(k)) continue;

      const idx = orderIdx.get(k) ?? 9999;
      let next: string | null = null;

      if (allowSubsequenceHeuristic(tag)) {
        if (!creativeMatchesAtCurrentSegmentStart(remaining, tag)) continue;
        next = consumeCreativeTagForTag(remaining, tag);
      } else {
        next = consumeInitialsPrefixForTag(remaining, tag);
      }

      if (next === null) continue;
      if (!best || idx < best.idx) {
        best = { tag, next, idx };
      }
    }

    if (!best) break;

    used.add(tagKey(best.tag));
    out.push(best.tag);
    remaining = best.next;
  }

  if (out.length === 0) return null;
  remaining = remaining.trim();
  return remaining ? `${out.join(' ')} ${remaining}` : out.join(' ');
}

/** Unique tags in first-seen order (matches typical footer tag list order). */
function uniqueTagsInOrder(footerTags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of footerTags) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function shortenEventNameUsingFooterTags(
  eventName: string,
  footerTags: string[] | null | undefined
): string {
  if (!eventName?.trim() || !footerTags?.length) return eventName;

  const tags = uniqueTagsInOrder(footerTags.map((t) => t.trim()).filter(Boolean));
  if (tags.length === 0) return eventName;

  const a = trySeasonedSpan(eventName, tags);
  if (a) return a;

  if (tags.length >= 2) {
    const multi = shortenMultiFooterTagsGreedy(eventName, tags);
    if (multi !== null) return multi;
    return eventName;
  }

  const c = tryInitialsPrefix(eventName, tags);
  if (c) return c;

  const e = trySubsequenceWholeName(eventName, tags);
  if (e) return e;

  return eventName;
}
