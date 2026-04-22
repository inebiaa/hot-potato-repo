import { supabase } from './supabase';
import type { Event } from './supabase';
import { effectiveHeaderTags } from './eventHeaderTags';
import { coalesceTagList } from './eventTagArray';
import { normalizeTagName, tagArrayContainsNormalized, type TagType } from './tagIdentity';

/**
 * Tag model (for contributor-facing behavior):
 * - **Event fields** (producers, designers, etc.) store the exact credits line as entered (trim + dedupe only).
 *   Pills and edit forms use these strings; they are not replaced by a global “canonical” name.
 * - **Tag identities + aliases** link spellings to profiles, stats, and search. They do not override the text on an
 *   event once saved. Optional `public_display_alias` applies in Settings/credit UI, not on event cards.
 * - **Cluster** (`cluster_id`): linked names share a cluster; filters and search use `cluster_id` (no single "main" row).
 * - **Filters** use that cluster id as `identityId` in the map when known; legacy string filters still work via normalized compare.
 */
/** Key: `${tagType}\0${normalized raw string from event}` */
export function tagResolutionKey(tagType: string, rawFromEvent: string): string {
  return `${tagType}\x00${normalizeTagName(rawFromEvent)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Human-readable text for the search bar / filter chip. Filter `value` is often a tag `identity` uuid;
 * the map (or an explicit label from a pill/suggestion) supplies the name to show.
 */
export function displayLabelForTagFilter(
  type: string,
  value: string,
  map: TagResolutionMap | null | undefined,
  explicitLabel?: string
): string {
  if (explicitLabel && explicitLabel.trim()) return explicitLabel.trim();
  if (!value) return value;
  if (!map) return value;

  if (type === 'custom_performer' && value.includes('\x00')) {
    const [slug, rest] = value.split('\x00');
    if (!slug) return value;
    const customType = `custom:${slug}` as TagType;
    if (UUID_RE.test(rest)) {
      for (const [k, e] of map) {
        if (e?.identityId === rest && k.startsWith(`${customType}\x00`)) return e.display;
      }
    }
    const byKey = map.get(tagResolutionKey(customType, rest));
    if (byKey?.display) return byKey.display;
    return rest;
  }

  if (UUID_RE.test(value)) {
    for (const [k, e] of map) {
      if (e?.identityId === value && k.startsWith(`${type}\x00`)) return e.display;
    }
  }

  const byKey = map.get(tagResolutionKey(type, value));
  if (byKey?.display) return byKey.display;
  return value;
}

export interface TagDisplayEntry {
  /** `tag_identities.cluster_id` for filters; otherwise null */
  identityId: string | null;
  /** On event cards, this is always the string stored on the event (per-show spelling) */
  display: string;
  /** Identity’s primary name; used for search/credits, not to overwrite event text */
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
  cluster_id: string;
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
    coalesceTagList(e.producers).forEach((v) => add('producer', v));
    coalesceTagList(e.featured_designers).forEach((v) => add('designer', v));
    coalesceTagList(e.models).forEach((v) => add('model', v));
    coalesceTagList(e.hair_makeup).forEach((v) => add('hair_makeup', v));
    effectiveHeaderTags(e).forEach((v) => add('header_tags', v));
    coalesceTagList(e.footer_tags).forEach((v) => add('footer_tags', v));
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
  if (tagResolutionMap) {
    if (UUID_RE.test(tagValue)) {
      return resolved?.identityId === tagValue;
    }
    const filterEntry = tagResolutionMap.get(tagResolutionKey('venue', tagValue));
    if (filterEntry?.identityId && resolved?.identityId) {
      return filterEntry.identityId === resolved.identityId;
    }
  }
  const canonical = resolved?.canonical ?? rawVenue;
  return normalizeTagName(canonical) === normalizeTagName(tagValue);
}

/**
 * True if any of `eventValues` should match a tag filter. Prefer identity id in `filterValue` (uuid);
 * otherwise matches normalized strings or, when the map can resolve the filter, same identity.
 */
export function eventArrayMatchesFilter(
  map: TagResolutionMap | null | undefined,
  tagType: string,
  eventValues: string[] | null | undefined,
  filterValue: string
): boolean {
  if (!eventValues?.length) return false;
  if (map) {
    if (UUID_RE.test(filterValue)) {
      for (const v of eventValues) {
        const e = map.get(tagResolutionKey(tagType, v));
        if (e?.identityId === filterValue) return true;
      }
      return false;
    }
    const filterEntry = map.get(tagResolutionKey(tagType, filterValue));
    if (filterEntry?.identityId) {
      for (const v of eventValues) {
        const e = map.get(tagResolutionKey(tagType, v));
        if (e?.identityId === filterEntry.identityId) return true;
      }
    }
  }
  return tagArrayContainsNormalized(eventValues, filterValue);
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
      .select('id, tag_type, canonical_name, public_display_alias_id, normalized_name, cluster_id')
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
        tag_identities ( id, tag_type, canonical_name, public_display_alias_id, normalized_name, cluster_id )
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

  const pairToCluster = new Map<string, string>();
  for (const [k, rowId] of pairToIdentity) {
    const row = identityRows.get(rowId);
    if (row) pairToCluster.set(k, row.cluster_id);
  }

  const clusters = new Set(pairToCluster.values());
  const clusterToRep = new Map<string, IdentityRow>();
  let allClusterMembers: IdentityRow[] = [];
  if (clusters.size > 0) {
    const { data: inClusters } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name, public_display_alias_id, normalized_name, cluster_id')
      .in('cluster_id', [...clusters]);
    allClusterMembers = (inClusters || []) as IdentityRow[];
    for (const row of allClusterMembers) {
      const c = row.cluster_id;
      const cur = clusterToRep.get(c);
      if (!cur || row.id < cur.id) {
        clusterToRep.set(c, row);
      }
      identityRows.set(row.id, row);
    }
  }

  const rawsByCluster = new Map<string, Set<string>>();
  for (const [k, rowId] of pairToIdentity) {
    const p = pairKeys.get(k);
    if (!p) continue;
    const r = identityRows.get(rowId);
    if (!r) continue;
    const c = r.cluster_id;
    let set = rawsByCluster.get(c);
    if (!set) {
      set = new Set<string>();
      rawsByCluster.set(c, set);
    }
    set.add(p.raw);
  }

  const memberIdsForAliases = allClusterMembers.length
    ? allClusterMembers.map((r) => r.id)
    : [...new Set(pairToIdentity.values())];

  const aliasesByRow = new Map<string, { id: string; alias: string }[]>();
  const aliasTextById = new Map<string, string>();
  if (memberIdsForAliases.length > 0) {
    const { data: aliasRows } = await supabase
      .from('tag_aliases')
      .select('id, identity_id, alias')
      .in('identity_id', memberIdsForAliases);
    for (const a of aliasRows || []) {
      const list = aliasesByRow.get(a.identity_id) || [];
      list.push({ id: a.id, alias: a.alias });
      aliasesByRow.set(a.identity_id, list);
      aliasTextById.set(a.id, a.alias);
    }
  }

  const buildEntry = (clusterId: string): TagDisplayEntry => {
    const row = clusterToRep.get(clusterId);
    if (!row) {
      return { identityId: null, display: '', canonical: '', searchable: [] };
    }
    const canonical = row.canonical_name;
    let display = canonical;
    if (row.public_display_alias_id) {
      const t = aliasTextById.get(row.public_display_alias_id);
      if (t) display = t;
    }
    const raws = rawsByCluster.get(clusterId);
    const searchable = new Set<string>([canonical, ...(raws ?? [])]);
    for (const m of allClusterMembers) {
      if (m.cluster_id !== clusterId) continue;
      for (const a of aliasesByRow.get(m.id) || []) {
        if (a.alias) searchable.add(a.alias);
      }
    }
    if (display && normalizeTagName(display) !== normalizeTagName(canonical)) {
      searchable.add(display);
    }
    return {
      identityId: clusterId,
      display,
      canonical,
      searchable: [...searchable],
    };
  };

  for (const [k, { raw }] of pairKeys) {
    const rowId = pairToIdentity.get(k);
    if (!rowId) {
      result.set(k, {
        identityId: null,
        display: raw,
        canonical: raw,
        searchable: [raw],
      });
      continue;
    }
    const row = identityRows.get(rowId);
    const clusterId = row?.cluster_id;
    if (!clusterId) {
      result.set(k, {
        identityId: null,
        display: raw,
        canonical: raw,
        searchable: [raw],
      });
      continue;
    }
    const base = buildEntry(clusterId);
    result.set(k, {
      ...base,
      display: raw,
    });
  }

  return result;
}
