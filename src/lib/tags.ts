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
