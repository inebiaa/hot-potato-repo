import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';
import type { Event } from './eventTypes';

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

export type { Event } from './eventTypes';

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
