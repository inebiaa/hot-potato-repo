import { useState, useEffect } from 'react';
import { Plus, LogOut, LogIn, Sparkles, Search, Filter, Settings, MapPin, FileEdit } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event, Rating } from './lib/supabase';
import EventCard from './components/EventCard';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import SettingsModal from './components/SettingsModal';
import SuggestionsPanel from './components/SuggestionsPanel';
import TagRatingsModal from './components/TagRatingsModal';

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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isSuggestionsPanelOpen, setIsSuggestionsPanelOpen] = useState(false);
  const [isTagRatingsModalOpen, setIsTagRatingsModalOpen] = useState(false);
  const [tagRatingsData, setTagRatingsData] = useState<{ type: string; value: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedTag, setSelectedTag] = useState<{ type: string; value: string } | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'past' | 'future'>('all');
  const [allCities, setAllCities] = useState<string[]>([]);
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
    try {
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: true });

      if (eventsError) throw eventsError;

      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('*');

      if (ratingsError) throw ratingsError;

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
    } catch (error) {
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
        const descriptionMatch = event.description.toLowerCase().includes(query);
        const cityMatch = event.city?.toLowerCase().includes(query);
        const locationMatch = event.location?.toLowerCase().includes(query);
        const designersMatch = event.featured_designers?.some((d) =>
          d.toLowerCase().includes(query)
        );
        const modelsMatch = event.models?.some((m) => m.toLowerCase().includes(query));
        const producersMatch = event.producers?.some((p) =>
          p.toLowerCase().includes(query)
        );
        const headerTagsMatch = event.header_tags?.some((t) =>
          t.toLowerCase().includes(query)
        );
        const footerTagsMatch = event.footer_tags?.some((t) =>
          t.toLowerCase().includes(query)
        );
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by show name, designer, model, or producer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="">All Cities</option>
                  {allCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | 'past' | 'future')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                >
                  <option value="all">All Events</option>
                  <option value="future">Upcoming Events</option>
                  <option value="past">Past Events</option>
                </select>
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : events.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <EventCard
                key={event.id}
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
            ))}
          </div>
        )}
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
    </div>
  );
}

export default App;
