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

/** Values already used on events under `custom_tags[slug]`. */
async function fetchCustomTagNamesFromEvents(slug: string): Promise<string[]> {
  const { data, error } = await supabase.from('events').select('custom_tags');
  if (error) return [];

  const set = new Set<string>();
  (data || []).forEach((row: { custom_tags?: Record<string, unknown> | null }) => {
    const ct = row.custom_tags;
    if (!ct || typeof ct !== 'object' || Array.isArray(ct)) return;
    const raw = ct[slug];
    const arr = Array.isArray(raw) ? raw : raw != null && String(raw).trim() ? [raw] : [];
    arr.forEach((v) => {
      const trimmed = String(v).trim();
      if (trimmed) set.add(trimmed);
    });
  });
  return Array.from(set);
}

/** Canonical names registered for this custom category (`tag_identities.tag_type = custom:${slug}`). */
async function fetchCustomTagNamesFromIdentities(slug: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tag_identities')
    .select('canonical_name')
    .eq('tag_type', `custom:${slug}`);
  if (error || !data?.length) return [];
  const set = new Set<string>();
  for (const row of data as { canonical_name: string }[]) {
    const t = row.canonical_name?.trim();
    if (t) set.add(t);
  }
  return Array.from(set);
}

/**
 * Suggestions for a custom performer field: names seen on events plus identities for `custom:${slug}`
 * (so the list matches what search can resolve, including before the first event lists a name).
 */
export async function fetchCustomTagSuggestions(slug: string): Promise<string[]> {
  const [fromEvents, fromIdentities] = await Promise.all([
    fetchCustomTagNamesFromEvents(slug),
    fetchCustomTagNamesFromIdentities(slug),
  ]);
  const merged = new Set<string>([...fromEvents, ...fromIdentities]);
  return Array.from(merged).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Display title from stored slug (same as add/edit event modals). */
export function slugToCustomCategoryLabel(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export interface CustomPerformerCategoryOption {
  slug: string;
  label: string;
}

/**
 * Distinct custom performer category slugs used on any event (`custom_tags` and `custom_tag_meta` keys).
 * Labels are derived from slugs for autocomplete (DB stores slugs; icons live in meta).
 */
export async function fetchExistingCustomPerformerCategories(): Promise<CustomPerformerCategoryOption[]> {
  const { data, error } = await supabase.from('events').select('custom_tags, custom_tag_meta');
  if (error) return [];
  const slugs = new Set<string>();
  for (const row of data || []) {
    const ct = row.custom_tags as Record<string, unknown> | null | undefined;
    const meta = row.custom_tag_meta as Record<string, unknown> | null | undefined;
    if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
      Object.keys(ct).forEach((k) => {
        const t = k.trim();
        if (t) slugs.add(t);
      });
    }
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      Object.keys(meta).forEach((k) => {
        const t = k.trim();
        if (t) slugs.add(t);
      });
    }
  }
  return Array.from(slugs)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((slug) => ({ slug, label: slugToCustomCategoryLabel(slug) }));
}
