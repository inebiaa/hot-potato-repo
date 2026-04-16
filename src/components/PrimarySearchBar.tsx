import { Filter, MapPin, Search } from 'lucide-react';
import { useRef, type DragEvent } from 'react';
import type { AppSettings } from '../types/appSettings';
import TagPillSplitLabel, {
  tagPillSplitContainerWithIconClass,
  type TagPillSegmentColors,
} from './TagPillSplitLabel';

function SearchBarTagValueSlot({
  text,
  segmentColors,
}: {
  text: string;
  segmentColors: TagPillSegmentColors;
}) {
  const slotRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={slotRef} className="flex min-h-0 min-w-0 max-w-full flex-1 basis-0 flex-col justify-center self-stretch">
      <TagPillSplitLabel layoutWidthRef={slotRef} text={text} segmentColors={segmentColors} />
    </span>
  );
}

interface TagFilter {
  type: string;
  value: string;
}

interface TagSuggestion {
  type: string;
  value: string;
  label: string;
}

interface PrimarySearchBarProps {
  appSettings: AppSettings;
  searchDragOver: boolean;
  searchFocused: boolean;
  selectedTags: TagFilter[];
  selectedCity: string;
  dateFilter: 'all' | 'past' | 'future';
  allCities: string[];
  searchQuery: string;
  tagSuggestions: TagSuggestion[];
  filteredCount?: number;
  totalCount?: number;
  summaryLabelSingular?: string;
  summaryLabelPlural?: string;
  summaryOverride?: string;
  onSearchDrop: (e: DragEvent) => void;
  onSearchDragOver: (e: DragEvent) => void;
  onSearchDragLeave: () => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelectTagFilter: (type: string, value: string) => void;
  onRemoveTagFilter: (type: string, value: string) => void;
  onSelectedCityChange: (value: string) => void;
  onDateFilterChange: (value: 'all' | 'past' | 'future') => void;
  onClearFilters: () => void;
}

