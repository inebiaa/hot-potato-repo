export interface AppSettings {
  [key: string]: string | undefined;
  app_name?: string;
  app_icon_url?: string;
  app_logo_url?: string;
  app_favicon_url?: string;
  tagline?: string;
  /** JSON map of CopyKey → string overrides (see src/copy). */
  copy_overrides?: string;
  color_scheme?: string;
  collapsible_cards_enabled?: string;
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
  countdown_bg_color?: string;
  countdown_text_color?: string;
  footer_tags_bg_color?: string;
  footer_tags_text_color?: string;
  producer_icon?: string;
  designer_icon?: string;
  model_icon?: string;
  hair_makeup_icon?: string;
  city_icon?: string;
  season_icon?: string;
  header_tags_icon?: string;
  footer_tags_icon?: string;
  special_guests_icon?: string;
  optional_tags_bg_color?: string;
  optional_tags_text_color?: string;
  special_guests_bg_color?: string;
  special_guests_text_color?: string;
  /** JSON array of tag_identities.id for header pinned artist pills. */
  header_pinned_artists?: string;
  support_email?: string;
  privacy_policy_url?: string;
  terms_of_service_url?: string;
}
