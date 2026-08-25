import { useCallback, useEffect, useRef, useState } from 'react';
import { COPY_OVERRIDES_SETTING_KEY } from '../copy';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteStoredBrandImage,
  ensureBrandImageStored,
} from '../lib/brandImageUpload';
import {
  parseHeaderPinnedArtistIds,
  resolvePinnedArtistNamesToIds,
  serializeHeaderPinnedArtistIds,
} from '../lib/headerPinnedArtists';
import { fetchIdentitiesByIds } from '../lib/tagIdentity';
import { supabase } from '../lib/supabase';
import type { AppSettings } from '../types/appSettings';

const DEFAULT_SETTINGS: AppSettings = {
  app_name: 'Secret Blogger',
  app_icon_url: '',
  app_logo_url: '',
  app_favicon_url: '',
  tagline: 'Fashion & Music Show Reviews',
  copy_overrides: '',
  color_scheme: 'custom',
  collapsible_cards_enabled: 'true',
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
  producer_icon: 'Tag',
  designer_icon: 'Tag',
  model_icon: 'Tag',
  hair_makeup_icon: 'Tag',
  city_icon: 'Tag',
  season_icon: 'Tag',
  header_tags_icon: 'Tag',
  footer_tags_icon: 'Tag',
  special_guests_icon: 'Mic',
  optional_tags_bg_color: '#fda4af',
  optional_tags_text_color: '#881337',
  special_guests_bg_color: '#e0e7ff',
  special_guests_text_color: '#3730a3',
  header_pinned_artists: '',
  support_email: '',
  privacy_policy_url: '',
  terms_of_service_url: '',
};

type UseSettingsEditorOptions = {
  onSettingsUpdated: () => void;
  onSettingsPreview?: (settings: AppSettings) => void;
};

