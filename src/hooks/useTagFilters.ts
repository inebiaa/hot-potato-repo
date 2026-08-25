import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Event } from '../lib/eventTypes';
import { eventDateMatchesSearch } from '../lib/formatEventDate';
import { normalizeForSearch } from '../lib/normalize';
import { isSpecialGuestsSlug } from '../lib/specialGuests';
import {
  displayLabelForTagFilter,
  type TagResolutionMap,
} from '../lib/tagDisplayResolution';
import {
  normalizeTagName,
  searchTagIdentities,
  type TagIdentityRecord,
} from '../lib/tagIdentity';
import {
  eventMatchesTextQuery,
  filterEventsBySelectedTags,
  type SelectedTagFilter,
} from '../lib/eventTagFilter';
import { regionSuggestionMatchesQuery } from '../lib/cityPlaces';
import { collectSearchableTagsFromEvents } from '../lib/searchableTagsFromEvents';
import { feedUpcomingHorizonYmd } from '../lib/eventsFeed';
import { isUpcomingBeyondHorizon } from '../lib/eventDates';

type UseTagFiltersOptions<T extends Event> = {
  events: T[];
  tagResolutionMap: TagResolutionMap | null;
  profileBoardEvents: Event[] | null;
  hasMoreEvents: boolean;
  catalogHydrating: boolean;
  browsingRef: { current: boolean };
  ensureFullCatalog: () => Promise<void>;
  scrollFeedToTop: () => void;
  /** Only hydrate the home browse catalog on home (and overlay) routes. */
  catalogActive?: boolean;
};

