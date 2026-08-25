import type { Event, Rating, UserList, UserListEvent } from '../../lib/supabase';

export interface ProfilePageProps {
  userId: string;
  onTagClick?: (type: string, value: string, displayLabel?: string) => void;
  onOpenEvent?: (eventId: string) => void;
  /** When viewing a board, report its events so search suggestions stay board-scoped. */
  onBoardEventsChange?: (events: Event[] | null) => void;
  onSearchEventRatingSubmitted?: (eventId: string) => void;
  onSearchEventUpdated?: () => void;
  tagColors?: {
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
  };
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  refreshTrigger?: number;
  /** Optional cached events from App - avoids re-fetching when navigating */
  cachedEvents?: Event[];
}

export interface ReviewRow {
  rating: Rating;
  event: Event;
  eventName: string;
  eventDate: string;
  averageRating: number;
  ratingCount: number;
}

export interface ListWithCount extends UserList {
  event_count: number;
  /** Temporary cover from event photos when no custom cover is set. */
  cover_collage_urls?: string[];
  /** Event ids on this board (for search matching). */
  event_ids?: string[];
}

export type BoardRow = {
  event: Event;
  listEvent: UserListEvent;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
};