export function useSettingsEditor({ onSettingsUpdated, onSettingsPreview }: UseSettingsEditorOptions) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...DEFAULT_SETTINGS }));
  const [pinnedArtistNames, setPinnedArtistNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const skipNextPreviewRef = useRef(false);
  const savedBrandingImagesRef = useRef({
    app_icon_url: '',
    app_logo_url: '',
    app_favicon_url: '',
  });

  const flashSuccess = useCallback((message: string, ms = 3000) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), ms);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase.from('app_settings').select('key, value');
      if (fetchError) throw fetchError;
      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value || '';
      });
      const iconValue = (key: keyof AppSettings, fallback: string) =>
        Object.prototype.hasOwnProperty.call(settingsObj, key) ? settingsObj[key] : fallback;
      const rawScheme = settingsObj.color_scheme;
      const color_scheme = ['faded', 'bright', 'custom'].includes(rawScheme) ? rawScheme : 'custom';

      setSettings({
        app_name: settingsObj.app_name || DEFAULT_SETTINGS.app_name,
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        app_favicon_url: settingsObj.app_favicon_url || '',
        tagline: settingsObj.tagline || DEFAULT_SETTINGS.tagline,
        copy_overrides: settingsObj.copy_overrides || settingsObj[COPY_OVERRIDES_SETTING_KEY] || '',
        color_scheme,
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: settingsObj.producer_bg_color || DEFAULT_SETTINGS.producer_bg_color,
        producer_text_color: settingsObj.producer_text_color || DEFAULT_SETTINGS.producer_text_color,
        designer_bg_color: settingsObj.designer_bg_color || DEFAULT_SETTINGS.designer_bg_color,
        designer_text_color: settingsObj.designer_text_color || DEFAULT_SETTINGS.designer_text_color,
        model_bg_color: settingsObj.model_bg_color || DEFAULT_SETTINGS.model_bg_color,
        model_text_color: settingsObj.model_text_color || DEFAULT_SETTINGS.model_text_color,
        hair_makeup_bg_color: settingsObj.hair_makeup_bg_color || DEFAULT_SETTINGS.hair_makeup_bg_color,
        hair_makeup_text_color: settingsObj.hair_makeup_text_color || DEFAULT_SETTINGS.hair_makeup_text_color,
        city_bg_color: settingsObj.city_bg_color || DEFAULT_SETTINGS.city_bg_color,
        city_text_color: settingsObj.city_text_color || DEFAULT_SETTINGS.city_text_color,
        season_bg_color: settingsObj.season_bg_color || DEFAULT_SETTINGS.season_bg_color,
        season_text_color: settingsObj.season_text_color || DEFAULT_SETTINGS.season_text_color,
        header_tags_bg_color: settingsObj.header_tags_bg_color || DEFAULT_SETTINGS.header_tags_bg_color,
        header_tags_text_color: settingsObj.header_tags_text_color || DEFAULT_SETTINGS.header_tags_text_color,
        countdown_bg_color: settingsObj.countdown_bg_color || DEFAULT_SETTINGS.countdown_bg_color,
        countdown_text_color: settingsObj.countdown_text_color || DEFAULT_SETTINGS.countdown_text_color,
        footer_tags_bg_color: settingsObj.footer_tags_bg_color || DEFAULT_SETTINGS.footer_tags_bg_color,
        footer_tags_text_color: settingsObj.footer_tags_text_color || DEFAULT_SETTINGS.footer_tags_text_color,
        producer_icon: iconValue('producer_icon', 'Tag'),
        designer_icon: iconValue('designer_icon', 'Tag'),
        model_icon: iconValue('model_icon', 'Tag'),
        hair_makeup_icon: iconValue('hair_makeup_icon', 'Tag'),
        city_icon: iconValue('city_icon', 'Tag'),
        season_icon: iconValue('season_icon', 'Tag'),
        header_tags_icon: iconValue('header_tags_icon', 'Tag'),
        footer_tags_icon: iconValue('footer_tags_icon', 'Tag'),
        special_guests_icon: iconValue('special_guests_icon', 'Mic'),
        optional_tags_bg_color: settingsObj.optional_tags_bg_color || DEFAULT_SETTINGS.optional_tags_bg_color,
        optional_tags_text_color: settingsObj.optional_tags_text_color || DEFAULT_SETTINGS.optional_tags_text_color,
        special_guests_bg_color: settingsObj.special_guests_bg_color || DEFAULT_SETTINGS.special_guests_bg_color,
        special_guests_text_color: settingsObj.special_guests_text_color || DEFAULT_SETTINGS.special_guests_text_color,
        header_pinned_artists: settingsObj.header_pinned_artists || '',
        support_email: settingsObj.support_email || '',
        privacy_policy_url: settingsObj.privacy_policy_url || '',
        terms_of_service_url: settingsObj.terms_of_service_url || '',
      });
      const pinnedIds = parseHeaderPinnedArtistIds(settingsObj.header_pinned_artists);
      if (pinnedIds.length > 0) {
        void fetchIdentitiesByIds(pinnedIds).then((rows) => {
          const byId = new Map(rows.map((r) => [r.id, r.canonical_name]));
          setPinnedArtistNames(pinnedIds.map((id) => byId.get(id)).filter((n): n is string => !!n));
        });
      } else {
        setPinnedArtistNames([]);
      }
      savedBrandingImagesRef.current = {
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        app_favicon_url: settingsObj.app_favicon_url || '',
      };
      skipNextPreviewRef.current = true;
      setSettingsLoaded(true);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (!settingsLoaded || !onSettingsPreview) return;
    if (skipNextPreviewRef.current) {
      skipNextPreviewRef.current = false;
      return;
    }
    onSettingsPreview(settings);
  }, [settings, settingsLoaded, onSettingsPreview]);

  const patchSettings = (patch: Partial<AppSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      onSettingsPreview?.(next);
      return next;
    });
  };

  const saveSettings = async () => {
    if (!user) {
      setError('You must be logged in');
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const iconStored = await ensureBrandImageStored(settings.app_icon_url, 'icon');
      if ('error' in iconStored) throw new Error(iconStored.error);
      const logoStored = await ensureBrandImageStored(settings.app_logo_url, 'logo');
      if ('error' in logoStored) throw new Error(logoStored.error);
      const faviconStored = await ensureBrandImageStored(settings.app_favicon_url, 'favicon');
      if ('error' in faviconStored) throw new Error(faviconStored.error);

      const nextIcon = iconStored.url || '';
      const nextLogo = logoStored.url || '';
      const nextFavicon = faviconStored.url || '';
      if (
        nextIcon !== settings.app_icon_url ||
        nextLogo !== settings.app_logo_url ||
        nextFavicon !== settings.app_favicon_url
      ) {
        setSettings((prev) => ({
          ...prev,
          app_icon_url: nextIcon,
          app_logo_url: nextLogo,
          app_favicon_url: nextFavicon,
        }));
      }

      const prev = savedBrandingImagesRef.current;
      if (prev.app_icon_url && prev.app_icon_url !== nextIcon) {
        void deleteStoredBrandImage(prev.app_icon_url);
      }
      if (prev.app_logo_url && prev.app_logo_url !== nextLogo) {
        void deleteStoredBrandImage(prev.app_logo_url);
      }
      if (prev.app_favicon_url && prev.app_favicon_url !== nextFavicon) {
        void deleteStoredBrandImage(prev.app_favicon_url);
      }

      const pinnedArtistIds = await resolvePinnedArtistNamesToIds(pinnedArtistNames, user.id);
      const headerPinnedArtists = serializeHeaderPinnedArtistIds(pinnedArtistIds);

      const updates = [
        { key: 'app_name', value: settings.app_name },
        { key: 'app_icon_url', value: nextIcon },
        { key: 'app_logo_url', value: nextLogo },
        { key: 'app_favicon_url', value: nextFavicon },
        { key: 'tagline', value: settings.tagline },
        { key: COPY_OVERRIDES_SETTING_KEY, value: settings.copy_overrides || '' },
        { key: 'color_scheme', value: settings.color_scheme },
        { key: 'collapsible_cards_enabled', value: settings.collapsible_cards_enabled },
        { key: 'producer_bg_color', value: settings.producer_bg_color },
        { key: 'producer_text_color', value: settings.producer_text_color },
        { key: 'designer_bg_color', value: settings.designer_bg_color },
        { key: 'designer_text_color', value: settings.designer_text_color },
        { key: 'model_bg_color', value: settings.model_bg_color },
        { key: 'model_text_color', value: settings.model_text_color },
        { key: 'hair_makeup_bg_color', value: settings.hair_makeup_bg_color },
        { key: 'hair_makeup_text_color', value: settings.hair_makeup_text_color },
        { key: 'city_bg_color', value: settings.city_bg_color },
        { key: 'city_text_color', value: settings.city_text_color },
        { key: 'season_bg_color', value: settings.season_bg_color },
        { key: 'season_text_color', value: settings.season_text_color },
        { key: 'header_tags_bg_color', value: settings.header_tags_bg_color },
        { key: 'header_tags_text_color', value: settings.header_tags_text_color },
        { key: 'countdown_bg_color', value: settings.countdown_bg_color },
        { key: 'countdown_text_color', value: settings.countdown_text_color },
        { key: 'footer_tags_bg_color', value: settings.footer_tags_bg_color },
        { key: 'footer_tags_text_color', value: settings.footer_tags_text_color },
        { key: 'producer_icon', value: settings.producer_icon },
        { key: 'designer_icon', value: settings.designer_icon },
        { key: 'model_icon', value: settings.model_icon },
        { key: 'hair_makeup_icon', value: settings.hair_makeup_icon },
        { key: 'city_icon', value: settings.city_icon },
        { key: 'season_icon', value: settings.season_icon },
        { key: 'header_tags_icon', value: settings.header_tags_icon },
        { key: 'footer_tags_icon', value: settings.footer_tags_icon },
        { key: 'special_guests_icon', value: settings.special_guests_icon },
        { key: 'optional_tags_bg_color', value: settings.optional_tags_bg_color },
        { key: 'optional_tags_text_color', value: settings.optional_tags_text_color },
        { key: 'special_guests_bg_color', value: settings.special_guests_bg_color },
        { key: 'special_guests_text_color', value: settings.special_guests_text_color },
        { key: 'header_pinned_artists', value: headerPinnedArtists },
        { key: 'support_email', value: settings.support_email || '' },
        { key: 'privacy_policy_url', value: settings.privacy_policy_url || '' },
        { key: 'terms_of_service_url', value: settings.terms_of_service_url || '' },
      ];

      for (const u of updates) {
        const { error: err } = await supabase
          .from('app_settings')
          .upsert(
            { key: u.key, value: u.value, updated_by: user.id, updated_at: new Date().toISOString() },
            { onConflict: 'key' },
          );
        if (err) throw err;
      }
      savedBrandingImagesRef.current = {
        app_icon_url: nextIcon,
        app_logo_url: nextLogo,
        app_favicon_url: nextFavicon,
      };
      flashSuccess('Settings saved');
      onSettingsUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    setSettings,
    patchSettings,
    pinnedArtistNames,
    setPinnedArtistNames,
    loading,
    error,
    setError,
    success,
    setSuccess,
    flashSuccess,
    settingsLoaded,
    saveSettings,
    fetchSettings,
  };
}
