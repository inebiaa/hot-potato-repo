import { supabase } from './supabase';

export type TagColumn = 'producers' | 'featured_designers' | 'models' | 'hair_makeup' | 'header_tags' | 'footer_tags';

/** Fetch all unique tag values from a given column across all events */
export async function fetchExistingTags(column: TagColumn): Promise<string[]> {
  const { data, error } = await supabase
    .from('events')
    .select(column);

  if (error) return [];

  const set = new Set<string>();
  (data || []).forEach((row: Record<string, string[] | null>) => {
    const arr = row[column];
    if (Array.isArray(arr)) {
      arr.forEach((v) => {
        const trimmed = String(v).trim();
        if (trimmed) set.add(trimmed);
      });
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Fetch unique city values from events (city is a scalar column) */
export async function fetchExistingCities(): Promise<string[]> {
  const { data, error } = await supabase.from('events').select('city');
  if (error) return [];
  const set = new Set<string>();
  (data || []).forEach((row: { city?: string | null }) => {
    const v = row.city;
    if (v && typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) set.add(trimmed);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Fetch unique non-empty venue names from events (`location` column) */
export async function fetchExistingVenues(): Promise<string[]> {
  const { data, error } = await supabase.from('events').select('location');
  if (error) return [];
  const set = new Set<string>();
  (data || []).forEach((row: { location?: string | null }) => {
    const v = row.location;
    if (v && typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed) set.add(trimmed);
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Fetch unique tag values from custom_tags JSONB for a given slug */
export async function fetchCustomTagSuggestions(slug: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('events')
    .select('custom_tags');

  if (error) return [];

  const set = new Set<string>();
  (data || []).forEach((row: { custom_tags?: Record<string, string[]> | null }) => {
    const arr = row.custom_tags?.[slug];
    if (Array.isArray(arr)) {
      arr.forEach((v) => {
        const trimmed = String(v).trim();
        if (trimmed) set.add(trimmed);
      });
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
