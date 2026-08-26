import type { AppSettings } from '../../types/appSettings';

export const PALETTE_STORAGE_KEY = 'tag_settings_palette_v1';
export const COLLECTIONS_STORAGE_KEY = 'tag_color_collections_v1';
export const DEFAULT_TAG_SETTINGS_KEY = 'tag_default_settings_v1';

export const BUILT_IN_TAG_DEFAULTS: Pick<
  AppSettings,
  | 'producer_bg_color'
  | 'producer_text_color'
  | 'designer_bg_color'
  | 'designer_text_color'
  | 'model_bg_color'
  | 'model_text_color'
  | 'hair_makeup_bg_color'
  | 'hair_makeup_text_color'
  | 'city_bg_color'
  | 'city_text_color'
  | 'season_bg_color'
  | 'season_text_color'
  | 'header_tags_bg_color'
  | 'header_tags_text_color'
  | 'countdown_bg_color'
  | 'countdown_text_color'
  | 'footer_tags_bg_color'
  | 'footer_tags_text_color'
  | 'optional_tags_bg_color'
  | 'optional_tags_text_color'
  | 'special_guests_bg_color'
  | 'special_guests_text_color'
  | 'producer_icon'
  | 'designer_icon'
  | 'model_icon'
  | 'hair_makeup_icon'
  | 'city_icon'
  | 'season_icon'
  | 'header_tags_icon'
  | 'footer_tags_icon'
  | 'special_guests_icon'
> = {
  producer_bg_color: '#fef08a',
  producer_text_color: '#713f12',
  designer_bg_color: '#f9a8d4',
  designer_text_color: '#831843',
  model_bg_color: '#86efac',
  model_text_color: '#14532d',
  hair_makeup_bg_color: '#67e8f9',
  hair_makeup_text_color: '#164e63',
  city_bg_color: '#bef264',
  city_text_color: '#365314',
  season_bg_color: '#fdba74',
  season_text_color: '#7c2d12',
  header_tags_bg_color: '#c4b5fd',
  header_tags_text_color: '#4c1d95',
  countdown_bg_color: '#fef3c7',
  countdown_text_color: '#92400e',
  footer_tags_bg_color: '#5eead4',
  footer_tags_text_color: '#134e4a',
  optional_tags_bg_color: '#fda4af',
  optional_tags_text_color: '#881337',
  special_guests_bg_color: '#e0e7ff',
  special_guests_text_color: '#3730a3',
  producer_icon: 'Tag',
  designer_icon: 'Tag',
  model_icon: 'Tag',
  hair_makeup_icon: 'Tag',
  city_icon: 'Tag',
  season_icon: 'Tag',
  header_tags_icon: 'Tag',
  footer_tags_icon: 'Tag',
  special_guests_icon: 'Mic',
};

export type TabId = 'branding' | 'legal' | 'moderation' | 'admins' | 'tags' | 'account';
export type CoreTagKey =
  | 'producer'
  | 'designer'
  | 'model'
  | 'hair_makeup'
  | 'city'
  | 'season'
  | 'header_tags'
  | 'footer_tags'
  | 'special_guests';
export type SwatchColorKey = CoreTagKey | 'optional_tags' | 'countdown';

export interface ColorCollection {
  id: string;
  name: string;
  colors: string[];
}

export interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  username?: string;
  user_id_public?: string;
}
