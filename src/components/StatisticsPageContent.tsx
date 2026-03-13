import { BarChart3, Search } from 'lucide-react';
import type { TagStats } from './StatisticsPage';

interface StatisticsPageContentProps {
  asPage: boolean;
  tagStats: TagStats[];
  events: unknown[];
  loading: boolean;
  selectedType: string;
  selectedCity: string;
  selectedSeason: string;
  allCities: string[];
  allSeasons: string[];
  sortBy: 'count' | 'name';
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  getTagColors: (type: string) => { bg: string; text: string };
  setSelectedType: (t: string) => void;
  setSelectedCity: (c: string) => void;
  setSelectedSeason: (s: string) => void;
  setSortBy: (s: 'count' | 'name') => void;
  handleTagClick: (tag: TagStats) => void;
}

export default function StatisticsPageContent({
  asPage,
  tagStats,
  events,
  loading,
  selectedType,
  selectedCity,
  selectedSeason,
  allCities,
  allSeasons,
  sortBy,
  getTagColors,
  setSelectedType,
  setSelectedCity,
  setSelectedSeason,
  setSortBy,
  searchQuery = '',
  setSearchQuery,
  handleTagClick,
}: StatisticsPageContentProps) {
  const footerText = `Showing ${tagStats.length} ${tagStats.length === 1 ? 'tag' : 'tags'} across ${events.length} ${events.length === 1 ? 'show' : 'shows'}`;

  return (
    <div
      className={`${asPage ? 'max-w-6xl mx-auto' : 'w-full max-w-6xl'} ${asPage ? '' : 'my-8'}`}
      onClick={(e) => {
        if (!asPage) e.stopPropagation();
      }}
    >
      <div
        className={`${asPage ? 'bg-transparent' : 'bg-white rounded-xl shadow-2xl'} w-full overflow-hidden flex flex-col`}
        style={asPage ? undefined : { maxHeight: '90vh' }}
      >
        <div className={`px-6 py-4 border-b flex items-center gap-3 ${asPage ? 'bg-white rounded-t-xl' : 'bg-white'}`}>
          <div className="bg-stone-100 p-2 rounded-lg">
            <BarChart3 className="text-stone-600" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tag Statistics</h2>
            <p className="text-gray-500 text-sm">Click any tag to view shows and ratings</p>
          </div>
        </div>

        <div className="p-6 border-b bg-gray-50 space-y-4">
          {setSearchQuery && (
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 min-w-0 flex items-center gap-2 pl-3 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus-within:ring-1 focus-within:ring-blue-300 focus-within:border-blue-400">
                <Search className="shrink-0 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search tags by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 min-w-0 text-sm bg-transparent focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedType('all')}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${
                  selectedType === 'all'
                    ? 'bg-stone-200 text-stone-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedType('designer')}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{
                  backgroundColor: selectedType === 'designer' ? getTagColors('designer').bg : '#f3f4f6',
                  color: selectedType === 'designer' ? getTagColors('designer').text : '#374151',
                }}
              >
                Designers
              </button>
              <button
                onClick={() => setSelectedType('model')}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{
                  backgroundColor: selectedType === 'model' ? getTagColors('model').bg : '#f3f4f6',
                  color: selectedType === 'model' ? getTagColors('model').text : '#374151',
                }}
              >
                Models
              </button>
              <button
                onClick={() => setSelectedType('producer')}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{
                  backgroundColor: selectedType === 'producer' ? getTagColors('producer').bg : '#f3f4f6',
                  color: selectedType === 'producer' ? getTagColors('producer').text : '#374151',
                }}
              >
                Producers
              </button>
              <button
                onClick={() => setSelectedType('hair_makeup')}
                className="text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                style={{
                  backgroundColor: selectedType === 'hair_makeup' ? getTagColors('hair_makeup').bg : '#f3f4f6',
                  color: selectedType === 'hair_makeup' ? getTagColors('hair_makeup').text : '#374151',
                }}
              >
                Hair & Makeup
              </button>
            </div>

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
                <span
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs"
                  style={{
                    backgroundColor: getTagColors('city').bg,
                    color: getTagColors('city').text,
                  }}
                >
                  {selectedCity}
                  <button onClick={() => setSelectedCity('')} className="text-xs opacity-80 hover:opacity-100">
                    Clear
                  </button>
                </span>
              )}
              {selectedSeason && (
                <span
                  className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs"
                  style={{
                    backgroundColor: getTagColors('season').bg,
                    color: getTagColors('season').text,
                  }}
                >
                  {selectedSeason}
                  <button onClick={() => setSelectedSeason('')} className="text-xs opacity-80 hover:opacity-100">
                    Clear
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
            <div className="flex flex-wrap gap-2">
              {tagStats.map((stat, idx) => {
                const colors = getTagColors(stat.type);
                return (
                  <button
                    key={idx}
                    onClick={() => handleTagClick(stat)}
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: colors.bg,
                      color: colors.text,
                    }}
                  >
                    <span>{stat.name}</span>
                    <span className="font-semibold">{stat.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>{footerText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
