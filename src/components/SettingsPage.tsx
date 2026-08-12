import { useState, useEffect, useRef } from 'react';
import { Save, Image, Users, Tags, User, Type } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { readableTextForBg } from '../lib/colorUtils';
import { CUSTOM_COLORS_STORAGE_KEY, PRELOADED_HEX } from '../lib/tagColorPickerData';
import type { AppSettings } from '../types/appSettings';
import BrandingTab from './settings/BrandingTab';
import CopyTab from './settings/CopyTab';
import AccountTab from './settings/AccountTab';
import AdminsTab from './settings/AdminsTab';
import TagsTab, { BRIGHT_TAG_DEFAULTS, FADED_TAG_DEFAULTS } from './settings/TagsTab';
import { Button } from './ui';
import { deleteStoredProfileImage } from '../lib/profileImageUpload';
import { COPY_OVERRIDES_SETTING_KEY } from '../copy';
import {
  deleteStoredBrandImage,
  ensureBrandImageStored,
} from '../lib/brandImageUpload';

const PALETTE_STORAGE_KEY = 'tag_settings_palette_v1';
const COLLECTIONS_STORAGE_KEY = 'tag_color_collections_v1';
const DEFAULT_TAG_SETTINGS_KEY = 'tag_default_settings_v1';


const BUILT_IN_TAG_DEFAULTS: Pick<AppSettings, 'producer_bg_color' | 'producer_text_color' | 'designer_bg_color' | 'designer_text_color' | 'model_bg_color' | 'model_text_color' | 'hair_makeup_bg_color' | 'hair_makeup_text_color' | 'city_bg_color' | 'city_text_color' | 'season_bg_color' | 'season_text_color' | 'header_tags_bg_color' | 'header_tags_text_color' | 'countdown_bg_color' | 'countdown_text_color' | 'footer_tags_bg_color' | 'footer_tags_text_color' | 'optional_tags_bg_color' | 'optional_tags_text_color' | 'special_guests_bg_color' | 'special_guests_text_color' | 'producer_icon' | 'designer_icon' | 'model_icon' | 'hair_makeup_icon' | 'city_icon' | 'season_icon' | 'header_tags_icon' | 'footer_tags_icon' | 'special_guests_icon'> = {
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

interface ColorCollection {
  id: string;
  name: string;
  colors: string[];
}

interface SettingsPageProps {
  onSettingsUpdated: () => void;
  onSettingsPreview?: (settings: AppSettings) => void;
  onAccountUpdated?: () => void;
}

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  username?: string;
  user_id_public?: string;
}

type TabId = 'branding' | 'copy' | 'admins' | 'tags' | 'account';
type CoreTagKey = 'producer' | 'designer' | 'model' | 'hair_makeup' | 'city' | 'season' | 'header_tags' | 'footer_tags' | 'special_guests';
type SwatchColorKey = CoreTagKey | 'optional_tags' | 'countdown';

