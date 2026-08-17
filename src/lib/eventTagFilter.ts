import type { Event } from './supabase';
import { cityMatchesRegionCode } from './cityPlaces';
import { eventDateFilterValue } from './formatEventDate';
import { effectiveHeaderTags } from './eventHeaderTags';
import { getSeasonFromDate, getYearFromDate } from './season';
import { normalizeShowType } from './showType';
import { getSpecialGuests, isSpecialGuestsSlug } from './specialGuests';
import { sameTagSpelling } from './tagIdentity';
import {
  eventArrayMatchesFilter,
  eventMatchesVenueTag,
  type TagResolutionMap,
} from './tagDisplayResolution';

export type SelectedTagFilter = { type: string; value: string; label: string };

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
      return eventArrayMatchesFilter(tagResolutionMap, 'producer', event.producers, tag.value, tag.label);
    case 'designer':
      return eventArrayMatchesFilter(tagResolutionMap, 'designer', event.featured_designers, tag.value, tag.label);
    case 'artist':
      return (
        eventArrayMatchesFilter(tagResolutionMap, 'artist', event.featured_artists, tag.value, tag.label) ||
        eventArrayMatchesFilter(tagResolutionMap, 'artist', getSpecialGuests(event.custom_tags), tag.value, tag.label)
      );
    case 'hair_makeup':
      return eventArrayMatchesFilter(tagResolutionMap, 'hair_makeup', event.hair_makeup, tag.value, tag.label);
    case 'header_tags':
      return eventArrayMatchesFilter(tagResolutionMap, 'header_tags', effectiveHeaderTags(event), tag.value, tag.label);
    case 'footer_tags':
      return eventArrayMatchesFilter(tagResolutionMap, 'footer_tags', event.footer_tags, tag.value, tag.label);
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
