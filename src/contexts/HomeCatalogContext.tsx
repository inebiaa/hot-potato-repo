import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useEventsFeed } from '../hooks/useEventsFeed';
import { useTagFilters } from '../hooks/useTagFilters';
import type { Event } from '../lib/supabase';
import type { EventWithStats } from '../lib/eventsFeed';
import { isHomeCatalogRoute } from '../lib/homeCatalogRoute';
import {
  fetchTagResolutionForEvents,
  type TagResolutionMap,
} from '../lib/tagDisplayResolution';
import type { SelectedTagFilter } from '../lib/eventTagFilter';
import { filterByBlockedCreators } from '../lib/ugcSafety';
import { TagDisplayProvider } from './TagDisplayContext';

/**
 * Home catalog (browse feed + home search/filter).
 *
 * Home owns this. Other pages must not read it for their own lists.
 * The browse feed downloads only on `/` and `/event/:id`; it stays in memory after that.
 * After a settings/account or profile board edit, they may ask chrome to refresh home.
 */
export type HomeCatalogValue = {
  events: EventWithStats[];
  loading: boolean;
  eventsError: string | null;
  setEventsError: (message: string | null) => void;
  hasMoreEvents: boolean;
  catalogHydrating: boolean;
  deepLinkFailed: boolean;
  clearDeepLinkFailed: () => void;
  feedScrollRef: RefObject<HTMLElement | null>;
  feedSentinelRef: RefObject<HTMLDivElement | null>;
  eventCardRefs: RefObject<Record<string, HTMLDivElement | null>>;
  fetchEvents: (opts?: { append?: boolean }) => Promise<void>;
  ensureFullCatalog: () => Promise<void>;
  refreshEventRating: (eventId: string) => Promise<void>;
  mergeDeepLinkedEvent: (eventId: string) => Promise<EventWithStats | null>;
  tagResolutionMap: TagResolutionMap | null;
  setTagResolutionMap: React.Dispatch<React.SetStateAction<TagResolutionMap | null>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  selectedTags: SelectedTagFilter[];
  setSelectedTags: React.Dispatch<React.SetStateAction<SelectedTagFilter[]>>;
  filteredEvents: EventWithStats[];
  tagSuggestions: { type: string; value: string; label: string }[];
  browsing: boolean;
  filtering: boolean;
  catalogStillLoading: boolean;
  searchDragOver: boolean;
  selectTagFilter: (type: string, value: string, explicitLabel?: string) => void;
  removeTagFilter: (type: string, value: string) => void;
  clearFilters: () => void;
  handleSearchDrop: (e: React.DragEvent) => void;
  handleSearchDragOver: (e: React.DragEvent) => void;
  handleSearchDragLeave: () => void;
  applyHomeTagFilter: (type: string, value: string, explicitLabel?: string) => void;
  goHome: () => void;
  /** Open home without clearing the current search or tags. */
  showHomeFeed: () => void;
};

const HomeCatalogContext = createContext<HomeCatalogValue | null>(null);

type HomeCatalogProviderProps = {
  children: ReactNode;
  /** Profile board scope for search suggestions. Profile-owned; not home data. */
  profileBoardEvents: Event[] | null;
};

