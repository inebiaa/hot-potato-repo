import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'secret-blogger-auth',
  },
});

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  city: string;
  season: string | null;
  location: string | null;
  address: string | null;
  /** Full formatted address line when available; used for cards and Event JSON-LD. */
  formatted_address?: string | null;
  /** Google Place ID when set from a place picker; unused if venues are free-text. */
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

export interface EditSuggestion {
  id: string;
  event_id: string;
  suggested_by: string;
  suggestion_data: any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Rating {
  id: string;
  event_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface EventWithRatings extends Event {
  average_rating: number;
  rating_count: number;
  user_rating?: Rating;
}

export interface UserList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface UserListEvent {
  id: string;
  list_id: string;
  event_id: string;
  position: number;
  created_at: string;
}
