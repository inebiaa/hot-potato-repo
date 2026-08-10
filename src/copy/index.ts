import { COPY_CATALOG, type CopyKey } from './catalog';

export type { CopyKey, CopyGroup, CopyEntry } from './catalog';
export { COPY_CATALOG, COPY_GROUP_LABELS, COPY_SETTINGS_KEYS } from './catalog';

export const COPY_OVERRIDES_SETTING_KEY = 'copy_overrides';

export type CopyOverrides = Partial<Record<CopyKey, string>>;

export function parseCopyOverrides(raw: string | null | undefined): CopyOverrides {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: CopyOverrides = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (key in COPY_CATALOG && typeof value === 'string') {
        out[key as CopyKey] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeCopyOverrides(overrides: CopyOverrides): string {
  const cleaned: CopyOverrides = {};
  for (const [key, value] of Object.entries(overrides) as [CopyKey, string | undefined][]) {
    if (!(key in COPY_CATALOG) || typeof value !== 'string') continue;
    // Keep spaces while typing; drop only empty / whitespace-only entries.
    if (value.trim() === '') continue;
    cleaned[key] = value;
  }
  return JSON.stringify(cleaned);
}

/** Resolve a copy key: Settings override → catalog default. */
export function t(key: CopyKey, overrides?: CopyOverrides | null): string {
  const fromOverride = overrides?.[key]?.trim();
  if (fromOverride) return fromOverride;
  return COPY_CATALOG[key].default;
}

export function overridesFromSettings(
  settings: { copy_overrides?: string } | null | undefined
): CopyOverrides {
  return parseCopyOverrides(settings?.copy_overrides);
}
