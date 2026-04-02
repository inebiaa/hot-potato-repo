import { useState, useEffect, useRef } from 'react';
import { Save, Trash2, Image, Users, Tags, FolderPlus, User, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getIcon, DEFAULT_ICONS } from '../lib/eventCardIcons';
import { useAuth } from '../contexts/AuthContext';
import { readableTextForBg } from '../lib/colorUtils';
import IconPicker from './IconPicker';
import { CUSTOM_COLORS_STORAGE_KEY, PRELOADED_HEX } from './ColorPicker';
import {
  ensureIdentity,
  findIdentityByName,
  isNormalizedAliasTakenByOtherIdentity,
  normalizeTagName,
  searchTagIdentities,
  searchEventTags,
  type TagIdentityRecord,
  type TagType,
} from '../lib/tagIdentity';
import type { AppSettings } from '../types/appSettings';

function formatTagTypeLabel(tagType: string): string {
  if (tagType.startsWith('custom:')) {
    const slug = tagType.slice(7) || 'custom';
    return `Custom: ${slug.replace(/-/g, ' ')}`;
  }
  const map: Record<string, string> = {
    producer: 'Producer',
    designer: 'Designer',
    model: 'Model',
    hair_makeup: 'Hair & Makeup',
    venue: 'Venue',
    header_tags: 'Genre',
    footer_tags: 'Collection',
  };
  return map[tagType] || tagType;
}

/** Same pattern as App.tsx tag search: "Producer: ", "Designer: ", "Genre: ", etc. */
function connectSearchTypePrefix(tagType: string): string {
  if (tagType.startsWith('custom:')) return 'Custom: ';
  const map: Record<string, string> = {
    producer: 'Producer',
    designer: 'Designer',
    model: 'Model',
    hair_makeup: 'Hair & Makeup',
    venue: 'Venue',
    header_tags: 'Genre',
    footer_tags: 'Collection',
  };
  const label = map[tagType] ?? tagType.replace(/_/g, ' ');
  return `${label}: `;
}

const CONNECT_CREATE_TYPE_PILLS: { value: TagType; label: string }[] = [
  { value: 'producer', label: 'Producer' },
  { value: 'designer', label: 'Designer' },
  { value: 'model', label: 'Model' },
  { value: 'hair_makeup', label: 'Hair & Makeup' },
  { value: 'header_tags', label: 'Genre' },
  { value: 'footer_tags', label: 'Collection' },
];

/** EventCard-aligned: neutral pills use bg-gray-300 text-gray-600 rounded-md; selected adds reorder-style ring */
function creditPillClass(active: boolean) {
  return [
    'inline-flex items-center justify-center max-w-[220px] truncate whitespace-nowrap text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80',
    active ? 'bg-gray-300 text-gray-600 ring-2 ring-blue-400 ring-offset-1' : 'bg-gray-200 text-gray-600 hover:bg-gray-300',
  ].join(' ');
}

const PALETTE_STORAGE_KEY = 'tag_settings_palette_v1';
const COLLECTIONS_STORAGE_KEY = 'tag_color_collections_v1';
const DEFAULT_TAG_SETTINGS_KEY = 'tag_default_settings_v1';

/** Faded (muted) preset: soft pastels, auto text color */
const FADED_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#f3f4f6', designer_bg_color: '#fef3c7', model_bg_color: '#fce7f3',
  hair_makeup_bg_color: '#f3e8ff', city_bg_color: '#dbeafe', season_bg_color: '#ffedd5',
  header_tags_bg_color: '#ccfbf1', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#d1fae5', optional_tags_bg_color: '#e0e7ff',
};

/** Vibrant (bright) preset: saturated colors, auto text color */
const BRIGHT_TAG_DEFAULTS: Record<string, string> = {
  producer_bg_color: '#fef08a', designer_bg_color: '#f9a8d4', model_bg_color: '#86efac',
  hair_makeup_bg_color: '#67e8f9', city_bg_color: '#bef264', season_bg_color: '#fdba74',
  header_tags_bg_color: '#c4b5fd', countdown_bg_color: '#fef3c7', footer_tags_bg_color: '#5eead4', optional_tags_bg_color: '#fda4af',
};

const BUILT_IN_TAG_DEFAULTS: Pick<AppSettings, 'producer_bg_color' | 'producer_text_color' | 'designer_bg_color' | 'designer_text_color' | 'model_bg_color' | 'model_text_color' | 'hair_makeup_bg_color' | 'hair_makeup_text_color' | 'city_bg_color' | 'city_text_color' | 'season_bg_color' | 'season_text_color' | 'header_tags_bg_color' | 'header_tags_text_color' | 'countdown_bg_color' | 'countdown_text_color' | 'footer_tags_bg_color' | 'footer_tags_text_color' | 'optional_tags_bg_color' | 'optional_tags_text_color' | 'producer_icon' | 'designer_icon' | 'model_icon' | 'hair_makeup_icon' | 'city_icon' | 'season_icon' | 'header_tags_icon' | 'footer_tags_icon'> = {
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
  onAccountUpdated?: () => void;
}

interface CreditRow {
  id: string;
  identity_id: string;
  preferred_alias_id: string | null;
  public_display_alias_id: string | null;
  tag_type: string;
  canonical_name: string;
  aliases: { id: string; alias: string }[];
}

interface AdminUser {
  id: string;
  user_id: string;
  created_at: string;
  username?: string;
  user_id_public?: string;
}

