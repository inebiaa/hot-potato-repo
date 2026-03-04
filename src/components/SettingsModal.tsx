import { useState, useEffect, useRef } from 'react';
import { Save, UserPlus, Trash2, Image, Users, Tags, FolderPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getIcon, DEFAULT_ICONS } from '../lib/eventCardIcons';
import { useAuth } from '../contexts/AuthContext';
import { readableTextForBg } from '../lib/colorUtils';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';
import { CUSTOM_COLORS_STORAGE_KEY, PRELOADED_HEX } from './ColorPicker';

const PALETTE_STORAGE_KEY = 'tag_settings_palette_v1';
const COLLECTIONS_STORAGE_KEY = 'tag_color_collections_v1';
const DEFAULT_TAG_SETTINGS_KEY = 'tag_default_settings_v1';

const BUILT_IN_TAG_DEFAULTS: Pick<AppSettings, 'producer_bg_color' | 'producer_text_color' | 'designer_bg_color' | 'designer_text_color' | 'model_bg_color' | 'model_text_color' | 'hair_makeup_bg_color' | 'hair_makeup_text_color' | 'city_bg_color' | 'city_text_color' | 'season_bg_color' | 'season_text_color' | 'header_tags_bg_color' | 'header_tags_text_color' | 'footer_tags_bg_color' | 'footer_tags_text_color' | 'optional_tags_bg_color' | 'optional_tags_text_color' | 'producer_icon' | 'designer_icon' | 'model_icon' | 'hair_makeup_icon' | 'city_icon' | 'season_icon' | 'header_tags_icon' | 'footer_tags_icon'> = {
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
  footer_tags_bg_color: '#5eead4',
  footer_tags_text_color: '#134e4a',
  optional_tags_bg_color: '#fda4af',
  optional_tags_text_color: '#881337',
  producer_icon: 'Tag',
  designer_icon: 'Tag',
  model_icon: 'Tag',
  hair_makeup_icon: 'Tag',
  city_icon: 'Tag',
  season_icon: 'Tag',
  header_tags_icon: 'Tag',
  footer_tags_icon: 'Tag',
};

interface ColorCollection {
  id: string;
  name: string;
  colors: string[];
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
  onSettingsPreview?: (settings: AppSettings) => void;
}

interface AppSettings {
  app_name: string;
  app_icon_url: string;
  app_logo_url: string;
  tagline: string;
  color_scheme: string;
  collapsible_cards_enabled: string;
  producer_bg_color: string;
  producer_text_color: string;
  designer_bg_color: string;
  designer_text_color: string;
  model_bg_color: string;
  model_text_color: string;
  hair_makeup_bg_color: string;
  hair_makeup_text_color: string;
  city_bg_color: string;
  city_text_color: string;
  season_bg_color: string;
  season_text_color: string;
  header_tags_bg_color: string;
  header_tags_text_color: string;
  footer_tags_bg_color: string;
  footer_tags_text_color: string;
  producer_icon: string;
  designer_icon: string;
  model_icon: string;
  hair_makeup_icon: string;
  city_icon: string;
  season_icon: string;
  header_tags_icon: string;
  footer_tags_icon: string;
  optional_tags_bg_color: string;
  optional_tags_text_color: string;
}

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  email?: string;
}

