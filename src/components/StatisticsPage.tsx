import { useState, useEffect } from 'react';
import { X, TrendingUp, BarChart3, Users, Sparkles, MapPin, Calendar } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';

interface TagStats {
  name: string;
  count: number;
  type: string;
  events: Event[];
}

interface StatisticsPageProps {
  isOpen: boolean;
  onClose: () => void;
  tagColors: any;
}

export default function StatisticsPage({ isOpen, onClose, tagColors }: StatisticsPageProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [sortBy, setSortBy] = useState<'count' | 'name'>('count');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchEvents();
    }
  }, [isOpen]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTagStats = (): TagStats[] => {
    const stats: Record<string, TagStats> = {};

    let filteredEvents = [...events];

    if (selectedCity) {
      filteredEvents = filteredEvents.filter(e => e.city === selectedCity);
    }

    if (selectedSeason) {
      filteredEvents = filteredEvents.filter(e => e.season === selectedSeason);
    }

    filteredEvents.forEach((event) => {
      const addTag = (name: string, type: string) => {
        const key = `${type}:${name}`;
        if (!stats[key]) {
          stats[key] = { name, count: 0, type, events: [] };
        }
        stats[key].count++;
        stats[key].events.push(event);
      };

      if (selectedType === 'all' || selectedType === 'designer') {
        event.featured_designers?.forEach(d => addTag(d, 'designer'));
      }
      if (selectedType === 'all' || selectedType === 'model') {
        event.models?.forEach(m => addTag(m, 'model'));
      }
      if (selectedType === 'all' || selectedType === 'producer') {
        event.producers?.forEach(p => addTag(p, 'producer'));
      }
      if (selectedType === 'all' || selectedType === 'hair_makeup') {
        event.hair_makeup?.forEach(h => addTag(h, 'hair_makeup'));
      }
      if (selectedType === 'all' || selectedType === 'city') {
        if (event.city) addTag(event.city, 'city');
      }
      if (selectedType === 'all' || selectedType === 'season') {
        if (event.season) addTag(event.season, 'season');
      }
      if (selectedType === 'all' || selectedType === 'header_tags') {
        event.header_tags?.forEach(t => addTag(t, 'header_tags'));
      }
      if (selectedType === 'all' || selectedType === 'footer_tags') {
        event.footer_tags?.forEach(t => addTag(t, 'footer_tags'));
      }
    });

    const statsArray = Object.values(stats);

    if (sortBy === 'count') {
      return statsArray.sort((a, b) => b.count - a.count);
    } else {
      return statsArray.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  const getTagColors = (type: string) => {
    switch (type) {
      case 'designer':
        return {
          bg: tagColors.designer_bg_color || '#fef3c7',
          text: tagColors.designer_text_color || '#b45309'
        };
      case 'model':
        return {
          bg: tagColors.model_bg_color || '#fce7f3',
          text: tagColors.model_text_color || '#be185d'
        };
      case 'producer':
        return {
          bg: tagColors.producer_bg_color || '#f3f4f6',
          text: tagColors.producer_text_color || '#374151'
        };
      case 'hair_makeup':
        return {
          bg: tagColors.hair_makeup_bg_color || '#f3e8ff',
          text: tagColors.hair_makeup_text_color || '#7c3aed'
        };
      case 'city':
        return {
          bg: tagColors.city_bg_color || '#dbeafe',
          text: tagColors.city_text_color || '#1e40af'
        };
      case 'season':
        return {
          bg: tagColors.season_bg_color || '#ffedd5',
          text: tagColors.season_text_color || '#c2410c'
        };
      case 'header_tags':
        return {
          bg: tagColors.header_tags_bg_color || '#ccfbf1',
          text: tagColors.header_tags_text_color || '#0f766e'
        };
      case 'footer_tags':
        return {
          bg: tagColors.footer_tags_bg_color || '#d1fae5',
          text: tagColors.footer_tags_text_color || '#065f46'
        };
      default:
        return {
          bg: '#f3f4f6',
          text: '#374151'
        };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'designer':
        return <Sparkles size={16} />;
      case 'model':
        return <Users size={16} />;
      case 'producer':
        return <BarChart3 size={16} />;
      case 'city':
        return <MapPin size={16} />;
      case 'season':
        return <Calendar size={16} />;
      default:
        return <TrendingUp size={16} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'designer':
        return 'Designer';
      case 'model':
        return 'Model';
      case 'producer':
        return 'Producer';
      case 'hair_makeup':
        return 'Hair & Makeup';
      case 'city':
        return 'City';
      case 'season':
        return 'Season';
      case 'header_tags':
        return 'Header Tag';
      case 'footer_tags':
        return 'Footer Tag';
      default:
        return type;
    }
  };

  const allCities = Array.from(new Set(events.map(e => e.city).filter(Boolean))).sort();
  const allSeasons = Array.from(new Set(events.map(e => e.season).filter(Boolean))).sort();

  const tagStats = calculateTagStats();
  const groupedStats: Record<string, TagStats[]> = {};
  tagStats.forEach(stat => {
    if (!groupedStats[stat.type]) {
      groupedStats[stat.type] = [];
    }
    groupedStats[stat.type].push(stat);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white bg-opacity-20 p-2 rounded-lg">
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Tag Statistics</h2>
              <p className="text-blue-100 text-sm">Comprehensive analytics across all shows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Tags
              </button>
              <button
                onClick={() => setSelectedType('designer')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: selectedType === 'designer' ? getTagColors('designer').bg : '#e5e7eb',
                  color: selectedType === 'designer' ? getTagColors('designer').text : '#374151'
                }}
              >
                Designers
              </button>
              <button
                onClick={() => setSelectedType('model')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: selectedType === 'model' ? getTagColors('model').bg : '#e5e7eb',
                  color: selectedType === 'model' ? getTagColors('model').text : '#374151'
                }}
              >
                Models
              </button>
              <button
                onClick={() => setSelectedType('producer')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: selectedType === 'producer' ? getTagColors('producer').bg : '#e5e7eb',
                  color: selectedType === 'producer' ? getTagColors('producer').text : '#374151'
                }}
              >
                Producers
              </button>
              <button
                onClick={() => setSelectedType('city')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: selectedType === 'city' ? getTagColors('city').bg : '#e5e7eb',
                  color: selectedType === 'city' ? getTagColors('city').text : '#374151'
                }}
              >
                Cities
              </button>
              <button
                onClick={() => setSelectedType('season')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: selectedType === 'season' ? getTagColors('season').bg : '#e5e7eb',
                  color: selectedType === 'season' ? getTagColors('season').text : '#374151'
                }}
              >
                Seasons
              </button>
            </div>

            <div className="flex-1 min-w-[200px]"></div>

            <div className="flex gap-2">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Cities</option>
                {allCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>

              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Seasons</option>
                {allSeasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'count' | 'name')}
                className="px-3 py-2 rounded-lg text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="count">Sort by Count</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>

          {(selectedCity || selectedSeason) && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">Filtered by:</span>
              {selectedCity && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: getTagColors('city').bg,
                    color: getTagColors('city').text
                  }}
                >
                  {selectedCity}
                  <button onClick={() => setSelectedCity('')} className="ml-1 hover:opacity-70">
                    <X size={14} />
                  </button>
                </span>
              )}
              {selectedSeason && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: getTagColors('season').bg,
                    color: getTagColors('season').text
                  }}
                >
                  {selectedSeason}
                  <button onClick={() => setSelectedSeason('')} className="ml-1 hover:opacity-70">
                    <X size={14} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : tagStats.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No tags found</h3>
              <p className="text-gray-600">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedStats).map(([type, stats]) => (
                <div key={type} className="space-y-3">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    {getTypeIcon(type)}
                    {getTypeLabel(type)}s
                    <span className="text-sm font-normal text-gray-500">({stats.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {stats.map((stat, idx) => {
                      const colors = getTagColors(stat.type);
                      return (
                        <div
                          key={idx}
                          className="rounded-lg p-4 border-2 transition-all hover:shadow-md"
                          style={{
                            backgroundColor: colors.bg,
                            borderColor: colors.text + '40'
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4
                                className="font-semibold text-sm truncate"
                                style={{ color: colors.text }}
                              >
                                {stat.name}
                              </h4>
                              <p className="text-xs opacity-75 mt-1" style={{ color: colors.text }}>
                                {stat.count} {stat.count === 1 ? 'appearance' : 'appearances'}
                              </p>
                            </div>
                            <div
                              className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg shrink-0"
                              style={{
                                backgroundColor: colors.text + '20',
                                color: colors.text
                              }}
                            >
                              {stat.count}
                            </div>
                          </div>
                          <div className="mt-2 text-xs opacity-70" style={{ color: colors.text }}>
                            {stat.events.slice(0, 3).map(e => e.name).join(', ')}
                            {stat.events.length > 3 && ` +${stat.events.length - 3} more`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {tagStats.length} {tagStats.length === 1 ? 'tag' : 'tags'} across {events.length} {events.length === 1 ? 'show' : 'shows'}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
