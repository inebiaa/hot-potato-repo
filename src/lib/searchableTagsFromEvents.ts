import type { Event } from './supabase';
import {
  COUNTRY_FILTER_AU,
  COUNTRY_FILTER_CANADA,
  COUNTRY_FILTER_US,
  resolveRegionFromCity,
} from './cityPlaces';
import { effectiveHeaderTags } from './eventHeaderTags';
import { getSpecialGuests, isSpecialGuestsSlug } from './specialGuests';
import { formatEventDateDisplay, eventDateFilterValue } from './formatEventDate';
import { getSeasonFromDate, getYearFromDate } from './season';
import { normalizeShowType, showTypeLabel } from './showType';
import { normalizeTagName } from './tagIdentity';
import { tagResolutionKey, type TagResolutionMap } from './tagDisplayResolution';

export type SearchableTag = { type: string; value: string; label: string };

/** Build typeahead candidates from a set of events (feed or a single board). */
export function collectSearchableTagsFromEvents(
  events: Event[],
  tagResolutionMap: TagResolutionMap | null | undefined,
): SearchableTag[] {
  const seen = new Set<string>();
  const tags: SearchableTag[] = [];
  const add = (type: string, value: string, label?: string) => {
    const lab = label ?? value;
    const key = `${type}:${value}:${lab}`;
    if (!seen.has(key) && value) {
      seen.add(key);
      tags.push({ type, value, label: lab });
    }
  };
  const map = tagResolutionMap;
  const expandIdentity = (tagType: string, raw: string) => {
    const entry = map?.get(tagResolutionKey(tagType, raw));
    const filterValue = entry?.identityId ?? raw;
    const label = entry?.display ?? raw;
    add(tagType, filterValue, label);
    if (entry) {
      entry.searchable.forEach((s) => {
        if (normalizeTagName(s) !== normalizeTagName(label)) {
          add(tagType, filterValue, s);
        }
      });
    }
  };
  let hasUsState = false;
  let hasCaProvince = false;
  let hasAustralia = false;
  events.forEach((e) => {
    (e.producers || []).forEach((v) => expandIdentity('producer', v));
    (e.featured_designers || []).forEach((v) => expandIdentity('designer', v));
    (e.featured_artists || []).forEach((v) => expandIdentity('artist', v));
    getSpecialGuests(e.custom_tags).forEach((v) => expandIdentity('artist', v));
    (e.hair_makeup || []).forEach((v) => expandIdentity('hair_makeup', v));
    effectiveHeaderTags(e).forEach((v) => expandIdentity('header_tags', v));
    (e.footer_tags || []).forEach((v) => expandIdentity('footer_tags', v));
    if (e.city) {
      add('city', e.city);
      const region = resolveRegionFromCity(e.city);
      if (region) {
        add('region', region.filterCode, region.label);
        if (region.kind === 'state') hasUsState = true;
        if (region.kind === 'province') hasCaProvince = true;
        if (region.filterCode === COUNTRY_FILTER_AU) hasAustralia = true;
      }
    }
    if (e.location) expandIdentity('venue', e.location);
    add('season', getSeasonFromDate(e.date));
    {
      const showType = normalizeShowType(e.show_type);
      add('show_type', showType, showTypeLabel(showType));
    }
    {
      const y = getYearFromDate(e.date);
      if (y) add('year', y);
    }
    {
      const dateVal = eventDateFilterValue(e.date);
      if (dateVal) add('date', dateVal, formatEventDateDisplay(e.date));
    }
    if (e.custom_tags && typeof e.custom_tags === 'object') {
      Object.entries(e.custom_tags).forEach(([slug, vals]) => {
        if (isSpecialGuestsSlug(slug)) return;
        const tt = `custom:${slug}` as const;
        (vals || []).forEach((v) => {
          const entry = map?.get(tagResolutionKey(tt, v));
          const filterPart = entry?.identityId ?? v;
          const label = entry?.display ?? v;
          const filterVal = `${slug}\x00${filterPart}`;
          add('custom_performer', filterVal, label);
          entry?.searchable.forEach((s) => {
            if (normalizeTagName(s) !== normalizeTagName(label)) {
              add('custom_performer', filterVal, s);
            }
          });
        });
      });
    }
  });
  // Cities store state/province (or AU state) codes; expose country chips for those markets.
  if (hasUsState) add('region', COUNTRY_FILTER_US, 'United States');
  if (hasCaProvince) add('region', COUNTRY_FILTER_CANADA, 'Canada');
  if (hasAustralia) add('region', COUNTRY_FILTER_AU, 'Australia');
  return tags.sort((a, b) => a.label.localeCompare(b.label));
}

/** Collect tag identity UUIDs referenced by searchable tag filter values. */
export function identityIdsFromSearchableTags(tags: SearchableTag[]): Set<string> {
  const ids = new Set<string>();
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  for (const t of tags) {
    if (UUID_RE.test(t.value)) ids.add(t.value);
    if (t.type === 'custom_performer' && t.value.includes('\x00')) {
      const [, rest] = t.value.split('\x00');
      if (rest && UUID_RE.test(rest)) ids.add(rest);
    }
  }
  return ids;
}
