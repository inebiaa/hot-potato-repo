import { useCallback, useEffect, useState } from 'react';
import { readableTextForBg } from '../lib/colorUtils';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../types/appSettings';

/** Survive remounts so we don't flash a full-page spinner on every route land. */
let settingsCache: AppSettings | null = null;

export function useAppSettings() {
  const [appSettings, setAppSettingsState] = useState<AppSettings | null>(() => settingsCache);

  const setAppSettings = useCallback(
    (next: AppSettings | ((prev: AppSettings | null) => AppSettings | null)) => {
      setAppSettingsState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (value) settingsCache = value;
        return value;
      });
    },
    [],
  );

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;

      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value;
      });
      const iconValue = (key: keyof AppSettings, fallback: string) =>
        Object.prototype.hasOwnProperty.call(settingsObj, key) ? settingsObj[key] : fallback;

      const scheme = settingsObj.color_scheme || 'custom';
      const useAutoText = scheme === 'faded' || scheme === 'bright';
      const resolveText = (bg: string, explicit: string | undefined, fallback: string) =>
        useAutoText ? readableTextForBg(bg) : explicit || fallback;

      const producerBg = settingsObj.producer_bg_color || '#f3f4f6';
      const designerBg = settingsObj.designer_bg_color || '#fef3c7';
      const modelBg = settingsObj.model_bg_color || '#fce7f3';
      const hairBg = settingsObj.hair_makeup_bg_color || '#f3e8ff';
      const cityBg = settingsObj.city_bg_color || '#dbeafe';
      const seasonBg = settingsObj.season_bg_color || '#ffedd5';
      const headerBg = settingsObj.header_tags_bg_color || '#ccfbf1';
      const countdownBg = settingsObj.countdown_bg_color || '#fef3c7';
      const footerBg = settingsObj.footer_tags_bg_color || '#d1fae5';
      const optionalBg = settingsObj.optional_tags_bg_color || '#e0e7ff';
      const specialGuestsBg = settingsObj.special_guests_bg_color || '#e0e7ff';

      const nextSettings: AppSettings = {
        app_name: settingsObj.app_name ?? undefined,
        app_icon_url: settingsObj.app_icon_url ?? undefined,
        app_logo_url: settingsObj.app_logo_url ?? undefined,
        app_favicon_url: settingsObj.app_favicon_url ?? undefined,
        tagline: settingsObj.tagline ?? undefined,
        copy_overrides: settingsObj.copy_overrides ?? '',
        color_scheme: scheme,
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: producerBg,
        producer_text_color: resolveText(producerBg, settingsObj.producer_text_color, '#374151'),
        designer_bg_color: designerBg,
        designer_text_color: resolveText(designerBg, settingsObj.designer_text_color, '#b45309'),
        model_bg_color: modelBg,
        model_text_color: resolveText(modelBg, settingsObj.model_text_color, '#be185d'),
        hair_makeup_bg_color: hairBg,
        hair_makeup_text_color: resolveText(hairBg, settingsObj.hair_makeup_text_color, '#7e22ce'),
        city_bg_color: cityBg,
        city_text_color: resolveText(cityBg, settingsObj.city_text_color, '#1e40af'),
        season_bg_color: seasonBg,
        season_text_color: resolveText(seasonBg, settingsObj.season_text_color, '#c2410c'),
        header_tags_bg_color: headerBg,
        header_tags_text_color: resolveText(headerBg, settingsObj.header_tags_text_color, '#0f766e'),
        countdown_bg_color: countdownBg,
        countdown_text_color: resolveText(countdownBg, settingsObj.countdown_text_color, '#92400e'),
        footer_tags_bg_color: footerBg,
        footer_tags_text_color: resolveText(footerBg, settingsObj.footer_tags_text_color, '#065f46'),
        producer_icon: iconValue('producer_icon', 'Sparkles'),
        designer_icon: iconValue('designer_icon', 'Star'),
        model_icon: iconValue('model_icon', 'Users'),
        hair_makeup_icon: iconValue('hair_makeup_icon', 'Scissors'),
        city_icon: iconValue('city_icon', 'MapPin'),
        season_icon: iconValue('season_icon', 'Calendar'),
        header_tags_icon: iconValue('header_tags_icon', 'Tag'),
        footer_tags_icon: iconValue('footer_tags_icon', 'Tag'),
        special_guests_icon: iconValue('special_guests_icon', 'Mic'),
        optional_tags_bg_color: optionalBg,
        optional_tags_text_color: resolveText(optionalBg, settingsObj.optional_tags_text_color, '#3730a3'),
        special_guests_bg_color: specialGuestsBg,
        special_guests_text_color: resolveText(
          specialGuestsBg,
          settingsObj.special_guests_text_color,
          '#3730a3',
        ),
        header_pinned_artists: settingsObj.header_pinned_artists ?? '',
      };
      settingsCache = nextSettings;
      setAppSettingsState(nextSettings);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  return {
    appSettings,
    setAppSettings,
    fetchSettings,
  };
}
