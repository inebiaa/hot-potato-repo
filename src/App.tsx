import { useState, useEffect, useRef, useMemo, useCallback, startTransition, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { Sparkles, Search } from 'lucide-react';
import AppHeader from './components/AppHeader';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event, Rating } from './lib/supabase';
import { getSeasonFromDate, getYearFromDate } from './lib/season';
import { eventSortKey, isEventUpcoming } from './lib/eventDates';
import { effectiveHeaderTags } from './lib/eventHeaderTags';
import { normalizeEventTagArrays } from './lib/eventTagArray';
import { normalizeForSearch } from './lib/normalize';
import { readableTextForBg } from './lib/colorUtils';
import EventCard from './components/EventCard';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import SettingsModal from './components/SettingsModal';
import TagRatingsModal from './components/TagRatingsModal';
import StatisticsPage from './components/StatisticsPage';
import ProfilePage from './components/ProfilePage';
import type { AppSettings } from './types/appSettings';
import { TagDisplayProvider } from './contexts/TagDisplayContext';
import {
  displayLabelForTagFilter,
  eventArrayMatchesFilter,
  eventMatchesVenueTag,
  fetchTagResolutionForEvents,
  tagResolutionKey,
  type TagResolutionMap,
} from './lib/tagDisplayResolution';
import {
  normalizeTagName,
  sameTagSpelling,
  searchTagIdentities,
  type TagIdentityRecord,
} from './lib/tagIdentity';
import PrimarySearchBar from './components/PrimarySearchBar';
import MasonryLaneFeed, { type MasonryLaneItem } from './components/MasonryLaneFeed';
import EventJsonLd from './components/EventJsonLd';
import { eventPagePath } from './lib/siteBase';
import { clearAppModalParams, parseAppModal, setAppModalParams } from './lib/searchParamsModal';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useDesktopLikePointer } from './hooks/useDesktopLikePointer';

