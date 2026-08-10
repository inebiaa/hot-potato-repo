import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { X, GripVertical, Plus } from 'lucide-react';
import { fetchExistingTags, fetchCustomTagSuggestions, fetchExistingCities, fetchExistingVenues, TagColumn } from '../lib/tags';
import { searchCities } from '../lib/cityPlaces';
import { tagMatchesQuery } from '../lib/normalize';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { TAG_INPUT_EDIT_PILL_COLORS } from './tagPillShell';
import { formControlClass, formControlPaddingClass } from './ui/field';
import { cn } from '../lib/utils';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  tagColumn?: TagColumn;
  customTagSlug?: string;
  /** When true, fetches real city suggestions (Photon); pick required — no free text */
  useCitySuggestions?: boolean;
  /** When true, fetches venue (`location`) suggestions from existing events */
  useVenueSuggestions?: boolean;
  /** When 1, only a single tag is allowed (e.g. for city) */
  maxTags?: number;
  placeholder?: string;
  required?: boolean;
  id?: string;
  label?: string;
  hint?: string;
  /**
   * Compact row: label + small + box. Expands to the full tag field when pressed
   * (or when tags already exist).
   */
  expandable?: boolean;
  /** Optional control shown on the right of the collapsed/expanded header row. */
  headerAction?: ReactNode;
  /** Extra content under the field when expanded (e.g. icon picker). */
  expandedExtras?: ReactNode;
}