type TabId = 'branding' | 'admins' | 'tags' | 'account';
type CoreTagKey = 'producer' | 'designer' | 'model' | 'hair_makeup' | 'city' | 'season' | 'header_tags' | 'footer_tags';
type SwatchColorKey = CoreTagKey | 'optional_tags' | 'countdown';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated, onSettingsPreview, onAccountUpdated }: SettingsModalProps) {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('branding');
  const [settings, setSettings] = useState<AppSettings>(() => ({
    app_name: 'Secret Blogger',
    app_icon_url: '',
    app_logo_url: '',
    app_favicon_url: '',
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
    optional_tags_bg_color: '#fda4af',
    optional_tags_text_color: '#881337',
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

  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [connectName, setConnectName] = useState('');
  const [connectType, setConnectType] = useState<TagType>('producer');
  const [creditSearchResults, setCreditSearchResults] = useState<{ id: string; tag_type: string; canonical_name: string; fromEvent?: boolean }[]>([]);
  const [creditSearching, setCreditSearching] = useState(false);
  const [newAliasByIdentity, setNewAliasByIdentity] = useState<Record<string, string>>({});
  const [showCreateTagForm, setShowCreateTagForm] = useState(false);
  const [aliasDeleteModeIdentityId, setAliasDeleteModeIdentityId] = useState<string | null>(null);
  const [addingAliasForIdentityId, setAddingAliasForIdentityId] = useState<string | null>(null);
  const [creditConnectSuccess, setCreditConnectSuccess] = useState('');
  const [connectListActiveIdx, setConnectListActiveIdx] = useState(-1);
  const connectSearchInputRef = useRef<HTMLInputElement>(null);

  const [adminIdentitySearch, setAdminIdentitySearch] = useState('');
  const [adminIdentitySearchResults, setAdminIdentitySearchResults] = useState<TagIdentityRecord[]>([]);
  const [adminIdentitySearching, setAdminIdentitySearching] = useState(false);
  const [adminManagedIdentity, setAdminManagedIdentity] = useState<TagIdentityRecord | null>(null);
  const [adminManagedAliases, setAdminManagedAliases] = useState<{ id: string; alias: string; normalized_alias: string }[]>([]);
  const [adminAliasLoading, setAdminAliasLoading] = useState(false);
  const [adminAliasError, setAdminAliasError] = useState<string | null>(null);
  const [adminAliasDeleteMode, setAdminAliasDeleteMode] = useState(false);
  const [adminAddingAlias, setAdminAddingAlias] = useState(false);
  const [newAdminAliasText, setNewAdminAliasText] = useState('');
  const [editingAdminAliasId, setEditingAdminAliasId] = useState<string | null>(null);
  const [editAdminAliasDraft, setEditAdminAliasDraft] = useState('');

  const tagOptions: { key: SwatchColorKey; label: string }[] = [
    { key: 'producer', label: 'Producer' },
    { key: 'designer', label: 'Designer' },
    { key: 'model', label: 'Model' },
    { key: 'hair_makeup', label: 'Hair & Makeup' },
    { key: 'city', label: 'City' },
    { key: 'season', label: 'Season' },
    { key: 'header_tags', label: 'Genre' },
    { key: 'footer_tags', label: 'Collection' },
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
    const { data } = await supabase.from('user_profiles').select('username, user_id_public').eq('user_id', userId).maybeSingle();
    setEditName(data?.username || '');
    setEditUsername(data?.user_id_public || '');
  };

  const fetchCredits = async () => {
    if (!userId) return;
    const { data: creditRows, error: creditsErr } = await supabase.from('user_tag_credits').select('id, identity_id, preferred_alias_id').eq('user_id', userId);
    if (creditsErr) {
      setCreditsError(creditsErr.message || 'Could not load credits');
      setCredits([]);
      return;
    }
    const identityIds = (creditRows || []).map((r: { identity_id: string }) => r.identity_id);
    if (identityIds.length === 0) {
      setCreditsError(null);
      setCredits([]);
      return;
    }
    const { data: identities, error: identitiesErr } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name, public_display_alias_id')
      .in('id', identityIds);
    if (identitiesErr) {
      setCreditsError(identitiesErr.message || 'Could not load credit identities');
      setCredits([]);
      return;
    }
    const { data: aliasRows } = await supabase.from('tag_aliases').select('id, identity_id, alias').in('identity_id', identityIds).order('alias', { ascending: true });
    const identityMap = new Map(
      (identities || []).map((i: { id: string; tag_type: string; canonical_name: string; public_display_alias_id: string | null }) => [i.id, i])
    );
    const aliasMap = new Map<string, { id: string; alias: string }[]>();
    (aliasRows || []).forEach((a: { identity_id: string; id: string; alias: string }) => {
      const existing = aliasMap.get(a.identity_id) || [];
      existing.push({ id: a.id, alias: a.alias });
      aliasMap.set(a.identity_id, existing);
    });
    const merged: CreditRow[] = (creditRows || []).map((c: { id: string; identity_id: string; preferred_alias_id: string | null }) => {
      const identity = identityMap.get(c.identity_id) as
        | { tag_type: string; canonical_name: string; public_display_alias_id: string | null }
        | undefined;
      return {
        id: c.id,
        identity_id: c.identity_id,
        preferred_alias_id: c.preferred_alias_id || null,
        public_display_alias_id: identity?.public_display_alias_id ?? null,
        tag_type: identity?.tag_type || 'unknown',
        canonical_name: identity?.canonical_name || 'Unknown',
        aliases: aliasMap.get(c.identity_id) || [],
      };
    });
    setCreditsError(null);
    setCredits(merged);
  };

  const saveAccountProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: newName, user_id_public: newUsername, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) {
        setProfileSaveError(error.message || 'Could not save profile.');
        setProfileSaving(false);
        return;
      }
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

  const connectCreditByIdentity = async (identity: { id: string; tag_type: string; canonical_name: string }) => {
    const { data: existing } = await supabase.from('user_tag_credits').select('id').eq('user_id', userId).eq('identity_id', identity.id).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('user_tag_credits').insert({ user_id: userId, identity_id: identity.id });
      if (error) {
        setCreditsError(error.message || 'Could not connect credit');
        return;
      }
    }
    setConnectName('');
    setCreditSearchResults([]);
    setCreditsError(null);
    setCreditConnectSuccess('Connected');
    setTimeout(() => setCreditConnectSuccess(''), 3500);
    fetchCredits();
    window.setTimeout(() => connectSearchInputRef.current?.focus(), 0);
  };

  const removeAliasForCredit = async (credit: CreditRow, aliasId: string) => {
    const alias = credit.aliases.find((a) => a.id === aliasId);
    if (!alias) return;
    if (normalizeTagName(alias.alias) === normalizeTagName(credit.canonical_name)) {
      setCreditsError('Cannot remove the default name for this tag.');
      return;
    }
    setCreditsError(null);
    if (credit.public_display_alias_id === aliasId) {
      const { error: e1 } = await supabase.from('tag_identities').update({ public_display_alias_id: null }).eq('id', credit.identity_id);
      if (e1) {
        setCreditsError(e1.message || 'Could not update cards before removing alias');
        return;
      }
    }
    if (credit.preferred_alias_id === aliasId) {
      const { error: e2 } = await supabase.from('user_tag_credits').update({ preferred_alias_id: null }).eq('id', credit.id);
      if (e2) {
        setCreditsError(e2.message || 'Could not clear saved label before removing alias');
        return;
      }
    }
    const { data: deleted, error } = await supabase.from('tag_aliases').delete().eq('id', aliasId).select('id');
    if (error) {
      setCreditsError(error.message || 'Could not remove alias');
      return;
    }
    if (!deleted?.length) {
      setCreditsError('Could not remove alias. Check that you are linked to this tag or ask an admin.');
      return;
    }
    fetchCredits();
  };

  const handleConnectSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = creditSearchResults;
    if (list.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setConnectListActiveIdx((i) => (i < list.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setConnectListActiveIdx((i) => (i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === 'Enter' && connectListActiveIdx >= 0 && connectListActiveIdx < list.length) {
      e.preventDefault();
      void selectCreditSearchResult(list[connectListActiveIdx]);
    }
  };

  const selectCreditSearchResult = async (item: { id: string; tag_type: string; canonical_name: string; fromEvent?: boolean }) => {
    let identity: { id: string; tag_type: string; canonical_name: string };
    if (item.fromEvent) {
      const resolved = await ensureIdentity(item.tag_type as TagType, item.canonical_name, userId);
      if (!resolved) {
        setCreditsError('Could not add tag');
        return;
      }
      identity = resolved;
    } else {
      identity = item;
    }
    await connectCreditByIdentity(identity);
  };

  const connectOrCreateCredit = async (createIfMissing: boolean) => {
    const name = connectName.trim();
    if (!name) return;
    let identity = await findIdentityByName(connectType, name);
    if (!identity && createIfMissing) identity = await ensureIdentity(connectType, name, userId);
    if (!identity) {
      setCreditsError('No matching tag. Try another name or use Create new tag.');
      return;
    }
    await connectCreditByIdentity(identity);
  };

  const addAliasForCredit = async (credit: CreditRow) => {
    const alias = (newAliasByIdentity[credit.identity_id] || '').trim();
    if (!alias) return;
    const normalized = normalizeTagName(alias);
    const { data: existing } = await supabase.from('tag_aliases').select('id').eq('identity_id', credit.identity_id).eq('normalized_alias', normalized).maybeSingle();
    if (!existing) {
      const taken = await isNormalizedAliasTakenByOtherIdentity(credit.tag_type as TagType, credit.identity_id, normalized);
      if (taken) {
        setCreditsError('That spelling is already used by another tag in this category.');
        return;
      }
      const { error } = await supabase.from('tag_aliases').insert({ identity_id: credit.identity_id, alias, normalized_alias: normalized, created_by: userId });
      if (error) {
        setCreditsError(error.message || 'Could not add alias');
        return;
      }
    }
    setNewAliasByIdentity((prev) => ({ ...prev, [credit.identity_id]: '' }));
    setAddingAliasForIdentityId(null);
    fetchCredits();
  };

  const setPublicDisplayAlias = async (identityId: string, aliasId: string | null) => {
    const { error } = await supabase.from('tag_identities').update({ public_display_alias_id: aliasId }).eq('id', identityId);
    if (error) {
      setCreditsError(error.message || 'Could not set name on event cards');
      return;
    }
    fetchCredits();
    onSettingsUpdated();
  };

  const addProfileNameAsAlias = async (credit: CreditRow) => {
    const name = editName.trim();
    if (!name) {
      setCreditsError('Save your profile name first, or type it in Your Name.');
      return;
    }
    const normalized = normalizeTagName(name);
    const { data: existing } = await supabase
      .from('tag_aliases')
      .select('id')
      .eq('identity_id', credit.identity_id)
      .eq('normalized_alias', normalized)
      .maybeSingle();
    if (!existing) {
      const taken = await isNormalizedAliasTakenByOtherIdentity(credit.tag_type as TagType, credit.identity_id, normalized);
      if (taken) {
        setCreditsError('That spelling is already used by another tag in this category.');
        return;
      }
      const { error } = await supabase
        .from('tag_aliases')
        .insert({ identity_id: credit.identity_id, alias: name, normalized_alias: normalized, created_by: userId });
      if (error) {
        setCreditsError(error.message || 'Could not add alias');
        return;
      }
    }
    fetchCredits();
  };

  const removeCredit = async (creditId: string) => {
    const { error } = await supabase.from('user_tag_credits').delete().eq('id', creditId);
    if (error) {
      setCreditsError(error.message || 'Could not remove credit');
      return;
    }
    fetchCredits();
  };

  useEffect(() => {
    const q = connectName.trim();
    if (q.length < 2 || !userId) {
      setCreditSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setCreditSearching(true);
      Promise.all([searchTagIdentities(q), searchEventTags(q)])
        .then(([identities, eventTags]) => {
          const seen = new Set<string>();
          const combined: { id: string; tag_type: string; canonical_name: string; fromEvent?: boolean }[] = [];
          for (const r of identities) {
            const key = `${r.tag_type}:${normalizeTagName(r.canonical_name)}`;
            if (!seen.has(key)) {
              seen.add(key);
              combined.push({ ...r, fromEvent: false });
            }
          }
          for (const r of eventTags) {
            const key = `${r.tag_type}:${normalizeTagName(r.canonical_name)}`;
            if (!seen.has(key)) {
              seen.add(key);
              combined.push({ id: `event:${r.tag_type}:${encodeURIComponent(r.canonical_name)}`, tag_type: r.tag_type, canonical_name: r.canonical_name, fromEvent: true });
            }
          }
          setCreditSearchResults(combined.slice(0, 20));
          setCreditSearching(false);
        })
        .catch(() => setCreditSearching(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [connectName, userId]);

  useEffect(() => {
    setConnectListActiveIdx(creditSearchResults.length > 0 ? 0 : -1);
  }, [creditSearchResults]);

  useEffect(() => {
    if (!isOpen || !isAdmin) return;
    const q = adminIdentitySearch.trim();
    if (q.length < 2) {
      setAdminIdentitySearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setAdminIdentitySearching(true);
      searchTagIdentities(q)
        .then((rows) => {
          setAdminIdentitySearchResults(rows);
          setAdminIdentitySearching(false);
        })
        .catch(() => setAdminIdentitySearching(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [adminIdentitySearch, isOpen, isAdmin]);

  useEffect(() => {
    if (isOpen) {
      setSettingsLoaded(false);
      fetchSettings();
      fetchAdminUsers();
      if (user) {
        fetchAccountProfile();
        fetchCredits();
      }
      if (!isAdmin) setActiveTab('account');
    } else {
      setSettingsLoaded(false);
      setAdminIdentitySearch('');
      setAdminIdentitySearchResults([]);
      setAdminManagedIdentity(null);
      setAdminManagedAliases([]);
      setAdminAliasError(null);
      setAdminAliasDeleteMode(false);
      setAdminAddingAlias(false);
      setNewAdminAliasText('');
      setEditingAdminAliasId(null);
      setEditAdminAliasDraft('');
    }
  }, [isOpen, user?.id]);

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
      const iconValue = (key: keyof AppSettings, fallback: string) =>
        Object.prototype.hasOwnProperty.call(settingsObj, key) ? settingsObj[key] : fallback;
      const rawScheme = settingsObj.color_scheme;
      const color_scheme = ['faded', 'bright', 'custom'].includes(rawScheme) ? rawScheme : 'custom';

      setSettings({
        app_name: settingsObj.app_name || 'Secret Blogger',
        app_icon_url: settingsObj.app_icon_url || '',
        app_logo_url: settingsObj.app_logo_url || '',
        app_favicon_url: settingsObj.app_favicon_url || '',
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

  const fetchAdminAliasesForIdentity = async (identityId: string) => {
    setAdminAliasLoading(true);
    setAdminAliasError(null);
    const { data, error } = await supabase
      .from('tag_aliases')
      .select('id, alias, normalized_alias')
      .eq('identity_id', identityId)
      .order('alias', { ascending: true });
    setAdminAliasLoading(false);
    if (error) {
      setAdminAliasError(error.message);
      setAdminManagedAliases([]);
      return;
    }
    setAdminManagedAliases((data || []) as { id: string; alias: string; normalized_alias: string }[]);
  };

  const selectAdminManagedIdentity = (identity: TagIdentityRecord) => {
    setAdminManagedIdentity(identity);
    setAdminIdentitySearch('');
    setAdminIdentitySearchResults([]);
    setEditingAdminAliasId(null);
    setEditAdminAliasDraft('');
    setAdminAliasDeleteMode(false);
    void fetchAdminAliasesForIdentity(identity.id);
  };

  const deleteAdminAliasRow = async (aliasId: string) => {
    const { error } = await supabase.rpc('admin_delete_tag_alias', { p_alias_id: aliasId });
    if (error) {
      setAdminAliasError(error.message);
      return;
    }
    setAdminAliasError(null);
    if (adminManagedIdentity) void fetchAdminAliasesForIdentity(adminManagedIdentity.id);
  };

  const saveAdminAliasEdit = async () => {
    if (!editingAdminAliasId || !adminManagedIdentity) return;
    const text = editAdminAliasDraft.trim();
    if (!text) return;
    const { error } = await supabase.rpc('admin_update_tag_alias', {
      p_alias_id: editingAdminAliasId,
      p_new_alias: text,
    });
    if (error) {
      setAdminAliasError(error.message);
      return;
    }
    setEditingAdminAliasId(null);
    setEditAdminAliasDraft('');
    void fetchAdminAliasesForIdentity(adminManagedIdentity.id);
  };

  const addAdminAliasRow = async () => {
    if (!adminManagedIdentity) return;
    const text = newAdminAliasText.trim();
    if (!text) return;
    const norm = normalizeTagName(text);
    const taken = await isNormalizedAliasTakenByOtherIdentity(
      adminManagedIdentity.tag_type as TagType,
      adminManagedIdentity.id,
      norm
    );
    if (taken) {
      setAdminAliasError('That spelling is already used by another tag in this category.');
      return;
    }
    const { error } = await supabase.from('tag_aliases').insert({
      identity_id: adminManagedIdentity.id,
      alias: text,
      normalized_alias: norm,
      created_by: userId || null,
    });
    if (error) {
      setAdminAliasError(error.message);
      return;
    }
    setNewAdminAliasText('');
    setAdminAddingAlias(false);
    void fetchAdminAliasesForIdentity(adminManagedIdentity.id);
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
        { key: 'app_favicon_url', value: settings.app_favicon_url },
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
    ...(isAdmin ? [
      { id: 'branding' as const, label: 'Branding', icon: <Image size={18} /> },
      { id: 'admins' as const, label: 'Admins', icon: <Users size={18} /> },
      { id: 'tags' as const, label: 'Tags', icon: <Tags size={18} /> },
    ] : []),
    { id: 'account', label: 'Account', icon: <User size={18} /> },
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">App Favicon URL</label>
                  <input
                    type="url"
                    value={settings.app_favicon_url}
                    onChange={(e) => setSettings((s) => ({ ...s, app_favicon_url: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  {settings.app_favicon_url && <img src={settings.app_favicon_url} alt="" className="mt-2 w-8 h-8 rounded-lg border object-cover" />}
                </div>
              </>
            )}

            {activeTab === 'admins' && (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={adminUserIdPublic}
                    onChange={(e) => setAdminUserIdPublic(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleAddAdmin();
                      }
                    }}
                    placeholder="User ID"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    disabled={adminLoading}
                    onClick={() => void handleAddAdmin()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                  >
                    {adminLoading ? 'Adding...' : 'Add Admin'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 -mt-1">Use the member's public User ID from their profile.</p>
                <div className="space-y-2">
                  {adminUsers.map((admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium">
                        {admin.user_id_public ? `@${admin.user_id_public}` : admin.user_id}
                        {admin.username ? ` (${admin.username})` : ''}
                      </span>
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

                <section className="border-t border-stone-100 pt-5 mt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-stone-800 mb-1">Manage tag aliases</h3>
                  <p className="text-xs text-stone-500 mb-3">Search for a tag identity, then add, edit, or remove aliases.</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminIdentitySearch}
                      onChange={(e) => setAdminIdentitySearch(e.target.value)}
                      placeholder="Search shows, designers, models…"
                      className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                      autoComplete="off"
                    />
                    {adminIdentitySearching && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Searching…</span>
                    )}
                  </div>
                  {adminIdentitySearch.trim().length >= 2 && adminIdentitySearchResults.length > 0 && (
                    <div className="rounded-md border border-stone-200 bg-white divide-y divide-stone-100 max-h-48 overflow-y-auto shadow-sm">
                      {adminIdentitySearchResults.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => selectAdminManagedIdentity(row)}
                          className="w-full flex items-stretch gap-2 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <div className="flex flex-1 min-w-0 items-center gap-2">
                            <span className="text-gray-400 text-xs shrink-0">{connectSearchTypePrefix(row.tag_type)}</span>
                            <span className="text-sm text-gray-900 truncate">{row.canonical_name}</span>
                          </div>
                          <span className="shrink-0 self-center text-xs text-stone-500">Open</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {adminIdentitySearch.trim().length >= 2 && !adminIdentitySearching && adminIdentitySearchResults.length === 0 && (
                    <p className="text-xs text-stone-600">No identities match.</p>
                  )}

                  {adminManagedIdentity && (
                    <div className="rounded-xl border border-stone-100 p-3 bg-stone-50/70 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600">
                          {formatTagTypeLabel(adminManagedIdentity.tag_type)}
                        </span>
                        <span className="text-sm font-medium text-stone-900">{adminManagedIdentity.canonical_name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminManagedIdentity(null);
                            setAdminManagedAliases([]);
                            setAdminAliasDeleteMode(false);
                            setEditingAdminAliasId(null);
                            setAdminAddingAlias(false);
                          }}
                          className="ml-auto text-[11px] text-stone-400 hover:text-stone-700"
                        >
                          Clear
                        </button>
                      </div>
                      {adminAliasLoading && <p className="text-xs text-stone-500">Loading aliases…</p>}
                      {adminAliasError && <p className="text-xs text-amber-800">{adminAliasError}</p>}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[11px] font-medium text-stone-600">Also known as</span>
                          {adminAliasDeleteMode ? (
                            <button
                              type="button"
                              onClick={() => setAdminAliasDeleteMode(false)}
                              className="text-[11px] text-stone-600 hover:text-stone-900"
                            >
                              Done
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAdminAliasDeleteMode(true)}
                              className="text-[11px] text-stone-500 hover:text-stone-800"
                            >
                              Remove aliases
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {adminManagedAliases.map((al) =>
                            editingAdminAliasId === al.id ? (
                              <div key={al.id} className="inline-flex flex-wrap items-center gap-1.5">
                                <input
                                  value={editAdminAliasDraft}
                                  onChange={(e) => setEditAdminAliasDraft(e.target.value)}
                                  className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white min-w-[140px]"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => void saveAdminAliasEdit()}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingAdminAliasId(null);
                                    setEditAdminAliasDraft('');
                                  }}
                                  className="text-xs text-stone-500 hover:text-stone-800"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <span
                                key={al.id}
                                data-tag-pill
                                className={`relative inline-flex items-center gap-1 text-xs pl-2 pr-2 py-1 rounded-md bg-gray-300 text-gray-600 ${adminAliasDeleteMode ? 'pill-wiggle' : ''}`}
                              >
                                {al.alias}
                                {!adminAliasDeleteMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAdminAliasId(al.id);
                                      setEditAdminAliasDraft(al.alias);
                                    }}
                                    className="ml-1 text-[10px] text-stone-400 hover:text-stone-700 underline"
                                  >
                                    Edit
                                  </button>
                                )}
                                {adminAliasDeleteMode && (
                                  <button
                                    type="button"
                                    className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-stone-300 text-stone-600 shadow-sm hover:bg-stone-50"
                                    title="Remove alias"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!window.confirm('Remove this alias?')) return;
                                      void deleteAdminAliasRow(al.id);
                                    }}
                                    aria-label={`Remove alias ${al.alias}`}
                                  >
                                    <X size={10} />
                                  </button>
                                )}
                              </span>
                            )
                          )}
                          {adminAddingAlias ? (
                            <div className="inline-flex flex-wrap items-center gap-1.5">
                              <input
                                value={newAdminAliasText}
                                onChange={(e) => setNewAdminAliasText(e.target.value)}
                                placeholder="New alias"
                                className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white min-w-[140px]"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => void addAdminAliasRow()}
                                className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50"
                              >
                                Add
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminAddingAlias(false);
                                  setNewAdminAliasText('');
                                }}
                                className="text-xs text-stone-500 hover:text-stone-800"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setAdminAddingAlias(true)}
                              className="inline-flex items-center justify-center text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
                              title="Add alias"
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}

            {activeTab === 'tags' && (
              <>
                <div className="space-y-5">
                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Color scheme</h3>
                    <p className="text-xs text-gray-500 mb-2">Apply a preset palette. Faded = muted pastels, Vibrant = saturated.</p>
                    <div className="flex flex-wrap gap-2">
                      {(['faded', 'bright', 'custom'] as const).map((scheme) => {
                        const label = scheme === 'faded' ? 'Faded' : scheme === 'bright' ? 'Vibrant' : 'Custom';
                        const isActive = settings.color_scheme === scheme;
                        return (
                          <button
                            key={scheme}
                            type="button"
                            onClick={() => {
                              if (scheme === 'custom') {
                                setSettings((s) => ({ ...s, color_scheme: 'custom' }));
                                return;
                              }
                              const preset = scheme === 'faded' ? FADED_TAG_DEFAULTS : BRIGHT_TAG_DEFAULTS;
                              const updates: Record<string, string> = { color_scheme: scheme };
                              Object.entries(preset).forEach(([k, bg]) => {
                                updates[k] = bg;
                                const textKey = k.replace('_bg_color', '_text_color');
                                updates[textKey] = readableTextForBg(bg);
                              });
                              setSettings((s) => ({ ...s, ...updates }));
                              onSettingsPreview?.({ ...settings, ...updates });
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                              isActive ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Palette</h3>
                    <p className="text-xs text-gray-500 mb-3">Click a swatch to edit, drag to a collection. Pick colors for tag types below.</p>
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
                        className="text-xs text-gray-500 hover:text-gray-800 font-medium"
                      >
                        Reset palette
                      </button>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Collections</h3>
                    <p className="text-xs text-gray-500 mb-3">Group colors for quick access. Drag swatches from the palette above.</p>
                    <button
                      type="button"
                      onClick={createCollection}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg mb-3"
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
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Tag colors</h3>
                    <p className="text-xs text-gray-500 mb-3">Click a tag type to assign a color from the palette.</p>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map(({ key, label }) => {
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
                                <div className="absolute left-0 top-full z-20 mt-1 p-3 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[220px]">
                                  <div className="text-xs font-medium text-gray-700 mb-2">{label}</div>
                                  <div className="grid grid-cols-6 gap-2 mb-3">
                                    {(() => {
                                      const inPalette = new Set(paletteColors.map((h) => h.toLowerCase()));
                                      const options = inPalette.has(bg.toLowerCase()) ? paletteColors : [bg, ...paletteColors];
                                      return options;
                                    })().map((hex) => (
                                      <button
                                        key={hex}
                                        type="button"
                                        onClick={() => assignColorToTag(key, hex)}
                                        className={`w-8 h-8 rounded-lg border-2 shrink-0 ${hex.toLowerCase() === bg.toLowerCase() ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-200 hover:border-gray-400'}`}
                                        style={{ backgroundColor: hex }}
                                        title={hex}
                                      />
                                    ))}
                                  </div>
                                  <label className="inline-flex items-center gap-2 px-2 py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs font-medium text-gray-700">
                                    <input
                                      type="color"
                                      value={bg}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        assignColorToTag(key, v, false);
                                        addToPalette(v);
                                      }}
                                      className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                                    />
                                    <span>Custom</span>
                                  </label>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Icons</h3>
                    <p className="text-xs text-gray-500 mb-3">Choose an icon for each tag type.</p>
                    <div className="flex flex-wrap gap-2">
                      {coreTagOptions.map(({ key: k, label }) => (
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
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Preview</h3>
                    <p className="text-xs text-gray-500 mb-3">Tag pills as they appear on event cards.</p>
                    <div className="flex flex-wrap gap-2">
                      {tagOptions.map(({ key: k, label }) => {
                        const bgKey = k === 'optional_tags' ? 'optional_tags_bg_color' : k === 'countdown' ? 'countdown_bg_color' : `${k}_bg_color`;
                        const textKey = k === 'optional_tags' ? 'optional_tags_text_color' : k === 'countdown' ? 'countdown_text_color' : `${k}_text_color`;
                        const bg = (settings as Record<string, string>)[bgKey] || '#e5e7eb';
                        const text = (settings as Record<string, string>)[textKey] || '#374151';
                        const iconName = k === 'optional_tags' || k === 'countdown' ? '' : (settings as Record<string, string>)[`${k}_icon`];
                        const IconC = !iconName ? null : getIcon(iconName, `${k}_icon` as keyof typeof DEFAULT_ICONS);
                        return (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-gray-200"
                            style={{ backgroundColor: bg, color: text }}
                          >
                            {IconC && <IconC size={12} className="shrink-0" />}
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </section>

                  <section className="border-t pt-4 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-gray-600">Defaults</span>
                    <button
                      type="button"
                      onClick={setAsDefault}
                      className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      Save as default
                    </button>
                    <button
                      type="button"
                      onClick={revertToDefault}
                      className="px-3 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                    >
                      Reset to default
                    </button>
                  </section>
                </div>
              </>
            )}

            {activeTab === 'account' && user && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Profile</h3>
                  <p className="text-xs text-gray-500 mb-3">Display name and username.</p>
                  <form onSubmit={saveAccountProfile} className="space-y-4">
                    <div>
                      <label htmlFor="editName" className="block text-xs font-medium text-stone-600 mb-1">Your Name</label>
                      <input
                        id="editName"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={80}
                        className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                        placeholder="Jane Doe"
                      />
                      <p className="text-xs text-stone-400 mt-0.5">Shown on your profile.</p>
                    </div>
                    <div>
                      <label htmlFor="editUsername" className="block text-xs font-medium text-stone-600 mb-1">Username</label>
                      <input
                        id="editUsername"
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        minLength={4}
                        maxLength={30}
                        pattern="[a-zA-Z0-9_-]+"
                        className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                        placeholder="janedoe2024"
                      />
                      <p className="text-xs text-stone-400 mt-0.5">Letters, numbers, underscore, hyphen.</p>
                    </div>
                    {profileSaveError && <p className="text-sm text-red-600">{profileSaveError}</p>}
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-4 py-2 text-sm font-medium rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed"
                    >
                      {profileSaving ? 'Saving…' : 'Save Profile'}
                    </button>
                  </form>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-stone-800 mb-1">Tags linked to your profile</h3>
                  <p className="text-xs text-stone-500 mb-3">Link credits from shows. Pick the name shown on cards.</p>
                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        ref={connectSearchInputRef}
                        value={connectName}
                        onChange={(e) => setConnectName(e.target.value)}
                        onKeyDown={handleConnectSearchKeyDown}
                        placeholder="Search shows, designers, models…"
                        className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                        aria-autocomplete="list"
                        aria-controls="connect-tag-results"
                        aria-expanded={connectName.trim().length >= 2 && creditSearchResults.length > 0}
                      />
                      {creditSearching && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Searching…</span>
                      )}
                    </div>
                    {connectName.trim().length >= 2 && creditSearchResults.length > 0 && (
                      <div
                        id="connect-tag-results"
                        role="listbox"
                        className="rounded-md border border-stone-200 bg-white divide-y divide-stone-100 max-h-56 overflow-y-auto shadow-sm"
                      >
                        {creditSearchResults.map((identity, idx) => (
                          <div
                            key={identity.id}
                            role="option"
                            aria-selected={idx === connectListActiveIdx}
                            id={`connect-opt-${idx}`}
                            className={`flex items-stretch gap-2 px-3 py-2 ${idx === connectListActiveIdx ? 'bg-gray-50' : ''}`}
                            onMouseEnter={() => setConnectListActiveIdx(idx)}
                          >
                            <div className="flex flex-1 min-w-0 items-center gap-2 text-left">
                              <span className="text-gray-400 text-xs shrink-0">{connectSearchTypePrefix(identity.tag_type)}</span>
                              <span className="text-sm text-gray-900 truncate">{identity.canonical_name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => selectCreditSearchResult(identity)}
                              className="shrink-0 self-center text-xs px-2.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800"
                            >
                              Connect
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {connectName.trim().length >= 2 && !creditSearching && creditSearchResults.length === 0 && (
                      <p className="text-xs text-stone-600">
                        No match.{' '}
                        <button
                          type="button"
                          className="text-stone-800 underline hover:no-underline"
                          onClick={() => setShowCreateTagForm(true)}
                        >
                          Create tag
                        </button>
                      </p>
                    )}
                    <div className="pt-1 border-t border-stone-100">
                      <button
                        type="button"
                        onClick={() => setShowCreateTagForm((v) => !v)}
                        aria-expanded={showCreateTagForm}
                        className="text-xs text-stone-700 underline hover:text-stone-900"
                      >
                        {showCreateTagForm ? 'Hide' : 'Create new tag'}
                      </button>
                      {showCreateTagForm && (
                        <div className="mt-3 p-3 rounded-lg border border-stone-200 bg-white space-y-2">
                          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tag type">
                            {CONNECT_CREATE_TYPE_PILLS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                data-tag-pill
                                onClick={() => setConnectType(p.value)}
                                className={creditPillClass(connectType === p.value)}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-2 items-end">
                            <div className="flex-1 min-w-[140px]">
                              <label htmlFor="connect-create-name" className="block text-[11px] text-stone-500 mb-0.5">Name</label>
                              <input
                                id="connect-create-name"
                                value={connectName}
                                onChange={(e) => setConnectName(e.target.value)}
                                placeholder="Name as it should appear"
                                className="w-full text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => connectOrCreateCredit(true)}
                              className="text-xs px-2.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800"
                            >
                              Create and link
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {creditConnectSuccess && <p className="text-xs text-green-700 mt-2">{creditConnectSuccess}</p>}
                  {creditsError && <p className="text-xs text-amber-700 mt-2">{creditsError}</p>}
                  {credits.length === 0 && (
                    <div className="mt-4 rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-4 text-sm text-stone-600">
                      <p className="font-medium text-stone-800 mb-1">No tags yet</p>
                      <p className="text-xs text-stone-500">Search for how you are credited on a show. Add aliases after linking.</p>
                    </div>
                  )}
                  {credits.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {credits.map((credit) => {
                        const publicLabel =
                          credit.aliases.find((a) => a.id === credit.public_display_alias_id)?.alias ?? credit.canonical_name;
                        const aliasRemovable = (alias: { alias: string }) =>
                          normalizeTagName(alias.alias) !== normalizeTagName(credit.canonical_name);
                        const inDeleteMode = aliasDeleteModeIdentityId === credit.identity_id;
                        return (
                          <div key={credit.id} className="rounded-xl border border-stone-100 p-3 bg-stone-50/70 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-gray-300 text-gray-600">
                                {formatTagTypeLabel(credit.tag_type)}
                              </span>
                              <span className="text-sm font-medium text-stone-900">{publicLabel}</span>
                              <button
                                type="button"
                                onClick={() => { if (window.confirm('Remove this credit from your profile?')) removeCredit(credit.id); }}
                                className="ml-auto text-[11px] text-stone-400 hover:text-red-600"
                                title="Remove credit"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-stone-600 mb-1">Name on event cards</label>
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Name on event cards">
                                <button
                                  type="button"
                                  data-tag-pill
                                  onClick={() => setPublicDisplayAlias(credit.identity_id, null)}
                                  className={creditPillClass(!credit.public_display_alias_id)}
                                  title={`Default · ${credit.canonical_name}`}
                                >
                                  Default · {credit.canonical_name}
                                </button>
                                {credit.aliases.map((a) => (
                                  <button
                                    key={a.id}
                                    type="button"
                                    data-tag-pill
                                    onClick={() => setPublicDisplayAlias(credit.identity_id, a.id)}
                                    className={creditPillClass(credit.public_display_alias_id === a.id)}
                                  >
                                    {a.alias}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <span className="text-[11px] font-medium text-stone-600">Also known as</span>
                                {inDeleteMode ? (
                                  <button
                                    type="button"
                                    onClick={() => setAliasDeleteModeIdentityId(null)}
                                    className="text-[11px] text-stone-600 hover:text-stone-900"
                                  >
                                    Done
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAliasDeleteModeIdentityId(credit.identity_id)}
                                    className="text-[11px] text-stone-500 hover:text-stone-800"
                                  >
                                    Remove aliases
                                  </button>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {credit.aliases.map((alias) => {
                                  const removable = aliasRemovable(alias);
                                  return (
                                    <span
                                      key={alias.id}
                                      data-tag-pill
                                      className={`relative inline-flex items-center gap-1 text-xs pl-2 pr-2 py-1 rounded-md bg-gray-300 text-gray-600 ${inDeleteMode && removable ? 'pill-wiggle' : ''}`}
                                    >
                                      {alias.alias}
                                      {inDeleteMode && removable && (
                                        <button
                                          type="button"
                                          className="absolute -top-1.5 -right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-stone-300 text-stone-600 shadow-sm hover:bg-stone-50"
                                          title="Remove alias"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!window.confirm('Remove this alias?')) return;
                                            void removeAliasForCredit(credit, alias.id);
                                          }}
                                          aria-label={`Remove alias ${alias.alias}`}
                                        >
                                          <X size={10} />
                                        </button>
                                      )}
                                    </span>
                                  );
                                })}
                                {addingAliasForIdentityId === credit.identity_id ? (
                                  <div className="inline-flex flex-wrap items-center gap-1.5">
                                    <input
                                      value={newAliasByIdentity[credit.identity_id] || ''}
                                      onChange={(e) => setNewAliasByIdentity((prev) => ({ ...prev, [credit.identity_id]: e.target.value }))}
                                      placeholder="New alias"
                                      className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white min-w-[140px]"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      onClick={() => addAliasForCredit(credit)}
                                      className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-700 hover:bg-stone-50"
                                    >
                                      Add
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAddingAliasForIdentityId(null)}
                                      className="text-xs text-stone-500 hover:text-stone-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setAddingAliasForIdentityId(credit.identity_id)}
                                    className="inline-flex items-center justify-center text-xs px-2 py-1 rounded-md border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
                                    title="Add alias"
                                  >
                                    <Plus size={14} />
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => addProfileNameAsAlias(credit)}
                                className="mt-2 text-xs text-stone-600 hover:text-stone-900 underline-offset-2 hover:underline"
                              >
                                Use profile name as alias
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
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

