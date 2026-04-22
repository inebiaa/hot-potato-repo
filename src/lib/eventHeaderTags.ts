import { normalizeTagName } from './tagIdentity';
import { coalesceTagList } from './eventTagArray';

/**
 * Genre/collection-style tags for the show live in `header_tags` only (there is no separate DB column in all envs).
 */
export function effectiveHeaderTags(e: { header_tags?: string[] | null }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of coalesceTagList(e.header_tags)) {
    const s = String(t).trim();
    if (!s) continue;
    const n = normalizeTagName(s);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(s);
  }
  return out;
}
