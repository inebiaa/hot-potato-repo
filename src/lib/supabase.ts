import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface EventCollection {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  city: string;
  season: string | null;
  location: string | null;
  address: string | null;
  image_url: string | null;
  producers: string[] | null;
  featured_designers: string[] | null;
  models: string[] | null;
  hair_makeup: string[] | null;
  genre: string[] | null;
  footer_tags: string[] | null;
  collection_id: string | null;
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
