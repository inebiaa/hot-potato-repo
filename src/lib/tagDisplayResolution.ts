import { supabase } from './supabase';
import type { Event } from './supabase';
import { normalizeTagName, type TagType } from './tagIdentity';

/** Key: `${tagType}\0${normalized raw string from event}` */
export function tagResolutionKey(tagType: string, rawFromEvent: string): string {
  return `${tagType}\x00${normalizeTagName(rawFromEvent)}`;
}

export interface TagDisplayEntry {
  /** Resolved identity id when this tag maps to `tag_identities`; otherwise null */
  identityId: string | null;
  /** Label for pills (public display alias or canonical) */
  display: string;
  /** Value for filters / onTagClick — matches stored event strings (canonical) */
  canonical: string;
  /** Strings that match search: canonical, raw values on events for this identity, and display when it differs */
  searchable: string[];
}

export type TagResolutionMap = Map<string, TagDisplayEntry>;

interface IdentityRow {
  id: string;
  tag_type: string;
  canonical_name: string;
  public_display_alias_id: string | null;
  normalized_name: string;
}

function collectTagPairs(events: Event[]): Map<string, { type: string; raw: string }> {
  const pairKeys = new Map<string, { type: string; raw: string }>();
  const add = (type: string, raw: string) => {
    const t = raw?.trim();
    if (!t) return;
    const k = tagResolutionKey(type, t);
    if (!pairKeys.has(k)) pairKeys.set(k, { type, raw: t });
  };

  for (const e of events) {
    (e.producers || []).forEach((v) => add('producer', v));
    (e.featured_designers || []).forEach((v) => add('designer', v));
    (e.models || []).forEach((v) => add('model', v));
    (e.hair_makeup || []).forEach((v) => add('hair_makeup', v));
    (e.header_tags || []).forEach((v: string) => add('header_tags', v));
    (e.footer_tags || []).forEach((v) => add('footer_tags', v));
    if (e.location) add('venue', e.location);
    if (e.custom_tags && typeof e.custom_tags === 'object') {
      Object.entries(e.custom_tags).forEach(([slug, vals]) => {
        (vals || []).forEach((v) => add(`custom:${slug}` as TagType, v));
      });
    }
  }
  return pairKeys;
}

/**
 * Match venue tags robustly using canonical identity values when available.
 * Falls back to normalized direct compare when resolution data is missing.
 */
export function eventMatchesVenueTag(
  event: Pick<Event, 'location'>,
  tagValue: string,
  tagResolutionMap?: TagResolutionMap | null
): boolean {
  const rawVenue = event.location?.trim();
  if (!rawVenue || !tagValue) return false;
  const resolved = tagResolutionMap?.get(tagResolutionKey('venue', rawVenue));
  const canonical = resolved?.canonical ?? rawVenue;
  return normalizeTagName(canonical) === normalizeTagName(tagValue);
}

/**
 * Batch-load identity + aliases for all tag strings on the given events.
 * Used for display labels, filter canonical keys, and search expansion.
 */
