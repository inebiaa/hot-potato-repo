import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { AppSettings } from '../types/appSettings';
import { showTypePillColors } from '../lib/showType';
import { getPillColors } from './tagCards/getPillColors';
import { useAuth } from '../contexts/AuthContext';
import { EmptyFieldPlaceholderOverlay } from './PlaceholderCopyEdit';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { useT } from '../hooks/useCopy';
import { regionKindFromCode } from '../lib/cityPlaces';

export type CustomPerformerTagDef = { slug: string; bg_color: string; text_color: string };

interface TagFilter {
  type: string;
  value: string;
  /** Human-readable; `value` may be a tag identity uuid */
  label: string;
}

interface TagSuggestion {
  type: string;
  value: string;
  label: string;
}

interface PrimarySearchBarProps {
  appSettings: AppSettings;
  customPerformerTags?: CustomPerformerTagDef[];
  searchDragOver: boolean;
  selectedTags: TagFilter[];
  searchQuery: string;
  tagSuggestions: TagSuggestion[];
  onSearchDrop: (e: DragEvent) => void;
  onSearchDragOver: (e: DragEvent) => void;
  onSearchDragLeave: () => void;
  onSearchQueryChange: (value: string) => void;
  onSelectTagFilter: (type: string, value: string, label?: string) => void;
  onRemoveTagFilter: (type: string, value: string) => void;
  onClearFilters: () => void;
}

function tagLabel(type: string, value = ''): string {
  if (type === 'designer') return 'Designer: ';
  if (type === 'artist') return 'Artist: ';
  if (type === 'producer') return 'Producer: ';
  if (type === 'city') return 'City: ';
  if (type === 'region') {
    const kind = regionKindFromCode(value);
    if (kind === 'state') return 'State: ';
    if (kind === 'province') return 'Province: ';
    return 'Country: ';
  }
  if (type === 'venue') return 'Venue: ';
  if (type === 'season') return 'Season: ';
  if (type === 'year') return 'Year: ';
  if (type === 'date') return 'Date: ';
  if (type === 'hair_makeup') return 'Hair & Makeup: ';
  if (type === 'header_tags') return 'Genre: ';
  if (type === 'footer_tags') return 'Collection: ';
  if (type === 'custom_performer') return 'Custom: ';
  if (type === 'show_type') return 'Show: ';
  if (type === 'query') return '';
  return '';
}

/** Lucide X on the query-clear control (filter chips use TagPillSplitLabel trailingSlot). */
const queryClearBtn =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-80 transition-opacity hover:bg-muted hover:opacity-100';

function suggestionTypeLabel(type: string, value?: string): string {
  if (type === 'header_tags') return 'Genre';
  if (type === 'footer_tags') return 'Collection';
  if (type === 'hair_makeup') return 'Hair & Makeup';
  if (type === 'custom_performer') return 'Custom';
  if (type === 'show_type') return 'Show';
  if (type === 'date') return 'Date';
  if (type === 'region' && value) {
    const kind = regionKindFromCode(value);
    if (kind === 'state') return 'State';
    if (kind === 'province') return 'Province';
    return 'Country';
  }
  if (type === 'region') return 'Region';
  return type.replace(/_/g, ' ');
}

function pillColorsForFilter(
  type: string,
  value: string,
  appSettings: AppSettings,
  customPerformerTags?: CustomPerformerTagDef[]
): { bg: string; text: string } {
  if (type === 'show_type') {
    const colors = showTypePillColors(value);
    return { bg: colors.backgroundColor, text: colors.color };
  }
  if (type === 'query') {
    return { bg: '#f3f4f6', text: '#374151' };
  }
  if (type === 'custom_performer' && customPerformerTags?.length) {
    const slug = value.split('\x00')[0];
    const def = customPerformerTags.find((t) => t.slug === slug);
    if (def?.bg_color && def?.text_color) {
      return { bg: def.bg_color, text: def.text_color };
    }
  }
  const pillType =
    type === 'year' || type === 'date'
      ? 'year'
      : type === 'region'
        ? 'region'
        : type.startsWith('custom:')
          ? 'custom_performer'
          : type;
  return getPillColors(pillType, appSettings);
}

