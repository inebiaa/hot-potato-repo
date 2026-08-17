import { supabase } from './supabase';
import type { Event } from './supabase';
import { regionDisplayNameFromCode } from './cityPlaces';
import { effectiveHeaderTags } from './eventHeaderTags';
import { coalesceTagList } from './eventTagArray';
import { formatEventDateDisplay } from './formatEventDate';
import { isSpecialGuestsSlug } from './specialGuests';
import { normalizeTagName, tagArrayContainsNormalized, type TagType } from './tagIdentity';

/**
 * Tag model:
 * - Event fields store exact credits as entered (pills / edit forms).
 * - Each spelling has at most one `tag_identities` row (one main name — no aliases / no links).
 * - Filters use that identity id when known; otherwise normalized string compare.
 */
/** Key: `${tagType}\0${normalized raw string from event}` */
export function tagResolutionKey(tagType: string, rawFromEvent: string): string {
  return `${tagType}\x00${normalizeTagName(rawFromEvent)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Human-readable text for the search bar / filter chip. Filter `value` is often a tag identity uuid;
 * the map (or an explicit label from a pill) supplies the name to show.
 */
export function displayLabelForTagFilter(
  type: string,
  value: string,
  map: TagResolutionMap | null | undefined,
  explicitLabel?: string
): string {
  if (type === 'date') {
    return formatEventDateDisplay(value) || explicitLabel?.trim() || value;
  }
  if (explicitLabel && explicitLabel.trim()) return explicitLabel.trim();
  if (!value) return value;
  if (type === 'region') {
    return regionDisplayNameFromCode(value);
  }
  if (type === 'show_type') {
    return value === 'music' ? 'Music' : value === 'fashion' ? 'Fashion' : value;
  }
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
  /** `tag_identities.id` for filters; otherwise null */
  identityId: string | null;
  /** On event cards, this is always the string stored on the event (per-show spelling) */
  display: string;
  /** Identity’s canonical name; used for search, not to overwrite event text */
  canonical: string;
  /** Strings that match search: canonical + this event raw when different */
  searchable: string[];
}

export type TagResolutionMap = Map<string, TagDisplayEntry>;

interface IdentityRow {
  id: string;
  tag_type: string;
  canonical_name: string;
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
    coalesceTagList(e.producers).forEach((v) => add('producer', v));
    coalesceTagList(e.featured_designers).forEach((v) => add('designer', v));
    coalesceTagList(e.featured_artists).forEach((v) => add('artist', v));
    coalesceTagList(e.hair_makeup).forEach((v) => add('hair_makeup', v));
    effectiveHeaderTags(e).forEach((v) => add('header_tags', v));
    coalesceTagList(e.footer_tags).forEach((v) => add('footer_tags', v));
    if (e.location) add('venue', e.location);
    if (e.custom_tags && typeof e.custom_tags === 'object') {
      Object.entries(e.custom_tags).forEach(([slug, vals]) => {
        const asArtist = isSpecialGuestsSlug(slug);
        (vals || []).forEach((v) => add(asArtist ? 'artist' : (`custom:${slug}` as TagType), v));
      });
    }
  }
  return pairKeys;
}

/**
 * Match venue tags robustly using identity when available.
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
  filterValue: string,
  filterLabel?: string,
): boolean {
  if (!eventValues?.length) return false;
  if (map) {
    if (UUID_RE.test(filterValue)) {
      for (const v of eventValues) {
        const e = map.get(tagResolutionKey(tagType, v));
        if (e?.identityId === filterValue) return true;
      }
      let canonical = filterLabel?.trim();
      if (!canonical) {
        for (const e of map.values()) {
          if (e.identityId === filterValue) {
            canonical = e.canonical;
            break;
          }
        }
      }
      if (canonical && tagArrayContainsNormalized(eventValues, canonical)) return true;
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
 * Batch-load identity resolution for all tag strings on the given events.
 * Used for display labels, filter keys, and search expansion.
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

  const pairToIdentity = new Map<string, string>();
  const identityRows = new Map<string, IdentityRow>();

  for (const [tagType, raws] of byType) {
    const norms = [...new Set(raws.map((r) => normalizeTagName(r)))].filter(Boolean);
    if (norms.length === 0) continue;

    const { data: canonRows } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name, normalized_name')
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
    const canonical = row?.canonical_name ?? raw;
    const searchable = new Set<string>([canonical, raw]);
    result.set(k, {
      identityId: rowId,
      display: raw,
      canonical,
      searchable: [...searchable],
    });
  }

  return result;
}
