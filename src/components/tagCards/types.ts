import type { Event } from '../../lib/supabase';

export interface EventRating {
  event_id: string;
  event_name: string;
  avg_rating: number;
  rating_count: number;
  event?: Event;
}

export interface TagColorsForPills {
  producer_icon?: string;
  designer_icon?: string;
  model_icon?: string;
  hair_makeup_icon?: string;
  city_icon?: string;
  season_icon?: string;
  header_tags_icon?: string;
  footer_tags_icon?: string;
  producer_bg_color?: string;
  producer_text_color?: string;
  designer_bg_color?: string;
  designer_text_color?: string;
  model_bg_color?: string;
  model_text_color?: string;
  hair_makeup_bg_color?: string;
  hair_makeup_text_color?: string;
  city_bg_color?: string;
  city_text_color?: string;
  season_bg_color?: string;
  season_text_color?: string;
  header_tags_bg_color?: string;
  header_tags_text_color?: string;
  footer_tags_bg_color?: string;
  footer_tags_text_color?: string;
  optional_tags_bg_color?: string;
  optional_tags_text_color?: string;
}

export interface TagEntityCardSharedProps {
  tagValue: string;
  eventRatings: EventRating[];
  totalShows: number;
  overallAverage: number;
  totalRatings: number;
  onEventClick?: (eventId: string) => void;
  tagColors?: TagColorsForPills;
}