export default function TagInput({
  value,
  onChange,
  tagColumn,
  customTagSlug,
  useCitySuggestions = false,
  useVenueSuggestions = false,
  maxTags,
  placeholder = 'Type and press Enter to add',
  required = false,
  id,
  label,
  hint,
  expandable = false,
  headerAction,
  expandedExtras,
}: TagInputProps) {
  const tags = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [expanded, setExpanded] = useState(() => !expandable || tags.length > 0);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const focusAfterExpandRef = useRef(false);
  const requireSuggestionPick = useCitySuggestions;

  useEffect(() => {
    if (expandable && tags.length > 0) setExpanded(true);
  }, [expandable, tags.length]);

  useEffect(() => {
    if (!expanded || !focusAfterExpandRef.current) return;
    focusAfterExpandRef.current = false;
    inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    let cancelled = false;
    if (useCitySuggestions) {
      // Seed with cities already on events (for continuity); live search also queries Photon.
      fetchExistingCities().then((list) => {
        if (!cancelled) setAllTags(list);
      });
    } else if (useVenueSuggestions) {
      fetchExistingVenues().then((list) => {
        if (!cancelled) setAllTags(list);
      });
    } else if (customTagSlug) {
      fetchCustomTagSuggestions(customTagSlug).then((list) => {
        if (!cancelled) setAllTags(list);
      });
    } else if (tagColumn) {
      fetchExistingTags(tagColumn).then((list) => {
        if (!cancelled) setAllTags(list);
      });
    }
    return () => { cancelled = true; };
  }, [tagColumn, customTagSlug, useCitySuggestions, useVenueSuggestions]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    if (maxTags === 1) {
      onChange([trimmed]);
    } else {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, [tags, onChange, maxTags]);

  const removeTag = useCallback((index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  }, [tags, onChange]);

  const canAddMore = maxTags == null || tags.length < maxTags;

  const reorderTags = useCallback((fromIndex: number, toIndex: number) => {
    if (maxTags === 1) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= tags.length || toIndex < 0 || toIndex >= tags.length) return;
    try {
      const next = [...tags];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, removed);
      onChange(next);
    } catch (err) {
      console.error('Tag reorder error:', err);
    }
  }, [tags, onChange, maxTags]);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.setData('application/json', JSON.stringify({ index }));
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && dragIndex !== index) setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const from = dragIndex ?? parseInt(e.dataTransfer.getData('text/plain') || '', 10);
      if (Number.isNaN(from) || from < 0 || from >= tags.length || from === dropIndex) {
        setDragIndex(null);
        setDropTargetIndex(null);
        return;
      }
      if (dropIndex < 0 || dropIndex >= tags.length) {
        setDragIndex(null);
        setDropTargetIndex(null);
        return;
      }
      reorderTags(from, dropIndex);
    } finally {
      setDragIndex(null);
      setDropTargetIndex(null);
    }
  };

  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setCitySearchLoading(false);
      return;
    }

    if (!useCitySuggestions) {
      const filtered = allTags.filter(
        (t) => tagMatchesQuery(t, inputValue) && !tags.includes(t)
      );
      setSuggestions(filtered.slice(0, 8));
      setShowSuggestions(filtered.length > 0);
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    setCitySearchLoading(true);
    const handle = window.setTimeout(() => {
      const q = inputValue.trim();
      const fromExisting = allTags.filter(
        (t) => tagMatchesQuery(t, q) && !tags.includes(t) && /,\s*[A-Za-z]{2}$/.test(t)
      );
      searchCities(q, 8).then((remote) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const t of [...fromExisting, ...remote]) {
          const key = t.trim().toLowerCase();
          if (!key || seen.has(key) || tags.includes(t)) continue;
          seen.add(key);
          merged.push(t);
          if (merged.length >= 8) break;
        }
        setSuggestions(merged);
        setShowSuggestions(merged.length > 0);
        setHighlightedIndex(merged.length > 0 ? 0 : -1);
        setCitySearchLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setSuggestions(fromExisting.slice(0, 8));
        setShowSuggestions(fromExisting.length > 0);
        setHighlightedIndex(fromExisting.length > 0 ? 0 : -1);
        setCitySearchLoading(false);
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [inputValue, allTags, tags, useCitySuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex]);
      } else if (!requireSuggestionPick && inputValue.trim() && (canAddMore || maxTags === 1)) {
        addTag(inputValue);
      } else if (requireSuggestionPick && suggestions.length === 1) {
        addTag(suggestions[0]);
      }
      return;
    }
    if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!requireSuggestionPick && inputValue.trim()) addTag(inputValue);
      setShowSuggestions(false);
    }, 150);
  };

  const openExpanded = () => {
    focusAfterExpandRef.current = true;
    setExpanded(true);
  };

  if (expandable && !expanded) {
    return (
      <div className="flex items-center gap-2">
        {label ? (
          <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{label}</span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <button
          type="button"
          onClick={openExpanded}
          className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-dashed border-input',
            'bg-card text-muted-foreground transition-colors hover:border-neutral-400 hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label={label ? `Add ${label}` : 'Add tags'}
          title={label ? `Add ${label}` : 'Add'}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
        {headerAction}
      </div>
    );
  }

  return (
    <div className="relative">
      {(label || headerAction) && (
        <div className="mb-1 flex items-center gap-2">
          {label ? (
            <label htmlFor={id} className="min-w-0 flex-1 text-sm font-medium text-foreground">
              {label} {required && <span className="text-muted-foreground">*</span>}
            </label>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {headerAction}
        </div>
      )}
      {expandedExtras ? <div className="mb-2">{expandedExtras}</div> : null}
      <div
        className={cn(
          formControlClass,
          formControlPaddingClass,
          'flex min-h-10 flex-wrap items-center gap-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            data-tag-pill
            draggable={maxTags !== 1}
            onDragStart={maxTags !== 1 ? (e) => handleDragStart(e, idx) : undefined}
            onDragEnd={handleDragEnd}
            onDragOver={maxTags !== 1 ? (e) => handleDragOver(e, idx) : undefined}
            onDragLeave={handleDragLeave}
            onDrop={maxTags !== 1 ? (e) => handleDrop(e, idx) : undefined}
            className={cn(
              /* Same group + segment shells as EventCard — character split, not field-width blobs */
              `${tagPillSplitSegmentGroupClass} p-0 text-xs select-none`,
              maxTags === 1 ? '' : dragIndex === idx ? 'cursor-grabbing opacity-60' : 'cursor-grab',
              dropTargetIndex === idx ? 'ring-2 ring-ring ring-offset-1' : '',
            )}
          >
            <TagPillSplitLabel
              text={tag}
              segmentColors={TAG_INPUT_EDIT_PILL_COLORS}
              leadingSlot={
                maxTags !== 1 ? (
                  <GripVertical size={12} className="text-neutral-500" aria-hidden />
                ) : undefined
              }
              trailingSlot={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(idx);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="inline-flex items-center justify-center p-0 text-neutral-500 hover:text-neutral-800"
                  aria-label={`Remove ${tag}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              }
            />
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => inputValue.trim() && setShowSuggestions(true)}
          placeholder={tags.length === 0 ? placeholder : ''}
          required={required && tags.length === 0}
          className="min-w-[7rem] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              className={cn(
                'min-h-[44px] w-full px-3 py-3 text-left text-base hover:bg-muted sm:min-h-0 sm:py-2 sm:text-sm',
                i === highlightedIndex ? 'bg-muted' : '',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {hint && !expandable && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {useCitySuggestions && citySearchLoading && inputValue.trim() && (
        <p className="mt-1 text-xs text-muted-foreground">Searching cities…</p>
      )}
    </div>
  );
}