export function HomeCatalogProvider({ children, profileBoardEvents }: HomeCatalogProviderProps) {
  const { user, blockedUserIds } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const catalogActive =
    isHomeCatalogRoute(location.pathname) && searchParams.get('embed') !== '1';
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tagResolvedEventIdsRef = useRef<Set<string>>(new Set());
  const [tagResolutionMap, setTagResolutionMap] = useState<TagResolutionMap | null>(null);

  const feed = useEventsFeed({ userId: user?.id, enabled: catalogActive });

  const filters = useTagFilters({
    events: feed.events,
    tagResolutionMap,
    profileBoardEvents,
    hasMoreEvents: feed.hasMoreEvents,
    catalogHydrating: feed.catalogHydrating,
    browsingRef: feed.browsingRef,
    ensureFullCatalog: feed.ensureFullCatalog,
    scrollFeedToTop: () => feed.feedScrollRef.current?.scrollTo({ top: 0 }),
    catalogActive,
  });

  useEffect(() => {
    if (feed.events.length === 0) {
      setTagResolutionMap(new Map());
      tagResolvedEventIdsRef.current = new Set();
      return;
    }
    const unresolved = feed.events.filter((e) => !tagResolvedEventIdsRef.current.has(e.id));
    if (unresolved.length === 0) return;

    let cancelled = false;
    fetchTagResolutionForEvents(unresolved).then((map) => {
      if (cancelled) return;
      for (const e of unresolved) tagResolvedEventIdsRef.current.add(e.id);
      setTagResolutionMap((prev) => {
        if (!prev || prev.size === 0) return map;
        const merged = new Map(prev);
        map.forEach((v, k) => merged.set(k, v));
        return merged;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [feed.events]);

  const applyHomeTagFilter = useCallback(
    (type: string, value: string, explicitLabel?: string) => {
      navigate({ pathname: '/', search: '' });
      filters.selectTagFilter(type, value, explicitLabel);
    },
    [navigate, filters.selectTagFilter],
  );

  const goHome = useCallback(() => {
    filters.setSelectedTags([]);
    navigate('/');
    window.scrollTo(0, 0);
  }, [filters.setSelectedTags, navigate]);

  const showHomeFeed = useCallback(() => {
    if (isHomeCatalogRoute(location.pathname)) return;
    navigate('/');
    window.scrollTo(0, 0);
  }, [navigate, location.pathname]);

  const visibleFilteredEvents = useMemo(
    () => filterByBlockedCreators(filters.filteredEvents, blockedUserIds),
    [filters.filteredEvents, blockedUserIds],
  );

  const value = useMemo<HomeCatalogValue>(
    () => ({
      events: feed.events,
      loading: feed.loading,
      eventsError: feed.eventsError,
      setEventsError: feed.setEventsError,
      hasMoreEvents: feed.hasMoreEvents,
      catalogHydrating: feed.catalogHydrating,
      deepLinkFailed: feed.deepLinkFailed,
      clearDeepLinkFailed: feed.clearDeepLinkFailed,
      feedScrollRef: feed.feedScrollRef,
      feedSentinelRef: feed.feedSentinelRef,
      eventCardRefs,
      fetchEvents: feed.fetchEvents,
      ensureFullCatalog: feed.ensureFullCatalog,
      refreshEventRating: feed.refreshEventRating,
      mergeDeepLinkedEvent: feed.mergeDeepLinkedEvent,
      tagResolutionMap,
      setTagResolutionMap,
      searchQuery: filters.searchQuery,
      setSearchQuery: filters.setSearchQuery,
      selectedTags: filters.selectedTags,
      setSelectedTags: filters.setSelectedTags,
      filteredEvents: visibleFilteredEvents,
      tagSuggestions: filters.tagSuggestions,
      browsing: filters.browsing,
      filtering: filters.filtering,
      catalogStillLoading: filters.catalogStillLoading,
      searchDragOver: filters.searchDragOver,
      selectTagFilter: filters.selectTagFilter,
      removeTagFilter: filters.removeTagFilter,
      clearFilters: filters.clearFilters,
      handleSearchDrop: filters.handleSearchDrop,
      handleSearchDragOver: filters.handleSearchDragOver,
      handleSearchDragLeave: filters.handleSearchDragLeave,
      applyHomeTagFilter,
      goHome,
      showHomeFeed,
    }),
    [feed, filters, tagResolutionMap, applyHomeTagFilter, goHome, showHomeFeed, visibleFilteredEvents],
  );

  return (
    <HomeCatalogContext.Provider value={value}>
      <TagDisplayProvider map={tagResolutionMap}>{children}</TagDisplayProvider>
    </HomeCatalogContext.Provider>
  );
}

export function useHomeCatalog(): HomeCatalogValue {
  const ctx = useContext(HomeCatalogContext);
  if (!ctx) {
    throw new Error('useHomeCatalog must be used inside HomeCatalogProvider');
  }
  return ctx;
}

export function useHomeCatalogOptional(): HomeCatalogValue | null {
  return useContext(HomeCatalogContext);
}
