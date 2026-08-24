/** Faded (muted) preset: soft pastels, auto text color */
export const FADED_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#f3f4f6', designer_bg_color: '#fef3c7', model_bg_color: '#fce7f3',
  hair_makeup_bg_color: '#f3e8ff', city_bg_color: '#dbeafe', season_bg_color: '#ffedd5',
  header_tags_bg_color: '#ccfbf1', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#d1fae5', optional_tags_bg_color: '#e0e7ff',
  special_guests_bg_color: '#e0e7ff',
};

/** Vibrant (bright) preset: saturated colors, auto text color */
export const BRIGHT_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#fef08a', designer_bg_color: '#f9a8d4', model_bg_color: '#86efac',
  hair_makeup_bg_color: '#67e8f9', city_bg_color: '#bef264', season_bg_color: '#fdba74',
  header_tags_bg_color: '#c4b5fd', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#5eead4', optional_tags_bg_color: '#fda4af',
  special_guests_bg_color: '#a5b4fc',
};

export type ColorCollection = {
  id: string;
  name: string;
  colors: string[];
};

export type TagOption = {
  key: string;
  label: string;
};
