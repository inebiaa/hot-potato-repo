import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Rating } from '../lib/supabase';
import {
  fetchEventRatingStats,
  fetchRatingBundleForEvent,
  fetchUserRatingsByEventId,
} from '../lib/eventRatingStats';
import {
  FEED_PAGE_SIZE,
  FEED_PREFETCH_VIEWPORTS,
  compareEventsForFeed,
  fetchBeyondHorizonUpcomingEvents,
  fetchEventWithStats,
  fetchPastEventsPage,
  fetchUpcomingEvents,
  mapEventsWithStats,
  mergeEventsByFeedOrder,
  type EventWithStats,
} from '../lib/eventsFeed';

type UseEventsFeedOptions = {
  userId: string | undefined;
  /** When false, do not download the browse feed (other pages). Cache stays if already loaded. */
  enabled?: boolean;
};

export function useEventsFeed({ userId, enabled = true }: UseEventsFeedOptions) {
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(enabled);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreErrorRef = useRef<string | null>(null);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deepLinkFailed, setDeepLinkFailed] = useState(false);
  const [catalogHydrating, setCatalogHydrating] = useState(false);

  const feedScrollRef = useRef<HTMLElement | null>(null);
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const browsingRef = useRef(true);
  const userRatingsCacheRef = useRef<Map<string, Rating>>(new Map());
  const hasLoadedEventsRef = useRef(false);
  const eventsOffsetRef = useRef(0);
  const hasMoreEventsRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const ensuringCatalogRef = useRef(false);
  const beyondHorizonLoadedRef = useRef(false);
  const catalogFullyLoadedRef = useRef(false);

  const fetchEvents = useCallback(
    async (opts?: { append?: boolean; force?: boolean }) => {
      if (!enabledRef.current) return;
      const append = opts?.append ?? false;
      const force = opts?.force ?? false;
      const silent = hasLoadedEventsRef.current && !force && !append;
      if (!append && !silent) setLoading(true);
      if (append) {
        if (loadingMoreRef.current || !hasMoreEventsRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        setLoadMoreError(null);
        loadMoreErrorRef.current = null;
      } else if (!silent) {
        setEventsError(null);
        setLoadMoreError(null);
        loadMoreErrorRef.current = null;
        eventsOffsetRef.current = 0;
        hasMoreEventsRef.current = true;
        setHasMoreEvents(true);
        beyondHorizonLoadedRef.current = false;
        catalogFullyLoadedRef.current = false;
      } else if (force) {
        setEventsError(null);
        setLoadMoreError(null);
        loadMoreErrorRef.current = null;
      }

      try {
        const userRatingsPromise =
          append && userRatingsCacheRef.current.size > 0
            ? Promise.resolve({ data: userRatingsCacheRef.current, error: null as Error | null })
            : userId
              ? fetchUserRatingsByEventId(userId)
              : Promise.resolve({ data: new Map<string, Rating>(), error: null as Error | null });

        if (!append) {
          const [upcomingRes, pastRes, userRatingsRes] = await Promise.all([
            fetchUpcomingEvents(),
            fetchPastEventsPage(0, FEED_PAGE_SIZE),
            userRatingsPromise,
          ]);

          if (upcomingRes.error) {
            if (!silent) {
              setEventsError(upcomingRes.error.message);
              setEvents([]);
            }
            return;
          }
          if (pastRes.error) {
            if (!silent) {
              setEventsError(pastRes.error.message);
              setEvents([]);
            }
            return;
          }

          if (userRatingsRes.error) {
            console.error('Error fetching user ratings:', userRatingsRes.error);
            userRatingsCacheRef.current = new Map();
          } else {
            userRatingsCacheRef.current = userRatingsRes.data;
          }

          const pageRows = [...upcomingRes.data, ...pastRes.data];
          const statsRes = await fetchEventRatingStats(pageRows.map((e) => e.id));
          const statsMap = statsRes.error ? new Map() : statsRes.data;
          if (statsRes.error) {
            console.error('Error fetching event rating stats:', statsRes.error);
          }

          const mapped = mapEventsWithStats(pageRows, statsMap, userRatingsCacheRef.current).sort(
            (a, b) => compareEventsForFeed(a, b),
          );

          // Silent refresh must not wipe a hydrated catalog or restart filter loading.
          const preserveCatalog =
            silent &&
            (catalogFullyLoadedRef.current ||
              beyondHorizonLoadedRef.current ||
              eventsOffsetRef.current > pastRes.data.length ||
              !hasMoreEventsRef.current);

          if (preserveCatalog) {
            setEvents((prev) => mergeEventsByFeedOrder(prev, mapped));
          } else {
            eventsOffsetRef.current = pastRes.data.length;
            hasMoreEventsRef.current = pastRes.hasMore;
            setHasMoreEvents(pastRes.hasMore);
            setEvents(mapped);
          }

          setEventsError(null);
          setLoadMoreError(null);
        loadMoreErrorRef.current = null;
        } else {
          const pastRes = await fetchPastEventsPage(eventsOffsetRef.current, FEED_PAGE_SIZE);
          if (pastRes.error) {
            setLoadMoreError(pastRes.error.message);
            loadMoreErrorRef.current = pastRes.error.message;
            return;
          }

          eventsOffsetRef.current += pastRes.data.length;
          hasMoreEventsRef.current = pastRes.hasMore;
          setHasMoreEvents(pastRes.hasMore);

          const statsRes = await fetchEventRatingStats(pastRes.data.map((e) => e.id));
          const statsMap = statsRes.error ? new Map() : statsRes.data;
          if (statsRes.error) {
            console.error('Error fetching event rating stats:', statsRes.error);
          }

          const pageMapped = mapEventsWithStats(pastRes.data, statsMap, userRatingsCacheRef.current);
          setEvents((prev) => mergeEventsByFeedOrder(prev, pageMapped));
          setLoadMoreError(null);
        loadMoreErrorRef.current = null;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (append) {
          setLoadMoreError(message);
          loadMoreErrorRef.current = message;
        } else if (!silent) {
          setEventsError(message);
          setEvents([]);
        }
        console.error('Error fetching events:', error);
      } finally {
        hasLoadedEventsRef.current = true;
        if (append) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  const loadMoreEvents = useCallback(() => {
    if (loadMoreErrorRef.current) return;
    void fetchEvents({ append: true });
  }, [fetchEvents]);

  const maybePrefetchFeed = useCallback(() => {
    if (!enabledRef.current) return;
    if (!browsingRef.current || !hasMoreEventsRef.current || loadingMoreRef.current || loading) return;

    const root = feedScrollRef.current;
    if (!root) {
      loadMoreEvents();
      return;
    }
    const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
    const need = root.clientHeight * FEED_PREFETCH_VIEWPORTS;
    if (remaining < need) {
      loadMoreEvents();
    }
  }, [loading, loadMoreEvents]);

  useEffect(() => {
    if (!enabled) return;
    void fetchEvents();
  }, [enabled, fetchEvents]);

  useEffect(() => {
    if (!enabled) return;
    maybePrefetchFeed();
  }, [enabled, maybePrefetchFeed, hasMoreEvents, loadingMore, events.length]);

  useEffect(() => {
    if (!enabled) return;
    const root = feedScrollRef.current;
    if (!root) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        maybePrefetchFeed();
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, maybePrefetchFeed]);

  useEffect(() => {
    if (!enabled) return;
    if (!browsingRef.current || !hasMoreEvents || loading) return;

    const root = feedScrollRef.current;
    const target = feedSentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && browsingRef.current) {
          loadMoreEvents();
        }
      },
      { root, rootMargin: '2000px 0px', threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [enabled, hasMoreEvents, loadingMore, loading, events.length, loadMoreEvents]);

  const ensureFullCatalog = useCallback(async () => {
    enabledRef.current = true;
    if (!hasLoadedEventsRef.current) {
      await fetchEvents();
    }
    if (catalogFullyLoadedRef.current || ensuringCatalogRef.current) return;
    ensuringCatalogRef.current = true;
    setCatalogHydrating(true);
    try {
      if (!beyondHorizonLoadedRef.current) {
        const beyondRes = await fetchBeyondHorizonUpcomingEvents();
        if (!beyondRes.error && beyondRes.data.length > 0) {
          const statsRes = await fetchEventRatingStats(beyondRes.data.map((e) => e.id));
          if (!statsRes.error) {
            const mapped = mapEventsWithStats(
              beyondRes.data,
              statsRes.data,
              userRatingsCacheRef.current,
            );
            setEvents((prev) => mergeEventsByFeedOrder(prev, mapped));
          }
        }
        beyondHorizonLoadedRef.current = true;
      }
      while (hasMoreEventsRef.current) {
        await fetchEvents({ append: true });
      }
      catalogFullyLoadedRef.current = true;
    } finally {
      ensuringCatalogRef.current = false;
      setCatalogHydrating(false);
    }
  }, [fetchEvents]);

  const refreshEventRating = useCallback(
    async (eventId: string) => {
      const bundle = await fetchRatingBundleForEvent(eventId, userId);
      if (bundle.error) {
        console.error('Error refreshing event rating:', bundle.error);
        return;
      }
      if (bundle.user_rating) {
        userRatingsCacheRef.current.set(eventId, bundle.user_rating);
      } else {
        userRatingsCacheRef.current.delete(eventId);
      }
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                average_rating: bundle.average_rating,
                rating_count: bundle.rating_count,
                user_rating: bundle.user_rating,
              }
            : e,
        ),
      );
    },
    [userId],
  );

  const mergeDeepLinkedEvent = useCallback(
    async (eventId: string): Promise<EventWithStats | null> => {
      const { data, error } = await fetchEventWithStats(eventId, userId);
      if (error || !data) {
        setDeepLinkFailed(true);
        return null;
      }
      setEvents((prev) => mergeEventsByFeedOrder(prev, [data]));
      return data;
    },
    [userId],
  );

  const clearDeepLinkFailed = useCallback(() => setDeepLinkFailed(false), []);

  return {
    events,
    setEvents,
    loading,
    eventsError,
    setEventsError,
    loadMoreError,
    setLoadMoreError,
    hasMoreEvents,
    loadingMore,
    catalogHydrating,
    deepLinkFailed,
    clearDeepLinkFailed,
    feedScrollRef,
    feedSentinelRef,
    browsingRef: browsingRef as MutableRefObject<boolean>,
    fetchEvents,
    ensureFullCatalog,
    refreshEventRating,
    mergeDeepLinkedEvent,
  };
}
