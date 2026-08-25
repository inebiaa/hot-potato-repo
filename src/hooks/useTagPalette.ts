import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import { readableTextForBg } from '../lib/colorUtils';
import { CUSTOM_COLORS_STORAGE_KEY, PRELOADED_HEX } from '../lib/tagColorPickerData';
import type { AppSettings } from '../types/appSettings';
import {
  BUILT_IN_TAG_DEFAULTS,
  COLLECTIONS_STORAGE_KEY,
  type ColorCollection,
  DEFAULT_TAG_SETTINGS_KEY,
  PALETTE_STORAGE_KEY,
  type SwatchColorKey,
} from '../components/settings/settingsConstants';

const TAG_OPTIONS: { key: SwatchColorKey; label: string }[] = [
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

type UseTagPaletteOptions = {
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  onSettingsPreview?: (settings: AppSettings) => void;
  flashSuccess: (message: string) => void;
  setError: (message: string) => void;
};

export function useTagPalette({
  settings,
  setSettings,
  onSettingsPreview,
  flashSuccess,
  setError,
}: UseTagPaletteOptions) {
  const [assigningTag, setAssigningTag] = useState<SwatchColorKey | null>(null);
  const [paletteColors, setPaletteColors] = useState<string[]>(() => [...PRELOADED_HEX]);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editingHex, setEditingHex] = useState('');
  const [collections, setCollections] = useState<ColorCollection[]>(() => []);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);

  const coreTagOptions = TAG_OPTIONS.filter((t) => t.key !== 'optional_tags');

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
      /* ignore */
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
            typeof c === 'object' &&
            c !== null &&
            typeof c.id === 'string' &&
            typeof c.name === 'string' &&
            Array.isArray(c.colors),
        );
        setCollections(valid);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistPalette = (colors: string[]) => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(colors));
      const extra = colors.filter((h) => !PRELOADED_HEX.some((p) => p.toLowerCase() === h.toLowerCase()));
      window.localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(extra));
    } catch {
      /* ignore */
    }
  };

  const persistCollections = (cols: ColorCollection[]) => {
    try {
      window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(cols));
    } catch {
      /* ignore */
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
      c.id === collectionId && !c.colors.some((x) => x.toLowerCase() === n)
        ? { ...c, colors: [...c.colors, n] }
        : c,
    );
    setCollections(next);
    persistCollections(next);
    setDragOverCollectionId(null);
  };

  const removeColorFromCollection = (collectionId: string, hex: string) => {
    const n = hex.toLowerCase();
    const next = collections.map((c) =>
      c.id === collectionId ? { ...c, colors: c.colors.filter((x) => x.toLowerCase() !== n) } : c,
    );
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
      /* ignore */
    }
    return BUILT_IN_TAG_DEFAULTS;
  };

  const setAsDefault = () => {
    const toSave: Record<string, string> = {};
    for (const k of TAG_OPTIONS) {
      const bgKey =
        k.key === 'optional_tags'
          ? 'optional_tags_bg_color'
          : k.key === 'countdown'
            ? 'countdown_bg_color'
            : `${k.key}_bg_color`;
      const textKey =
        k.key === 'optional_tags'
          ? 'optional_tags_text_color'
          : k.key === 'countdown'
            ? 'countdown_text_color'
            : `${k.key}_text_color`;
      const iconKey = k.key === 'optional_tags' || k.key === 'countdown' ? null : `${k.key}_icon`;
      toSave[bgKey] =
        (settings as Record<string, string>)[bgKey] ||
        BUILT_IN_TAG_DEFAULTS[bgKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
      toSave[textKey] =
        (settings as Record<string, string>)[textKey] ||
        BUILT_IN_TAG_DEFAULTS[textKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
      if (iconKey) {
        toSave[iconKey] =
          (settings as Record<string, string>)[iconKey] ||
          BUILT_IN_TAG_DEFAULTS[iconKey as keyof typeof BUILT_IN_TAG_DEFAULTS];
      }
    }
    try {
      window.localStorage.setItem(DEFAULT_TAG_SETTINGS_KEY, JSON.stringify(toSave));
      setError('');
      flashSuccess('Current options set as default');
    } catch {
      setError('Could not save default');
    }
  };

  const revertToDefault = () => {
    const defs = getTagDefaults();
    const next: AppSettings = { ...settings };
    for (const { key } of TAG_OPTIONS) {
      const bgKey =
        key === 'optional_tags'
          ? 'optional_tags_bg_color'
          : key === 'countdown'
            ? 'countdown_bg_color'
            : `${key}_bg_color`;
      const textKey =
        key === 'optional_tags'
          ? 'optional_tags_text_color'
          : key === 'countdown'
            ? 'countdown_text_color'
            : `${key}_text_color`;
      const iconKey = key === 'optional_tags' || key === 'countdown' ? null : `${key}_icon`;
      next[bgKey] = defs[bgKey as keyof typeof defs];
      next[textKey] = defs[textKey as keyof typeof defs];
      if (iconKey) (next as Record<string, string>)[iconKey] = defs[iconKey as keyof typeof defs];
    }
    setSettings(next);
    onSettingsPreview?.(next);
    setError('');
    flashSuccess('Reverted to default');
  };

  const assignColorToTag = (tagKey: SwatchColorKey, hex: string, close = true) => {
    const bgKey =
      tagKey === 'optional_tags'
        ? 'optional_tags_bg_color'
        : tagKey === 'countdown'
          ? 'countdown_bg_color'
          : `${tagKey}_bg_color`;
    const textKey =
      tagKey === 'optional_tags'
        ? 'optional_tags_text_color'
        : tagKey === 'countdown'
          ? 'countdown_text_color'
          : `${tagKey}_text_color`;
    setSettings((s) => ({
      ...s,
      color_scheme: 'custom',
      [bgKey]: hex,
      [textKey]: readableTextForBg(hex),
    }));
    if (close) setAssigningTag(null);
  };

  return {
    tagOptions: TAG_OPTIONS,
    coreTagOptions,
    assigningTag,
    setAssigningTag,
    paletteColors,
    editingColor,
    setEditingColor,
    editingHex,
    setEditingHex,
    editColorInPalette,
    removeFromPalette,
    addToPalette,
    resetPaletteToDefaults,
    collections,
    createCollection,
    dragOverCollectionId,
    setDragOverCollectionId,
    addColorToCollection,
    updateCollectionName,
    deleteCollection,
    removeColorFromCollection,
    setAsDefault,
    revertToDefault,
    assignColorToTag,
  };
}
