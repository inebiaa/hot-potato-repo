import { useState, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { fetchExistingTags, TagColumn } from '../lib/tags';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  tagColumn: TagColumn;
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
  placeholder = 'Type and press Enter to add',
  required = false,
  id,
  label,
  hint,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchExistingTags(tagColumn).then((tags) => {
      if (!cancelled) setAllTags(tags);
    });
    return () => { cancelled = true; };
  }, [tagColumn]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }, [value, onChange]);

  const removeTag = useCallback((index: number) => {
    onChange(value.filter((_, i) => i !== index));
  }, [value, onChange]);

  useEffect(() => {
    if (!inputValue.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const query = inputValue.toLowerCase();
    const filtered = allTags.filter(
      (t) => t.toLowerCase().includes(query) && !value.includes(t)
    );
    setSuggestions(filtered.slice(0, 8));
    setShowSuggestions(filtered.length > 0);
    setHighlightedIndex(-1);
  }, [inputValue, allTags, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
      return;
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value.length - 1);
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
        className="flex flex-wrap gap-1.5 p-2 min-h-[42px] border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag, idx) => (
          <span
            key={`${tag}-${idx}`}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-sm"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(idx);
              }}
              className="ml-0.5 p-0.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700"
              aria-label={`Remove ${tag}`}
            >
              <X size={12} strokeWidth={2.5} />
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
          placeholder={value.length === 0 ? placeholder : ''}
          required={required && value.length === 0}
          className="flex-1 min-w-[120px] outline-none text-sm py-1"
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
              className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
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