export default function SettingsPage({ onSettingsUpdated, onSettingsPreview, onAccountUpdated }: SettingsPageProps) {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [settings, setSettings] = useState<AppSettings>(() => ({
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
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminUserIdPublic, setAdminUserIdPublic] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [assigningTag, setAssigningTag] = useState<SwatchColorKey | null>(null);
  const [paletteColors, setPaletteColors] = useState<string[]>(() => [...PRELOADED_HEX]);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editingHex, setEditingHex] = useState('');
  const [collections, setCollections] = useState<ColorCollection[]>(() => []);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const skipNextPreviewRef = useRef(false);
  const savedBrandingImagesRef = useRef({
    app_icon_url: '',
    app_logo_url: '',
    app_favicon_url: '',
  });

  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const tagOptions: { key: SwatchColorKey; label: string }[] = [
    { key: 'producer', label: 'Producer' },
    { key: 'designer', label: 'Designer' },
    { key: 'hair_makeup', label: 'Hair & Makeup' },
    { key: 'city', label: 'City' },
    { key: 'season', label: 'Season' },
    { key: 'header_tags', label: 'Genre' },
    { key: 'footer_tags', label: 'Collection' },
    { key: 'special_guests', label: 'Special Guests' },
    { key: 'countdown', label: 'Countdown' },
    { key: 'optional_tags', label: 'Custom' },
  ];
  const coreTagOptions = tagOptions.filter((t) => t.key !== 'optional_tags');
  const tagKeysForDefault = tagOptions;

  useEffect(() => {
    try {
      const paletteRaw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
      if (paletteRaw) {
        const parsed = JSON.parse(paletteRaw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((v): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v));
          const seen = new Set<string>();
          const deduped = valid.filter((h) => !seen.has(h.toLowerCase()) && (seen.add(h.toLowerCase()), true));
          if (deduped.length > 0) {
            setPaletteColors(deduped);
            return;
          }
        }
      }
      const raw = window.localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((v): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v));
        const seen = new Set(PRELOADED_HEX.map((h) => h.toLowerCase()));
        const extra = valid.filter((h) => !seen.has(h.toLowerCase()) && (seen.add(h.toLowerCase()), true));
        setPaletteColors(() => [...PRELOADED_HEX, ...extra]);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLECTIONS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.filter(
          (c): c is ColorCollection =>
            typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.colors)
        );
        setCollections(valid);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistPalette = (colors: string[]) => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(colors));
      const extra = colors.filter((h) => !PRELOADED_HEX.some((p) => p.toLowerCase() === h.toLowerCase()));
      window.localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(extra));
    } catch {
      // ignore
    }
  };

  const persistCollections = (cols: ColorCollection[]) => {
    try {
      window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cols));
    } catch {
      // ignore
    }
  };

  const addToPalette = (hex: string) => {
    const n = hex.toLowerCase();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    setPaletteColors((prev) => {
      if (prev.some((c) => c.toLowerCase() === n)) return prev;
      const next = [...prev, n];
      persistPalette(next);
      return next;
    });
  };

  const removeFromPalette = (hex: string) => {
    const n = hex.toLowerCase();
    setPaletteColors((prev) => {
      const next = prev.filter((c) => c.toLowerCase() !== n);
      persistPalette(next);
      return next;
    });
  };

  const editColorInPalette = (oldHex: string, newHex: string) => {
    const n = newHex.toLowerCase();
    if (!/^#[0-9a-fA-F]{6}$/.test(newHex)) return;
    const nextPalette = paletteColors.map((c) => (c.toLowerCase() === oldHex.toLowerCase() ? n : c));
    if (nextPalette.some((x) => x.toLowerCase() === n)) {
      setPaletteColors(nextPalette);
      persistPalette(nextPalette);
      const nextCollections = collections.map((col) => ({
        ...col,
        colors: col.colors.map((c) => (c.toLowerCase() === oldHex.toLowerCase() ? n : c)),
      }));
      setCollections(nextCollections);
      persistCollections(nextCollections);
    }
    setEditingColor(null);
  };

  const resetPaletteToDefaults = () => {
    setPaletteColors([...PRELOADED_HEX]);
    persistPalette([...PRELOADED_HEX]);
  };

  const createCollection = () => {
    const id = crypto.randomUUID();
    const name = `Collection ${collections.length + 1}`;
    const next = [...collections, { id, name, colors: [] }];
    setCollections(next);
    persistCollections(next);
  };

  const updateCollectionName = (id: string, name: string) => {
    const next = collections.map((c) => (c.id === id ? { ...c, name } : c));
    setCollections(next);
    persistCollections(next);
  };

  const deleteCollection = (id: string) => {
    const next = collections.filter((c) => c.id !== id);
    setCollections(next);
    persistCollections(next);
    setDragOverCollectionId(null);
  };

  const addColorToCollection = (collectionId: string, hex: string) => {
    const n = hex.toLowerCase();
    const next = collections.map((c) =>
      c.id === collectionId && !c.colors.some((x) => x.toLowerCase() === n) ? { ...c, colors: [...c.colors, n] } : c
    );
    setCollections(next);
    persistCollections(next);
    setDragOverCollectionId(null);
  };

  const removeColorFromCollection = (collectionId: string, hex: string) => {
    const n = hex.toLowerCase();
    const next = collections.map((c) => (c.id === collectionId ? { ...c, colors: c.colors.filter((x) => x.toLowerCase() !== n) } : c));
    setCollections(next);
    persistCollections(next);
  };

  const getTagDefaults = (): typeof BUILT_IN_TAG_DEFAULTS => {
    try {
      const raw = window.localStorage.getItem(DEFAULT_TAG_SETTINGS_KEY);
      if (!raw) return BUILT_IN_TAG_DEFAULTS;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const merged = { ...BUILT_IN_TAG_DEFAULTS };
        for (const k of Object.keys(BUILT_IN_TAG_DEFAULTS) as (keyof typeof BUILT_IN_TAG_DEFAULTS)[]) {
          if (typeof parsed[k] === 'string') merged[k] = parsed[k];
        }
        return merged;
      }
    } catch {
      // ignore
    }
    return BUILT_IN_TAG_DEFAULTS;
  };

  const setAsDefault = () => {
    const toSave: Record<string, string> = {};
    for (const k of tagKeysForDefault) {
      const bgKey = k.key === 'optional_tags' ? 'optional_tags_bg_color' : k.key === 'countdown' ? 'countdown_bg_color' : `${k.key}_bg_color`;
      const textKey = k.key === 'optional_tags' ? 'optional_tags_text_color' : k.key === 'countdown' ? 'countdown_text_color' : `${k.key}_text_color`;
      const iconKey = k.key === 'optional_tags' || k.key === 'countdown' ? null : `${k.key}_icon`;
      toSave[bgKey] = (settings as Record<string, string>)[bgKey] || BUILT_IN_TAG_DEFAULTS[bgKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
      toSave[textKey] = (settings as Record<string, string>)[textKey] || BUILT_IN_TAG_DEFAULTS[textKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
      if (iconKey) toSave[iconKey] = (settings as Record<string, string>)[iconKey] || BUILT_IN_TAG_DEFAULTS[iconKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
    }
    try {
      window.localStorage.setItem(DEFAULT_TAG_SETTINGS_KEY, JSON.stringify(toSave));
      setError('');
      setSuccess('Current options set as default');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Could not save default');
    }
  };

  const revertToDefault = () => {
    const defs = getTagDefaults();
    const next: AppSettings = { ...settings };
    for (const { key } of tagOptions) {
      const bgKey = key === 'optional_tags' ? 'optional_tags_bg_color' : key === 'countdown' ? 'countdown_bg_color' : `${key}_bg_color`;
      const textKey = key === 'optional_tags' ? 'optional_tags_text_color' : key === 'countdown' ? 'countdown_text_color' : `${key}_text_color`;
      const iconKey = key === 'optional_tags' || key === 'countdown' ? null : `${key}_icon`;
      next[bgKey] = defs[bgKey as keyof typeof defs];
      next[textKey] = defs[textKey as keyof typeof defs];
      if (iconKey) (next as Record<string, string>)[iconKey] = defs[iconKey as keyof typeof defs];
    }
    setSettings(next);
    onSettingsPreview?.(next);
    setError('');
    setSuccess('Reverted to default');
    setTimeout(() => setSuccess(''), 3000);
  };

  const assignColorToTag = (tagKey: SwatchColorKey, hex: string, close = true) => {
    const bgKey = tagKey === 'optional_tags' ? 'optional_tags_bg_color' : tagKey === 'countdown' ? 'countdown_bg_color' : `${tagKey}_bg_color`;
    const textKey = tagKey === 'optional_tags' ? 'optional_tags_text_color' : tagKey === 'countdown' ? 'countdown_text_color' : `${tagKey}_text_color`;
    setSettings((s) => ({
      ...s,
      color_scheme: 'custom',
      [bgKey]: hex,
      [textKey]: readableTextForBg(hex),
    }));
    if (close) setAssigningTag(null);
  };

  const userId = user?.id ?? '';

  const fetchAccountProfile = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('username, user_id_public, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    setEditName(data?.username || '');
    setEditUsername(data?.user_id_public || '');
    setEditAvatarUrl(data?.avatar_url || '');
  };

  const saveAccountProfile = async () => {
    setProfileSaveError('');
    setProfileSaving(true);
    try {
      const newName = editName.trim();
      const newUsername = editUsername.trim();
      if (!newName || newName.length < 1) {
        setProfileSaveError('Your name is required.');
        setProfileSaving(false);
        return;
      }
      if (!newUsername || newUsername.length < 4) {
        setProfileSaveError('Username must be at least 4 characters.');
        setProfileSaving(false);
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        setProfileSaveError('Username may only contain letters, numbers, underscores, and hyphens.');
        setProfileSaving(false);
        return;
      }
      const newAvatar = editAvatarUrl.trim() || null;
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('avatar_url')
        .eq('user_id', userId)
        .maybeSingle();
      const { error } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: userId,
            username: newName,
            user_id_public: newUsername,
            avatar_url: newAvatar,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        );
      if (error) {
        const msg = error.code === '23505'
          ? 'That username is already taken.'
          : (error.message || 'Could not save profile.');
        setProfileSaveError(msg);
        setProfileSaving(false);
        return;
      }
      const prevAvatar = existingProfile?.avatar_url?.trim() || null;
      if (prevAvatar && prevAvatar !== newAvatar) {
        await deleteStoredProfileImage(prevAvatar);
      }
      await fetchAccountProfile();
      setSuccess('Profile saved');
      onSettingsUpdated();
      onAccountUpdated?.();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setProfileSaveError('Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    setSettingsLoaded(false);
    fetchSettings();
    fetchAdminUsers();
    if (user) {
      fetchAccountProfile();
    }
    if (!isAdmin) setActiveTab('account');
    // One-shot on mount / auth change; fetch* helpers are intentionally not deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!settingsLoaded || !onSettingsPreview) return;
    if (skipNextPreviewRef.current) {
      skipNextPreviewRef.current = false;
      return;
    }
    onSettingsPreview(settings);
  }, [settings, settingsLoaded, onSettingsPreview]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value || '';
      });
      const iconValue = (key: keyof AppSettings, fallback: string) =>
        Object.prototype.hasOwnProperty.call(settingsObj, key) ? settingsObj[key] : fallback;
      const rawScheme = settingsObj.color_scheme;
      const color_scheme = ['faded', 'bright', 'custom'].includes(rawScheme) ? rawScheme : 'custom';

      setSettings({
        app_name: settingsObj.app_name || 'Secret Blogger',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        app_favicon_url: settingsObj.app_favicon_url || '',
        tagline: settingsObj.tagline || 'Fashion & Music Show Reviews',
        copy_overrides: settingsObj.copy_overrides || settingsObj[COPY_OVERRIDES_SETTING_KEY] || '',
        color_scheme,
        collapsible_cards_enabled: settingsObj.collapsible_cards_enabled || 'true',
        producer_bg_color: settingsObj.producer_bg_color || '#fef08a',
        producer_text_color: settingsObj.producer_text_color || '#713f12',
        designer_bg_color: settingsObj.designer_bg_color || '#f9a8d4',
        designer_text_color: settingsObj.designer_text_color || '#831843',
        model_bg_color: settingsObj.model_bg_color || '#86efac',
        model_text_color: settingsObj.model_text_color || '#14532d',
        hair_makeup_bg_color: settingsObj.hair_makeup_bg_color || '#67e8f9',
        hair_makeup_text_color: settingsObj.hair_makeup_text_color || '#164e63',
        city_bg_color: settingsObj.city_bg_color || '#bef264',
        city_text_color: settingsObj.city_text_color || '#365314',
        season_bg_color: settingsObj.season_bg_color || '#fdba74',
        season_text_color: settingsObj.season_text_color || '#7c2d12',
        header_tags_bg_color: settingsObj.header_tags_bg_color || '#c4b5fd',
        header_tags_text_color: settingsObj.header_tags_text_color || '#4c1d95',
        countdown_bg_color: settingsObj.countdown_bg_color || '#fef3c7',
        countdown_text_color: settingsObj.countdown_text_color || '#92400e',
        footer_tags_bg_color: settingsObj.footer_tags_bg_color || '#5eead4',
        footer_tags_text_color: settingsObj.footer_tags_text_color || '#134e4a',
        producer_icon: iconValue('producer_icon', 'Tag'),
        designer_icon: iconValue('designer_icon', 'Tag'),
        model_icon: iconValue('model_icon', 'Tag'),
        hair_makeup_icon: iconValue('hair_makeup_icon', 'Tag'),
        city_icon: iconValue('city_icon', 'Tag'),
        season_icon: iconValue('season_icon', 'Tag'),
        header_tags_icon: iconValue('header_tags_icon', 'Tag'),
        footer_tags_icon: iconValue('footer_tags_icon', 'Tag'),
        special_guests_icon: iconValue('special_guests_icon', 'Mic'),
        optional_tags_bg_color: settingsObj.optional_tags_bg_color || '#fda4af',
        optional_tags_text_color: settingsObj.optional_tags_text_color || '#881337',
        special_guests_bg_color: settingsObj.special_guests_bg_color || '#e0e7ff',
        special_guests_text_color: settingsObj.special_guests_text_color || '#3730a3',
      });
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
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase.from('admin_users').select('id, user_id, created_at');
      if (error) throw error;
      const adminRows = data || [];
      const userIds = adminRows.map((admin) => admin.user_id);
      if (userIds.length === 0) {
        setAdminUsers([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, username, user_id_public')
        .in('user_id', userIds);
      if (profileError) throw profileError;

      const profileByUserId = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile])
      );

      setAdminUsers(
        adminRows.map((admin) => {
          const profile = profileByUserId.get(admin.user_id);
          return {
            ...admin,
            username: profile?.username ?? 'Unknown',
            user_id_public: profile?.user_id_public ?? undefined,
          };
        })
      );
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const handleAddAdmin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const newAdminId = adminUserIdPublic.trim();
    if (!newAdminId) {
      setError('Please enter a user ID');
      return;
    }
    setError('');
    setSuccess('');
    setAdminLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id_public', newAdminId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.user_id) {
        setError('No user found with that ID');
        setAdminLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('admin_users').insert({ user_id: profile.user_id });
      if (insertError) {
        setError(insertError.code === '23505' ? 'User is already an admin' : insertError.message);
        setAdminLoading(false);
        return;
      }
      setSuccess('Admin added');
      setAdminUserIdPublic('');
      fetchAdminUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add admin');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminId: string) => {
    if (adminUsers.length <= 1) {
      setError('Cannot remove the last admin');
      return;
    }
    if (!confirm('Remove this admin?')) return;
    setError('');
    try {
      const { error } = await supabase.from('admin_users').delete().eq('id', adminId);
      if (error) throw error;
      setSuccess('Admin removed');
      fetchAdminUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      ];

      for (const u of updates) {
        const { error: err } = await supabase
          .from('app_settings')
          .upsert({ key: u.key, value: u.value, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (err) throw err;
      }
      savedBrandingImagesRef.current = {
        app_icon_url: nextIcon,
        app_logo_url: nextLogo,
        app_favicon_url: nextFavicon,
      };
      setSuccess('Settings saved');
      onSettingsUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    ...(isAdmin ? [
      { id: 'branding' as const, label: 'Branding', icon: <Image size={18} /> },
      { id: 'copy' as const, label: 'Copy', icon: <Type size={18} /> },
      { id: 'admins' as const, label: 'Admins', icon: <Users size={18} /> },
      { id: 'tags' as const, label: 'Tags', icon: <Tags size={18} /> },
    ] : []),
    { id: 'account', label: 'Account', icon: <User size={18} /> },
  ];
  return (
    <div className="w-full overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex shrink-0 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-neutral-900 text-neutral-900'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 p-5">
            {activeTab === 'branding' && (
              <BrandingTab
                settings={settings}
                onChange={(patch) => {
                  setSettings((s) => ({ ...s, ...patch }));
                  onSettingsPreview?.({ ...settings, ...patch });
                }}
              />
            )}

            {activeTab === 'copy' && (
              <CopyTab
                settings={settings}
                onChange={(patch) => {
                  setSettings((s) => ({ ...s, ...patch }));
                  onSettingsPreview?.({ ...settings, ...patch });
                }}
              />
            )}

            {activeTab === 'admins' && (
              <AdminsTab
                adminUserIdPublic={adminUserIdPublic}
                setAdminUserIdPublic={setAdminUserIdPublic}
                adminLoading={adminLoading}
                adminUsers={adminUsers}
                handleAddAdmin={() => void handleAddAdmin()}
                handleRemoveAdmin={handleRemoveAdmin}
              />
            )}

            {activeTab === 'tags' && (
              <TagsTab
                settings={settings}
                setSettings={setSettings}
                onSettingsPreview={onSettingsPreview}
                paletteColors={paletteColors}
                editingColor={editingColor}
                setEditingColor={setEditingColor}
                editingHex={editingHex}
                setEditingHex={setEditingHex}
                editColorInPalette={editColorInPalette}
                removeFromPalette={removeFromPalette}
                addToPalette={addToPalette}
                resetPaletteToDefaults={resetPaletteToDefaults}
                collections={collections}
                createCollection={createCollection}
                dragOverCollectionId={dragOverCollectionId}
                setDragOverCollectionId={setDragOverCollectionId}
                addColorToCollection={addColorToCollection}
                updateCollectionName={updateCollectionName}
                deleteCollection={deleteCollection}
                removeColorFromCollection={removeColorFromCollection}
                assigningTag={assigningTag}
                setAssigningTag={(v) => setAssigningTag((v as SwatchColorKey | null) ?? null)}
                assignColorToTag={assignColorToTag}
                tagOptions={tagOptions}
                coreTagOptions={coreTagOptions}
                setAsDefault={setAsDefault}
                revertToDefault={revertToDefault}
              />
            )}

            {activeTab === 'account' && user && (
              <AccountTab
                accountEmail={user.email}
                editName={editName}
                setEditName={setEditName}
                editUsername={editUsername}
                setEditUsername={setEditUsername}
                editAvatarUrl={editAvatarUrl}
                setEditAvatarUrl={setEditAvatarUrl}
                userId={userId}
                profileSaveError={profileSaveError}
                profileSaving={profileSaving}
                saveAccountProfile={saveAccountProfile}
              />
            )}

          </div>

          {(error || success) && (
            <div className="px-5 pb-2">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
            </div>
          )}

          <div className="border-t border-border bg-muted p-5">
            <Button type="submit" disabled={loading} className="w-full">
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
    </div>
  );
}

