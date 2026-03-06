import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { Plus, LogOut, LogIn, Sparkles, Search, Filter, Settings, MapPin, BarChart3, User } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event, Rating } from './lib/supabase';
import { getSeasonFromDate } from './lib/season';
import { normalizeForSearch } from './lib/normalize';
import { readableTextForBg } from './lib/colorUtils';
import EventCard from './components/EventCard';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import SettingsModal from './components/SettingsModal';
import TagRatingsModal from './components/TagRatingsModal';
import StatisticsPage from './components/StatisticsPage';
import ProfilePage from './components/ProfilePage';

interface EventWithStats extends Event {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
}

interface AppSettings {
  [key: string]: string | undefined;
  app_name: string;
  app_icon_url: string;
  app_logo_url: string;
  tagline: string;
  color_scheme?: string;
  collapsible_cards_enabled?: string;
  producer_bg_color?: string;
  producer_text_color?: string;
  designer_bg_color?: string;
  designer_text_color?: string;
  model_bg_color?: string;
  model_text_color?: string;
  hair_makeup_bg_color?: string;
  hair_makeup_text_color?: string;
  city_bg_color?: string;
  city_text_color?: string;
  season_bg_color?: string;
  season_text_color?: string;
  header_tags_bg_color?: string;
  header_tags_text_color?: string;
  countdown_bg_color?: string;
  countdown_text_color?: string;
  footer_tags_bg_color?: string;
  footer_tags_text_color?: string;
  producer_icon?: string;
  designer_icon?: string;
  model_icon?: string;
  hair_makeup_icon?: string;
  city_icon?: string;
  season_icon?: string;
  header_tags_icon?: string;
  footer_tags_icon?: string;
  optional_tags_bg_color?: string;
  optional_tags_text_color?: string;
}

