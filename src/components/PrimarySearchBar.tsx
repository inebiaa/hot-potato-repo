import { Search, X } from 'lucide-react';
import type { DragEvent } from 'react';
import type { AppSettings } from '../types/appSettings';
import { getPillColors } from './tagCards/getPillColors';

export type CustomPerformerTagDef = { slug: string; bg_color: string; text_color: string };

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
  embeddedInHeader?: boolean;
  customPerformerTags?: CustomPerformerTagDef[];
  searchDragOver: boolean;
  searchFocused: boolean;
  selectedTags: TagFilter[];
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
  onClearFilters: () => void;
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

/** Lucide X on each filter chip (same size/weight as query-clear). */
const chipDismissBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-80 transition-opacity hover:bg-black/10 hover:opacity-100';

const queryClearBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 opacity-80 transition-opacity hover:bg-gray-100 hover:opacity-100';

function suggestionTypeLabel(type: string): string {
  if (type === 'header_tags') return 'Genre';
  if (type === 'footer_tags') return 'Collection';
  if (type === 'hair_makeup') return 'Hair & Makeup';
  if (type === 'custom_performer') return 'Custom';
  return type.replace(/_/g, ' ');
}

function pillColorsForFilter(
  type: string,
  value: string,
  appSettings: AppSettings,
  customPerformerTags?: CustomPerformerTagDef[]
): { bg: string; text: string } {
  if (type === 'custom_performer' && customPerformerTags?.length) {
    const slug = value.split('\x00')[0];
    const def = customPerformerTags.find((t) => t.slug === slug);
    if (def?.bg_color && def?.text_color) {
      return { bg: def.bg_color, text: def.text_color };
    }
  }
  const pillType =
    type === 'year'
      ? 'year'
      : type.startsWith('custom:')
        ? 'custom_performer'
        : type;
  return getPillColors(pillType, appSettings);
}

export default function PrimarySearchBar({
  appSettings,
  embeddedInHeader = false,
  customPerformerTags,
  searchDragOver,
  searchFocused,
  selectedTags,
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
  onClearFilters: _onClearFilters,
}: PrimarySearchBarProps) {
  void _onClearFilters;
  const hasFilterActivity = Boolean(searchQuery) || selectedTags.length > 0;
  const showCounts =
    !embeddedInHeader &&
    hasFilterActivity &&
    typeof filteredCount === 'number' &&
    typeof totalCount === 'number';

  const showTagSuggestions = searchFocused && tagSuggestions.length > 0;

  const searchFieldClass = embeddedInHeader
    ? `relative flex h-10 w-full min-w-0 flex-nowrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 shadow-sm transition-shadow focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-300 ${searchDragOver ? 'bg-blue-50 ring-2 ring-blue-400' : ''}`
    : `relative flex min-h-[2.5rem] w-full min-w-[200px] flex-nowrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-shadow focus-within:border-gray-300 focus-within:ring-1 focus-within:ring-gray-300 ${searchDragOver ? 'ring-2 ring-blue-400 bg-blue-50' : ''}`;

  const chipsAndInputRow =
    'flex min-h-0 min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden';

  return (
    <div className={embeddedInHeader ? 'w-full min-w-0' : 'mb-6 border-b border-gray-200 pb-4'}>
      <div className={embeddedInHeader ? 'w-full' : 'flex flex-wrap items-center gap-3'}>
        <div
          className={searchFieldClass}
          onDragOver={onSearchDragOver}
          onDragLeave={onSearchDragLeave}
          onDrop={onSearchDrop}
        >
          <Search className="pointer-events-none shrink-0 text-gray-400" size={18} strokeWidth={2} />
          <div className={chipsAndInputRow}>
            {selectedTags.map((selectedTag) => {
              const { type, value } = selectedTag;
              const { bg, text } = pillColorsForFilter(type, value, appSettings, customPerformerTags);
              const rawVal = type === 'custom_performer' ? value.split('\x00')[1] ?? value : value;
              const val = rawVal.replace(/\r\n|\r|\n/g, ' ').trim();
              return (
                <span
                  key={`${type}:${value}`}
                  className="inline-grid min-w-0 max-w-[min(28rem,100%)] shrink grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 overflow-hidden rounded-md text-xs"
                  title={`${tagLabel(type)}${val}`}
                >
                  <span
                    className="min-w-0 truncate rounded-md px-2 py-1 text-xs"
                    style={{ backgroundColor: bg, color: text }}
                  >
                    {tagLabel(type)}
                    {val}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemoveTagFilter(type, value);
                    }}
                    className={`${chipDismissBtn} -mr-0.5`}
                    style={{ color: text }}
                    aria-label={`Remove ${val} filter`}
                  >
                    <span className="sr-only">Remove filter</span>
                    <X size={14} strokeWidth={2} aria-hidden />
                  </button>
                </span>
              );
            })}
            {searchQuery.trim() ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onSearchQueryChange('');
                }}
                className={queryClearBtn}
                aria-label="Clear search text"
              >
                <X size={14} strokeWidth={2} />
              </button>
            ) : null}
            <input
              type="text"
              placeholder={selectedTags.length ? '' : 'Search shows, designers, models...'}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              className="min-h-0 min-w-0 flex-1 border-0 bg-transparent py-0.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
            />
          </div>
          {showTagSuggestions ? (
            <div
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg"
              role="listbox"
              aria-label="Tag suggestions"
            >
              {tagSuggestions.map((t) => (
                <button
                  key={`${t.type}:${t.value}:${t.label}`}
                  type="button"
                  role="option"
                  onMouseDown={(e) => { e.preventDefault(); onSelectTagFilter(t.type, t.value); }}
                  className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="shrink-0 text-xs capitalize text-gray-400">
                    {suggestionTypeLabel(t.type)}:
                  </span>
                  <span className="min-w-0 truncate text-gray-900" title={t.label.replace(/\r\n|\r|\n/g, ' ')}>
                    {t.label.replace(/\r\n|\r|\n/g, ' ')}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showCounts ? (
        <div className="mt-3 text-sm text-gray-600">
          {summaryOverride || `Showing ${filteredCount} of ${totalCount} ${totalCount === 1 ? summaryLabelSingular : summaryLabelPlural}`}
        </div>
      ) : null}
    </div>
  );
}
