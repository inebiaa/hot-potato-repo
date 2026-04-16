import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, GripVertical } from 'lucide-react';
import { fetchExistingTags, fetchCustomTagSuggestions, fetchExistingCities, fetchExistingVenues, TagColumn } from '../lib/tags';
import { tagMatchesQuery } from '../lib/normalize';
import TagPillSplitLabel, {
  tagPillSplitContainerWithIconClass,
  tagPillSplitSegmentGroupClass,
} from './TagPillSplitLabel';

const TAG_INPUT_CHIP_COLORS = { backgroundColor: '#f3f4f6', color: '#1f2937' } as const;

/** Long tag chips: width-aware splits use the flex slot between grip and remove, not a 48-char cap. */
function TagInputPillLabel({ text }: { text: string }) {
  const slotRef = useRef<HTMLSpanElement>(null);
  return (
    <span ref={slotRef} className="flex min-h-0 min-w-0 max-w-full flex-1 basis-0 flex-col justify-center self-stretch">
      <TagPillSplitLabel
        layoutWidthRef={slotRef}
        text={text}
        segmentColors={TAG_INPUT_CHIP_COLORS}
      />
    </span>
  );
}

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  tagColumn?: TagColumn;
  customTagSlug?: string;
  /** When true, fetches city suggestions (single-value field) */
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
}: TagInputProps) {
  const tags = useMemo(() => (Array.isArray(value) ? value : []), [value]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (useCitySuggestions) {
      fetchExistingCities().then((tags) => {
        if (!cancelled) setAllTags(tags);
      });
    } else if (useVenueSuggestions) {
      fetchExistingVenues().then((tags) => {
        if (!cancelled) setAllTags(tags);
      });
    } else if (customTagSlug) {
      fetchCustomTagSuggestions(customTagSlug).then((tags) => {
        if (!cancelled) setAllTags(tags);
      });
    } else if (tagColumn) {
      fetchExistingTags(tagColumn).then((tags) => {
        if (!cancelled) setAllTags(tags);
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
      return;
    }
    const filtered = allTags.filter(
      (t) => tagMatchesQuery(t, inputValue) && !tags.includes(t)
    );
    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [inputValue, allTags, tags]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim() && (canAddMore || maxTags === 1)) {
        addTag(inputValue);
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
      if (inputValue.trim()) addTag(inputValue);
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <div className="relative">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label} {required && '*'}
        </label>
      )}
      <div
        className="flex flex-wrap gap-1.5 p-2 min-h-[2.75rem] border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            draggable={maxTags !== 1}
            onDragStart={maxTags !== 1 ? (e) => handleDragStart(e, idx) : undefined}
            onDragEnd={handleDragEnd}
            onDragOver={maxTags !== 1 ? (e) => handleDragOver(e, idx) : undefined}
            onDragLeave={handleDragLeave}
            onDrop={maxTags !== 1 ? (e) => handleDrop(e, idx) : undefined}
            className={`${maxTags !== 1 ? tagPillSplitContainerWithIconClass : tagPillSplitSegmentGroupClass} p-0 rounded text-sm select-none ${
              maxTags === 1 ? '' : dragIndex === idx ? 'opacity-60 cursor-grabbing' : 'cursor-grab'
            } ${dropTargetIndex === idx ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
          >
            {maxTags !== 1 && <GripVertical size={14} className="text-gray-400 shrink-0" aria-hidden />}
            <TagInputPillLabel text={tag} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-700 sm:min-h-0 sm:min-w-0 sm:p-1"
              aria-label={`Remove ${tag}`}
            >
              <X size={16} strokeWidth={2.5} />
            </button>
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
          className="flex-1 min-w-[120px] min-h-[2.5rem] outline-none text-base sm:text-sm py-1"
        />
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full max-h-40 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg py-1"
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`min-h-[44px] w-full text-left px-3 py-3 text-base sm:min-h-0 sm:py-2 sm:text-sm hover:bg-blue-50 ${
                i === highlightedIndex ? 'bg-blue-50' : ''
              }`}
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
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}