export function useTagFilters<T extends Event>({
  events,
  tagResolutionMap,
  profileBoardEvents,
  hasMoreEvents,
  catalogHydrating,
  browsingRef,
  ensureFullCatalog,
  scrollFeedToTop,
  catalogActive = true,
}: UseTagFiltersOptions<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<SelectedTagFilter[]>([]);
  const [identitySearchHits, setIdentitySearchHits] = useState<TagIdentityRecord[]>([]);
  const [searchDragOver, setSearchDragOver] = useState(false);

  const browsing = selectedTags.length === 0 && searchQuery.trim().length < 2;
  browsingRef.current = browsing;
  const filtering = !browsing;
  const catalogStillLoading = filtering && (hasMoreEvents || catalogHydrating);

  const identityIdsInUse = useMemo(() => {
    const s = new Set<string>();
    tagResolutionMap?.forEach((entry) => {
      if (entry.identityId) s.add(entry.identityId);
    });
    return s;
  }, [tagResolutionMap]);

  useEffect(() => {
    if (!catalogActive) return;
    const needsFullCatalog =
      selectedTags.length > 0 || searchQuery.trim().length >= 2;
    if (!needsFullCatalog) return;
    void ensureFullCatalog();
  }, [selectedTags, searchQuery, ensureFullCatalog, catalogActive]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setIdentitySearchHits([]);
      return;
    }
    if (profileBoardEvents) {
      setIdentitySearchHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchTagIdentities(q).then(setIdentitySearchHits).catch(() => setIdentitySearchHits([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery, profileBoardEvents]);

  const tagSuggestions = useMemo(() => {
    const q = normalizeForSearch(searchQuery);
    if (!q || q.length < 2) return [];
    const suggestionEventPool = profileBoardEvents ?? events;
    const scopedEvents = filterEventsBySelectedTags(
      suggestionEventPool,
      selectedTags,
      tagResolutionMap,
    );
    const sourceTags = collectSearchableTagsFromEvents(scopedEvents, tagResolutionMap);
    const selectedKeys = new Set(selectedTags.map((t) => `${t.type}:${t.value}`));
    const tagMatchesQuery = (t: { type: string; value: string; label: string }) => {
      if (normalizeForSearch(t.label).includes(q)) return true;
      if (t.type === 'region' && regionSuggestionMatchesQuery(t.value, t.label, q)) return true;
      return t.type === 'date' && eventDateMatchesSearch(t.value, q);
    };
    const fromEvents = sourceTags.filter(
      (t) => !selectedKeys.has(`${t.type}:${t.value}`) && tagMatchesQuery(t),
    );
    if (profileBoardEvents) {
      return fromEvents.slice(0, 8);
    }
    const suggestionKey = (t: { type: string; value: string; label: string }) =>
      `${t.type}:${t.value}\x00${normalizeTagName(t.label)}`;
    const seen = new Set(fromEvents.map(suggestionKey));
    const out: { type: string; value: string; label: string }[] = [...fromEvents];
    const identityAllowlist = identityIdsInUse;
    for (const id of identitySearchHits) {
      if (!identityAllowlist.has(id.clusterId)) continue;
      const customSlug = id.tag_type.startsWith('custom:') ? id.tag_type.slice(7) : null;
      const sug =
        customSlug && !isSpecialGuestsSlug(customSlug)
          ? {
              type: 'custom_performer' as const,
              value: `${customSlug}\x00${id.clusterId}`,
              label: id.canonical_name,
            }
          : {
              type: customSlug && isSpecialGuestsSlug(customSlug) ? 'artist' : id.tag_type,
              value: id.clusterId,
              label: id.canonical_name,
            };
      if (selectedKeys.has(`${sug.type}:${sug.value}`)) continue;
      const key = suggestionKey(sug);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(sug);
      }
    }
    return out.slice(0, 8);
  }, [
    searchQuery,
    events,
    profileBoardEvents,
    selectedTags,
    tagResolutionMap,
    identitySearchHits,
    identityIdsInUse,
  ]);

  const filteredEvents = useMemo(() => {
    let filtered: T[] = [...events];

    if (browsing) {
      const horizonYmd = feedUpcomingHorizonYmd();
      filtered = filtered.filter((event) => !isUpcomingBeyondHorizon(event.date || '', horizonYmd));
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter((event) =>
        eventMatchesTextQuery(event, searchQuery, tagResolutionMap),
      );
    }

    return filterEventsBySelectedTags(filtered, selectedTags, tagResolutionMap);
  }, [searchQuery, selectedTags, events, tagResolutionMap, browsing]);

  const wasFilteringRef = useRef(false);
  useEffect(() => {
    if (filtering && !wasFilteringRef.current) {
      scrollFeedToTop();
    }
    wasFilteringRef.current = filtering;
  }, [filtering, scrollFeedToTop]);

  const selectTagFilter = useCallback(
    (type: string, value: string, explicitLabel?: string) => {
      const label = displayLabelForTagFilter(type, value, tagResolutionMap, explicitLabel);
      setSelectedTags((prev) => {
        if (type === 'query') {
          const n = normalizeForSearch(value);
          if (!n) return prev;
          if (prev.some((t) => t.type === 'query' && normalizeForSearch(t.value) === n)) return prev;
          return [...prev, { type, value: value.trim(), label: (label || value).trim() }];
        }
        const key = `${type}:${value}`;
        const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
        if (alreadySelected) return prev;
        return [...prev, { type, value, label }];
      });
      setSearchQuery('');
      scrollFeedToTop();
    },
    [tagResolutionMap, scrollFeedToTop],
  );

  const removeTagFilter = useCallback((type: string, value: string) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.type === type && t.value === value)));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
    scrollFeedToTop();
  }, [scrollFeedToTop]);

  const handleSearchDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSearchDragOver(false);
    const raw = e.dataTransfer.getData('text/plain');
    const match = raw?.match(/^tag-filter:([^:]+):(.+)$/);
    if (match) {
      const [, type, value] = match;
      const searchTerm = type === 'custom_performer' ? value.split('\x00')[1] ?? value : value;
      setSearchQuery(searchTerm);
    }
  }, []);

  const handleSearchDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setSearchDragOver(true);
  }, []);

  const handleSearchDragLeave = useCallback(() => {
    setSearchDragOver(false);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    filteredEvents,
    tagSuggestions,
    browsing,
    filtering,
    catalogStillLoading,
    searchDragOver,
    selectTagFilter,
    removeTagFilter,
    clearFilters,
    handleSearchDrop,
    handleSearchDragOver,
    handleSearchDragLeave,
  };
}