type TabId = 'branding' | 'admins' | 'tags';
type CoreTagKey = 'producer' | 'designer' | 'model' | 'hair_makeup' | 'city' | 'season' | 'header_tags' | 'footer_tags';
type SwatchColorKey = CoreTagKey | 'optional_tags';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated, onSettingsPreview }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [settings, setSettings] = useState<AppSettings>(() => ({
    app_name: 'Runway Rate',
    app_icon_url: '',
    app_logo_url: '',
    tagline: 'Fashion Show Reviews',
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
    optional_tags_bg_color: '#fda4af',
    optional_tags_text_color: '#881337',
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
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
  const { user } = useAuth();

  const tagKeysForDefault: { key: SwatchColorKey; label: string }[] = [
    { key: 'producer', label: 'Producer' },
    { key: 'designer', label: 'Designer' },
    { key: 'model', label: 'Model' },
    { key: 'hair_makeup', label: 'H&M' },
    { key: 'city', label: 'City' },
    { key: 'season', label: 'Season' },
    { key: 'header_tags', label: 'Genre' },
    { key: 'footer_tags', label: 'Footer' },
    { key: 'optional_tags', label: 'Optional' },
  ];

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
        setPaletteColors((prev) => [...PRELOADED_HEX, ...extra]);
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
      const bgKey = k.key === 'optional_tags' ? 'optional_tags_bg_color' : `${k.key}_bg_color`;
      const textKey = k.key === 'optional_tags' ? 'optional_tags_text_color' : `${k.key}_text_color`;
      const iconKey = k.key === 'optional_tags' ? null : `${k.key}_icon`;
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
    for (const { key } of tagKeysForDefault) {
      const bgKey = key === 'optional_tags' ? 'optional_tags_bg_color' : `${key}_bg_color`;
      const textKey = key === 'optional_tags' ? 'optional_tags_text_color' : `${key}_text_color`;
      const iconKey = key === 'optional_tags' ? null : `${key}_icon`;
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

  const assignColorToTag = (tagKey: SwatchColorKey, hex: string) => {
    const bgKey = tagKey === 'optional_tags' ? 'optional_tags_bg_color' : `${tagKey}_bg_color`;
    const textKey = tagKey === 'optional_tags' ? 'optional_tags_text_color' : `${tagKey}_text_color`;
    setSettings((s) => ({
      ...s,
      color_scheme: 'custom',
      [bgKey]: hex,
      [textKey]: readableTextForBg(hex),
    }));
    setAssigningTag(null);
  };

  useEffect(() => {
    if (isOpen) {
      setSettingsLoaded(false);
      fetchSettings();
      fetchAdminUsers();
    } else {
      setSettingsLoaded(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !settingsLoaded || !onSettingsPreview) return;
    if (skipNextPreviewRef.current) {
      skipNextPreviewRef.current = false;
      return;
    }
    onSettingsPreview(settings);
  }, [settings, isOpen, settingsLoaded, onSettingsPreview]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('app_settings').select('key, value');
      if (error) throw error;
      const settingsObj: Record<string, string> = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value || '';
      });
      const rawScheme = settingsObj.color_scheme;
      const color_scheme = ['faded', 'bright', 'custom'].includes(rawScheme) ? rawScheme : 'custom';

      setSettings({
        app_name: settingsObj.app_name || 'Runway Rate',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        tagline: settingsObj.tagline || 'Fashion Show Reviews',
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
        footer_tags_bg_color: settingsObj.footer_tags_bg_color || '#5eead4',
        footer_tags_text_color: settingsObj.footer_tags_text_color || '#134e4a',
        producer_icon: settingsObj.producer_icon || 'Tag',
        designer_icon: settingsObj.designer_icon || 'Tag',
        model_icon: settingsObj.model_icon || 'Tag',
        hair_makeup_icon: settingsObj.hair_makeup_icon || 'Tag',
        city_icon: settingsObj.city_icon || 'Tag',
        season_icon: settingsObj.season_icon || 'Tag',
        header_tags_icon: settingsObj.header_tags_icon || 'Tag',
        footer_tags_icon: settingsObj.footer_tags_icon || 'Tag',
        optional_tags_bg_color: settingsObj.optional_tags_bg_color || '#fda4af',
        optional_tags_text_color: settingsObj.optional_tags_text_color || '#881337',
      });
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
      const usersWithEmails = await Promise.all(
        (data || []).map(async (admin) => {
          const { data: userData } = await supabase.auth.admin.getUserById(admin.user_id);
          return { ...admin, email: userData.user?.email || 'Unknown' };
        })
      );
      setAdminUsers(usersWithEmails);
    } catch (err) {
      console.error('Error fetching admin users:', err);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim()) {
      setError('Please enter an email address');
      return;
    }
    setError('');
    setSuccess('');
    setAdminLoading(true);
    try {
      const { data: { users } = { users: [] }, error: searchError } = await supabase.auth.admin.listUsers();
      if (searchError) throw searchError;
      const foundUser = users?.find((u) => u.email?.toLowerCase() === adminEmail.trim().toLowerCase());
      if (!foundUser) {
        setError('No user found with that email');
        setAdminLoading(false);
        return;
      }
      const { error: insertError } = await supabase.from('admin_users').insert({ user_id: foundUser.id });
      if (insertError) {
        setError(insertError.code === '23505' ? 'User is already an admin' : insertError.message);
        setAdminLoading(false);
        return;
      }
      setSuccess('Admin added');
      setAdminEmail('');
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
      const updates = [
        { key: 'app_name', value: settings.app_name },
        { key: 'app_icon_url', value: settings.app_icon_url },
        { key: 'app_logo_url', value: settings.app_logo_url },
        { key: 'tagline', value: settings.tagline },
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
        { key: 'optional_tags_bg_color', value: settings.optional_tags_bg_color },
        { key: 'optional_tags_text_color', value: settings.optional_tags_text_color },
      ];

      for (const u of updates) {
        const { error: err } = await supabase
          .from('app_settings')
          .upsert({ key: u.key, value: u.value, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        if (err) throw err;
      }
      setSuccess('Settings saved');
      onSettingsUpdated();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'branding', label: 'Branding', icon: <Image size={18} /> },
    { id: 'admins', label: 'Admins', icon: <Users size={18} /> },
    { id: 'tags', label: 'Tags', icon: <Tags size={18} /> },
  ];
  const coreTagOptions: { k: CoreTagKey; label: string }[] = [
    { k: 'producer', label: 'Producer' },
    { k: 'designer', label: 'Designer' },
    { k: 'model', label: 'Model' },
    { k: 'hair_makeup', label: 'Hair & Makeup' },
    { k: 'city', label: 'City' },
    { k: 'season', label: 'Season' },
    { k: 'header_tags', label: 'Genre' },
    { k: 'footer_tags', label: 'Footer Tags' },
  ];
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl shadow-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b shrink-0">
          <h2 className="text-xl font-bold">Settings</h2>
        </div>

        <div className="flex border-b shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {activeTab === 'branding' && (
              <>
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-800">
                  <strong>Images:</strong> Upload to <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="underline">Imgur</a> or <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" className="underline">PostImages</a>, then paste the direct URL.
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Name</label>
                  <input
                    type="text"
                    value={settings.app_name}
                    onChange={(e) => setSettings((s) => ({ ...s, app_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
                  <input
                    type="text"
                    value={settings.tagline}
                    onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Icon URL</label>
                  <input
                    type="url"
                    value={settings.app_icon_url}
                    onChange={(e) => setSettings((s) => ({ ...s, app_icon_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  {settings.app_icon_url && <img src={settings.app_icon_url} alt="" className="mt-2 w-12 h-12 rounded-lg border object-cover" />}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Logo URL</label>
                  <input
                    type="url"
                    value={settings.app_logo_url}
                    onChange={(e) => setSettings((s) => ({ ...s, app_logo_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  {settings.app_logo_url && <img src={settings.app_logo_url} alt="" className="mt-2 h-10 object-contain" />}
                </div>
              </>
            )}

            {activeTab === 'admins' && (
              <>
                <form onSubmit={handleAddAdmin} className="flex gap-2">
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="User email"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="submit" disabled={adminLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
                    {adminLoading ? 'Adding...' : 'Add Admin'}
                  </button>
                </form>
                <div className="space-y-2">
                  {adminUsers.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">{admin.email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAdmin(admin.id)}
                        disabled={adminUsers.length <= 1}
                        className="text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activeTab === 'tags' && (
              <>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Color palette</h3>
                    <p className="text-xs text-gray-500 mb-2">Edit, delete, or add colors. Assign to tag types below.</p>
                    <div className="flex flex-wrap gap-2 items-center">
                      {paletteColors.map((hex) => (
                        <div key={hex} className="relative group">
                          {editingColor === hex ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingHex}
                                onChange={(e) => setEditingHex(e.target.value)}
                                className="w-20 px-1.5 py-0.5 text-xs border rounded"
                                placeholder="#ffffff"
                              />
                              <label className="inline-flex items-center justify-center w-8 h-8 rounded-lg border cursor-pointer">
                                <input
                                  type="color"
                                  value={editingHex}
                                  onChange={(e) => setEditingHex(e.target.value)}
                                  className="sr-only w-0 h-0"
                                />
                                <span className="w-full h-full rounded-lg" style={{ backgroundColor: editingHex || '#ccc' }} />
                              </label>
                              <button
                                type="button"
                                onClick={() => editColorInPalette(hex, editingHex)}
                                className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingColor(null)}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', hex);
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                className="inline-block w-8 h-8 rounded-lg border-2 border-gray-200 shadow-sm cursor-pointer select-none"
                                style={{ backgroundColor: hex, color: readableTextForBg(hex) }}
                                title={`${hex} (drag to collection)`}
                                onClick={() => { setEditingColor(hex); setEditingHex(hex); }}
                              />
                              <button
                                type="button"
                                onClick={() => removeFromPalette(hex)}
                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-red-600"
                                aria-label={`Remove ${hex}`}
                              >
                                ×
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      <label className="inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 cursor-pointer">
                        <input
                          type="color"
                          className="sr-only w-0 h-0"
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) addToPalette(v);
                          }}
                        />
                        <span className="text-lg leading-none">+</span>
                      </label>
                      <button
                        type="button"
                        onClick={resetPaletteToDefaults}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Reset to defaults
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Collections</h3>
                    <p className="text-xs text-gray-500 mb-2">Create named groups. Drag colors from the palette above into a collection.</p>
                    <button
                      type="button"
                      onClick={createCollection}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg mb-2"
                    >
                      <FolderPlus size={14} />
                      New collection
                    </button>
                    <div className="space-y-2">
                      {collections.map((col) => (
                        <div
                          key={col.id}
                          className={`border rounded-lg p-2 transition-colors ${
                            dragOverCollectionId === col.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'copy';
                            setDragOverCollectionId(col.id);
                          }}
                          onDragLeave={() => setDragOverCollectionId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            const hex = e.dataTransfer.getData('text/plain');
                            if (/^#[0-9a-fA-F]{6}$/.test(hex)) addColorToCollection(col.id, hex);
                            setDragOverCollectionId(null);
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="text"
                              value={col.name}
                              onChange={(e) => updateCollectionName(col.id, e.target.value)}
                              className="flex-1 text-sm font-medium border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none px-0 py-1"
                            />
                            <button
                              type="button"
                              onClick={() => deleteCollection(col.id)}
                              className="text-red-500 hover:text-red-700"
                              aria-label="Delete collection"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 items-center min-h-[28px]">
                            {col.colors.map((c) => (
                              <span key={c} className="relative group">
                                <span
                                  className="inline-block w-6 h-6 rounded border border-gray-200"
                                  style={{ backgroundColor: c, color: readableTextForBg(c) }}
                                  title={c}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeColorFromCollection(col.id, c)}
                                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 text-white text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Assign color to tag type</h3>
                    <p className="text-xs text-gray-500 mb-2">Click a tag type’s swatch to pick a color from the palette.</p>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { key: 'producer' as const, label: 'Producer' },
                          { key: 'designer' as const, label: 'Designer' },
                          { key: 'model' as const, label: 'Model' },
                          { key: 'hair_makeup' as const, label: 'Hair & Makeup' },
                          { key: 'city' as const, label: 'City' },
                          { key: 'season' as const, label: 'Season' },
                          { key: 'header_tags' as const, label: 'Genre' },
                          { key: 'footer_tags' as const, label: 'Footer' },
                          { key: 'optional_tags' as const, label: 'Optional' },
                        ] as { key: SwatchColorKey; label: string }[]
                      ).map(({ key, label }) => {
                        const bgKey = key === 'optional_tags' ? 'optional_tags_bg_color' : `${key}_bg_color`;
                        const textKey = key === 'optional_tags' ? 'optional_tags_text_color' : `${key}_text_color`;
                        const bg = (settings as Record<string, string>)[bgKey] || '#e5e7eb';
                        const text = (settings as Record<string, string>)[textKey] || '#374151';
                        return (
                          <div key={key} className="relative">
                            <button
                              type="button"
                              onClick={() => setAssigningTag(assigningTag === key ? null : key)}
                              className="inline-flex items-center gap-2 px-2 py-1.5 rounded-lg border-2 border-gray-200 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                              style={{ backgroundColor: bg, color: text }}
                              title={`${label} — click to change`}
                            >
                              <span className="w-5 h-5 rounded border border-gray-300 shrink-0" style={{ backgroundColor: bg }} />
                              <span className="text-xs font-medium">{label}</span>
                            </button>
                            {assigningTag === key && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setAssigningTag(null)} aria-hidden="true" />
                                <div className="absolute left-0 top-full z-20 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[180px]">
                                  <div className="text-xs font-medium text-gray-700 mb-2">Pick color for {label}</div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(() => {
                                      const inPalette = new Set(paletteColors.map((h) => h.toLowerCase()));
                                      const options = inPalette.has(bg.toLowerCase()) ? paletteColors : [bg, ...paletteColors];
                                      return options;
                                    })().map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => assignColorToTag(key, hex)}
                                        className="w-7 h-7 rounded border-2 border-gray-200 hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        style={{ backgroundColor: hex }}
                                        title={hex}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Icons</h3>
                    <p className="text-xs text-gray-500 mb-2">Click an icon to change it.</p>
                    <div className="flex flex-wrap gap-2">
                      {coreTagOptions.map(({ k, label }) => (
                        <div key={k} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-gray-500">{label}</span>
                          <IconPicker
                            label=""
                            value={(settings as Record<string, string>)[`${k}_icon`]}
                            onChange={(v) => setSettings((s) => ({ ...s, [`${k}_icon`]: v }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Preview</h3>
                    <p className="text-xs text-gray-500 mb-2">How tags will look with your colors and icons.</p>
                    <div className="flex flex-wrap gap-2">
                      {coreTagOptions.map(({ k, label }) => {
                        const bg = (settings as Record<string, string>)[`${k}_bg_color`] || '#e5e7eb';
                        const text = (settings as Record<string, string>)[`${k}_text_color`] || '#374151';
                        const IconC = getIcon((settings as Record<string, string>)[`${k}_icon`], `${k}_icon` as keyof typeof DEFAULT_ICONS);
                        return (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-gray-200"
                            style={{ backgroundColor: bg, color: text }}
                          >
                            <IconC size={12} className="shrink-0" />
                            {label}
                          </span>
                        );
                      })}
                      <span
                        className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-gray-200"
                        style={{
                          backgroundColor: settings.optional_tags_bg_color || '#e0e7ff',
                          color: settings.optional_tags_text_color || '#3730a3',
                        }}
                      >
                        Optional
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={setAsDefault}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      Set as default
                    </button>
                    <button
                      type="button"
                      onClick={revertToDefault}
                      className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      Revert to default
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {(error || success) && (
            <div className="px-5 pb-2">
              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">{success}</p>}
            </div>
          )}

          <div className="p-5 border-t bg-gray-50">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
