import { useState, useEffect, useRef, useMemo, useCallback, startTransition, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Sparkles, Search } from 'lucide-react';
import AppHeader from './components/AppHeader';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event, Rating } from './lib/supabase';
import { eventDateMatchesSearch, formatEventDateDisplay } from './lib/formatEventDate';
import { getSeasonFromDate } from './lib/season';
import { isEventUpcoming, isUpcomingBeyondHorizon } from './lib/eventDates';
import { effectiveHeaderTags } from './lib/eventHeaderTags';
import { normalizeForSearch } from './lib/normalize';
import { normalizeShowType, showTypeLabel } from './lib/showType';
import { getSpecialGuests, isSpecialGuestsSlug } from './lib/specialGuests';
import { readableTextForBg } from './lib/colorUtils';
import EventCard from './components/EventCard';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import SettingsPage from './components/SettingsPage';
import TagRatingsModal from './components/TagRatingsModal';
import StatisticsPage from './components/StatisticsPage';
import ProfilePage from './components/ProfilePage';
import SharedLibraryListPage from './components/SharedLibraryListPage';
import { BackIconButton } from './components/ui';
import { profilePagePath } from './lib/siteBase';
import { isProfileHandlePathSegment, resolveProfileByHandle } from './lib/userProfile';
import type { AppSettings } from './types/appSettings';
import { TagDisplayProvider } from './contexts/TagDisplayContext';
import { CopyProvider } from './contexts/CopyContext';
import { overridesFromSettings, t as copyT } from './copy';
import {
  displayLabelForTagFilter,
  fetchTagResolutionForEvents,
  tagResolutionKey,
  type TagResolutionMap,
} from './lib/tagDisplayResolution';
import {
  normalizeTagName,
  searchTagIdentities,
  type TagIdentityRecord,
} from './lib/tagIdentity';
import { filterEventsBySelectedTags } from './lib/eventTagFilter';
import {
  cityMatchesRegionQuery,
  regionSuggestionMatchesQuery,
} from './lib/cityPlaces';
import {
  collectSearchableTagsFromEvents,
  identityIdsFromSearchableTags,
} from './lib/searchableTagsFromEvents';
import PrimarySearchBar from './components/PrimarySearchBar';
import MasonryLaneFeed, { type MasonryLaneItem } from './components/MasonryLaneFeed';
import EventJsonLd from './components/EventJsonLd';
import { eventPagePath } from './lib/siteBase';
import { clearAppModalParams, parseAppModal, setAppModalParams } from './lib/searchParamsModal';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useDesktopLikePointer } from './hooks/useDesktopLikePointer';
import {
  fetchEventRatingStats,
  fetchRatingBundleForEvent,
  fetchUserRatingsByEventId,
} from './lib/eventRatingStats';
import {
  brandShareImageUrl,
  setRuntimeBrandShareImage,
  syncSiteSocialOgDescriptionInDocument,
  syncSiteSocialOgImageInDocument,
} from './lib/brandSocial';
import {
  EVENT_FEED_COLUMNS,
  FEED_PAGE_SIZE,
  FEED_PREFETCH_VIEWPORTS,
  compareEventsForFeed,
  feedUpcomingHorizonYmd,
  fetchBeyondHorizonUpcomingEvents,
  fetchPastEventsPage,
  fetchUpcomingEvents,
  mapEventsWithStats,
  mergeEventsByFeedOrder,
  toEventWithStats,
  type EventWithStats,
} from './lib/eventsFeed';

/** Survive remounts so we don't flash a full-page spinner on every route land. */
let settingsCache: AppSettings | null = null;

