import type { Event } from './eventTypes';

/**
 * `events` tag columns are `text[]` but some rows may be malformed (single string, JSON string, CSV).
 * Normalizes to a clean string list so the edit form, cards, and tag resolution all see the same values.
 */
export function coalesceTagList(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) {
    return v.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return [];
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t) as unknown;
        if (Array.isArray(parsed)) return coalesceTagList(parsed);
      } catch {
        // fall through
      }
    }
    if (t.includes(',')) {
      return t.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [t];
  }
  return [];
}

/** Apply to every event row from Supabase so tag chips and the edit form match. */
export function normalizeEventTagArrays(e: Event): Event {
  const opt = (v: string[]) => (v.length > 0 ? v : null);
  return {
    ...e,
    producers: opt(coalesceTagList(e.producers)) as Event['producers'],
    featured_designers: opt(coalesceTagList(e.featured_designers)) as Event['featured_designers'],
    models: opt(coalesceTagList(e.models)) as Event['models'],
    hair_makeup: opt(coalesceTagList(e.hair_makeup)) as Event['hair_makeup'],
    header_tags: opt(coalesceTagList(e.header_tags)) as Event['header_tags'],
    footer_tags: opt(coalesceTagList(e.footer_tags)) as Event['footer_tags'],
  };
}
