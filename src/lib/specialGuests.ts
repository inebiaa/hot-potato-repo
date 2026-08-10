/** Dedicated music-show credit stored in `custom_tags`. Icon/colors come from app settings. */
export const SPECIAL_GUESTS_SLUG = 'special-guests';
export const SPECIAL_GUESTS_LABEL = 'Special Guests';

export function isSpecialGuestsSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '') === 'specialguests';
}

export function getSpecialGuests(customTags: Record<string, string[]> | null | undefined): string[] {
  if (!customTags || typeof customTags !== 'object') return [];
  for (const [slug, vals] of Object.entries(customTags)) {
    if (isSpecialGuestsSlug(slug) && Array.isArray(vals)) {
      return vals.map((v) => String(v).trim()).filter(Boolean);
    }
  }
  return [];
}

/** Merge special guests into custom_tags; omit the key when empty. */
export function withSpecialGuests(
  customTags: Record<string, string[]>,
  guests: string[]
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [slug, vals] of Object.entries(customTags)) {
    if (isSpecialGuestsSlug(slug)) continue;
    if (Array.isArray(vals) && vals.length > 0) next[slug] = vals;
  }
  const cleaned = guests.map((v) => String(v).trim()).filter(Boolean);
  if (cleaned.length > 0) next[SPECIAL_GUESTS_SLUG] = cleaned;
  return next;
}

/** Keep other custom meta; drop leftover special-guests icon meta (icon is settings-owned). */
export function withSpecialGuestsMeta(
  meta: Record<string, { icon?: string }> | null | undefined,
  _hasGuests: boolean
): Record<string, { icon?: string }> | null {
  const next: Record<string, { icon?: string }> = {};
  for (const [slug, val] of Object.entries(meta || {})) {
    if (isSpecialGuestsSlug(slug)) continue;
    next[slug] = val;
  }
  return Object.keys(next).length ? next : null;
}