export default function PrimarySearchBar({
  appSettings,
  customPerformerTags,
  searchDragOver,
  selectedTags,
  searchQuery,
  tagSuggestions,
  onSearchDrop,
  onSearchDragOver,
  onSearchDragLeave,
  onSearchQueryChange,
  onSelectTagFilter,
  onRemoveTagFilter,
  onClearFilters: _onClearFilters,
}: PrimarySearchBarProps) {
  void _onClearFilters;
  const t = useT();
  const { isAdmin } = useAuth();
  const listboxId = useId();
  const fieldRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const [fieldFocused, setFieldFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Track focus via focusin/focusout so suggestion clicks and re-focus don't leave a stale "blurred" state.
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const sync = () => setFieldFocused(el.contains(document.activeElement));
    const onFocusOut = () => {
      // After the browser finishes moving focus (incl. to a suggestion button).
      requestAnimationFrame(() => {
        setFieldFocused(el.contains(document.activeElement));
      });
    };
    el.addEventListener('focusin', sync);
    el.addEventListener('focusout', onFocusOut);
    sync();
    return () => {
      el.removeEventListener('focusin', sync);
      el.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery, tagSuggestions]);

  useEffect(() => {
    if (activeIndex < 0) return;
    const option = listboxRef.current?.querySelector<HTMLElement>(`[data-suggestion-index="${activeIndex}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const showTagSuggestions = fieldFocused && tagSuggestions.length > 0;
  const activeOptionId =
    showTagSuggestions && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined;

  const selectSuggestion = (suggestion: TagSuggestion) => {
    onSelectTagFilter(suggestion.type, suggestion.value, suggestion.label);
    setActiveIndex(-1);
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const count = tagSuggestions.length;
    if (e.key === 'Backspace' && !searchQuery && selectedTags.length > 0) {
      e.preventDefault();
      const last = selectedTags[selectedTags.length - 1];
      onRemoveTagFilter(last.type, last.value);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showTagSuggestions && count > 0) {
        const pick = activeIndex >= 0 && activeIndex < count ? activeIndex : 0;
        selectSuggestion(tagSuggestions[pick]);
        return;
      }
      const q = searchQuery.trim();
      if (q.length >= 2) {
        onSelectTagFilter('query', q, q);
      }
      return;
    }
    if (!showTagSuggestions) {
      if (e.key === 'Escape') {
        setActiveIndex(-1);
        (e.target as HTMLInputElement).blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % count);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? count - 1 : i - 1));
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(count - 1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setActiveIndex(-1);
      (e.target as HTMLInputElement).blur();
    }
  };

  const searchFieldClass = `group relative flex min-h-10 w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1 type-body text-foreground shadow-sm transition-shadow focus-within:border-input focus-within:ring-1 focus-within:ring-ring ${searchDragOver ? 'bg-muted ring-2 ring-ring' : ''}`;

  const searchPlaceholder = t('search.placeholder');
  const searchFieldEmpty = selectedTags.length === 0 && !searchQuery.trim();
  const showSearchPlaceholderOverlay = isAdmin && searchFieldEmpty;

  const chipsAndInputRow =
    'flex min-h-0 min-w-0 flex-1 flex-wrap items-center gap-1';

  return (
    <div className="w-full min-w-0">
      <div className="w-full">
        <div
          ref={fieldRef}
          className={searchFieldClass}
          onDragOver={onSearchDragOver}
          onDragLeave={onSearchDragLeave}
          onDrop={onSearchDrop}
        >
          <Search className="pointer-events-none shrink-0 text-muted-foreground" size={18} strokeWidth={2} />
          <div className={chipsAndInputRow}>
            {selectedTags.map((selectedTag) => {
              const { type, value, label } = selectedTag;
              const { bg, text } = pillColorsForFilter(type, value, appSettings, customPerformerTags);
              const shown = (label || value).replace(/\r\n|\r|\n/g, ' ').trim();
              const pillText = `${tagLabel(type, value)}${shown}`;
              return (
                <span
                  key={`${type}:${value}`}
                  className={`${tagPillSplitSegmentGroupClass} min-w-0 max-w-full shrink-0 p-0`}
                  title={pillText}
                >
                  <TagPillSplitLabel
                    text={pillText}
                    segmentColors={{ backgroundColor: bg, color: text }}
                    trailingSlot={
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveTagFilter(type, value);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center p-0 opacity-80 hover:opacity-100"
                        style={{ color: text }}
                        aria-label={`Remove ${shown} filter`}
                      >
                        <X size={12} strokeWidth={2.5} aria-hidden />
                      </button>
                    }
                  />
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
            <div className="relative min-w-[7rem] flex-1">
              {showSearchPlaceholderOverlay ? (
                <EmptyFieldPlaceholderOverlay
                  copyKey="search.placeholder"
                  placeholder={searchPlaceholder}
                />
              ) : null}
              <input
                type="text"
                placeholder={
                  showSearchPlaceholderOverlay
                    ? ''
                    : selectedTags.length
                      ? ''
                      : searchPlaceholder
                }
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={onSearchKeyDown}
                role="combobox"
                aria-expanded={showTagSuggestions}
                aria-controls={showTagSuggestions ? listboxId : undefined}
                aria-autocomplete="list"
                aria-activedescendant={activeOptionId}
                className="w-full min-h-0 min-w-0 border-0 bg-transparent py-0.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          {showTagSuggestions ? (
            <div
              ref={listboxRef}
              id={listboxId}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-card py-0.5 shadow-lg"
              role="listbox"
              aria-label="Tag suggestions"
            >
              {tagSuggestions.map((suggestion, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={`${suggestion.type}:${suggestion.value}:${suggestion.label}`}
                    id={`${listboxId}-opt-${index}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-suggestion-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(suggestion);
                    }}
                    className={`grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 px-3 py-2 text-left type-body ${
                      active ? 'bg-muted' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="shrink-0 type-caption capitalize text-muted-foreground">
                      {suggestionTypeLabel(suggestion.type, suggestion.value)}:
                    </span>
                    <span
                      className="min-w-0 truncate text-foreground"
                      title={suggestion.label.replace(/\r\n|\r|\n/g, ' ')}
                    >
                      {suggestion.label.replace(/\r\n|\r|\n/g, ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
