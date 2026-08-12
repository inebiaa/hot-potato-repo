import { normalizeTagNameKey } from './normalize';
import { isSpecialGuestsSlug } from './specialGuests';
import { supabase } from './supabase';

export type TagType =
  | 'producer'
  | 'designer'
  | 'artist'
  | 'hair_makeup'
  | 'venue'
  | 'header_tags'
  | 'footer_tags'
  | `custom:${string}`;

export interface TagIdentityRecord {
  /** `tag_identities.id` — use for admin and filters. */
  id: string;
  /**
   * Same as `id` (one name per identity; no linked groups).
   * Kept for call sites that still read `clusterId`.
   */
  clusterId: string;
  tag_type: string;
  canonical_name: string;
}

/** Trim, collapse spaces, lowercase, strip accents (aligned with DB `fold_tag_normalize`). */
export function normalizeTagName(input: string): string {
  return normalizeTagNameKey(input);
}

/** True if `value` matches any entry (accent/case/spacing insensitive). */
export function tagArrayContainsNormalized(arr: string[] | null | undefined, value: string): boolean {
  if (!arr?.length || !String(value).trim()) return false;
  const v = normalizeTagName(value);
  return arr.some((x) => normalizeTagName(x) === v);
}

/** Accent/case/spacing insensitive string compare for city-like fields. */
export function sameTagSpelling(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeTagName(a ?? '') === normalizeTagName(b ?? '');
}

function toRecord(row: { id: string; tag_type: string; canonical_name: string }): TagIdentityRecord {
  return {
    id: row.id,
    clusterId: row.id,
    tag_type: row.tag_type,
    canonical_name: row.canonical_name,
  };
}

export async function findIdentityByName(tagType: TagType, name: string): Promise<TagIdentityRecord | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const { data: canonicalRows } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name, normalized_name')
    .eq('tag_type', tagType)
    .eq('normalized_name', normalized)
    .limit(1);
  if (canonicalRows && canonicalRows.length > 0) {
    return toRecord(canonicalRows[0] as { id: string; tag_type: string; canonical_name: string });
  }
  return null;
}

export async function ensureIdentity(tagType: TagType, name: string, createdBy?: string): Promise<TagIdentityRecord | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const existing = await findIdentityByName(tagType, name);
  if (existing) return existing;

  const canonicalName = name.trim();
  const { data: inserted, error } = await supabase
    .from('tag_identities')
    .insert({
      tag_type: tagType,
      canonical_name: canonicalName,
      normalized_name: normalized,
      created_by: createdBy || null,
    })
    .select('id, tag_type, canonical_name')
    .limit(1)
    .maybeSingle();
  if (error || !inserted) return null;

  return toRecord(inserted as { id: string; tag_type: string; canonical_name: string });
}

type IdentityNameRow = { id: string; tag_type: string; canonical_name: string };

/** Search tag identities by canonical / normalized name, any type. For "find yourself" / credit search. */
export async function searchTagIdentities(query: string): Promise<TagIdentityRecord[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const safe = (s: string) => s.replace(/'/g, "''");
  const trimQ = query.trim();
  const seen = new Set<string>();
  const out: IdentityNameRow[] = [];

  const { data: byCanonical } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .ilike('canonical_name', `%${safe(trimQ)}%`)
    .limit(15);
  (byCanonical || []).forEach((row: IdentityNameRow) => {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  });

  const { data: byNormalized } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .like('normalized_name', `%${q}%`)
    .limit(15);
  (byNormalized || []).forEach((row: IdentityNameRow) => {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  });

  return out.slice(0, 20).map((row) => toRecord(row));
}

const EVENT_TAG_COLUMNS: { key: keyof EventTagSource; tagType: TagType }[] = [
  { key: 'producers', tagType: 'producer' },
  { key: 'featured_designers', tagType: 'designer' },
  { key: 'featured_artists', tagType: 'artist' },
  { key: 'hair_makeup', tagType: 'hair_makeup' },
  { key: 'header_tags', tagType: 'header_tags' },
  { key: 'footer_tags', tagType: 'footer_tags' },
];

/** Fields on an event row used to register tag identities (does not change event text). */
export interface EventFieldsForIdentitySync {
  producers?: string[] | null;
  featured_designers?: string[] | null;
  featured_artists?: string[] | null;
  hair_makeup?: string[] | null;
  header_tags?: string[] | null;
  footer_tags?: string[] | null;
  location?: string | null;
  custom_tags?: Record<string, string[]> | null;
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, concurrency);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i]);
    }
  });
  await Promise.all(workers);
}

