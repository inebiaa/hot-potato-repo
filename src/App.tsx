import { useState, useEffect, useRef } from 'react';
import { Plus, LogOut, LogIn, Sparkles, Search, Filter, Settings, MapPin, FileEdit, BarChart3 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event, Rating, EventCollection } from './lib/supabase';
import EventCard from './components/EventCard';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import SettingsModal from './components/SettingsModal';
import SuggestionsPanel from './components/SuggestionsPanel';
import TagRatingsModal from './components/TagRatingsModal';
import StatisticsPage from './components/StatisticsPage';

interface EventWithStats extends Event {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
}

interface AppSettings {
  app_name: string;
  app_icon_url: string;
  app_logo_url: string;
  tagline: string;
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
  footer_tags_bg_color?: string;
  footer_tags_text_color?: string;
}

function App() {
  const { user, signOut, isAdmin } = useAuth();
  const [events, setEvents] = useState<EventWithStats[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<EventWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSuggestionsPanelOpen, setIsSuggestionsPanelOpen] = useState(false);
  const [isTagRatingsModalOpen, setIsTagRatingsModalOpen] = useState(false);
  const [tagRatingsData, setTagRatingsData] = useState<{ type: string; value: string } | null>(null);
  const [isStatisticsPageOpen, setIsStatisticsPageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedTag, setSelectedTag] = useState<{ type: string; value: string } | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'past' | 'future'>('all');
  const [allCities, setAllCities] = useState<string[]>([]);
  const [collections, setCollections] = useState<EventCollection[]>([]);
  const eventCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasClearedFiltersForSharedLink = useRef(false);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    app_name: 'Runway Rate',
    app_icon_url: '',
    app_logo_url: '',
    tagline: 'Fashion Show Reviews',
  });

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

      setAppSettings({
        app_name: settingsObj.app_name || 'Runway Rate',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        tagline: settingsObj.tagline || 'Fashion Show Reviews',
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: settingsObj.producer_bg_color || 'bg-gray-100',
        producer_text_color: settingsObj.producer_text_color || 'text-gray-700',
        designer_bg_color: settingsObj.designer_bg_color || 'bg-amber-100',
        designer_text_color: settingsObj.designer_text_color || 'text-amber-700',
        model_bg_color: settingsObj.model_bg_color || 'bg-pink-100',
        model_text_color: settingsObj.model_text_color || 'text-pink-700',
        hair_makeup_bg_color: settingsObj.hair_makeup_bg_color || 'bg-purple-100',
        hair_makeup_text_color: settingsObj.hair_makeup_text_color || 'text-purple-700',
        city_bg_color: settingsObj.city_bg_color || 'bg-blue-100',
        city_text_color: settingsObj.city_text_color || 'text-blue-700',
        season_bg_color: settingsObj.season_bg_color || '#ffedd5',
        season_text_color: settingsObj.season_text_color || '#c2410c',
        header_tags_bg_color: settingsObj.header_tags_bg_color || 'bg-teal-100',
        header_tags_text_color: settingsObj.header_tags_text_color || 'text-teal-700',
        footer_tags_bg_color: settingsObj.footer_tags_bg_color || 'bg-emerald-100',
        footer_tags_text_color: settingsObj.footer_tags_text_color || 'text-emerald-700',
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

        return {
          ...event,
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

      // Fetch collections separately so a missing table or RLS issue doesn't hide events
      try {
        const { data: collectionsData } = await supabase
          .from('event_collections')
          .select('*')
          .order('sort_order')
          .order('name');
        setCollections(collectionsData || []);
      } catch {
        setCollections([]);
      }
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

  const handleTagClick = (type: string, value: string) => {
    setTagRatingsData({ type, value });
    setIsTagRatingsModalOpen(true);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedTag(null);
    setDateFilter('all');
  };

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const embedMode = urlParams?.get('embed') === '1';
  const eventIdFromUrl = urlParams?.get('event') || null;

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

  useEffect(() => {
    if (!embedMode && eventIdFromUrl && !loading && filteredEvents.length > 0) {
      const el = eventCardRefs.current[eventIdFromUrl];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [embedMode, eventIdFromUrl, loading, filteredEvents]);

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
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((event) => {
        const nameMatch = event.name.toLowerCase().includes(query);
        const descriptionMatch = event.description?.toLowerCase().includes(query) || false;
        const cityMatch = event.city?.toLowerCase().includes(query) || false;
        const locationMatch = event.location?.toLowerCase().includes(query) || false;
        const designersMatch = event.featured_designers?.some((d) =>
          d.toLowerCase().includes(query)
        ) || false;
        const modelsMatch = event.models?.some((m) => m.toLowerCase().includes(query)) || false;
        const producersMatch = event.producers?.some((p) =>
          p.toLowerCase().includes(query)
        ) || false;
        const headerTagsMatch = event.header_tags?.some((t) =>
          t.toLowerCase().includes(query)
        ) || false;
        const footerTagsMatch = event.footer_tags?.some((t) =>
          t.toLowerCase().includes(query)
        ) || false;
        return nameMatch || descriptionMatch || cityMatch || locationMatch || designersMatch || modelsMatch || producersMatch || headerTagsMatch || footerTagsMatch;
      });
    }

    if (selectedCity) {
      filtered = filtered.filter((event) => event.city === selectedCity);
    }

    if (selectedTag) {
      filtered = filtered.filter((event) => {
        switch (selectedTag.type) {
          case 'city':
            return event.city === selectedTag.value;
          case 'season':
            return event.season === selectedTag.value;
          case 'producer':
            return event.producers?.includes(selectedTag.value);
          case 'designer':
            return event.featured_designers?.includes(selectedTag.value);
          case 'model':
            return event.models?.includes(selectedTag.value);
          case 'hair_makeup':
            return event.hair_makeup?.includes(selectedTag.value);
          case 'header_tags':
            return event.header_tags?.includes(selectedTag.value);
          case 'footer_tags':
            return event.footer_tags?.includes(selectedTag.value);
          default:
            return true;
        }
      });
    }

    setFilteredEvents(filtered);
  }, [searchQuery, selectedCity, selectedTag, dateFilter, events]);

  console.log('Auth state:', { user: !!user, userId: user?.id, isAdmin });

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
            tagColors={appSettings}
            collapsibleEnabled={false}
          />
        </div>
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={() => setIsTagRatingsModalOpen(false)}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
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
                    <img src={appSettings.app_icon_url} alt="App Icon" className="w-10 h-10 rounded-lg" />
                  ) : (
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 rounded-lg">
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
                onClick={() => setIsStatisticsPageOpen(true)}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="View Statistics"
              >
                <BarChart3 size={20} />
                <span className="hidden sm:inline text-sm">Stats</span>
              </button>
              {user ? (
                <>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setIsSuggestionsPanelOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Review Edit Suggestions"
                      >
                        <FileEdit size={20} />
                        <span className="hidden sm:inline text-sm">Suggestions</span>
                      </button>
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <LogIn size={20} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Fashion Shows</h2>
          <p className="text-gray-600 mb-6">
            {user ? 'Discover, rate, and review fashion shows from around the world' : 'Sign in to rate shows and add your own!'}
          </p>

          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <div className="relative flex-1 min-w-[250px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search shows, designers, models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="appearance-none pl-4 pr-8 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    style={{
                      backgroundColor: selectedCity ? (appSettings.city_bg_color || '#dbeafe') : '#f3f4f6',
                      color: selectedCity ? (appSettings.city_text_color || '#1e40af') : '#4b5563'
                    }}
                  >
                    <option value="">All Cities</option>
                    {allCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <MapPin className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" size={14} />
                </div>

                <div className="relative">
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as 'all' | 'past' | 'future')}
                    className="appearance-none pl-4 pr-8 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    style={{
                      backgroundColor: dateFilter !== 'all' ? '#fef3c7' : '#f3f4f6',
                      color: dateFilter !== 'all' ? '#b45309' : '#4b5563'
                    }}
                  >
                    <option value="all">All Events</option>
                    <option value="future">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                  <Filter className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            {(searchQuery || selectedCity || selectedTag || dateFilter !== 'all') && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-600">
                  Showing {filteredEvents.length} of {events.length} shows
                </span>
                {selectedTag && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {selectedTag.type === 'designer' && 'Designer: '}
                    {selectedTag.type === 'model' && 'Model: '}
                    {selectedTag.type === 'producer' && 'Producer: '}
                    {selectedTag.type === 'city' && 'City: '}
                    {selectedTag.type === 'hair_makeup' && 'Hair & Makeup: '}
                    {selectedTag.value}
                  </span>
                )}
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
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-4">
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
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : (() => {
          // Group by collection when any event has a collection (backend-controlled via collection_id)
          const hasGroupedEvents = filteredEvents.some((e) => e.collection_id) && collections.length > 0;
          if (!hasGroupedEvents) {
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => (
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
                      tagColors={appSettings}
                      collapsibleEnabled={appSettings.collapsible_cards_enabled === 'true'}
                    />
                  </div>
                ))}
              </div>
            );
          }
          const sortedCollections = [...collections].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
          const byCollection = new Map<string, EventWithStats[]>();
          const ungrouped: EventWithStats[] = [];
          const byDate = (a: EventWithStats, b: EventWithStats) => new Date(b.date).getTime() - new Date(a.date).getTime();
          filteredEvents.forEach((event) => {
            if (event.collection_id) {
              const list = byCollection.get(event.collection_id) || [];
              list.push(event);
              byCollection.set(event.collection_id, list);
            } else {
              ungrouped.push(event);
            }
          });
          sortedCollections.forEach((c) => {
            const list = byCollection.get(c.id) || [];
            list.sort(byDate);
            byCollection.set(c.id, list);
          });
          ungrouped.sort(byDate);
          return (
            <div className="space-y-6">
              {sortedCollections.map((coll) => {
                const eventsInColl = byCollection.get(coll.id) || [];
                if (eventsInColl.length === 0) return null;
                return (
                  <div
                    key={coll.id}
                    className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden shadow-sm"
                  >
                    <div className="px-4 py-2.5 border-b border-gray-200 bg-white/90 text-sm font-medium text-gray-700">
                      {coll.name}
                    </div>
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {eventsInColl.map((event) => (
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
                            tagColors={appSettings}
                            collapsibleEnabled={appSettings.collapsible_cards_enabled === 'true'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {ungrouped.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 border-b border-gray-200 bg-white/90 text-sm font-medium text-gray-500">
                    Other shows
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {ungrouped.map((event) => (
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
                          tagColors={appSettings}
                          collapsibleEnabled={appSettings.collapsible_cards_enabled === 'true'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      <AddEventModal
        isOpen={isAddEventModalOpen}
        onClose={() => setIsAddEventModalOpen(false)}
        onEventAdded={fetchEvents}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsUpdated={fetchSettings}
      />

      <SuggestionsPanel
        isOpen={isSuggestionsPanelOpen}
        onClose={() => setIsSuggestionsPanelOpen(false)}
        onSuggestionProcessed={fetchEvents}
      />

      <TagRatingsModal
        isOpen={isTagRatingsModalOpen}
        onClose={() => setIsTagRatingsModalOpen(false)}
        tagType={tagRatingsData?.type || ''}
        tagValue={tagRatingsData?.value || ''}
      />

      <StatisticsPage
        isOpen={isStatisticsPageOpen}
        onClose={() => setIsStatisticsPageOpen(false)}
        tagColors={appSettings}
      />
    </div>
  );
}

export default App;
