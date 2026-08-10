/** Shared event row shape (also used by Vite prerender; keep free of runtime imports). */
export type ShowType = 'fashion' | 'music';

export interface Event {
  id: string;
  name: string;
  date: string;
  city: string;
  season: string | null;
  /** Fashion vs music show; legacy rows without the column normalize to fashion in the UI. */
  show_type?: ShowType | null;
  location: string | null;
  /** Auto-resolved street address for JSON-LD only (not shown in the UI). */
  formatted_address?: string | null;
  image_url: string | null;
  /** Official ticket / registration URL (countdown pill on upcoming events). */
  countdown_link?: string | null;
  producers: string[] | null;
  featured_designers: string[] | null;
  /** Music-show starring artists (separate from fashion designers). */
  featured_artists?: string[] | null;
  models: string[] | null;
  hair_makeup: string[] | null;
  header_tags?: string[] | null;
  footer_tags: string[] | null;
  custom_tags?: Record<string, string[]> | null;
  custom_tag_meta?: Record<string, { icon?: string }> | null;
  created_by: string | null;
  created_at: string;
}
