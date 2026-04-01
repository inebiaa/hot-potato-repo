/** Shared event row shape (also used by Vite prerender; keep free of runtime imports). */
export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  city: string;
  season: string | null;
  location: string | null;
  address: string | null;
  /** Optional single-line full address (legacy rows); cards + Event JSON-LD streetAddress when set. */
  formatted_address?: string | null;
  /** Optional external place identifier (legacy rows); unused by current venue UI. */
  google_place_id?: string | null;
  image_url: string | null;
  /** Official ticket / registration URL (countdown pill on upcoming events). */
  countdown_link?: string | null;
  producers: string[] | null;
  featured_designers: string[] | null;
  models: string[] | null;
  hair_makeup: string[] | null;
  genre?: string[] | null;
  header_tags?: string[] | null;
  footer_tags: string[] | null;
  custom_tags?: Record<string, string[]> | null;
  custom_tag_meta?: Record<string, { icon?: string }> | null;
  created_by: string | null;
  created_at: string;
}