function isHex(value: string | undefined) {
  return !!value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

function tagLabel(type: string): string {
  if (type === 'designer') return 'Designer: ';
  if (type === 'model') return 'Model: ';
  if (type === 'producer') return 'Producer: ';
  if (type === 'city') return 'City: ';
  if (type === 'venue') return 'Venue: ';
  if (type === 'season') return 'Season: ';
  if (type === 'year') return 'Year: ';
  if (type === 'hair_makeup') return 'Hair & Makeup: ';
  if (type === 'header_tags') return 'Genre: ';
  if (type === 'footer_tags') return 'Collection: ';
  if (type === 'custom_performer') return 'Custom: ';
  return '';
}

function suggestionTypeLabel(type: string): string {
  if (type === 'header_tags') return 'Genre';
  if (type === 'footer_tags') return 'Collection';
  if (type === 'hair_makeup') return 'Hair & Makeup';
  if (type === 'custom_performer') return 'Custom';
  return type.replace(/_/g, ' ');
}

export default function PrimarySearchBar({
  appSettings,
  searchDragOver,
  searchFocused,
  selectedTags,
  selectedCity,
  dateFilter,
  allCities,
  searchQuery,
  tagSuggestions,
  filteredCount,
  totalCount,
  summaryLabelSingular = 'show',
  summaryLabelPlural = 'shows',
  summaryOverride,
  onSearchDrop,
  onSearchDragOver,
  onSearchDragLeave,
  onSearchFocus,
  onSearchBlur,
  onSearchQueryChange,
  onSelectTagFilter,
  onRemoveTagFilter,
  onSelectedCityChange,
  onDateFilterChange,
  onClearFilters,
}: PrimarySearchBarProps) {
  return (
    <div className="border-b border-gray-200 pb-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        <div
          className={`relative flex-1 min-w-[200px] flex items-center gap-2 pl-3 pr-4 py-2 border border-gray-200 rounded-lg bg-white transition-colors text-sm focus-within:ring-1 focus-within:ring-gray-300 focus-within:border-gray-300 ${searchDragOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`}
          onDragOver={onSearchDragOver}
          onDragLeave={onSearchDragLeave}
          onDrop={onSearchDrop}
        >
          <Search className="shrink-0 text-gray-400" size={18} />
          <div className="flex flex-nowrap items-center gap-1.5 min-w-0 flex-1 overflow-x-auto">
            {selectedTags.map((selectedTag) => {
              const type = selectedTag.type;
              const bg = (type === 'producer' && isHex(appSettings.producer_bg_color)) ? appSettings.producer_bg_color!
                : (type === 'designer' && isHex(appSettings.designer_bg_color)) ? appSettings.designer_bg_color!
                : (type === 'model' && isHex(appSettings.model_bg_color)) ? appSettings.model_bg_color!
                : (type === 'hair_makeup' && isHex(appSettings.hair_makeup_bg_color)) ? appSettings.hair_makeup_bg_color!
                : ((type === 'city' || type === 'venue') && isHex(appSettings.city_bg_color)) ? appSettings.city_bg_color!
                : (type === 'season' || type === 'year') && isHex(appSettings.season_bg_color) ? appSettings.season_bg_color!
                : (type === 'header_tags' && isHex(appSettings.header_tags_bg_color)) ? appSettings.header_tags_bg_color!
                : (type === 'footer_tags' && isHex(appSettings.footer_tags_bg_color)) ? appSettings.footer_tags_bg_color!
                : '#dbeafe';
              const text = (type === 'producer' && isHex(appSettings.producer_text_color)) ? appSettings.producer_text_color!
                : (type === 'designer' && isHex(appSettings.designer_text_color)) ? appSettings.designer_text_color!
                : (type === 'model' && isHex(appSettings.model_text_color)) ? appSettings.model_text_color!
                : (type === 'hair_makeup' && isHex(appSettings.hair_makeup_text_color)) ? appSettings.hair_makeup_text_color!
                : ((type === 'city' || type === 'venue') && isHex(appSettings.city_text_color)) ? appSettings.city_text_color!
                : (type === 'season' || type === 'year') && isHex(appSettings.season_text_color) ? appSettings.season_text_color!
                : (type === 'header_tags' && isHex(appSettings.header_tags_text_color)) ? appSettings.header_tags_text_color!
                : (type === 'footer_tags' && isHex(appSettings.footer_tags_text_color)) ? appSettings.footer_tags_text_color!
                : '#1e40af';
              const val = type === 'custom_performer' ? selectedTag.value.split('\x00')[1] : selectedTag.value;
              return (
                <span
                  key={`${type}:${selectedTag.value}`}
                  className={`${tagPillSplitContainerWithIconClass} p-0 max-w-[min(100%,24rem)] min-w-0 text-xs shrink-0`}
                >
                  <span
                    className="inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-1 max-sm:py-1 text-xs"
                    style={{ backgroundColor: bg, color: text }}
                  >
                    {tagLabel(type)}
                  </span>
                  <SearchBarTagValueSlot text={val} segmentColors={{ backgroundColor: bg, color: text }} />
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveTagFilter(type, selectedTag.value); }}
                    className="shrink-0 opacity-80 hover:opacity-100 -mr-0.5"
                    aria-label={`Remove ${val} filter`}
                  >
                    <span className="sr-only">Remove</span>
                    <span aria-hidden>×</span>
                  </button>
                </span>
              );
            })}
            {selectedCity && (
              <span className={`${tagPillSplitContainerWithIconClass} p-0 max-w-[min(100%,24rem)] min-w-0 text-xs shrink-0`}>
                <span
                  className="inline-flex shrink-0 whitespace-nowrap rounded-md px-2 py-1 max-sm:py-1 text-xs"
                  style={{
                    backgroundColor: isHex(appSettings.city_bg_color) ? appSettings.city_bg_color! : '#dbeafe',
                    color: isHex(appSettings.city_text_color) ? appSettings.city_text_color! : '#1e40af',
                  }}
                >
                  City:{' '}
                </span>
                <SearchBarTagValueSlot
                  text={selectedCity}
                  segmentColors={{
                    backgroundColor: isHex(appSettings.city_bg_color) ? appSettings.city_bg_color! : '#dbeafe',
                    color: isHex(appSettings.city_text_color) ? appSettings.city_text_color! : '#1e40af',
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectedCityChange(''); }}
                  className="shrink-0 opacity-80 hover:opacity-100 -mr-0.5"
                  aria-label={`Remove city filter`}
                >
                  <span className="sr-only">Remove</span>
                  <span aria-hidden>×</span>
                </button>
              </span>
            )}
            {dateFilter !== 'all' && (
              <span className={`${tagPillSplitContainerWithIconClass} p-0 min-w-0 text-xs shrink-0`}>
                <SearchBarTagValueSlot
                  text={dateFilter === 'future' ? 'Upcoming' : 'Past'}
                  segmentColors={{ backgroundColor: '#e7e5e4', color: '#292524' }}
                />
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDateFilterChange('all'); }}
                  className="shrink-0 opacity-80 hover:opacity-100 -mr-0.5"
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
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              className="flex-1 min-w-[120px] py-0.5 border-0 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
            />
          </div>
          {searchFocused && tagSuggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">Filter by tag</div>
              {tagSuggestions.map((t) => (
                <button
                  key={`${t.type}:${t.value}:${t.label}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelectTagFilter(t.type, t.value); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0"
                >
                  <span className="text-gray-400 text-xs capitalize shrink-0">
                    {suggestionTypeLabel(t.type)}:
                  </span>
                  <span className="text-gray-900 min-w-0 flex-1">
                    <TagPillSplitLabel fitToContainer text={t.label} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => onSelectedCityChange(e.target.value)}
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
              onChange={(e) => onDateFilterChange(e.target.value as 'all' | 'past' | 'future')}
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
          {typeof filteredCount === 'number' && typeof totalCount === 'number' && (
            <span className="text-sm text-gray-600">
              {summaryOverride || `Showing ${filteredCount} of ${totalCount} ${totalCount === 1 ? summaryLabelSingular : summaryLabelPlural}`}
            </span>
          )}
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
