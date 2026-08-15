import type { Event } from './supabase';
import { cityMatchesRegionCode, cityMatchesRegionQuery } from './cityPlaces';
import { eventDateFilterValue, eventDateMatchesSearch } from './formatEventDate';
import { effectiveHeaderTags } from './eventHeaderTags';
import { normalizeForSearch } from './normalize';
import { getSeasonFromDate, getYearFromDate } from './season';
import { normalizeShowType, showTypeLabel } from './showType';
import { getSpecialGuests, isSpecialGuestsSlug } from './specialGuests';
import { sameTagSpelling } from './tagIdentity';
import {
  eventArrayMatchesFilter,
  eventMatchesVenueTag,
  tagResolutionKey,
  type TagResolutionMap,
} from './tagDisplayResolution';

export type SelectedTagFilter = { type: string; value: string; label: string };

/** Substring match used by the search field and by stacked `query` pills. */
export function eventMatchesTextQuery(
  event: Event,
  rawQuery: string,
  tagResolutionMap: TagResolutionMap | null | undefined,
): boolean {
  const queryNorm = normalizeForSearch(rawQuery);
  if (!queryNorm) return true;
  const map = tagResolutionMap;
  const tagLineMatch = (tagType: string, raw: string) => {
    if (normalizeForSearch(raw).includes(queryNorm)) return true;
    const entry = map?.get(tagResolutionKey(tagType, raw));
    return entry?.searchable.some((s) => normalizeForSearch(s).includes(queryNorm)) ?? false;
  };
  const customLineMatch = (slug: string, raw: string) => {
    if (normalizeForSearch(raw).includes(queryNorm)) return true;
    const entry = map?.get(tagResolutionKey(`custom:${slug}`, raw));
    return entry?.searchable.some((s) => normalizeForSearch(s).includes(queryNorm)) ?? false;
  };
  const nameMatch = normalizeForSearch(event.name || '').includes(queryNorm);
  const cityMatch =
    normalizeForSearch(event.city || '').includes(queryNorm) ||
    cityMatchesRegionQuery(event.city, queryNorm);
  const locationMatch = normalizeForSearch(event.location || '').includes(queryNorm);
  const venueMatch = event.location ? tagLineMatch('venue', event.location) : false;
  const designersMatch = event.featured_designers?.some((d) => tagLineMatch('designer', d)) || false;
  const artistsMatch =
    event.featured_artists?.some((a) => tagLineMatch('artist', a)) ||
    getSpecialGuests(event.custom_tags).some((a) => tagLineMatch('artist', a)) ||
    false;
  const producersMatch = event.producers?.some((p) => tagLineMatch('producer', p)) || false;
  const headerTagsMatch = effectiveHeaderTags(event).some((t) => tagLineMatch('header_tags', t)) || false;
  const footerTagsMatch = event.footer_tags?.some((t) => tagLineMatch('footer_tags', t)) || false;
  const customTagsMatch =
    event.custom_tags && typeof event.custom_tags === 'object'
      ? Object.entries(event.custom_tags).some(([slug, vals]) =>
          isSpecialGuestsSlug(slug)
            ? false
            : (vals || []).some((v: string) => customLineMatch(slug, v)),
        )
      : false;
  const hairMakeupMatch = event.hair_makeup?.some((h) => tagLineMatch('hair_makeup', h)) || false;
  const dateMatch = eventDateMatchesSearch(event.date || '', queryNorm);
  const seasonMatch = normalizeForSearch(getSeasonFromDate(event.date || '')).includes(queryNorm);
  const showTypeMatch = normalizeForSearch(showTypeLabel(event.show_type)).includes(queryNorm);
  return (
    nameMatch ||
    cityMatch ||
    locationMatch ||
    venueMatch ||
    designersMatch ||
    artistsMatch ||
    producersMatch ||
    headerTagsMatch ||
    footerTagsMatch ||
    customTagsMatch ||
    hairMakeupMatch ||
    dateMatch ||
    seasonMatch ||
    showTypeMatch
  );
}

export function eventMatchesSelectedTag(
  event: Event,
  tag: SelectedTagFilter,
  tagResolutionMap: TagResolutionMap | null | undefined,
): boolean {
  switch (tag.type) {
    case 'city':
      return sameTagSpelling(event.city, tag.value);
    case 'region':
      return cityMatchesRegionCode(event.city, tag.value);
    case 'venue':
      return eventMatchesVenueTag(event, tag.value, tagResolutionMap);
    case 'season':
      return getSeasonFromDate(event.date) === tag.value;
    case 'show_type':
      return normalizeShowType(event.show_type) === tag.value;
    case 'year':
      return getYearFromDate(event.date) === tag.value;
    case 'date': {
      const ymd = eventDateFilterValue(event.date || '');
      return Boolean(ymd) && ymd === tag.value;
    }
    case 'producer':
      return eventArrayMatchesFilter(tagResolutionMap, 'producer', event.producers, tag.value);
    case 'designer':
      return eventArrayMatchesFilter(tagResolutionMap, 'designer', event.featured_designers, tag.value);
    case 'artist':
      return (
        eventArrayMatchesFilter(tagResolutionMap, 'artist', event.featured_artists, tag.value) ||
        eventArrayMatchesFilter(tagResolutionMap, 'artist', getSpecialGuests(event.custom_tags), tag.value)
      );
    case 'hair_makeup':
      return eventArrayMatchesFilter(tagResolutionMap, 'hair_makeup', event.hair_makeup, tag.value);
    case 'header_tags':
      return eventArrayMatchesFilter(tagResolutionMap, 'header_tags', effectiveHeaderTags(event), tag.value);
    case 'footer_tags':
      return eventArrayMatchesFilter(tagResolutionMap, 'footer_tags', event.footer_tags, tag.value);
    case 'custom_performer': {
      const [slug, tagValue] = tag.value.split('\x00');
      if (!slug || !tagValue) return false;
      if (isSpecialGuestsSlug(slug)) {
        return (
          eventArrayMatchesFilter(tagResolutionMap, 'artist', event.featured_artists, tagValue) ||
          eventArrayMatchesFilter(tagResolutionMap, 'artist', getSpecialGuests(event.custom_tags), tagValue)
        );
      }
      const vals = event.custom_tags?.[slug];
      return eventArrayMatchesFilter(
        tagResolutionMap,
        `custom:${slug}`,
        Array.isArray(vals) ? vals : null,
        tagValue,
      );
    }
    case 'query':
      return eventMatchesTextQuery(event, tag.value, tagResolutionMap);
    default:
      return true;
  }
}

export function filterEventsBySelectedTags<T extends Event>(
  events: T[],
  selectedTags: SelectedTagFilter[],
  tagResolutionMap: TagResolutionMap | null | undefined,
): T[] {
  if (selectedTags.length === 0) return events;
  return events.filter((event) =>
    selectedTags.every((tag) => eventMatchesSelectedTag(event, tag, tagResolutionMap)),
  );
}