function App() {
  const { user, loading: authLoading, signOut, isAdmin } = useAuth();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [authModalPrompt, setAuthModalPrompt] = useState<string | undefined>(undefined);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTagRatingsModalOpen, setIsTagRatingsModalOpen] = useState(false);
  const [tagRatingsData, setTagRatingsData] = useState<{ type: string; value: string } | null>(null);
  const [isStatisticsPageOpen, setIsStatisticsPageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedTags, setSelectedTags] = useState<{ type: string; value: string }[]>([]);
  const [dateFilter, setDateFilter] = useState<'all' | 'past' | 'future'>('all');
  const [allCities, setAllCities] = useState<string[]>([]);
  const [overlayEventId, setOverlayEventId] = useState<string | null>(null);
  const [overlaySource, setOverlaySource] = useState<'tagModal' | 'viewRatings' | null>(null);
  const [, setOverlayOpenWithWiggle] = useState(false);
  const [overlaySuggestSection, setOverlaySuggestSection] = useState<keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] } | undefined>(undefined);
  const [overlaySuggestCustomSlug, setOverlaySuggestCustomSlug] = useState<string | undefined>(undefined);
  const [tagModalRefreshTrigger, setTagModalRefreshTrigger] = useState(0);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [footerTagExpanded, setFooterTagExpanded] = useState<Record<string, boolean>>({});
  const [showProfileView, setShowProfileView] = useState(false);
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasClearedFiltersForSharedLink = useRef(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    app_name: 'Runway Rate',
    app_icon_url: '',
    app_logo_url: '',
    tagline: 'Fashion Show Reviews',
    color_scheme: 'custom',
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchDragOver, setSearchDragOver] = useState(false);

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

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error) throw error;

      const settingsObj: any = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value || '';
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
        app_name: settingsObj.app_name || 'Runway Rate',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        tagline: settingsObj.tagline || 'Fashion Show Reviews',
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
          ...event,
          custom_tags: customTags,
          custom_tag_meta: customTagMeta,
          average_rating: average,
          rating_count: eventRatings.length,
          user_rating: userRating,
        };
      });

      setEvents(eventsWithStats);
      setFilteredEvents(eventsWithStats);

      const citiesSet = new Set<string>();
      eventsWithStats.forEach((event) => {
        if (event.city) {
          citiesSet.add(event.city);
        }
      });
      setAllCities(Array.from(citiesSet).sort());
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
  }, [user]);

  const searchableTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: { type: string; value: string; label: string }[] = [];
    const add = (type: string, value: string) => {
      const key = `${type}:${value}`;
      if (!seen.has(key) && value) {
        seen.add(key);
        tags.push({ type, value, label: value });
      }
    };
    events.forEach((e) => {
      (e.producers || []).forEach((v) => add('producer', v));
      (e.featured_designers || []).forEach((v) => add('designer', v));
      (e.models || []).forEach((v) => add('model', v));
      (e.hair_makeup || []).forEach((v) => add('hair_makeup', v));
      (e.genre || e.header_tags || []).forEach((v: string) => add('header_tags', v));
      (e.footer_tags || []).forEach((v) => add('footer_tags', v));
      if (e.city) add('city', e.city);
      add('season', getSeasonFromDate(e.date));
      if (e.custom_tags && typeof e.custom_tags === 'object') {
        Object.entries(e.custom_tags).forEach(([slug, vals]) => {
          (vals || []).forEach((v) => {
            const key = `custom_performer:${slug}:${v}`;
            if (!seen.has(key) && v) {
              seen.add(key);
              tags.push({ type: 'custom_performer', value: `${slug}\x00${v}`, label: v });
            }
          });
        });
      }
    });
    return tags.sort((a, b) => a.label.localeCompare(b.label));
  }, [events]);

  const tagSuggestions = useMemo(() => {
    const q = normalizeForSearch(searchQuery);
    if (!q || q.length < 2) return [];
    return searchableTags.filter((t) => normalizeForSearch(t.label).includes(q)).slice(0, 8);
  }, [searchQuery, searchableTags]);

  const openTagModal = (type: string, value: string) => {
    setTagRatingsData({ type, value });
    setIsTagRatingsModalOpen(true);
  };

  const handleTagClick = (type: string, value: string) => {
    if (overlayEventId) closeEventOverlay();
    setShowProfileView(false);
    setIsTagRatingsModalOpen(false);
    setIsStatisticsPageOpen(false);
    setIsSettingsModalOpen(false);
    setIsAddEventModalOpen(false);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', pathname);
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return [];
      return [{ type, value }];
    });
    setSearchQuery('');
  };

  const selectTagFilter = (type: string, value: string) => {
    setSelectedTags((prev) => {
      const key = `${type}:${value}`;
      const alreadySelected = prev.some((t) => `${t.type}:${t.value}` === key);
      if (alreadySelected) return [];
      return [{ type, value }];
    });
    setSearchQuery('');
  };

  const removeTagFilter = (type: string, value: string) => {
    setSelectedTags((prev) => prev.filter((t) => !(t.type === type && t.value === value)));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedTags([]);
    setDateFilter('all');
  };

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const embedMode = urlParams?.get('embed') === '1';
  const eventIdFromUrl = urlParams?.get('event') || null;
  const showProfile = showProfileView || urlParams?.get('profile') === '1';
  const showStats = urlParams?.get('stats') === '1';

  // Sync profile/stats view with URL (initial load + browser back/forward)
  const [, setUrlSync] = useState(0);
  useEffect(() => {
    const sync = () => {
      setShowProfileView(new URLSearchParams(window.location.search).get('profile') === '1');
      setUrlSync((n) => n + 1);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const openStats = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `${pathname}?stats=1`);
    }
    setIsStatisticsPageOpen(true);
  };

  const goBackFromStats = () => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', pathname);
    }
    setIsStatisticsPageOpen(false);
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
  }, [overlayEventId]);

  // Lock background scroll when any popup/overlay is open so only the popup scrolls
  useEffect(() => {
    const anyPopupOpen = !!(
      overlayEventId ||
      isStatisticsPageOpen ||
      isTagRatingsModalOpen ||
      isSettingsModalOpen ||
      isAddEventModalOpen ||
      isAuthModalOpen
    );
    document.body.style.overflow = anyPopupOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [overlayEventId, isStatisticsPageOpen, isTagRatingsModalOpen, isSettingsModalOpen, isAddEventModalOpen, isAuthModalOpen]);

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dateFilter === 'past') {
      filtered = filtered.filter((event) => new Date(event.date) < today);
    } else if (dateFilter === 'future') {
      filtered = filtered.filter((event) => new Date(event.date) >= today);
    }

    if (searchQuery.trim()) {
      const queryNorm = normalizeForSearch(searchQuery);
      if (queryNorm) {
        filtered = filtered.filter((event) => {
          const nameMatch = normalizeForSearch(event.name || '').includes(queryNorm);
          const descriptionMatch = normalizeForSearch(event.description || '').includes(queryNorm);
          const cityMatch = normalizeForSearch(event.city || '').includes(queryNorm);
          const locationMatch = normalizeForSearch(event.location || '').includes(queryNorm);
          const designersMatch = event.featured_designers?.some((d) =>
            normalizeForSearch(d).includes(queryNorm)
          ) || false;
          const modelsMatch = event.models?.some((m) =>
            normalizeForSearch(m).includes(queryNorm)
          ) || false;
          const producersMatch = event.producers?.some((p) =>
            normalizeForSearch(p).includes(queryNorm)
          ) || false;
          const headerTagsMatch = (event.genre || event.header_tags)?.some((t: string) =>
            normalizeForSearch(t).includes(queryNorm)
          ) || false;
          const footerTagsMatch = event.footer_tags?.some((t) =>
            normalizeForSearch(t).includes(queryNorm)
          ) || false;
          const customTagsMatch = (event.custom_tags && typeof event.custom_tags === 'object')
            ? Object.values(event.custom_tags).flat().some((v: string) =>
                normalizeForSearch(v || '').includes(queryNorm)
              )
          : false;
          const hairMakeupMatch = event.hair_makeup?.some((h) =>
            normalizeForSearch(h).includes(queryNorm)
          ) || false;
          return nameMatch || descriptionMatch || cityMatch || locationMatch || designersMatch || modelsMatch || producersMatch || headerTagsMatch || footerTagsMatch || customTagsMatch || hairMakeupMatch;
        });
      }
    }

    if (selectedCity) {
      filtered = filtered.filter((event) => event.city === selectedCity);
    }

    selectedTags.forEach((tag) => {
      filtered = filtered.filter((event) => {
        switch (tag.type) {
          case 'city':
            return event.city === tag.value;
          case 'season':
            return getSeasonFromDate(event.date) === tag.value;
          case 'producer':
            return event.producers?.includes(tag.value);
          case 'designer':
            return event.featured_designers?.includes(tag.value);
          case 'model':
            return event.models?.includes(tag.value);
          case 'hair_makeup':
            return event.hair_makeup?.includes(tag.value);
          case 'header_tags':
            return (event.genre || event.header_tags)?.includes(tag.value);
          case 'footer_tags':
            return event.footer_tags?.includes(tag.value);
          case 'custom_performer': {
            const [slug, tagValue] = tag.value.split('\x00');
            return slug && tagValue && event.custom_tags?.[slug]?.includes(tagValue);
          }
          default:
            return true;
        }
      });
    });

    setFilteredEvents(filtered);
  }, [searchQuery, selectedCity, selectedTags, dateFilter, events]);

  useEffect(() => {
    setUpcomingExpanded(false);
    setFooterTagExpanded({});
  }, [searchQuery, selectedCity, selectedTags, dateFilter]);

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const overlayEvent = overlayEventId ? (events.find((e) => e.id === overlayEventId) ?? filteredEvents.find((e) => e.id === overlayEventId)) : null;

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
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('event', eventId);
      window.history.replaceState(null, '', url.pathname + '?' + url.searchParams.toString());
    }
  };

  const closeEventOverlay = () => {
    setOverlayEventId(null);
    setOverlaySource(null);
    setOverlayOpenWithWiggle(false);
    setOverlaySuggestSection(undefined);
    setOverlaySuggestCustomSlug(undefined);
    setTagModalRefreshTrigger((t) => t + 1);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', pathname);
  };

  const goBack = () => {
    if (showProfile) {
      setShowProfileView(false);
      if (typeof window !== 'undefined') window.history.replaceState(null, '', pathname);
    } else if (typeof window !== 'undefined') {
      window.location.href = pathname;
    }
  };

  const openProfile = () => {
    setShowProfileView(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `${pathname}?profile=1`);
    }
  };

  const openAuthModal = (mode: 'signin' | 'signup' = 'signin', prompt?: string) => {
    setAuthModalMode(mode);
    setAuthModalPrompt(prompt);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthModalMode('signin');
    setAuthModalPrompt(undefined);
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
          />
        </div>
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={() => setIsTagRatingsModalOpen(false)}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={openTagModal}
        />
      </div>
    );
  }

  if (showStats) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <header className="shrink-0 bg-white shadow-sm border-b z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {appSettings.app_logo_url ? (
                <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-10 object-contain" />
              ) : (
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2">
                  <Sparkles className="text-white" size={24} />
                </div>
              )}
              <a href={pathname} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                {appSettings.app_name}
              </a>
            </div>
            <button onClick={goBackFromStats} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
              ← Back to shows
            </button>
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <StatisticsPage
              isOpen={true}
              onClose={goBackFromStats}
              tagColors={appSettings}
              onOpenEvent={(id) => openEventOverlay(id)}
              tagModalRefreshTrigger={tagModalRefreshTrigger}
              asPage
            />
          </div>
        </main>
      </div>
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
        <header className="bg-white shadow-sm border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {appSettings.app_logo_url ? (
                <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-10 object-contain" />
              ) : (
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2">
                  <Sparkles className="text-white" size={24} />
                </div>
              )}
              <a href={pathname} className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                {appSettings.app_name}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openStats}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                title="View Statistics"
              >
                <BarChart3 size={18} />
                <span className="hidden sm:inline">Stats</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  title="App Settings"
                >
                  <Settings size={18} />
                  <span className="hidden sm:inline">Settings</span>
                </button>
              )}
              <button
                onClick={() => setIsAddEventModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">Add Show</span>
              </button>
              <button onClick={goBack} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Back to shows
              </button>
              <button onClick={() => signOut()} className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">
                Sign Out
              </button>
            </div>
          </div>
        </header>
        <main className="max-w-[2400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 overflow-visible">
          <ProfilePage
            userId={user.id}
            pathname={pathname}
            onClose={goBack}
            onTagClick={handleTagClick}
            onOpenEvent={(id, openWithWiggle, suggestSection, suggestCustomSlug) => openEventOverlay(id, 'viewRatings', openWithWiggle, suggestSection, suggestCustomSlug)}
            tagColors={appSettings}
            customPerformerTags={[]}
          />
        </main>

        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={() => setIsTagRatingsModalOpen(false)}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={openTagModal}
        />

        {overlayEvent && (
          <div
            className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${overlaySource ? 'z-[75]' : 'z-[60]'}`}
            onClick={closeEventOverlay}
            role="dialog"
            aria-modal="true"
            aria-label="Event details"
          >
            <div className="relative max-w-md w-full my-8 flex-shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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
              />
            </div>
          </div>
        )}

        <AddEventModal
          isOpen={isAddEventModalOpen}
          onClose={() => setIsAddEventModalOpen(false)}
          onEventAdded={fetchEvents}
        />

        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => { setIsSettingsModalOpen(false); fetchSettings(); }}
          onSettingsUpdated={fetchSettings}
          onSettingsPreview={setAppSettings}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {appSettings.app_logo_url ? (
                <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-10 object-contain" />
              ) : (
                <>
                  {appSettings.app_icon_url ? (
                    <img src={appSettings.app_icon_url} alt="App Icon" className="w-10 h-10" />
                  ) : (
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2">
                      <Sparkles className="text-white" size={24} />
                    </div>
                  )}
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{appSettings.app_name}</h1>
                    {appSettings.tagline && (
                      <p className="text-xs text-gray-500">{appSettings.tagline}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openStats}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="View Statistics"
              >
                <BarChart3 size={20} />
                <span className="hidden sm:inline text-sm">Stats</span>
              </button>
              {user ? (
                <>
                  <button
                    type="button"
                    onClick={openProfile}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="My Profile"
                  >
                    <User size={20} />
                    <span className="hidden sm:inline text-sm">My Profile</span>
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        title="App Settings"
                      >
                        <Settings size={20} />
                        <span className="hidden sm:inline text-sm">Settings</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setIsAddEventModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                    <span className="hidden sm:inline">Add Show</span>
                  </button>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => openAuthModal('signin')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <LogIn size={20} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[2400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 overflow-visible">
        <div className="mb-8 overflow-visible">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Fashion Shows</h2>
          <p className="text-gray-600 mb-6">
            {user ? 'Discover, rate, and review fashion shows from around the world' : 'Sign in to rate shows and add your own!'}
          </p>

          <div className="border-b border-gray-200 pb-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center">
              <div
                className={`relative flex-1 min-w-[200px] flex items-center gap-2 pl-3 pr-4 py-2 border border-gray-200 rounded-lg bg-white transition-colors text-sm focus-within:ring-1 focus-within:ring-gray-300 focus-within:border-gray-300 ${searchDragOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setSearchDragOver(true); }}
                onDragLeave={() => setSearchDragOver(false)}
                onDrop={handleSearchDrop}
              >
                <Search className="shrink-0 text-gray-400" size={18} />
                <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                  {selectedTags.map((selectedTag) => {
                    const isHex = (s: string | undefined) => s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
                    const type = selectedTag.type;
                    const bg = (type === 'producer' && isHex(appSettings.producer_bg_color)) ? appSettings.producer_bg_color!
                      : (type === 'designer' && isHex(appSettings.designer_bg_color)) ? appSettings.designer_bg_color!
                      : (type === 'model' && isHex(appSettings.model_bg_color)) ? appSettings.model_bg_color!
                      : (type === 'hair_makeup' && isHex(appSettings.hair_makeup_bg_color)) ? appSettings.hair_makeup_bg_color!
                      : (type === 'city' && isHex(appSettings.city_bg_color)) ? appSettings.city_bg_color!
                      : (type === 'season' && isHex(appSettings.season_bg_color)) ? appSettings.season_bg_color!
                      : (type === 'header_tags' && isHex(appSettings.header_tags_bg_color)) ? appSettings.header_tags_bg_color!
                      : (type === 'footer_tags' && isHex(appSettings.footer_tags_bg_color)) ? appSettings.footer_tags_bg_color!
                      : '#dbeafe';
                    const text = (type === 'producer' && isHex(appSettings.producer_text_color)) ? appSettings.producer_text_color!
                      : (type === 'designer' && isHex(appSettings.designer_text_color)) ? appSettings.designer_text_color!
                      : (type === 'model' && isHex(appSettings.model_text_color)) ? appSettings.model_text_color!
                      : (type === 'hair_makeup' && isHex(appSettings.hair_makeup_text_color)) ? appSettings.hair_makeup_text_color!
                      : (type === 'city' && isHex(appSettings.city_text_color)) ? appSettings.city_text_color!
                      : (type === 'season' && isHex(appSettings.season_text_color)) ? appSettings.season_text_color!
                      : (type === 'header_tags' && isHex(appSettings.header_tags_text_color)) ? appSettings.header_tags_text_color!
                      : (type === 'footer_tags' && isHex(appSettings.footer_tags_text_color)) ? appSettings.footer_tags_text_color!
                      : '#1e40af';
                    const label = type === 'designer' ? 'Designer: ' : type === 'model' ? 'Model: ' : type === 'producer' ? 'Producer: ' : type === 'city' ? 'City: ' : type === 'season' ? 'Season: ' : type === 'hair_makeup' ? 'Hair & Makeup: ' : type === 'header_tags' ? 'Genre: ' : type === 'footer_tags' ? 'Collection: ' : type === 'custom_performer' ? 'Custom: ' : '';
                    const val = type === 'custom_performer' ? selectedTag.value.split('\x00')[1] : selectedTag.value;
                    return (
                      <span
                        key={`${type}:${selectedTag.value}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs shrink-0"
                        style={{ backgroundColor: bg, color: text }}
                      >
                        {label}{val}
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeTagFilter(type, selectedTag.value); }}
                          className="opacity-80 hover:opacity-100 -mr-0.5"
                          aria-label={`Remove ${val} filter`}
                        >
                          <span className="sr-only">Remove</span>
                          <span aria-hidden>×</span>
                        </button>
                      </span>
                    );
                  })}
                  {selectedCity && (() => {
                    const isHexCity = (s: string | undefined) => s && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s);
                    return (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs shrink-0"
                      style={{
                        backgroundColor: isHexCity(appSettings.city_bg_color) ? appSettings.city_bg_color! : '#dbeafe',
                        color: isHexCity(appSettings.city_text_color) ? appSettings.city_text_color! : '#1e40af',
                      }}
                    >
                      City: {selectedCity}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedCity(''); }}
                        className="opacity-80 hover:opacity-100 -mr-0.5"
                        aria-label={`Remove city filter`}
                      >
                        <span className="sr-only">Remove</span>
                        <span aria-hidden>×</span>
                      </button>
                    </span>
                    );
                  })()}
                  {dateFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs shrink-0 bg-stone-200 text-stone-800">
                      {dateFilter === 'future' ? 'Upcoming' : 'Past'}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDateFilter('all'); }}
                        className="opacity-80 hover:opacity-100 -mr-0.5"
                        aria-label="Remove date filter"
                      >
                        <span className="sr-only">Remove</span>
                        <span aria-hidden>×</span>
                      </button>
                    </span>
                  )}
                  <input
                    type="text"
                    placeholder={(selectedTags.length || selectedCity || dateFilter !== 'all') ? '' : 'Search shows, designers, models...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                    className="flex-1 min-w-[120px] py-0.5 border-0 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
                  />
                </div>
                {searchFocused && tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                    <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">Filter by tag</div>
                    {tagSuggestions.map((t) => (
                      <button
                        key={`${t.type}:${t.value}`}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectTagFilter(t.type, t.value); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="text-gray-400 text-xs capitalize">{t.type.replace(/_/g, ' ')}:</span>
                        <span className="text-gray-900">{t.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 appearance-none cursor-pointer"
                  >
                    <option value="">All Cities</option>
                    {allCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={14} />
                </div>
                <div className="relative">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as 'all' | 'past' | 'future')}
                    className="pl-3 pr-8 py-2 border border-gray-200 rounded-lg bg-white text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300 appearance-none cursor-pointer"
                  >
                    <option value="all">All Events</option>
                    <option value="future">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                  <Filter className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" size={14} />
                </div>
              </div>
            </div>

            {(searchQuery || selectedCity || selectedTags.length || dateFilter !== 'all') && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">
                  Showing {filteredEvents.length} of {events.length} shows
                </span>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
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
                  onClick={() => setIsAddEventModalOpen(true)}
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
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const byDateDesc = (a: EventWithStats, b: EventWithStats) => new Date(b.date).getTime() - new Date(a.date).getTime();
          const sortedByDate = [...filteredEvents].sort(byDateDesc);
          const pastEvents = sortedByDate.filter((e) => new Date(e.date) < today);
          const upcoming = sortedByDate.filter((e) => new Date(e.date) >= today).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          const nextUpcoming = upcoming[0] ?? null;
          const otherUpcoming = upcoming.slice(1);

          const isFilteringByFooterTag = selectedTags.some((t) => t.type === 'footer_tags');
          const byDateAsc = (a: EventWithStats, b: EventWithStats) => new Date(a.date).getTime() - new Date(b.date).getTime();

          const footerTagToEvents = new Map<string, EventWithStats[]>();
          let ungroupedPast: EventWithStats[];

          if (isFilteringByFooterTag && pastEvents.length >= 2) {
            const footerTagValue = selectedTags.find((t) => t.type === 'footer_tags')?.value ?? '';
            footerTagToEvents.set(footerTagValue, [...pastEvents].sort(byDateAsc));
            ungroupedPast = [];
          } else {
            ungroupedPast = [...pastEvents].sort(byDateDesc);
          }

          const sortedFooterTags = [...footerTagToEvents.keys()].sort((a, b) => a.localeCompare(b));

          const CARD_TOP_SPACER = 'h-6 shrink-0';

          const renderCard = (event: EventWithStats, upcoming = false) => (
            <div
              key={event.id}
              ref={(el) => { eventCardRefs.current[event.id] = el; }}
              className={upcoming ? 'hover:opacity-90 transition-opacity' : ''}
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
                viewHref={`${pathname}?event=${event.id}`}
                onViewClick={(id, openWithWiggle, suggestSection, suggestCustomSlug) => openEventOverlay(id, undefined, openWithWiggle, suggestSection, suggestCustomSlug)}
                imageOpacity={upcoming ? 0.6 : undefined}
              />
            </div>
          );

          const renderFooterTagBlock = (tag: string) => {
            const colEvents = footerTagToEvents.get(tag)!;
            const isExpanded = footerTagExpanded[tag];
            const nextEvent = colEvents[0];
            const otherEvents = colEvents.slice(1);
            const stacked = [...otherEvents.slice(0, 3), nextEvent];
            const n = stacked.length;
            const offset = (n - 1) * 10;
            const toggleExpanded = () => setFooterTagExpanded((prev) => ({ ...prev, [tag]: !prev[tag] }));
            return (
              <div key={tag} className={`flex flex-col w-full min-w-0 ${!isExpanded ? 'min-h-[520px] mb-16 md:mb-6 md:mr-6' : 'min-h-0 h-full'}`}>
                <div className={`shrink-0 flex items-center ${CARD_TOP_SPACER}`} />
                <div className={`relative flex-1 ${!isExpanded ? 'min-h-[480px] pb-3' : 'overflow-visible'}`}>
                  {!isExpanded && (
                    <div className="relative w-full">
                      <button
                        type="button"
                        data-tag-pill
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleExpanded(); }}
                        className="absolute top-2 right-2 z-50 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: appSettings.footer_tags_bg_color || '#d1fae5',
                          color: appSettings.footer_tags_text_color || '#065f46',
                        }}
                        aria-expanded={isExpanded}
                        aria-label={isExpanded ? `Collapse ${tag}` : `Expand ${tag}`}
                      >
                        {isExpanded ? `−${colEvents.length}` : `+${colEvents.length}`}
                      </button>
                      {stacked.slice(0, -1).map((event, i) => {
                        const step = (n - 1 - i) * 10;
                        return (
                          <div
                            key={event.id}
                            className="absolute overflow-hidden pointer-events-none rounded-lg bg-white shadow-md flex flex-col"
                            style={{
                              left: i * 10,
                              right: offset - i * 10,
                              top: step,
                              bottom: -step,
                              zIndex: i,
                              opacity: 1,
                            }}
                          >
                            {event.image_url ? (
                              <img src={event.image_url} alt="" className="w-full h-48 object-cover rounded-t-lg" />
                            ) : (
                              <div className="w-full h-48 bg-white rounded-t-lg" />
                            )}
                            <div className="flex-1 min-h-[140px] bg-white rounded-b-lg" />
                          </div>
                        );
                      })}
                      <div
                        ref={(el) => { if (nextEvent) eventCardRefs.current[nextEvent.id] = el; }}
                        className="relative z-10"
                        style={{ marginLeft: offset }}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const isInteractive =
                            target.closest('button') || target.closest('a') || target.closest('input') ||
                            target.closest('[role="button"]') || target.closest('[data-event-actions]') || target.closest('[data-tag-pill]');
                          if (isInteractive) return;
                          e.preventDefault();
                          e.stopPropagation();
                          toggleExpanded();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpanded();
                          }
                        }}
                        aria-label={`Expand ${tag}`}
                      >
                        <EventCard
                          event={nextEvent!}
                          averageRating={nextEvent!.average_rating}
                          ratingCount={nextEvent!.rating_count}
                          userRating={nextEvent!.user_rating}
                          onRatingSubmitted={fetchEvents}
                          onEventUpdated={fetchEvents}
                          onTagClick={handleTagClick}
                          onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                          tagColors={appSettings}
                          customPerformerTags={[]}
                          viewHref={`${pathname}?event=${nextEvent!.id}`}
                          onViewClick={() => toggleExpanded()}
                        />
                      </div>
                    </div>
                  )}
                  {isExpanded && (
                    <div className="relative flex h-full w-full min-h-[200px]">
                      <button
                        type="button"
                        data-tag-pill
                        onClick={() => toggleExpanded()}
                        className="absolute top-2 right-2 z-50 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: appSettings.footer_tags_bg_color || '#d1fae5',
                          color: appSettings.footer_tags_text_color || '#065f46',
                        }}
                        aria-expanded={isExpanded}
                        aria-label={`Collapse ${tag}`}
                      >
                        −{colEvents.length}
                      </button>
                      <div className="flex-1 min-h-0 w-full">
                        {renderCard(nextEvent, false)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          const upcomingBlock = upcoming.length > 1 && nextUpcoming ? (
            <div className={`flex flex-col w-full min-w-0 ${!upcomingExpanded ? 'min-h-[520px] mb-16 md:mb-6 md:mr-6' : 'min-h-0 h-full'}`}>
              <div className={`shrink-0 flex items-center ${CARD_TOP_SPACER}`} />
              <div className={`relative flex-1 ${!upcomingExpanded ? 'min-h-[480px] pb-3' : 'overflow-visible'}`}>
                {!upcomingExpanded && (() => {
                  const stacked = [...otherUpcoming.slice(0, 3), nextUpcoming];
                  const n = stacked.length;
                  const offset = (n - 1) * 10;
                  return (
                    <div className="relative w-full">
                      <button
                        type="button"
                        data-tag-pill
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUpcomingExpanded((v) => !v); }}
                        className="absolute top-2 right-2 z-50 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                        style={{
                          backgroundColor: appSettings.footer_tags_bg_color || '#d1fae5',
                          color: appSettings.footer_tags_text_color || '#065f46',
                        }}
                        aria-expanded={upcomingExpanded}
                        aria-label={upcomingExpanded ? 'Collapse upcoming shows' : 'Expand upcoming shows'}
                      >
                        {upcomingExpanded ? `−${upcoming.length}` : `+${upcoming.length}`}
                      </button>
                      {stacked.slice(0, -1).map((event, i) => {
                        const step = (n - 1 - i) * 10;
                        return (
                        <div
                          key={event.id}
                          className="absolute overflow-hidden pointer-events-none rounded-lg bg-white shadow-md flex flex-col"
                          style={{
                            left: i * 10,
                            right: offset - i * 10,
                            top: step,
                            bottom: -step,
                            zIndex: i,
                            opacity: 0.6 + (i / Math.max(1, n - 1)) * 0.25,
                          }}
                        >
                          {event.image_url ? (
                            <img src={event.image_url} alt="" className="w-full h-48 object-cover rounded-t-lg" />
                          ) : (
                            <div className="w-full h-48 bg-gray-200 rounded-t-lg" />
                          )}
                          <div className="flex-1 min-h-[140px] bg-white rounded-b-lg" />
                        </div>
                        );
                      })}
                      <div
                        ref={(el) => { if (nextUpcoming) eventCardRefs.current[nextUpcoming.id] = el; }}
                        className="relative z-10"
                        style={{ marginLeft: offset }}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const isInteractive =
                            target.closest('button') ||
                            target.closest('a') ||
                            target.closest('input') ||
                            target.closest('[role="button"]') ||
                            target.closest('[data-event-actions]') ||
                            target.closest('[data-tag-pill]');
                          if (isInteractive) return;
                          e.preventDefault();
                          e.stopPropagation();
                          setUpcomingExpanded((v) => !v);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setUpcomingExpanded((v) => !v);
                          }
                        }}
                        aria-label="Expand upcoming shows"
                      >
                        <EventCard
                          event={nextUpcoming!}
                          averageRating={nextUpcoming!.average_rating}
                          ratingCount={nextUpcoming!.rating_count}
                          userRating={nextUpcoming!.user_rating}
                          onRatingSubmitted={fetchEvents}
                          onEventUpdated={fetchEvents}
                          onTagClick={handleTagClick}
                          onRequireAuth={() => openAuthModal('signup', 'Create an account to rate this show.')}
                          tagColors={appSettings}
                          customPerformerTags={[]}
                          imageOpacity={0.6}
                          onViewClick={() => setUpcomingExpanded((v) => !v)}
                        />
                      </div>
                    </div>
                  );
                })()}
                {upcomingExpanded && (
                  <div className="relative flex h-full w-full min-h-[200px]">
                    <button
                      type="button"
                      data-tag-pill
                      onClick={() => setUpcomingExpanded((v) => !v)}
                      className="absolute top-2 right-2 z-50 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: appSettings.footer_tags_bg_color || '#d1fae5',
                        color: appSettings.footer_tags_text_color || '#065f46',
                      }}
                      aria-expanded={upcomingExpanded}
                      aria-label="Collapse upcoming shows"
                    >
                      −{upcoming.length}
                    </button>
                    <div className="flex-1 min-h-0 w-full">
                      {renderCard(nextUpcoming, true)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null;

          const cardCell = (content: ReactNode, withSpacer = true) => (
            <div className="flex flex-col h-full">
              {withSpacer && <div className={CARD_TOP_SPACER} />}
              <div className="flex-1 min-h-0">{content}</div>
            </div>
          );

          return (
              <div className="columns-[300px] gap-6">
                {upcomingBlock && (
                  <div className="break-inside-avoid mb-6 w-full min-w-0">{upcomingBlock}</div>
                )}
                {upcomingExpanded && otherUpcoming.map((event) => (
                  <div key={event.id} className="break-inside-avoid mb-6">
                    {cardCell(renderCard(event, true))}
                  </div>
                ))}
                {upcoming.length === 1 && nextUpcoming && (
                  <div key={nextUpcoming.id} className="break-inside-avoid mb-6">
                    {cardCell(renderCard(nextUpcoming, false))}
                  </div>
                )}
                {sortedFooterTags.flatMap((footerTag) => {
                  const block = (
                    <div key={footerTag} className="break-inside-avoid mb-6 w-full min-w-0">
                      {renderFooterTagBlock(footerTag)}
                    </div>
                  );
                  const others = footerTagExpanded[footerTag]
                    ? (footerTagToEvents.get(footerTag)?.slice(1) ?? []).map((event) => (
                        <div key={event.id} className="break-inside-avoid mb-6">
                          {cardCell(renderCard(event, false))}
                        </div>
                      ))
                    : [];
                  return [block, ...others];
                })}
                {ungroupedPast.map((event) => (
                  <div key={event.id} className="break-inside-avoid mb-6">
                    {cardCell(renderCard(event, false), true)}
                  </div>
                ))}
              </div>
            );
        })()}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        promptMessage={authModalPrompt}
      />

      <AddEventModal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        onEventAdded={fetchEvents}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => { setIsSettingsModalOpen(false); fetchSettings(); }}
        onSettingsUpdated={fetchSettings}
        onSettingsPreview={setAppSettings}
      />

      <TagRatingsModal
        isOpen={isTagRatingsModalOpen}
        onClose={() => setIsTagRatingsModalOpen(false)}
        tagType={tagRatingsData?.type || ''}
        tagValue={tagRatingsData?.value || ''}
        onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
        refreshTrigger={tagModalRefreshTrigger}
        tagColors={appSettings}
        onTagClick={openTagModal}
      />

      {overlayEvent && (
        <div
          className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${overlaySource ? 'z-[75]' : 'z-[60]'}`}
          onClick={closeEventOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Event details"
        >
          <div className="relative max-w-md w-full my-8 flex-shrink-0" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
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
            />
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