export async function fetchTagResolutionForEvents(events: Event[]): Promise<TagResolutionMap> {
  const pairKeys = collectTagPairs(events);
  const result: TagResolutionMap = new Map();

  if (pairKeys.size === 0) return result;

  const byType = new Map<string, string[]>();
  for (const { type, raw } of pairKeys.values()) {
    const arr = byType.get(type) || [];
    arr.push(raw);
    byType.set(type, arr);
  }

  /** pairKey -> identity id */
  const pairToIdentity = new Map<string, string>();
  const identityRows = new Map<string, IdentityRow>();

  for (const [tagType, raws] of byType) {
    const norms = [...new Set(raws.map((r) => normalizeTagName(r)))].filter(Boolean);
    if (norms.length === 0) continue;

    const { data: canonRows } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name, public_display_alias_id, normalized_name')
      .eq('tag_type', tagType)
      .in('normalized_name', norms);

    const normToId = new Map<string, string>();
    for (const row of (canonRows || []) as IdentityRow[]) {
      normToId.set(row.normalized_name, row.id);
      identityRows.set(row.id, row);
    }

    for (const raw of raws) {
      const k = tagResolutionKey(tagType, raw);
      const id = normToId.get(normalizeTagName(raw));
      if (id) pairToIdentity.set(k, id);
    }
  }

  const unmatchedKeys = [...pairKeys.keys()].filter((k) => !pairToIdentity.has(k));
  if (unmatchedKeys.length > 0) {
    const unmatchedNorms = [
      ...new Set(unmatchedKeys.map((k) => normalizeTagName(pairKeys.get(k)!.raw))),
    ].filter(Boolean);

    const { data: aliasHits } = await supabase
      .from('tag_aliases')
      .select(
        `
        identity_id,
        normalized_alias,
        tag_identities ( id, tag_type, canonical_name, public_display_alias_id, normalized_name )
      `
      )
      .in('normalized_alias', unmatchedNorms);

    type Hit = {
      identity_id: string;
      normalized_alias: string;
      tag_identities: IdentityRow | IdentityRow[] | null;
    };

    for (const k of unmatchedKeys) {
      const { type, raw } = pairKeys.get(k)!;
      const norm = normalizeTagName(raw);
      const candidates: IdentityRow[] = [];
      for (const hit of (aliasHits || []) as Hit[]) {
        const ti = hit.tag_identities;
        const identity = Array.isArray(ti) ? ti[0] : ti;
        if (!identity || identity.tag_type !== type) continue;
        if (hit.normalized_alias !== norm) continue;
        candidates.push(identity);
      }
      if (candidates.length === 0) continue;
      const preferred =
        candidates.find((id) => id.normalized_name === norm) ??
        [...candidates].sort((a, b) => a.id.localeCompare(b.id))[0];
      pairToIdentity.set(k, preferred.id);
      identityRows.set(preferred.id, preferred);
    }
  }

  /** Raw strings from events that resolved to each identity (for searchable, not every DB alias) */
  const rawsByIdentity = new Map<string, Set<string>>();
  for (const [k, identityId] of pairToIdentity) {
    const p = pairKeys.get(k);
    if (!p) continue;
    let set = rawsByIdentity.get(identityId);
    if (!set) {
      set = new Set<string>();
      rawsByIdentity.set(identityId, set);
    }
    set.add(p.raw);
  }

  const identityIds = [...new Set(pairToIdentity.values())];
  const aliasesByIdentity = new Map<string, { id: string; alias: string }[]>();
  const aliasTextById = new Map<string, string>();

  if (identityIds.length > 0) {
    const { data: aliasRows } = await supabase
      .from('tag_aliases')
      .select('id, identity_id, alias')
      .in('identity_id', identityIds);

    for (const a of aliasRows || []) {
      const list = aliasesByIdentity.get(a.identity_id) || [];
      list.push({ id: a.id, alias: a.alias });
      aliasesByIdentity.set(a.identity_id, list);
      aliasTextById.set(a.id, a.alias);
    }
  }

  const buildEntry = (identityId: string): TagDisplayEntry => {
    const row = identityRows.get(identityId);
    if (!row) {
      return { identityId: null, display: '', canonical: '', searchable: [] };
    }
    const canonical = row.canonical_name;
    let display = canonical;
    if (row.public_display_alias_id) {
      const t = aliasTextById.get(row.public_display_alias_id);
      if (t) display = t;
    }
    const raws = rawsByIdentity.get(identityId);
    const searchable = new Set<string>([canonical, ...(raws ?? [])]);
    if (display && normalizeTagName(display) !== normalizeTagName(canonical)) {
      searchable.add(display);
    }
    return {
      identityId,
      display,
      canonical,
      searchable: [...searchable],
    };
  };

  for (const [k, { raw }] of pairKeys) {
    const id = pairToIdentity.get(k);
    if (!id) {
      result.set(k, {
        identityId: null,
        display: raw,
        canonical: raw,
        searchable: [raw],
      });
      continue;
    }
    result.set(k, buildEntry(id));
  }

  return result;
}