function App() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signOut, isAdmin } = useAuth();
  const desktopLikePointer = useDesktopLikePointer();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<{ type: string; value: string; label: string }[]>([]);
  const [overlayEventId, setOverlayEventId] = useState<string | null>(null);
  const [overlaySource, setOverlaySource] = useState<'tagModal' | 'viewRatings' | null>(null);
  const [tagModalRefreshTrigger, setTagModalRefreshTrigger] = useState(0);
  const [identitySearchHits, setIdentitySearchHits] = useState<TagIdentityRecord[]>([]);
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasClearedFiltersForSharedLink = useRef(false);
  const overlayCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLElement | null>(null);
  const feedSentinelRef = useRef<HTMLDivElement | null>(null);
  const userRatingsCacheRef = useRef<Map<string, Rating>>(new Map());
  const tagResolvedEventIdsRef = useRef<Set<string>>(new Set());
  const [appSettings, setAppSettings] = useState<AppSettings | null>(() => settingsCache);
  const hasLoadedEventsRef = useRef(false);
  const eventsOffsetRef = useRef(0);
  const hasMoreEventsRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const ensuringCatalogRef = useRef(false);
  const beyondHorizonLoadedRef = useRef(false);
  const [hasMoreEvents, setHasMoreEvents] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deepLinkFailed, setDeepLinkFailed] = useState(false);
  const [searchDragOver, setSearchDragOver] = useState(false);
  const [tagResolutionMap, setTagResolutionMap] = useState<TagResolutionMap | null>(null);
  const [profileReviewCounts, setProfileReviewCounts] = useState<{ visible: number; total: number } | null>(null);
  const [profileBoardEvents, setProfileBoardEvents] = useState<Event[] | null>(null);
  const [profileHeaderBack, setProfileHeaderBack] = useState<{
    label: string;
    onClick: () => void;
  } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileResolving, setProfileResolving] = useState(false);
  const [profileNotFound, setProfileNotFound] = useState(false);

  const modalRoute = useMemo(() => parseAppModal(searchParams), [searchParams]);

  const closeAppModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

  const openSettings = useCallback(() => {
    startTransition(() => {
      navigate({ pathname: '/', search: '?settings=1' });
      window.scrollTo(0, 0);
    });
  }, [navigate]);

  const openAddEventModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: setAppModalParams(searchParams, 'add-event') });
  }, [navigate, location.pathname, searchParams]);

  const openTagModal = useCallback(
    (type: string, value: string) => {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'tag', { tagType: type, tagValue: value }),
      });
    },
    [navigate, location.pathname, searchParams]
  );

  const openAuthModal = useCallback(
    (mode: 'signin' | 'signup' = 'signin', prompt?: string) => {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'auth', { authMode: mode, authPrompt: prompt }),
      });
    },
    [navigate, location.pathname, searchParams]
  );

  const closeAuthModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

  const handleSearchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setSearchDragOver(false);
    const raw = e.dataTransfer.getData('text/plain');
    const match = raw?.match(/^tag-filter:([^:]+):(.+)$/);
    if (match) {
      const [, type, value] = match;
      const searchTerm = type === 'custom_performer' ? value.split('\x00')[1] ?? value : value;
      setSearchQuery(searchTerm);
    }
  };
  const handleSearchDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setSearchDragOver(true);
  };
  const handleSearchDragLeave = () => {
    setSearchDragOver(false);
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value;
      });
      const iconValue = (key: keyof AppSettings, fallback: string) =>
        Object.prototype.hasOwnProperty.call(settingsObj, key) ? settingsObj[key] : fallback;

      const scheme = settingsObj.color_scheme || 'custom';
      const useAutoText = scheme === 'faded' || scheme === 'bright';
      const resolveText = (bg: string, explicit: string | undefined, fallback: string) =>
        useAutoText ? readableTextForBg(bg) : (explicit || fallback);

      const producerBg = settingsObj.producer_bg_color || '#f3f4f6';
      const designerBg = settingsObj.designer_bg_color || '#fef3c7';
      const modelBg = settingsObj.model_bg_color || '#fce7f3';
      const hairBg = settingsObj.hair_makeup_bg_color || '#f3e8ff';
      const cityBg = settingsObj.city_bg_color || '#dbeafe';
      const seasonBg = settingsObj.season_bg_color || '#ffedd5';
      const headerBg = settingsObj.header_tags_bg_color || '#ccfbf1';
      const countdownBg = settingsObj.countdown_bg_color || '#fef3c7';
      const footerBg = settingsObj.footer_tags_bg_color || '#d1fae5';
      const optionalBg = settingsObj.optional_tags_bg_color || '#e0e7ff';
      const specialGuestsBg = settingsObj.special_guests_bg_color || '#e0e7ff';

      const nextSettings: AppSettings = {
        app_name: settingsObj.app_name ?? undefined,
        app_icon_url: settingsObj.app_icon_url ?? undefined,
        app_logo_url: settingsObj.app_logo_url ?? undefined,
        app_favicon_url: settingsObj.app_favicon_url ?? undefined,
        tagline: settingsObj.tagline ?? undefined,
        copy_overrides: settingsObj.copy_overrides ?? '',
        color_scheme: scheme,
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: producerBg,
        producer_text_color: resolveText(producerBg, settingsObj.producer_text_color, '#374151'),
        designer_bg_color: designerBg,
        designer_text_color: resolveText(designerBg, settingsObj.designer_text_color, '#b45309'),
        model_bg_color: modelBg,
        model_text_color: resolveText(modelBg, settingsObj.model_text_color, '#be185d'),
        hair_makeup_bg_color: hairBg,
        hair_makeup_text_color: resolveText(hairBg, settingsObj.hair_makeup_text_color, '#7e22ce'),
        city_bg_color: cityBg,
        city_text_color: resolveText(cityBg, settingsObj.city_text_color, '#1e40af'),
        season_bg_color: seasonBg,
        season_text_color: resolveText(seasonBg, settingsObj.season_text_color, '#c2410c'),
        header_tags_bg_color: headerBg,
        header_tags_text_color: resolveText(headerBg, settingsObj.header_tags_text_color, '#0f766e'),
        countdown_bg_color: countdownBg,
        countdown_text_color: resolveText(countdownBg, settingsObj.countdown_text_color, '#92400e'),
        footer_tags_bg_color: footerBg,
        footer_tags_text_color: resolveText(footerBg, settingsObj.footer_tags_text_color, '#065f46'),
        producer_icon: iconValue('producer_icon', 'Sparkles'),
        designer_icon: iconValue('designer_icon', 'Star'),
        model_icon: iconValue('model_icon', 'Users'),
        hair_makeup_icon: iconValue('hair_makeup_icon', 'Scissors'),
        city_icon: iconValue('city_icon', 'MapPin'),
        season_icon: iconValue('season_icon', 'Calendar'),
        header_tags_icon: iconValue('header_tags_icon', 'Tag'),
        footer_tags_icon: iconValue('footer_tags_icon', 'Tag'),
        special_guests_icon: iconValue('special_guests_icon', 'Mic'),
        optional_tags_bg_color: optionalBg,
        optional_tags_text_color: resolveText(optionalBg, settingsObj.optional_tags_text_color, '#3730a3'),
        special_guests_bg_color: specialGuestsBg,
        special_guests_text_color: resolveText(specialGuestsBg, settingsObj.special_guests_text_color, '#3730a3'),
      };
      settingsCache = nextSettings;
      setAppSettings(nextSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchEvents = async (opts?: { append?: boolean }) => {
    const append = opts?.append ?? false;
    const silent = hasLoadedEventsRef.current;
    if (!append && !silent) setLoading(true);
    if (append) {
      if (loadingMoreRef.current || !hasMoreEventsRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      setEventsError(null);
      eventsOffsetRef.current = 0;
      hasMoreEventsRef.current = true;
      setHasMoreEvents(true);
      beyondHorizonLoadedRef.current = false;
      tagResolvedEventIdsRef.current = new Set();
    }

    try {
      // Home UI order: soonest upcoming first, then newest past.
      // Load all upcoming on first paint; page only the past catalog afterward.
      const userRatingsPromise =
        append && userRatingsCacheRef.current.size > 0
          ? Promise.resolve({ data: userRatingsCacheRef.current, error: null as Error | null })
          : user?.id
            ? fetchUserRatingsByEventId(user.id)
            : Promise.resolve({ data: new Map<string, Rating>(), error: null as Error | null });

      if (!append) {
        const [upcomingRes, pastRes, userRatingsRes] = await Promise.all([
          fetchUpcomingEvents(),
          fetchPastEventsPage(0, FEED_PAGE_SIZE),
          userRatingsPromise,
        ]);

        if (upcomingRes.error) {
          setEventsError(upcomingRes.error.message);
          setEvents([]);
          setFilteredEvents([]);
          return;
        }
        if (pastRes.error) {
          setEventsError(pastRes.error.message);
          setEvents([]);
          setFilteredEvents([]);
          return;
        }
        if (userRatingsRes.error) {
          setEventsError(userRatingsRes.error.message);
          setEvents([]);
          setFilteredEvents([]);
          return;
        }

        userRatingsCacheRef.current = userRatingsRes.data;
        const pageRows = [...upcomingRes.data, ...pastRes.data];
        eventsOffsetRef.current = pastRes.data.length;
        hasMoreEventsRef.current = pastRes.hasMore;
        setHasMoreEvents(pastRes.hasMore);

        const statsRes = await fetchEventRatingStats(pageRows.map((e) => e.id));
        if (statsRes.error) {
          setEventsError(statsRes.error.message);
          setEvents([]);
          setFilteredEvents([]);
          return;
        }

        const mapped = mapEventsWithStats(pageRows, statsRes.data, userRatingsCacheRef.current)
          .sort((a, b) => compareEventsForFeed(a, b));
        setEvents(mapped);
        setFilteredEvents(mapped);
      } else {
        const pastRes = await fetchPastEventsPage(eventsOffsetRef.current, FEED_PAGE_SIZE);
        if (pastRes.error) {
          setEventsError(pastRes.error.message);
          return;
        }

        eventsOffsetRef.current += pastRes.data.length;
        hasMoreEventsRef.current = pastRes.hasMore;
        setHasMoreEvents(pastRes.hasMore);

        const statsRes = await fetchEventRatingStats(pastRes.data.map((e) => e.id));
        if (statsRes.error) {
          setEventsError(statsRes.error.message);
          return;
        }

        const pageMapped = mapEventsWithStats(pastRes.data, statsRes.data, userRatingsCacheRef.current);
        setEvents((prev) => mergeEventsByFeedOrder(prev, pageMapped));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEventsError(message);
      if (!append) {
        setEvents([]);
        setFilteredEvents([]);
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
  };

  const loadMoreEvents = () => {
    void fetchEvents({ append: true });
  };

  /** Prefetch upcoming pages so content is ready before the user scrolls into empty space. */
  const maybePrefetchFeed = useCallback(() => {
    const browsing =
      selectedTags.length === 0 && searchQuery.trim().length < 2;
    if (!browsing || !hasMoreEventsRef.current || loadingMoreRef.current || loading) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, selectedTags.length, searchQuery]);

  useEffect(() => {
    maybePrefetchFeed();
  }, [maybePrefetchFeed, hasMoreEvents, loadingMore, events.length]);

  useEffect(() => {
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
  }, [maybePrefetchFeed]);

  /** Backup: when the bottom sentinel nears the viewport, pull another chunk. */
  useEffect(() => {
    const browsing =
      selectedTags.length === 0 && searchQuery.trim().length < 2;
    if (!browsing || !hasMoreEvents || loading) return;

    const root = feedScrollRef.current;
    const target = feedSentinelRef.current;
    if (!root || !target) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMoreEvents();
        }
      },
      { root, rootMargin: '2000px 0px', threshold: 0 },
    );
    io.observe(target);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreEvents, loadingMore, loading, events.length, selectedTags.length, searchQuery]);

  /** Search/tag filters need the full catalog; pull beyond-horizon + remaining past once. */
  const ensureFullCatalog = useCallback(async () => {
    if (ensuringCatalogRef.current) return;
    ensuringCatalogRef.current = true;
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
    } finally {
      ensuringCatalogRef.current = false;
    }
    // fetchEvents closes over user; intentional for identity-scoped ratings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** After a rating, refresh only that show's stats — not the whole feed. */
  const refreshEventRating = useCallback(
    async (eventId: string) => {
      const bundle = await fetchRatingBundleForEvent(eventId, user?.id);
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
    [user?.id],
  );

  useEffect(() => {
    void fetchSettings();
    // Settings are global — load once per App mount, not on every auth tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchEvents();
    // Refetch when identity changes (login/logout) so user_rating stays correct.
    // Use user?.id so token/object churn does not retrigger; silent after first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const needsFullCatalog =
      selectedTags.length > 0 || searchQuery.trim().length >= 2;
    if (!needsFullCatalog || !hasMoreEvents) return;
    void ensureFullCatalog();
  }, [selectedTags, searchQuery, hasMoreEvents, ensureFullCatalog]);

  useEffect(() => {
    if (events.length === 0) {
      setTagResolutionMap(new Map());
      tagResolvedEventIdsRef.current = new Set();
      return;
    }
    const unresolved = events.filter((e) => !tagResolvedEventIdsRef.current.has(e.id));
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
  }, [events]);

  useEffect(() => {
    if (appSettings?.app_favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = appSettings.app_favicon_url;
      }
    }
  }, [appSettings?.app_favicon_url]);

  useEffect(() => {
    if (!appSettings) return;
    const image = brandShareImageUrl(appSettings);
    setRuntimeBrandShareImage(image);
    syncSiteSocialOgImageInDocument(image, appSettings.app_name || 'Secret Blogger');
    syncSiteSocialOgDescriptionInDocument(copyT('home.subtitleSignedIn', overridesFromSettings(appSettings)));
  }, [appSettings]);

  const identityIdsInUse = useMemo(() => {
    const s = new Set<string>();
    tagResolutionMap?.forEach((entry) => {
      if (entry.identityId) s.add(entry.identityId);
    });
    return s;
  }, [tagResolutionMap]);


  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setIdentitySearchHits([]);
      return;
    }
    // Inside a board: suggestions come only from that board's tags (no global identity hits).
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
    const identityAllowlist =
      selectedTags.length > 0 ? identityIdsFromSearchableTags(sourceTags) : identityIdsInUse;
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

  const scrollFeedToTop = useCallback(() => {
    feedScrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const wasFilteringRef = useRef(false);
  useEffect(() => {
    const filtering = selectedTags.length > 0 || searchQuery.trim().length >= 2;
    if (filtering && !wasFilteringRef.current) {
      scrollFeedToTop();
    }
    wasFilteringRef.current = filtering;
  }, [selectedTags, searchQuery, scrollFeedToTop]);

  const handleTagClick = (type: string, value: string, explicitLabel?: string) => {
    if (overlayEventId) closeEventOverlay();
    else navigate({ pathname: '/', search: '' });
    const label = displayLabelForTagFilter(type, value, tagResolutionMap, explicitLabel);
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return prev;
      return [...prev, { type, value, label }];
    });
    setSearchQuery('');
    scrollFeedToTop();
  };

  const selectTagFilter = (type: string, value: string, explicitLabel?: string) => {
    const label = displayLabelForTagFilter(type, value, tagResolutionMap, explicitLabel);
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return prev;
      return [...prev, { type, value, label }];
    });
    setSearchQuery('');
    scrollFeedToTop();
  };

  const removeTagFilter = (type: string, value: string) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.type === type && t.value === value)));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    scrollFeedToTop();
  };

  // Legacy URLs: /?event=uuid → /event/uuid (keeps embed, stats, etc.)
  useEffect(() => {
    const q = searchParams.get('event');
    if (!q || params.eventId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    const qs = next.toString();
    navigate(`/event/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.eventId, navigate]);

  // Legacy URLs: /?list=uuid → /list/uuid
  useEffect(() => {
    const q = searchParams.get('list');
    if (!q || params.listId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('list');
    const qs = next.toString();
    navigate(`/list/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.listId, navigate]);

  const embedMode = searchParams.get('embed') === '1';
  const eventIdFromQuery = searchParams.get('event');
  const eventIdFromPath = params.eventId ?? null;
  const eventIdFromUrl = eventIdFromPath ?? eventIdFromQuery;
  const showProfile = searchParams.get('profile') === '1';
  const profileHandle =
    params.handle && isProfileHandlePathSegment(params.handle) ? params.handle : null;
  const showProfileView = showProfile || !!profileHandle;
  const sharedListId = params.listId ?? searchParams.get('list');
  const showSharedList = !!sharedListId;
  const showStats = searchParams.get('stats') === '1';
  const showSettings = searchParams.get('settings') === '1';
  const pathname = location.pathname;

  const isAddEventModalOpen = modalRoute.modal === 'add-event';
  const isAuthModalOpen = modalRoute.modal === 'auth';
  const isTagRatingsModalOpen =
    !showStats && modalRoute.modal === 'tag' && !!modalRoute.tagType && !!modalRoute.tagValue;
  const tagRatingsData = isTagRatingsModalOpen
    ? { type: modalRoute.tagType, value: modalRoute.tagValue }
    : null;

  const isEventPanelModal =
    modalRoute.modal === 'rate' ||
    modalRoute.modal === 'view-ratings' ||
    modalRoute.modal === 'edit-event';

  // Keep overlay state in sync with /event/:eventId (e.g. browser back)
  useEffect(() => {
    if (params.eventId) {
      setOverlayEventId(params.eventId);
    } else if (!searchParams.get('event')) {
      setOverlayEventId(null);
      setOverlaySource(null);
    }
  }, [params.eventId, searchParams]);

  // Sync URL with React: re-render when user navigates (pushState or popstate)
  useEffect(() => {
    const sync = () => {
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const openStats = () => {
    navigate({ pathname: '/', search: '?stats=1' });
    window.scrollTo(0, 0);
  };

  const goBackFromStats = () => {
    navigate({ pathname: '/', search: '' });
    window.scrollTo(0, 0);
  };

  const goBackFromSettings = () => {
    navigate({ pathname: '/', search: '' });
    window.scrollTo(0, 0);
    void fetchSettings();
  };

  // Resolve /handle to a user id (readable without sign-in)
  useEffect(() => {
    if (!showProfileView) {
      setProfileUserId(null);
      setProfileResolving(false);
      setProfileNotFound(false);
      setProfileHeaderBack(null);
      setProfileBoardEvents(null);
      return;
    }

    if (profileHandle) {
      let cancelled = false;
      setProfileResolving(true);
      setProfileNotFound(false);
      void resolveProfileByHandle(profileHandle).then((row) => {
        if (cancelled) return;
        setProfileResolving(false);
        if (!row) {
          setProfileNotFound(true);
          setProfileUserId(null);
          return;
        }
        setProfileUserId(row.user_id);
      });
      return () => {
        cancelled = true;
      };
    }

    if (authLoading) {
      setProfileResolving(true);
      return;
    }
    setProfileResolving(false);
    if (user) {
      setProfileUserId(user.id);
      setProfileNotFound(false);
    } else {
      setProfileUserId(null);
    }
  }, [showProfileView, profileHandle, user?.id, authLoading]);

  // Legacy ?modal=settings → ?settings=1 page
  useEffect(() => {
    if (searchParams.get('modal') !== 'settings') return;
    navigate({ pathname: '/', search: '?settings=1' }, { replace: true });
  }, [searchParams, navigate]);

  // When opening shared link (?event=xxx), clear filters once so the event is visible (don't clear again when user searches)
  useEffect(() => {
    if (!embedMode && eventIdFromUrl && !loading && events.length > 0 && !hasClearedFiltersForSharedLink.current) {
      const eventExists = events.some((e) => e.id === eventIdFromUrl);
      const eventInFiltered = filteredEvents.some((e) => e.id === eventIdFromUrl);
      if (eventExists && !eventInFiltered) {
        clearFilters();
        hasClearedFiltersForSharedLink.current = true;
      }
    }
  }, [embedMode, eventIdFromUrl, loading, events, filteredEvents]);

  // Sync URL ?event=id to overlay (shared links open overlay)
  useEffect(() => {
    if (!embedMode && eventIdFromUrl && !loading && events.length > 0) {
      setOverlayEventId(eventIdFromUrl);
    }
  }, [embedMode, eventIdFromUrl, loading, events.length]);

  useEffect(() => {
    if (!overlayEventId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeEventOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // closeEventOverlay is stable in behavior for Escape handling
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayEventId]);

  useEffect(() => {
    if (overlayEventId && overlayCardWrapperRef.current) {
      overlayCardWrapperRef.current.focus({ preventScroll: true });
    }
  }, [overlayEventId]);

  const anyPopupOpen = !!(
    overlayEventId ||
    showStats ||
    showProfileView ||
    showSettings ||
    isTagRatingsModalOpen ||
    isAddEventModalOpen ||
    isAuthModalOpen ||
    isEventPanelModal
  );
  useBodyScrollLock(anyPopupOpen);

  useEffect(() => {
    if (!embedMode && eventIdFromUrl && !loading && filteredEvents.length > 0 && !overlayEventId) {
      const el = eventCardRefs.current[eventIdFromUrl];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [embedMode, eventIdFromUrl, loading, filteredEvents, overlayEventId]);

  useEffect(() => {
    let filtered = [...events];

    // Browse feed: hide upcoming shows past the 6-month horizon (still in catalog for search/tags).
    const browsing = selectedTags.length === 0 && searchQuery.trim().length < 2;
    if (browsing) {
      const horizonYmd = feedUpcomingHorizonYmd();
      filtered = filtered.filter((event) => !isUpcomingBeyondHorizon(event.date || '', horizonYmd));
    }

    if (searchQuery.trim()) {
      const queryNorm = normalizeForSearch(searchQuery);
      if (queryNorm) {
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
        filtered = filtered.filter((event) => {
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
                    : (vals || []).some((v: string) => customLineMatch(slug, v))
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
        });
      }
    }

    filtered = filterEventsBySelectedTags(filtered, selectedTags, tagResolutionMap);

    setFilteredEvents(filtered);
  }, [searchQuery, selectedTags, events, tagResolutionMap]);

  const overlayEventFromCache = overlayEventId ? (events.find((e) => e.id === overlayEventId) ?? filteredEvents.find((e) => e.id === overlayEventId)) : null;
  const [overlayEventFetched, setOverlayEventFetched] = useState<EventWithStats | null>(null);

  // When overlay opens with an event not in cache (e.g. from Stats TagRatingsModal), fetch it
  useEffect(() => {
    if (!overlayEventId || overlayEventFromCache) {
      setOverlayEventFetched(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_FEED_COLUMNS)
        .eq('id', overlayEventId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const bundle = await fetchRatingBundleForEvent(data.id, user?.id);
      if (cancelled || bundle.error) return;
      const mapped = toEventWithStats(
        data as Event,
        {
          event_id: data.id,
          average_rating: bundle.average_rating,
          rating_count: bundle.rating_count,
        },
        bundle.user_rating,
      );
      setOverlayEventFetched(mapped);
      // Keep deep-linked shows in the in-memory list so rating refresh stays local.
      setEvents((prev) => mergeEventsByFeedOrder(prev, [mapped]));
    })();
    return () => { cancelled = true; };
    // user referenced for user_rating; including full user would over-fetch on profile edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayEventId, overlayEventFromCache, user?.id]);

  // Embed / shared links: pull a missing show by id without downloading the whole catalog.
  const hasDeepLinkedEvent = eventIdFromUrl
    ? events.some((e) => e.id === eventIdFromUrl)
    : true;
  useEffect(() => {
    setDeepLinkFailed(false);
  }, [eventIdFromUrl]);
  useEffect(() => {
    if (!eventIdFromUrl || loading || hasDeepLinkedEvent) return;
    if (overlayEventId === eventIdFromUrl) return; // overlay effect handles it
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('events')
        .select(EVENT_FEED_COLUMNS)
        .eq('id', eventIdFromUrl)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setDeepLinkFailed(true);
        return;
      }
      const bundle = await fetchRatingBundleForEvent(data.id, user?.id);
      if (cancelled) return;
      if (bundle.error) {
        setDeepLinkFailed(true);
        return;
      }
      const mapped = toEventWithStats(
        data as Event,
        {
          event_id: data.id,
          average_rating: bundle.average_rating,
          rating_count: bundle.rating_count,
        },
        bundle.user_rating,
      );
      setEvents((prev) => mergeEventsByFeedOrder(prev, [mapped]));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventIdFromUrl, loading, hasDeepLinkedEvent, user?.id, overlayEventId]);

  const overlayEvent = overlayEventFromCache ?? overlayEventFetched;

  const openEventOverlay = (
    eventId: string,
    source?: 'tagModal' | 'viewRatings',
  ) => {
    setOverlayEventId(eventId);
    setOverlaySource(source ?? null);
    // Stay on profile when opening a review from My reviews (don’t navigate to /event/:id).
    if (showProfileView) {
      const next = new URLSearchParams(searchParams);
      next.delete('profile');
      next.set('event', eventId);
      if (profileHandle) {
        navigate({ pathname: profilePagePath(profileHandle), search: next.toString() });
      } else {
        next.set('profile', '1');
        navigate({ pathname: '/', search: next.toString() });
      }
    } else {
      navigate(`/event/${eventId}`);
    }
  };

  const closeEventOverlay = () => {
    setOverlayEventId(null);
    setOverlaySource(null);
    setTagModalRefreshTrigger((t) => t + 1);
    if (showProfileView) {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      if (profileHandle) {
        const qs = next.toString();
        navigate(qs ? { pathname: profilePagePath(profileHandle), search: qs } : profilePagePath(profileHandle));
      } else {
        next.set('profile', '1');
        navigate({ pathname: '/', search: next.toString() });
      }
    } else {
      navigate('/');
    }
  };

  const goBack = () => {
    clearFilters();
    setProfileBoardEvents(null);
    navigate({ pathname: '/', search: '' });
    window.scrollTo(0, 0);
  };

  const openProfile = () => {
    void (async () => {
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('user_id_public')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.user_id_public) {
          navigate(profilePagePath(data.user_id_public));
          window.scrollTo(0, 0);
          return;
        }
      }
      navigate({ pathname: '/', search: '?profile=1' });
      window.scrollTo(0, 0);
    })();
  };

  // Embed mode: show only the single event card, minimal layout
  if (embedMode && eventIdFromUrl) {
    const embedEvent = events.find((e) => e.id === eventIdFromUrl);
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    if (!embedEvent) {
      if (deepLinkFailed) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <p className="text-gray-600">Show not found</p>
          </div>
        );
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <CopyProvider settings={appSettings}>
      <EventJsonLd event={embedEvent} />
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <EventCard
            event={embedEvent}
            averageRating={embedEvent.average_rating}
            ratingCount={embedEvent.rating_count}
            userRating={embedEvent.user_rating}
            onRatingSubmitted={() => void refreshEventRating(embedEvent.id)}
            onEventUpdated={fetchEvents}
            onTagClick={handleTagClick}
            tagColors={appSettings}
            customPerformerTags={[]}
          />
        </div>
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={closeAppModal}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={openTagModal}
          tagResolutionMap={tagResolutionMap}
          cachedAllEvents={events}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
      </CopyProvider>
      </TagDisplayProvider>
    );
  }

  if (!appSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
      </div>
    );
  }


  if (showSettings) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50 p-4">
          <div className="text-center">
            <p className="text-gray-700 mb-4">Sign in to open settings.</p>
            <BackIconButton
              href={pathname}
              label={copyT('modals.backToShows', overridesFromSettings(appSettings))}
            />
          </div>
        </div>
      );
    }
    if (!appSettings) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <CopyProvider settings={appSettings}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <AppHeader
          pathname={pathname}
          activeView="settings"
          desktopLikePointer={desktopLikePointer}
          appSettings={appSettings}
          user={user}
          isAdmin={!!isAdmin}
          onGoHome={goBackFromSettings}
          onOpenStats={openStats}
          onOpenProfile={openProfile}
          onOpenSettings={openSettings}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={
            <PrimarySearchBar
              embeddedInHeader
              appSettings={appSettings}
              searchDragOver={searchDragOver}
              selectedTags={selectedTags}
              searchQuery={searchQuery}
              tagSuggestions={tagSuggestions}
              filteredCount={filteredEvents.length}
              totalCount={filteredEvents.length}
              onSearchDrop={handleSearchDrop}
              onSearchDragOver={handleSearchDragOver}
              onSearchDragLeave={handleSearchDragLeave}
              onSearchQueryChange={setSearchQuery}
              onSelectTagFilter={selectTagFilter}
              onRemoveTagFilter={removeTagFilter}
              onClearFilters={clearFilters}
            />
          }
        />
        <main
          className={`flex-1 min-h-0 overflow-y-auto ${desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}
        >
          <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
            <BackIconButton
              type="button"
              onClick={goBackFromSettings}
              label={copyT('modals.backToShows', overridesFromSettings(appSettings))}
              className="mb-6"
            />
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <SettingsPage
              onSettingsUpdated={() => {
                fetchSettings();
                fetchTagResolutionForEvents(events).then(setTagResolutionMap);
              }}
              onSettingsPreview={setAppSettings}
              onAccountUpdated={fetchEvents}
            />
          </div>
        </main>

        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={closeAppModal}
          onEventAdded={fetchEvents}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
      </CopyProvider>
      </TagDisplayProvider>
    );
  }

  if (showStats) {
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <CopyProvider settings={appSettings}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <AppHeader
          pathname={pathname}
          activeView="stats"
          desktopLikePointer={desktopLikePointer}
          appSettings={appSettings}
          user={user}
          isAdmin={!!isAdmin}
          onGoHome={goBackFromStats}
          onOpenStats={openStats}
          onOpenProfile={openProfile}
          onOpenSettings={openSettings}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={
            <PrimarySearchBar
              embeddedInHeader
              appSettings={appSettings}
              searchDragOver={searchDragOver}
              selectedTags={selectedTags}
              searchQuery={searchQuery}
              tagSuggestions={tagSuggestions}
              filteredCount={filteredEvents.length}
              totalCount={filteredEvents.length}
              onSearchDrop={handleSearchDrop}
              onSearchDragOver={handleSearchDragOver}
              onSearchDragLeave={handleSearchDragLeave}
              onSearchQueryChange={setSearchQuery}
              onSelectTagFilter={selectTagFilter}
              onRemoveTagFilter={removeTagFilter}
              onClearFilters={clearFilters}
            />
          }
        />
        <main
          className={`flex-1 min-h-0 overflow-y-auto ${desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}
        >
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            <BackIconButton
              onClick={goBackFromStats}
              label={copyT('modals.backToShows', overridesFromSettings(appSettings))}
              className="mb-6"
            />
            <StatisticsPage
              isOpen={true}
              onClose={goBackFromStats}
              tagColors={appSettings}
              onOpenEvent={(id) => openEventOverlay(id, 'tagModal')}
              tagModalRefreshTrigger={tagModalRefreshTrigger}
              asPage
              events={filteredEvents}
              eventOverlayOpen={!!overlayEventId}
              onCloseEventOverlay={closeEventOverlay}
              tagResolutionMap={tagResolutionMap}
            />
          </div>
        </main>

        {overlayEventId && (
          <div
            className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${overlaySource ? 'z-[75]' : 'z-[60]'}`}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              closeEventOverlay();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
          >
            {overlayEvent ? (
              <div ref={overlayCardWrapperRef} tabIndex={-1} className="relative max-w-md w-full my-8 flex-shrink-0 outline-none" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <EventCard
                  event={overlayEvent}
                  averageRating={overlayEvent.average_rating}
                  ratingCount={overlayEvent.rating_count}
                  userRating={overlayEvent.user_rating}
                  onRatingSubmitted={() => void refreshEventRating(overlayEvent.id)}
                  onEventUpdated={fetchEvents}
                  onTagClick={handleTagClick}
                  tagColors={appSettings}
                  customPerformerTags={[]}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>
        )}

        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={closeAppModal}
          onEventAdded={fetchEvents}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
      </CopyProvider>
      </TagDisplayProvider>
    );
  }

  if (showSharedList && sharedListId) {
    if (!appSettings) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <CopyProvider settings={appSettings}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <AppHeader
          pathname={pathname}
          activeView="home"
          desktopLikePointer={desktopLikePointer}
          appSettings={appSettings}
          user={user}
          isAdmin={!!isAdmin}
          onGoHome={goBack}
          onOpenStats={openStats}
          onOpenProfile={openProfile}
          onOpenSettings={openSettings}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={null}
        />
        <main
          className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden ${desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}
        >
          <div className="max-w-[2400px] mx-auto min-w-0 px-4 py-6 sm:px-6 lg:px-8">
            <BackIconButton
              onClick={goBack}
              label={copyT('modals.backToShows', overridesFromSettings(appSettings))}
              className="mb-6"
            />
            <SharedLibraryListPage
              listId={sharedListId}
              onTagClick={handleTagClick}
              onOpenEvent={(id) => openEventOverlay(id)}
              tagColors={appSettings}
              customPerformerTags={[]}
            />
          </div>
        </main>
      </div>
      </CopyProvider>
      </TagDisplayProvider>
    );
  }

  if (showProfileView) {
    if (profileResolving || (showProfile && authLoading && !profileHandle)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    if (profileNotFound) {
      return (
        <CopyProvider settings={appSettings ?? undefined}>
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50 p-4">
            <div className="text-center">
              <p className="text-gray-700 mb-4">{copyT('profile.notFound', overridesFromSettings(appSettings))}</p>
              <BackIconButton href="/" label={copyT('modals.backToShows', overridesFromSettings(appSettings))} />
            </div>
          </div>
        </CopyProvider>
      );
    }
    if (showProfile && !user && !profileHandle) {
      return (
        <CopyProvider settings={appSettings ?? undefined}>
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50 p-4">
            <div className="text-center">
              <p className="text-gray-700 mb-4">{copyT('profile.signInToView', overridesFromSettings(appSettings))}</p>
              <BackIconButton
                href={pathname}
                label={copyT('modals.backToShows', overridesFromSettings(appSettings))}
              />
            </div>
          </div>
        </CopyProvider>
      );
    }
    if (!profileUserId) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    if (!appSettings) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <CopyProvider settings={appSettings}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <AppHeader
          pathname={pathname}
          activeView="profile"
          desktopLikePointer={desktopLikePointer}
          appSettings={appSettings}
          user={user}
          isAdmin={!!isAdmin}
          onGoHome={goBack}
          onOpenStats={openStats}
          onOpenProfile={openProfile}
          onOpenSettings={openSettings}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={
            <PrimarySearchBar
              embeddedInHeader
              appSettings={appSettings}
              searchDragOver={searchDragOver}
              selectedTags={selectedTags}
              searchQuery={searchQuery}
              tagSuggestions={tagSuggestions}
              filteredCount={profileReviewCounts?.visible}
              totalCount={profileReviewCounts?.total}
              summaryLabelSingular="review"
              summaryLabelPlural="reviews"
              onSearchDrop={handleSearchDrop}
              onSearchDragOver={handleSearchDragOver}
              onSearchDragLeave={handleSearchDragLeave}
              onSearchQueryChange={setSearchQuery}
              onSelectTagFilter={selectTagFilter}
              onRemoveTagFilter={removeTagFilter}
              onClearFilters={clearFilters}
            />
          }
        />
        <main
          className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden ${desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}
        >
          <div className="max-w-[2400px] mx-auto min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <BackIconButton
            onClick={profileHeaderBack?.onClick ?? goBack}
            label={
              profileHeaderBack?.label ??
              copyT('modals.backToShows', overridesFromSettings(appSettings))
            }
            className="mb-6"
          />
          <ProfilePage
            userId={profileUserId}
            pathname={pathname}
            onClose={goBack}
            onTagClick={handleTagClick}
            onOpenEvent={(id) => openEventOverlay(id, 'viewRatings')}
            onClearSearch={clearFilters}
            onBoardEventsChange={setProfileBoardEvents}
            onHeaderBackChange={setProfileHeaderBack}
            searchEvents={
              selectedTags.length > 0 || searchQuery.trim().length >= 2 ? filteredEvents : []
            }
            searchActive={selectedTags.length > 0 || searchQuery.trim().length >= 2}
            onSearchEventRatingSubmitted={(id) => void refreshEventRating(id)}
            onSearchEventUpdated={fetchEvents}
            tagColors={appSettings}
            customPerformerTags={[]}
            onVisibleReviewCountsChange={setProfileReviewCounts}
          />
          </div>
        </main>

        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={closeAppModal}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={openTagModal}
          tagResolutionMap={tagResolutionMap}
          cachedAllEvents={events}
        />

        {overlayEventId && (
          <div
            className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${overlaySource ? 'z-[75]' : 'z-[60]'}`}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              closeEventOverlay();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
          >
            {overlayEvent ? (
              <div ref={overlayCardWrapperRef} tabIndex={-1} className="relative max-w-md w-full my-8 flex-shrink-0 outline-none" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
                <EventCard
                  event={overlayEvent}
                  averageRating={overlayEvent.average_rating}
                  ratingCount={overlayEvent.rating_count}
                  userRating={overlayEvent.user_rating}
                  onRatingSubmitted={() => void refreshEventRating(overlayEvent.id)}
                  onEventUpdated={() => { void fetchEvents(); }}
                  onTagClick={handleTagClick}
                  tagColors={appSettings}
                  customPerformerTags={[]}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>
        )}

        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={closeAppModal}
          onEventAdded={fetchEvents}
        />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
      </CopyProvider>
      </TagDisplayProvider>
    );
  }

  /** Main feed only: search tag chips are React state, so Home must reset them when already on `/`. */
  const goToHome = () => {
    setSelectedTags([]);
    navigate({ pathname: '/', search: '' });
    window.scrollTo(0, 0);
  };

  if (!appSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
      </div>
    );
  }

  const copy = overridesFromSettings(appSettings);

  return (
    <TagDisplayProvider map={tagResolutionMap}>
    <CopyProvider settings={appSettings}>
    {params.eventId && overlayEvent ? <EventJsonLd event={overlayEvent} /> : null}
    <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
      <AppHeader
        pathname={pathname}
        activeView="home"
        desktopLikePointer={desktopLikePointer}
        appSettings={appSettings}
        user={user}
        isAdmin={!!isAdmin}
        onGoHome={goToHome}
        onOpenStats={openStats}
        onOpenProfile={openProfile}
        onOpenSettings={openSettings}
        onAddEvent={openAddEventModal}
        onSignIn={() => openAuthModal('signin')}
        onSignOut={() => signOut()}
        searchBar={
          <PrimarySearchBar
            embeddedInHeader
            appSettings={appSettings}
            searchDragOver={searchDragOver}
            selectedTags={selectedTags}
            searchQuery={searchQuery}
            tagSuggestions={tagSuggestions}
            filteredCount={filteredEvents.length}
            totalCount={events.length}
            onSearchDrop={handleSearchDrop}
            onSearchDragOver={handleSearchDragOver}
            onSearchDragLeave={handleSearchDragLeave}
            onSearchQueryChange={setSearchQuery}
            onSelectTagFilter={selectTagFilter}
            onRemoveTagFilter={removeTagFilter}
            onClearFilters={clearFilters}
          />
        }
      />

      <main
        ref={feedScrollRef}
        className={`flex-1 min-h-0 overflow-y-auto ${desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'}`}
      >
        <div className="max-w-[2400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 my-8">
        <div className="mb-8 overflow-visible">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">{copyT('home.title', copy)}</h2>
          <p className="max-w-2xl text-gray-600">
            {user ? copyT('home.subtitleSignedIn', copy) : copyT('home.subtitleSignedOut', copy)}
          </p>
        </div>

        {eventsError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-red-800">Could not load events</p>
              <p className="text-sm text-red-700 mt-1 font-mono">{eventsError}</p>
              <p className="text-xs text-red-600 mt-2">
                Check the browser console for details. Common fixes: run all migrations in Supabase (SQL Editor), or check RLS policies allow SELECT on <code>events</code> and <code>ratings</code> for anon/authenticated.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setEventsError(null); fetchEvents(); }}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Retry
              </button>
              <button
                onClick={() => setEventsError(null)}
                className="px-3 py-1.5 border border-red-300 rounded hover:bg-red-100 text-red-700 text-sm"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800"></div>
          </div>
        ) : events.length === 0 && !eventsError ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
              <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{copyT('empty.noShows.title', copy)}</h3>
              <p className="text-gray-600 mb-4">
                {copyT('empty.noShows.body', copy)}
              </p>
              {user && (
                <button
                  onClick={openAddEventModal}
                  className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-neutral-800"
                >
                  {copyT('empty.noShows.cta', copy)}
                </button>
              )}
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{copyT('empty.noMatch.title', copy)}</h3>
              <p className="text-gray-600 mb-4">
                {copyT('empty.noMatch.body', copy)}
              </p>
              <button
                onClick={clearFilters}
                className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-neutral-800"
              >
                {copyT('empty.noMatch.cta', copy)}
              </button>
            </div>
          </div>
        ) : (() => {
          const sortedByDate = [...filteredEvents].sort((a, b) => compareEventsForFeed(a, b));
          const pastEvents = sortedByDate.filter((e) => !isEventUpcoming(e.date));
          const upcoming = sortedByDate.filter((e) => isEventUpcoming(e.date));
          const ungroupedPast = pastEvents;

          const CARD_TOP_SPACER = 'h-6 shrink-0';

          const renderCard = (event: EventWithStats) => (
            <div
              key={event.id}
              ref={(el) => { eventCardRefs.current[event.id] = el; }}
            >
              <EventCard
                event={event}
                averageRating={event.average_rating}
                ratingCount={event.rating_count}
                userRating={event.user_rating}
                onRatingSubmitted={() => void refreshEventRating(event.id)}
                onEventUpdated={fetchEvents}
                onTagClick={handleTagClick}
                tagColors={appSettings}
                customPerformerTags={[]}
                viewHref={eventPagePath(event.id)}
                onViewClick={(id) => openEventOverlay(id)}
              />
            </div>
          );

          const cardCell = (content: ReactNode, withSpacer = true) => (
            <div className="flex min-w-0 w-full flex-col self-start">
              {withSpacer && <div className={CARD_TOP_SPACER} />}
              <div className="min-w-0">{content}</div>
            </div>
          );

          const laneItems: MasonryLaneItem[] = [];

          for (const event of upcoming) {
            laneItems.push({
              id: event.id,
              children: cardCell(renderCard(event), false),
            });
          }
          for (const event of ungroupedPast) {
            laneItems.push({ id: event.id, children: cardCell(renderCard(event), false) });
          }

          // Shortest-column lanes: upcoming first (chronological), then past shows.
          return (
              <div className="w-full">
                <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
                {hasMoreEvents && selectedTags.length === 0 && searchQuery.trim().length < 2 && (
                  <div ref={feedSentinelRef} className="h-1 w-full" aria-hidden />
                )}
              </div>
            );
        })()}
        </div>
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={modalRoute.authMode}
        promptMessage={modalRoute.authPrompt}
      />

      <AddEventModal
        isOpen={isAddEventModalOpen}
        onClose={closeAppModal}
        onEventAdded={fetchEvents}
      />

      <TagRatingsModal
        isOpen={isTagRatingsModalOpen}
        onClose={closeAppModal}
        tagType={tagRatingsData?.type || ''}
        tagValue={tagRatingsData?.value || ''}
        onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
        refreshTrigger={tagModalRefreshTrigger}
        tagColors={appSettings}
        onTagClick={openTagModal}
        tagResolutionMap={tagResolutionMap}
        cachedAllEvents={events}
      />

      {overlayEventId && (
        <div
          className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${overlaySource ? 'z-[75]' : 'z-[60]'}`}
          onClick={(e) => {
            if (e.target !== e.currentTarget) return;
            closeEventOverlay();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
        >
          {overlayEvent ? (
            <div ref={overlayCardWrapperRef} tabIndex={-1} className="relative max-w-md w-full my-8 flex-shrink-0 outline-none" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
              <EventCard
                event={overlayEvent}
                averageRating={overlayEvent.average_rating}
                ratingCount={overlayEvent.rating_count}
                userRating={overlayEvent.user_rating}
                onRatingSubmitted={() => void refreshEventRating(overlayEvent.id)}
                onEventUpdated={() => { void fetchEvents(); }}
                onTagClick={handleTagClick}
                tagColors={appSettings}
                customPerformerTags={[]}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
      )}

    </div>
    </CopyProvider>
    </TagDisplayProvider>
  );
}

export default App;