interface EventWithStats extends Event {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
}

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
  const [, setOverlayOpenWithWiggle] = useState(false);
  const [overlaySuggestSection, setOverlaySuggestSection] = useState<keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] } | undefined>(undefined);
  const [overlaySuggestCustomSlug, setOverlaySuggestCustomSlug] = useState<string | undefined>(undefined);
  const [tagModalRefreshTrigger, setTagModalRefreshTrigger] = useState(0);
  const [identitySearchHits, setIdentitySearchHits] = useState<TagIdentityRecord[]>([]);
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasClearedFiltersForSharedLink = useRef(false);
  const overlayReorderEnteredAtRef = useRef<number>(0);
  const overlayCardWrapperRef = useRef<HTMLDivElement | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchDragOver, setSearchDragOver] = useState(false);
  const [tagResolutionMap, setTagResolutionMap] = useState<TagResolutionMap | null>(null);
  const [profileReviewCounts, setProfileReviewCounts] = useState<{ visible: number; total: number } | null>(null);

  const modalRoute = useMemo(() => parseAppModal(searchParams), [searchParams]);

  const closeAppModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

  const openSettingsModal = useCallback(() => {
    startTransition(() => {
      navigate({ pathname: location.pathname, search: setAppModalParams(searchParams, 'settings') });
    });
  }, [navigate, location.pathname, searchParams]);

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

      setAppSettings({
        app_name: settingsObj.app_name ?? undefined,
        app_icon_url: settingsObj.app_icon_url ?? undefined,
        app_logo_url: settingsObj.app_logo_url ?? undefined,
        app_favicon_url: settingsObj.app_favicon_url ?? undefined,
        tagline: settingsObj.tagline ?? undefined,
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
        optional_tags_bg_color: optionalBg,
        optional_tags_text_color: resolveText(optionalBg, settingsObj.optional_tags_text_color, '#3730a3'),
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    setEventsError(null);
    try {
      const { data: eventsData, error: eventsErr } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

      if (eventsErr) {
        setEventsError(eventsErr.message || String(eventsErr));
        setEvents([]);
        setFilteredEvents([]);
        return;
      }

      const { data: ratingsData, error: ratingsErr } = await supabase
        .from('ratings')
        .select('*');

      if (ratingsErr) {
        setEventsError(ratingsErr.message || String(ratingsErr));
        setEvents([]);
        setFilteredEvents([]);
        return;
      }

      const eventsWithStats: EventWithStats[] = (eventsData || []).map((event) => {
        const eventRatings = (ratingsData || []).filter((r) => r.event_id === event.id);
        const total = eventRatings.reduce((sum, r) => sum + r.rating, 0);
        const average = eventRatings.length > 0 ? total / eventRatings.length : 0;
        const userRating = user
          ? eventRatings.find((r) => r.user_id === user.id)
          : undefined;

        let customTags: Record<string, string[]> | null = event.custom_tags ?? null;
        if (typeof customTags === 'string') {
          try {
            customTags = JSON.parse(customTags);
          } catch {
            customTags = {};
          }
        }
        if (!customTags || Array.isArray(customTags) || typeof customTags !== 'object') {
          customTags = {};
        }
        let customTagMeta: Record<string, { icon?: string }> | null = event.custom_tag_meta ?? null;
        if (typeof customTagMeta === 'string') {
          try {
            customTagMeta = JSON.parse(customTagMeta);
          } catch {
            customTagMeta = {};
          }
        }
        if (!customTagMeta || Array.isArray(customTagMeta) || typeof customTagMeta !== 'object') {
          customTagMeta = {};
        }

        return {
          ...normalizeEventTagArrays(event as Event),
          custom_tags: customTags,
          custom_tag_meta: customTagMeta,
          average_rating: average,
          rating_count: eventRatings.length,
          user_rating: userRating,
        };
      });

      setEvents(eventsWithStats);
      setFilteredEvents(eventsWithStats);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEventsError(message);
      setEvents([]);
      setFilteredEvents([]);
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchEvents();
    // Intentionally sync on auth user only; fetchSettings/fetchEvents close over latest setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (events.length === 0) {
      setTagResolutionMap(new Map());
      return;
    }
    let cancelled = false;
    fetchTagResolutionForEvents(events).then((map) => {
      if (!cancelled) setTagResolutionMap(map);
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

  const identityIdsInUse = useMemo(() => {
    const s = new Set<string>();
    tagResolutionMap?.forEach((entry) => {
      if (entry.identityId) s.add(entry.identityId);
    });
    return s;
  }, [tagResolutionMap]);

  const searchableTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: { type: string; value: string; label: string }[] = [];
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
    events.forEach((e) => {
      (e.producers || []).forEach((v) => expandIdentity('producer', v));
      (e.featured_designers || []).forEach((v) => expandIdentity('designer', v));
      (e.models || []).forEach((v) => expandIdentity('model', v));
      (e.hair_makeup || []).forEach((v) => expandIdentity('hair_makeup', v));
      effectiveHeaderTags(e).forEach((v) => expandIdentity('header_tags', v));
      (e.footer_tags || []).forEach((v) => expandIdentity('footer_tags', v));
      if (e.city) add('city', e.city);
      if (e.location) expandIdentity('venue', e.location);
      add('season', getSeasonFromDate(e.date));
      {
        const y = getYearFromDate(e.date);
        if (y) add('year', y);
      }
      if (e.custom_tags && typeof e.custom_tags === 'object') {
        Object.entries(e.custom_tags).forEach(([slug, vals]) => {
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
    return tags.sort((a, b) => a.label.localeCompare(b.label));
  }, [events, tagResolutionMap]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setIdentitySearchHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchTagIdentities(q).then(setIdentitySearchHits).catch(() => setIdentitySearchHits([]));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const tagSuggestions = useMemo(() => {
    const q = normalizeForSearch(searchQuery);
    if (!q || q.length < 2) return [];
    const fromEvents = searchableTags.filter((t) => normalizeForSearch(t.label).includes(q));
    const suggestionKey = (t: { type: string; value: string; label: string }) =>
      `${t.type}:${t.value}\x00${normalizeTagName(t.label)}`;
    const seen = new Set(fromEvents.map(suggestionKey));
    const out: { type: string; value: string; label: string }[] = [...fromEvents];
    for (const id of identitySearchHits) {
      if (!identityIdsInUse.has(id.clusterId)) continue;
      const sug = id.tag_type.startsWith('custom:')
        ? {
            type: 'custom_performer' as const,
            value: `${id.tag_type.slice(7)}\x00${id.clusterId}`,
            label: id.canonical_name,
          }
        : { type: id.tag_type, value: id.clusterId, label: id.canonical_name };
      const key = suggestionKey(sug);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(sug);
      }
    }
    return out.slice(0, 8);
  }, [searchQuery, searchableTags, identitySearchHits, identityIdsInUse]);

  const handleTagClick = (type: string, value: string, explicitLabel?: string) => {
    if (overlayEventId) closeEventOverlay();
    else navigate({ pathname: '/', search: '' });
    const label = displayLabelForTagFilter(type, value, tagResolutionMap, explicitLabel);
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return prev;
      return [{ type, value, label }];
    });
    setSearchQuery('');
  };

  const selectTagFilter = (type: string, value: string, explicitLabel?: string) => {
    const label = displayLabelForTagFilter(type, value, tagResolutionMap, explicitLabel);
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return prev;
      return [{ type, value, label }];
    });
    setSearchQuery('');
  };

  const removeTagFilter = (type: string, value: string) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.type === type && t.value === value)));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
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

  const embedMode = searchParams.get('embed') === '1';
  const eventIdFromQuery = searchParams.get('event');
  const eventIdFromPath = params.eventId ?? null;
  const eventIdFromUrl = eventIdFromPath ?? eventIdFromQuery;
  const showProfile = searchParams.get('profile') === '1';
  const showStats = searchParams.get('stats') === '1';
  const pathname = location.pathname;

  const isAddEventModalOpen = modalRoute.modal === 'add-event';
  const isSettingsModalOpen = modalRoute.modal === 'settings';
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
      setOverlayOpenWithWiggle(false);
      setOverlaySuggestSection(undefined);
      setOverlaySuggestCustomSlug(undefined);
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
    showProfile ||
    isTagRatingsModalOpen ||
    isSettingsModalOpen ||
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
          const descriptionMatch = normalizeForSearch(event.description || '').includes(queryNorm);
          const cityMatch = normalizeForSearch(event.city || '').includes(queryNorm);
          const locationMatch = normalizeForSearch(event.location || '').includes(queryNorm);
          const venueMatch = event.location ? tagLineMatch('venue', event.location) : false;
          const designersMatch = event.featured_designers?.some((d) => tagLineMatch('designer', d)) || false;
          const modelsMatch = event.models?.some((m) => tagLineMatch('model', m)) || false;
          const producersMatch = event.producers?.some((p) => tagLineMatch('producer', p)) || false;
          const headerTagsMatch = effectiveHeaderTags(event).some((t) => tagLineMatch('header_tags', t)) || false;
          const footerTagsMatch = event.footer_tags?.some((t) => tagLineMatch('footer_tags', t)) || false;
          const customTagsMatch =
            event.custom_tags && typeof event.custom_tags === 'object'
              ? Object.entries(event.custom_tags).some(([slug, vals]) =>
                  (vals || []).some((v: string) => customLineMatch(slug, v))
                )
              : false;
          const hairMakeupMatch = event.hair_makeup?.some((h) => tagLineMatch('hair_makeup', h)) || false;
          const yearMatch =
            /^\d{4}$/.test(queryNorm) && getYearFromDate(event.date) === queryNorm;
          return (
            nameMatch ||
            descriptionMatch ||
            cityMatch ||
            locationMatch ||
            venueMatch ||
            designersMatch ||
            modelsMatch ||
            producersMatch ||
            headerTagsMatch ||
            footerTagsMatch ||
            customTagsMatch ||
            hairMakeupMatch ||
            yearMatch
          );
        });
      }
    }

    selectedTags.forEach((tag) => {
      filtered = filtered.filter((event) => {
        switch (tag.type) {
          case 'city':
            return sameTagSpelling(event.city, tag.value);
          case 'venue':
            return eventMatchesVenueTag(event, tag.value, tagResolutionMap);
          case 'season':
            return getSeasonFromDate(event.date) === tag.value;
          case 'year':
            return getYearFromDate(event.date) === tag.value;
          case 'producer':
            return eventArrayMatchesFilter(tagResolutionMap, 'producer', event.producers, tag.value);
          case 'designer':
            return eventArrayMatchesFilter(tagResolutionMap, 'designer', event.featured_designers, tag.value);
          case 'model':
            return eventArrayMatchesFilter(tagResolutionMap, 'model', event.models, tag.value);
          case 'hair_makeup':
            return eventArrayMatchesFilter(tagResolutionMap, 'hair_makeup', event.hair_makeup, tag.value);
          case 'header_tags':
            return eventArrayMatchesFilter(tagResolutionMap, 'header_tags', effectiveHeaderTags(event), tag.value);
          case 'footer_tags':
            return eventArrayMatchesFilter(tagResolutionMap, 'footer_tags', event.footer_tags, tag.value);
          case 'custom_performer': {
            const [slug, tagValue] = tag.value.split('\x00');
            if (!slug || !tagValue) return false;
            const vals = event.custom_tags?.[slug];
            return eventArrayMatchesFilter(
              tagResolutionMap,
              `custom:${slug}`,
              Array.isArray(vals) ? vals : null,
              tagValue
            );
          }
          default:
            return true;
        }
      });
    });

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
        .select('*')
        .eq('id', overlayEventId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const { data: ratingsData } = await supabase.from('ratings').select('*').eq('event_id', data.id);
      const eventRatings = (ratingsData || []).filter((r: { event_id: string }) => r.event_id === data.id);
      const total = eventRatings.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0);
      const average = eventRatings.length > 0 ? total / eventRatings.length : 0;
      const userRating = user ? eventRatings.find((r: { user_id: string }) => r.user_id === user.id) : undefined;
      if (!cancelled) {
        setOverlayEventFetched({
          ...normalizeEventTagArrays(data as Event),
          average_rating: average,
          rating_count: eventRatings.length,
          user_rating: userRating,
        } as EventWithStats);
      }
    })();
    return () => { cancelled = true; };
    // user referenced for user_rating; including full user would over-fetch on profile edits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayEventId, overlayEventFromCache, user?.id]);

  const overlayEvent = overlayEventFromCache ?? overlayEventFetched;

  const openEventOverlay = (
    eventId: string,
    source?: 'tagModal' | 'viewRatings',
    openWithWiggle?: boolean,
    suggestSection?: keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] } | 'custom',
    suggestCustomSlug?: string
  ) => {
    setOverlayEventId(eventId);
    setOverlaySource(source ?? null);
    setOverlayOpenWithWiggle(!!openWithWiggle);
    setOverlaySuggestSection(openWithWiggle && !suggestCustomSlug && suggestSection !== 'custom' ? (suggestSection ?? 'header_tags') : undefined);
    setOverlaySuggestCustomSlug(openWithWiggle ? suggestCustomSlug : undefined);
    // Stay on profile when opening a review from My reviews (don’t navigate to /event/:id).
    if (showProfile) {
      const next = new URLSearchParams(searchParams);
      next.set('profile', '1');
      next.set('event', eventId);
      navigate({ pathname: '/', search: next.toString() });
    } else {
      navigate(`/event/${eventId}`);
    }
  };

  const closeEventOverlay = () => {
    overlayReorderEnteredAtRef.current = 0;
    setOverlayEventId(null);
    setOverlaySource(null);
    setOverlayOpenWithWiggle(false);
    setOverlaySuggestSection(undefined);
    setOverlaySuggestCustomSlug(undefined);
    setTagModalRefreshTrigger((t) => t + 1);
    if (searchParams.get('profile') === '1') {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      navigate({ pathname: '/', search: next.toString() });
    } else {
      navigate('/');
    }
  };

  const goBack = () => {
    if (showProfile) {
      navigate({ pathname: '/', search: '' });
      window.scrollTo(0, 0);
    } else {
      window.location.href = pathname || '/';
    }
  };

  const openProfile = () => {
    navigate({ pathname: '/', search: '?profile=1' });
    window.scrollTo(0, 0);
  };

  // Embed mode: show only the single event card, minimal layout
  if (embedMode && eventIdFromUrl) {
    const embedEvent = events.find((e) => e.id === eventIdFromUrl);
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      );
    }
    if (!embedEvent) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <p className="text-gray-600">Show not found</p>
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <EventJsonLd event={embedEvent} />
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <EventCard
            event={embedEvent}
            averageRating={embedEvent.average_rating}
            ratingCount={embedEvent.rating_count}
            userRating={embedEvent.user_rating}
            onRatingSubmitted={fetchEvents}
            onEventUpdated={fetchEvents}
            onTagClick={handleTagClick}
            onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
            tagColors={appSettings}
            customPerformerTags={[]}
            wiggleOnlyClearsOnClickAway
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
      </TagDisplayProvider>
    );
  }

  if (!appSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (showStats) {
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
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
          onOpenSettings={openSettingsModal}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={
            <PrimarySearchBar
              embeddedInHeader
              appSettings={appSettings}
              searchDragOver={searchDragOver}
              searchFocused={searchFocused}
              selectedTags={selectedTags}
              searchQuery={searchQuery}
              tagSuggestions={tagSuggestions}
              filteredCount={filteredEvents.length}
              totalCount={filteredEvents.length}
              onSearchDrop={handleSearchDrop}
              onSearchDragOver={handleSearchDragOver}
              onSearchDragLeave={handleSearchDragLeave}
              onSearchFocus={() => setSearchFocused(true)}
              onSearchBlur={() => setTimeout(() => setSearchFocused(false), 150)}
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
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 my-8">
            <button
              onClick={goBackFromStats}
              className="text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
            >
              ← Back to shows
            </button>
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
              if (overlayReorderEnteredAtRef.current && Date.now() - overlayReorderEnteredAtRef.current < 800) return;
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
                  onRatingSubmitted={fetchEvents}
                  onEventUpdated={fetchEvents}
                  onTagClick={handleTagClick}
                  onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                  tagColors={appSettings}
                  customPerformerTags={[]}
                  wiggleOnlyClearsOnClickAway
                  onReorderModeEntered={() => { overlayReorderEnteredAtRef.current = Date.now(); }}
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

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen
            onClose={() => {
              closeAppModal();
              fetchSettings();
            }}
            onSettingsUpdated={() => {
              fetchSettings();
              fetchTagResolutionForEvents(events).then(setTagResolutionMap);
            }}
            onSettingsPreview={setAppSettings}
            onAccountUpdated={fetchEvents}
          />
        )}

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
      </TagDisplayProvider>
    );
  }

  if (showProfile) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      );
    }
    if (!user) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-4">
          <div className="text-center">
            <p className="text-gray-700 mb-4">Sign in to view your profile.</p>
            <a href={pathname} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Back to shows</a>
          </div>
        </div>
      );
    }
    if (!appSettings) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      );
    }
    return (
      <TagDisplayProvider map={tagResolutionMap}>
      <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
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
          onOpenSettings={openSettingsModal}
          onAddEvent={openAddEventModal}
          onSignIn={() => openAuthModal('signin')}
          onSignOut={() => signOut()}
          searchBar={
            <PrimarySearchBar
              embeddedInHeader
              appSettings={appSettings}
              searchDragOver={searchDragOver}
              searchFocused={searchFocused}
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
              onSearchFocus={() => setSearchFocused(true)}
              onSearchBlur={() => setTimeout(() => setSearchFocused(false), 150)}
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
          <div className="max-w-[2400px] mx-auto min-w-0 px-2 py-6 sm:px-6 sm:py-8 lg:px-8 sm:my-8">
          <button
            onClick={goBack}
            className="text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          >
            ← Back to shows
          </button>
          <ProfilePage
            userId={user.id}
            pathname={pathname}
            onClose={goBack}
            onTagClick={handleTagClick}
            onOpenEvent={(id, openWithWiggle, suggestSection, suggestCustomSlug) => openEventOverlay(id, 'viewRatings', openWithWiggle, suggestSection, suggestCustomSlug)}
            tagColors={appSettings}
            customPerformerTags={[]}
            visibleEventIds={new Set(filteredEvents.map((e) => e.id))}
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
              if (overlayReorderEnteredAtRef.current && Date.now() - overlayReorderEnteredAtRef.current < 800) return;
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
                  onRatingSubmitted={() => { fetchEvents(); }}
                  onEventUpdated={() => { fetchEvents(); }}
                  onTagClick={handleTagClick}
                  onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                  tagColors={appSettings}
                  customPerformerTags={[]}
                  initialReorderSection={overlaySuggestCustomSlug ? undefined : overlaySuggestSection}
                  initialCustomReorderSlug={overlaySuggestCustomSlug}
                  wiggleOnlyClearsOnClickAway
                  onReorderModeEntered={() => { overlayReorderEnteredAtRef.current = Date.now(); }}
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

        {isSettingsModalOpen && (
          <SettingsModal
            isOpen
            onClose={() => {
              closeAppModal();
              fetchSettings();
            }}
            onSettingsUpdated={() => {
              fetchSettings();
              fetchTagResolutionForEvents(events).then(setTagResolutionMap);
            }}
            onSettingsPreview={setAppSettings}
            onAccountUpdated={fetchEvents}
          />
        )}

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={closeAuthModal}
          initialMode={modalRoute.authMode}
          promptMessage={modalRoute.authPrompt}
        />
      </div>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <TagDisplayProvider map={tagResolutionMap}>
    {params.eventId && overlayEvent ? <EventJsonLd event={overlayEvent} /> : null}
    <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
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
        onOpenSettings={openSettingsModal}
        onAddEvent={openAddEventModal}
        onSignIn={() => openAuthModal('signin')}
        onSignOut={() => signOut()}
        searchBar={
          <PrimarySearchBar
            embeddedInHeader
            appSettings={appSettings}
            searchDragOver={searchDragOver}
            searchFocused={searchFocused}
            selectedTags={selectedTags}
            searchQuery={searchQuery}
            tagSuggestions={tagSuggestions}
            filteredCount={filteredEvents.length}
            totalCount={events.length}
            onSearchDrop={handleSearchDrop}
            onSearchDragOver={handleSearchDragOver}
            onSearchDragLeave={handleSearchDragLeave}
            onSearchFocus={() => setSearchFocused(true)}
            onSearchBlur={() => setTimeout(() => setSearchFocused(false), 150)}
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
        <div className="max-w-[2400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 my-8">
        <div className="mb-8 overflow-visible">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">Fashion Shows</h2>
          <p className="max-w-2xl text-gray-600">
            {user ? 'Discover, rate, and review fashion shows from around the world' : 'Sign in to rate shows and add your own!'}
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : events.length === 0 && !eventsError ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
              <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No fashion shows yet</h3>
              <p className="text-gray-600 mb-4">
                Be the first to add a fashion show!
              </p>
              {user && (
                <button
                  onClick={openAddEventModal}
                  className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Add Show
                </button>
              )}
            </div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
              <Search size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No shows match your search</h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your filters or search terms
              </p>
              <button
                onClick={clearFilters}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : (() => {
          const byDateDesc = (a: EventWithStats, b: EventWithStats) => eventSortKey(b.date) - eventSortKey(a.date);
          const sortedByDate = [...filteredEvents].sort(byDateDesc);
          const pastEvents = sortedByDate.filter((e) => !isEventUpcoming(e.date));
          const upcoming = sortedByDate
            .filter((e) => isEventUpcoming(e.date))
            .sort((a, b) => eventSortKey(a.date) - eventSortKey(b.date));
          const ungroupedPast = [...pastEvents].sort(byDateDesc);

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
                onRatingSubmitted={fetchEvents}
                onEventUpdated={fetchEvents}
                onTagClick={handleTagClick}
                onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                tagColors={appSettings}
                customPerformerTags={[]}
                viewHref={eventPagePath(event.id)}
                onViewClick={(id, openWithWiggle, suggestSection, suggestCustomSlug) => openEventOverlay(id, undefined, openWithWiggle, suggestSection, suggestCustomSlug)}
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

      {isSettingsModalOpen && (
        <SettingsModal
          isOpen
          onClose={() => {
            closeAppModal();
            fetchSettings();
          }}
          onSettingsUpdated={() => {
            fetchSettings();
            fetchTagResolutionForEvents(events).then(setTagResolutionMap);
          }}
          onSettingsPreview={setAppSettings}
        />
      )}

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
            if (overlayReorderEnteredAtRef.current && Date.now() - overlayReorderEnteredAtRef.current < 800) return;
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
                onRatingSubmitted={() => { fetchEvents(); }}
                onEventUpdated={() => { fetchEvents(); }}
                onTagClick={handleTagClick}
                onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                tagColors={appSettings}
                customPerformerTags={[]}
                initialReorderSection={overlaySuggestCustomSlug ? undefined : overlaySuggestSection}
                initialCustomReorderSlug={overlaySuggestCustomSlug}
                wiggleOnlyClearsOnClickAway
                onReorderModeEntered={() => { overlayReorderEnteredAtRef.current = Date.now(); }}
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
    </TagDisplayProvider>
  );
}

export default App;