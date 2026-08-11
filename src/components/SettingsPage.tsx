import { useState, useEffect, useRef, useMemo } from 'react';
import { Save, Image, Users, Tags, User, Type } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { readableTextForBg } from '../lib/colorUtils';
import { CUSTOM_COLORS_STORAGE_KEY, PRELOADED_HEX } from '../lib/tagColorPickerData';
import {
  ensureIdentity,
  findIdentityByName,
  isNormalizedAliasTakenByOtherIdentity,
  normalizeTagName,
  searchTagIdentities,
  searchEventTags,
  adminLinkTagIdentities,
  adminUnlinkTagIdentity,
  type TagIdentityRecord,
  type TagType,
} from '../lib/tagIdentity';
import { loadAdminTagGroupMembers } from '../lib/adminTagGroupMembers';
import type { AppSettings } from '../types/appSettings';
import BrandingTab from './settings/BrandingTab';
import CopyTab from './settings/CopyTab';
import AccountTab, { type CreditRow } from './settings/AccountTab';
import AdminsTab from './settings/AdminsTab';
import TagsTab, { BRIGHT_TAG_DEFAULTS, FADED_TAG_DEFAULTS } from './settings/TagsTab';
import { Button } from './ui';
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
  /** Drop stale in-flight `fetchAdminLinkContext` results (e.g. fast Back + pick another name). */
  const fetchAdminLinkContextGenRef = useRef(0);

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
  const [adminMergeSearch, setAdminMergeSearch] = useState('');
  const [adminMergeSearchResults, setAdminMergeSearchResults] = useState<TagIdentityRecord[]>([]);
  const [adminMergeSearching, setAdminMergeSearching] = useState(false);
  const [adminMergeAbsorb, setAdminMergeAbsorb] = useState<TagIdentityRecord | null>(null);
  const [adminLinking, setAdminLinking] = useState(false);
  /** Every `tag_identities` row in the same cluster (including the open profile), for proof of linking. */
  const [adminIdentityClusterMembers, setAdminIdentityClusterMembers] = useState<{ id: string; canonical_name: string }[]>([]);

  /** Hide alias rows that only repeat the profile’s main name; “also credited as” is for alternate spellings. */
  const adminAliasesForDisplay = useMemo(() => {
    if (!adminManagedIdentity) return adminManagedAliases;
    const c = normalizeTagName(adminManagedIdentity.canonical_name);
    return adminManagedAliases.filter((al) => normalizeTagName(al.alias) !== c);
  }, [adminManagedAliases, adminManagedIdentity]);

  const tagOptions: { key: SwatchColorKey; label: string }[] = [
    { key: 'producer', label: 'Producer' },
    { key: 'designer', label: 'Designer' },
    { key: 'model', label: 'Model' },
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
    if (!isAdmin) return;
    if (adminManagedIdentity) {
      setAdminIdentitySearchResults([]);
      setAdminIdentitySearching(false);
      return;
    }
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
        .catch(() => {
          setAdminIdentitySearchResults([]);
          setAdminIdentitySearching(false);
        });
    }, 200);
    return () => window.clearTimeout(t);
  }, [adminIdentitySearch, isAdmin, adminManagedIdentity]);

  useEffect(() => {
    if (!isAdmin || !adminManagedIdentity) {
      setAdminMergeSearchResults([]);
      return;
    }
    const q = adminMergeSearch.trim();
    if (q.length < 2) {
      setAdminMergeSearchResults([]);
      return;
    }
    const keep = adminManagedIdentity;
    const t = window.setTimeout(() => {
      setAdminMergeSearching(true);
      searchTagIdentities(q)
        .then((rows) => {
          setAdminMergeSearchResults(
            rows.filter(
              (r) =>
                r.tag_type === keep.tag_type && r.id !== keep.id && r.clusterId !== keep.clusterId
            )
          );
          setAdminMergeSearching(false);
        })
        .catch(() => {
          setAdminMergeSearchResults([]);
          setAdminMergeSearching(false);
        });
    }, 200);
    return () => window.clearTimeout(t);
  }, [adminMergeSearch, isAdmin, adminManagedIdentity]);

  useEffect(() => {
    setSettingsLoaded(false);
    fetchSettings();
    fetchAdminUsers();
    if (user) {
      fetchAccountProfile();
      fetchCredits();
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

  /**
   * Loads every tag in the same person-group as this row.
   * Uses cluster_id + same tag_type, with an or() so we don’t miss rows (rep id, PostgREST edge cases, etc.).
   * @param alsoPartnerId — after a fresh link, pass the other id in case a single query missed a row.
   */
  const fetchAdminLinkContext = async (
    identityId: string,
    alsoPartnerId?: string
  ): Promise<{ id: string; canonical_name: string }[]> => {
    const gen = ++fetchAdminLinkContextGenRef.current;
    let row: { id: string; cluster_id?: string; canonical_name: string; tag_type: string } | null = null;
    const r1 = await supabase
      .from('tag_identities')
      .select('id, cluster_id, canonical_name, tag_type')
      .eq('id', identityId)
      .maybeSingle();
    if (r1.error) {
      const r0 = await supabase
        .from('tag_identities')
        .select('id, canonical_name, tag_type')
        .eq('id', identityId)
        .maybeSingle();
      if (r0.error || !r0.data) {
        if (gen === fetchAdminLinkContextGenRef.current) {
          setAdminIdentityClusterMembers([]);
          setAdminAliasError('Could not load profile.');
        }
        return [];
      }
      const a = r0.data as { id: string; canonical_name: string; tag_type: string };
      row = { id: a.id, canonical_name: a.canonical_name, tag_type: a.tag_type, cluster_id: a.id };
    } else {
      row = r1.data as { id: string; cluster_id?: string; canonical_name: string; tag_type: string };
    }
    if (!row) {
      if (gen === fetchAdminLinkContextGenRef.current) {
        setAdminIdentityClusterMembers([]);
      }
      return [];
    }
    const r = row;
    const { members, errorMessage } = await loadAdminTagGroupMembers(r, alsoPartnerId);
    if (gen !== fetchAdminLinkContextGenRef.current) {
      return members;
    }
    if (errorMessage) {
      setAdminAliasError(errorMessage);
    } else {
      setAdminAliasError((prev) =>
        prev && (prev.startsWith('Could not load linked group') || /cluster_id|migration 202604/i.test(prev))
          ? null
          : prev
      );
    }
    setAdminIdentityClusterMembers(members);
    setAdminManagedIdentity((prev) =>
      prev?.id === identityId
        ? {
            ...prev,
            clusterId: r.cluster_id ?? r.id,
            canonical_name: r.canonical_name,
            tag_type: r.tag_type,
          }
        : prev
    );
    return members;
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
    setAdminMergeSearch('');
    setAdminMergeSearchResults([]);
    setAdminMergeAbsorb(null);
    setEditingAdminAliasId(null);
    setEditAdminAliasDraft('');
    setAdminAliasDeleteMode(false);
    void fetchAdminAliasesForIdentity(identity.id);
    void fetchAdminLinkContext(identity.id);
  };

  const selectAdminMergeAbsorb = (row: TagIdentityRecord) => {
    if (!adminManagedIdentity || row.id === adminManagedIdentity.id) return;
    if (row.tag_type !== adminManagedIdentity.tag_type) return;
    if (row.clusterId && adminManagedIdentity.clusterId && row.clusterId === adminManagedIdentity.clusterId) {
      setAdminMergeSearch('');
      setAdminMergeSearchResults([]);
      setSuccess('Already connected.');
      setTimeout(() => setSuccess(''), 3000);
      void fetchAdminLinkContext(adminManagedIdentity.id, row.id);
      return;
    }
    setAdminMergeAbsorb(row);
    setAdminMergeSearch('');
    setAdminMergeSearchResults([]);
  };

  /** Switch which cluster member is open (same group; aliases load for that row). */
  const switchAdminToLinkedMember = (m: { id: string; canonical_name: string }) => {
    if (!adminManagedIdentity || m.id === adminManagedIdentity.id) return;
    setAdminManagedIdentity({
      id: m.id,
      tag_type: adminManagedIdentity.tag_type,
      canonical_name: m.canonical_name,
      clusterId: adminManagedIdentity.clusterId,
    });
    setAdminMergeSearch('');
    setAdminMergeSearchResults([]);
    setAdminMergeAbsorb(null);
    setEditingAdminAliasId(null);
    setEditAdminAliasDraft('');
    setAdminAliasDeleteMode(false);
    setAdminAddingAlias(false);
    setNewAdminAliasText('');
    void fetchAdminAliasesForIdentity(m.id);
    void fetchAdminLinkContext(m.id);
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
    if (norm === normalizeTagName(adminManagedIdentity.canonical_name)) {
      setAdminAliasError('That spelling is already the name on file for this tag. Use an alternate or nickname.');
      return;
    }
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

  const runAdminLink = async () => {
    if (!adminManagedIdentity || !adminMergeAbsorb) return;
    if (adminMergeAbsorb.id === adminManagedIdentity.id) {
      setAdminAliasError('Pick a different identity to link.');
      return;
    }
    const otherName = adminMergeAbsorb.canonical_name;
    const thisName = adminManagedIdentity.canonical_name;
    const partnerId = adminMergeAbsorb.id;
    const selfId = adminManagedIdentity.id;
    setAdminAliasError(null);
    setAdminLinking(true);

    const { data: aRow } = await supabase.from('tag_identities').select('cluster_id').eq('id', partnerId).maybeSingle();
    const { data: bRow } = await supabase.from('tag_identities').select('cluster_id').eq('id', selfId).maybeSingle();
    const ca = (aRow as { cluster_id?: string } | null)?.cluster_id;
    const cb = (bRow as { cluster_id?: string } | null)?.cluster_id;
    if (ca != null && cb != null && ca === cb) {
      setAdminLinking(false);
      setAdminMergeAbsorb(null);
      setAdminMergeSearch('');
      setAdminMergeSearchResults([]);
      setSuccess('Already connected — same person.');
      setTimeout(() => setSuccess(''), 3500);
      const { data: fresh } = await supabase
        .from('tag_identities')
        .select('id, tag_type, canonical_name, cluster_id')
        .eq('id', selfId)
        .maybeSingle();
      if (fresh) {
        const f = fresh as { id: string; tag_type: string; canonical_name: string; cluster_id?: string };
        setAdminManagedIdentity({
          id: f.id,
          tag_type: f.tag_type,
          canonical_name: f.canonical_name,
          clusterId: f.cluster_id ?? f.id,
        });
      }
      await fetchAdminAliasesForIdentity(selfId);
      await fetchAdminLinkContext(selfId, partnerId);
      return;
    }

    const { error } = await adminLinkTagIdentities(partnerId, selfId);
    setAdminLinking(false);

    if (error) {
      const errText = (error as Error).message || 'Link failed';
      const isCycle = /invalid link|would form a cycle|cycle/i.test(errText);
      setAdminMergeAbsorb(null);
      setAdminMergeSearch('');
      setAdminMergeSearchResults([]);
      const { data: freshE } = await supabase
        .from('tag_identities')
        .select('id, tag_type, canonical_name, cluster_id')
        .eq('id', selfId)
        .maybeSingle();
      if (freshE) {
        const f = freshE as { id: string; tag_type: string; canonical_name: string; cluster_id?: string };
        setAdminManagedIdentity({
          id: f.id,
          tag_type: f.tag_type,
          canonical_name: f.canonical_name,
          clusterId: f.cluster_id ?? f.id,
        });
      }
      await fetchAdminAliasesForIdentity(selfId);
      let members = await fetchAdminLinkContext(selfId, partnerId);
      if (isCycle && members.length < 2) {
        const byId = new Map<string, { id: string; canonical_name: string }>();
        byId.set(partnerId, { id: partnerId, canonical_name: otherName });
        byId.set(selfId, { id: selfId, canonical_name: thisName });
        members = Array.from(byId.values()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
        setAdminIdentityClusterMembers(members);
      }
      if (isCycle) {
        setAdminAliasError(null);
        setSuccess('Already connected (same in the system).');
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setAdminAliasError(errText);
      }
      return;
    }

    setAdminMergeAbsorb(null);
    setAdminMergeSearch('');
    setAdminMergeSearchResults([]);
    setSuccess(`Linked: “${otherName}” ↔ “${thisName}”`);
    setTimeout(() => setSuccess(''), 4000);
    const { data: fresh } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name, cluster_id')
      .eq('id', selfId)
      .maybeSingle();
    if (fresh) {
      const f = fresh as { id: string; tag_type: string; canonical_name: string; cluster_id?: string };
      setAdminManagedIdentity({
        id: f.id,
        tag_type: f.tag_type,
        canonical_name: f.canonical_name,
        clusterId: f.cluster_id ?? f.id,
      });
    }
    await fetchAdminAliasesForIdentity(selfId);
    await fetchAdminLinkContext(selfId, partnerId);
  };

  const runAdminUnlink = async (identityId: string) => {
    if (!window.confirm('Remove this profile from the linked set? It becomes its own tag again.')) {
      return;
    }
    setAdminAliasError(null);
    setAdminLinking(true);
    const { error } = await adminUnlinkTagIdentity(identityId);
    setAdminLinking(false);
    if (error) {
      setAdminAliasError(error.message || 'Unlink failed');
      return;
    }
    setSuccess('Unlinked');
    setTimeout(() => setSuccess(''), 3000);
    if (adminManagedIdentity) {
      if (adminManagedIdentity.id === identityId) {
        const { data: fr } = await supabase
          .from('tag_identities')
          .select('id, tag_type, canonical_name, cluster_id')
          .eq('id', identityId)
          .maybeSingle();
        if (fr) {
          const f = fr as { id: string; tag_type: string; canonical_name: string; cluster_id?: string };
          setAdminManagedIdentity({
            id: f.id,
            tag_type: f.tag_type,
            canonical_name: f.canonical_name,
            clusterId: f.cluster_id ?? f.id,
          });
        }
      }
      await fetchAdminLinkContext(adminManagedIdentity.id);
      void fetchAdminAliasesForIdentity(adminManagedIdentity.id);
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
                adminIdentitySearch={adminIdentitySearch}
                setAdminIdentitySearch={setAdminIdentitySearch}
                adminIdentitySearching={adminIdentitySearching}
                adminManagedIdentity={adminManagedIdentity}
                setAdminManagedIdentity={setAdminManagedIdentity}
                setAdminManagedAliases={setAdminManagedAliases}
                adminIdentitySearchResults={adminIdentitySearchResults}
                selectAdminManagedIdentity={selectAdminManagedIdentity}
                adminIdentityClusterMembers={adminIdentityClusterMembers}
                switchAdminToLinkedMember={switchAdminToLinkedMember}
                runAdminUnlink={runAdminUnlink}
                adminLinking={adminLinking}
                adminAliasLoading={adminAliasLoading}
                adminAliasError={adminAliasError}
                adminAliasesForDisplay={adminAliasesForDisplay}
                adminAliasDeleteMode={adminAliasDeleteMode}
                setAdminAliasDeleteMode={setAdminAliasDeleteMode}
                editingAdminAliasId={editingAdminAliasId}
                setEditingAdminAliasId={setEditingAdminAliasId}
                editAdminAliasDraft={editAdminAliasDraft}
                setEditAdminAliasDraft={setEditAdminAliasDraft}
                saveAdminAliasEdit={saveAdminAliasEdit}
                deleteAdminAliasRow={deleteAdminAliasRow}
                adminAddingAlias={adminAddingAlias}
                setAdminAddingAlias={setAdminAddingAlias}
                newAdminAliasText={newAdminAliasText}
                setNewAdminAliasText={setNewAdminAliasText}
                addAdminAliasRow={addAdminAliasRow}
                adminMergeSearch={adminMergeSearch}
                setAdminMergeSearch={setAdminMergeSearch}
                adminMergeSearching={adminMergeSearching}
                adminMergeSearchResults={adminMergeSearchResults}
                setAdminMergeSearchResults={setAdminMergeSearchResults}
                adminMergeAbsorb={adminMergeAbsorb}
                setAdminMergeAbsorb={setAdminMergeAbsorb}
                selectAdminMergeAbsorb={selectAdminMergeAbsorb}
                runAdminLink={runAdminLink}
                setAdminIdentityClusterMembers={setAdminIdentityClusterMembers}
                fetchAdminLinkContextGenRef={fetchAdminLinkContextGenRef}
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
                editName={editName}
                setEditName={setEditName}
                editUsername={editUsername}
                setEditUsername={setEditUsername}
                profileSaveError={profileSaveError}
                profileSaving={profileSaving}
                saveAccountProfile={saveAccountProfile}
                connectName={connectName}
                setConnectName={setConnectName}
                connectType={connectType}
                setConnectType={setConnectType}
                creditSearchResults={creditSearchResults}
                creditSearching={creditSearching}
                connectListActiveIdx={connectListActiveIdx}
                setConnectListActiveIdx={setConnectListActiveIdx}
                showCreateTagForm={showCreateTagForm}
                setShowCreateTagForm={setShowCreateTagForm}
                creditConnectSuccess={creditConnectSuccess}
                creditsError={creditsError}
                credits={credits}
                aliasDeleteModeIdentityId={aliasDeleteModeIdentityId}
                setAliasDeleteModeIdentityId={setAliasDeleteModeIdentityId}
                addingAliasForIdentityId={addingAliasForIdentityId}
                setAddingAliasForIdentityId={setAddingAliasForIdentityId}
                newAliasByIdentity={newAliasByIdentity}
                setNewAliasByIdentity={setNewAliasByIdentity}
                connectSearchInputRef={connectSearchInputRef}
                handleConnectSearchKeyDown={handleConnectSearchKeyDown}
                selectCreditSearchResult={selectCreditSearchResult}
                connectOrCreateCredit={connectOrCreateCredit}
                removeCredit={removeCredit}
                setPublicDisplayAlias={setPublicDisplayAlias}
                removeAliasForCredit={removeAliasForCredit}
                addAliasForCredit={addAliasForCredit}
                addProfileNameAsAlias={addProfileNameAsAlias}
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

