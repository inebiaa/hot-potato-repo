import { displayLabelForTagFilter, type TagResolutionMap } from './tagDisplayResolution';
import { fetchIdentitiesByIds, ensureIdentity, findIdentityByName } from './tagIdentity';

export const HEADER_PINNED_ARTISTS_KEY = 'header_pinned_artists';

export interface PinnedArtistEntry {
  id: string;
  label: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parse stored JSON array of tag identity UUIDs. */
export function parseHeaderPinnedArtistIds(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  } catch {
    return [];
  }
}

/** Serialize ordered identity UUIDs for app_settings. */
export function serializeHeaderPinnedArtistIds(ids: string[]): string {
  const valid = ids.filter((id) => UUID_RE.test(id));
  return JSON.stringify(valid);
}

/** Resolve pinned artist labels from tagResolutionMap, falling back to tag_identities fetch. */
export async function resolvePinnedArtistsForDisplay(
  ids: string[],
  tagResolutionMap: TagResolutionMap | null | undefined,
): Promise<PinnedArtistEntry[]> {
  if (ids.length === 0) return [];

  const missing: string[] = [];
  const byId = new Map<string, PinnedArtistEntry>();

  for (const id of ids) {
    const label = displayLabelForTagFilter('artist', id, tagResolutionMap);
    if (label && label !== id) {
      byId.set(id, { id, label });
    } else {
      missing.push(id);
    }
  }

  if (missing.length > 0) {
    const fetched = await fetchIdentitiesByIds(missing);
    for (const row of fetched) {
      if (row.tag_type === 'artist') {
        byId.set(row.id, { id: row.id, label: row.canonical_name });
      }
    }
  }

  return ids
    .map((id) => byId.get(id))
    .filter((entry): entry is PinnedArtistEntry => !!entry);
}

/** Resolve catalog artist names to tag identity ids (creates missing identities). */
export async function resolvePinnedArtistNamesToIds(
  names: string[],
  createdBy?: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const identity =
      (await findIdentityByName('artist', trimmed)) ??
      (await ensureIdentity('artist', trimmed, createdBy));
    if (identity) ids.push(identity.id);
  }
  return ids;
}
