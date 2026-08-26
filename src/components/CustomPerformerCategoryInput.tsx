import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
 fetchExistingCustomPerformerCategories,
 type CustomPerformerCategoryOption,
} from '../lib/tags';
import { tagMatchesQuery } from '../lib/normalize';
import { Input } from './ui';
import { cn } from '../lib/utils';

const MAX_SUGGESTIONS = 8;

interface CustomPerformerCategoryInputProps {
 id: string;
 value: string;
 onChange: (value: string) => void;
 /** Slugs already added on this form */
 excludedSlugs: string[];
 /** User chose an existing category from the list */
 onPickExisting: (slug: string, label: string) => void;
 placeholder?: string;
}

/**
 * Text field for "Add custom performer category" with autocomplete of category **types**
 * already used on other events (e.g. type "m" → "Music By").
 */
export default function CustomPerformerCategoryInput({
 id,
 value,
 onChange,
 excludedSlugs,
 onPickExisting,
 placeholder = 'e.g., Hosted By, Music By',
}: CustomPerformerCategoryInputProps) {
 const [allCategories, setAllCategories] = useState<CustomPerformerCategoryOption[]>([]);
 const [showSuggestions, setShowSuggestions] = useState(false);
 const [highlightedIndex, setHighlightedIndex] = useState(-1);
 const inputRef = useRef<HTMLInputElement>(null);
 const excluded = useMemo(() => new Set(excludedSlugs), [excludedSlugs]);

 useEffect(() => {
 let cancelled = false;
 fetchExistingCustomPerformerCategories().then((rows) => {
 if (!cancelled) setAllCategories(rows);
 });
 return () => {
 cancelled = true;
 };
 }, []);

 const suggestions = useMemo(() => {
 const q = value.trim();
 if (!q) return [];
 return allCategories
 .filter((c) => !excluded.has(c.slug))
 .filter((c) => tagMatchesQuery(c.label, value) || tagMatchesQuery(c.slug.replace(/-/g, ' '), value))
 .slice(0, MAX_SUGGESTIONS);
 }, [allCategories, excluded, value]);

 const pick = useCallback(
 (slug: string, label: string) => {
 onPickExisting(slug, label);
 onChange('');
 setShowSuggestions(false);
 setHighlightedIndex(-1);
 },
 [onChange, onPickExisting]
 );

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (!showSuggestions || suggestions.length === 0) return;
 if (e.key === 'ArrowDown') {
 e.preventDefault();
 setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
 } else if (e.key === 'ArrowUp') {
 e.preventDefault();
 setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
 } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
 e.preventDefault();
 const c = suggestions[highlightedIndex];
 pick(c.slug, c.label);
 } else if (e.key === 'Escape') {
 setShowSuggestions(false);
 setHighlightedIndex(-1);
 }
 };

 return (
 <div className="relative">
 <Input
 ref={inputRef}
 id={id}
 type="text"
 value={value}
 onChange={(e) => {
 onChange(e.target.value);
 setShowSuggestions(true);
 setHighlightedIndex(-1);
 }}
 onKeyDown={handleKeyDown}
 onFocus={() => value.trim() && setShowSuggestions(true)}
 onBlur={() => {
 setTimeout(() => {
 setShowSuggestions(false);
 setHighlightedIndex(-1);
 }, 150);
 }}
 placeholder={placeholder}
 autoComplete="off"
 />
 {showSuggestions && suggestions.length > 0 && (
 <div
 className="absolute z-50 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-card py-1 "
 role="listbox"
 >
 {suggestions.map((c, i) => (
 <button
 key={c.slug}
 type="button"
 role="option"
 aria-selected={i === highlightedIndex}
 className={cn(
 'min-h-[44px] w-full px-3 py-3 text-left text-base hover:bg-muted sm:min-h-0 sm:py-2 sm:text-sm',
 i === highlightedIndex ? 'bg-muted' : '',
 )}
 onMouseDown={(e) => {
 e.preventDefault();
 pick(c.slug, c.label);
 }}
 >
 {c.label}
 </button>
 ))}
 </div>
 )}
 </div>
 );
}