/**
 * For each credit line on the event, ensure a `tag_identities` row exists.
 * Call after a successful create/update so search, filters, and profiles can resolve names.
 * Runs with bounded concurrency — festival lineups can be dozens of names.
 */
export async function syncTagIdentitiesFromEventFields(
  fields: EventFieldsForIdentitySync,
  createdBy?: string | null
): Promise<void> {
  type Job = { tagType: TagType; name: string };
  const jobs: Job[] = [];

  for (const { key, tagType } of EVENT_TAG_COLUMNS) {
    const arr = fields[key] as string[] | null | undefined;
    if (!Array.isArray(arr)) continue;
    for (const name of arr) {
      if (typeof name === 'string' && name.trim()) jobs.push({ tagType, name });
    }
  }
  const loc = fields.location;
  if (typeof loc === 'string' && loc.trim()) {
    jobs.push({ tagType: 'venue', name: loc });
  }
  const ct = fields.custom_tags;
  if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    for (const [slug, vals] of Object.entries(ct)) {
      if (!Array.isArray(vals)) continue;
      const tagType = (isSpecialGuestsSlug(slug) ? 'artist' : `custom:${slug}`) as TagType;
      for (const name of vals) {
        if (typeof name === 'string' && name.trim()) jobs.push({ tagType, name });
      }
    }
  }

  await mapPool(jobs, 6, async ({ tagType, name }) => {
    try {
      await ensureIdentity(tagType, name, createdBy || undefined);
    } catch (err) {
      console.warn('tag identity sync failed for', tagType, name, err);
    }
  });
}

interface EventTagSource {
  producers?: string[] | null;
  featured_designers?: string[] | null;
  featured_artists?: string[] | null;
  hair_makeup?: string[] | null;
  location?: string | null;
  header_tags?: string[] | null;
  footer_tags?: string[] | null;
  custom_tags?: Record<string, unknown> | null;
}

/** Search tags from events (producers, designers, etc.). Use when tag_identities is empty or doesn't have the tag yet. */
export async function searchEventTags(query: string): Promise<Pick<TagIdentityRecord, 'tag_type' | 'canonical_name'>[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const { data: events, error } = await supabase
    .from('events')
    .select('producers, featured_designers, featured_artists, hair_makeup, location, header_tags, footer_tags, custom_tags')
    .order('date', { ascending: false })
    .limit(500);

  if (error || !events) return [];

  const seen = new Map<string, { tag_type: string; canonical_name: string }>();
  const add = (tagType: TagType, name: string) => {
    const n = normalizeTagName(name);
    if (!n || !n.includes(q)) return;
    const key = `${tagType}:${n}`;
    if (seen.has(key)) return;
    seen.set(key, { tag_type: tagType, canonical_name: name.trim() });
  };

  for (const ev of events as EventTagSource[]) {
    for (const { key, tagType } of EVENT_TAG_COLUMNS) {
      const arr = ev[key];
      if (Array.isArray(arr)) {
        for (const v of arr) {
          if (typeof v === 'string') add(tagType, v);
        }
      }
    }
    if (typeof ev.location === 'string') add('venue', ev.location);
    const ct = ev.custom_tags;
    if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
      for (const [slug, vals] of Object.entries(ct)) {
        const tagType = (isSpecialGuestsSlug(slug) ? 'artist' : `custom:${slug}`) as TagType;
        if (Array.isArray(vals)) {
          for (const v of vals) {
            if (typeof v === 'string') add(tagType, v);
          }
        }
      }
    }
  }

  return Array.from(seen.values()).slice(0, 15);
}
