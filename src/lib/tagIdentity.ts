import { normalizeTagNameKey } from './normalize';
import { supabase } from './supabase';

export type TagType =
  | 'producer'
  | 'designer'
  | 'model'
  | 'hair_makeup'
  | 'venue'
  | 'header_tags'
  | 'footer_tags'
  | `custom:${string}`;

export interface TagIdentityRecord {
  /** `tag_identities.id` (this row) — use for admin, credits, and alias rows. */
  id: string;
  /**
   * Shared by all names linked as the same person. Use for search chips and event filters
   * (not a "main" row: any member’s id works for linking/unlinking in admin).
   */
  clusterId: string;
  tag_type: string;
  canonical_name: string;
}

/** Trim, collapse spaces, lowercase, strip accents (aligned with DB `fold_tag_normalize`). */
export function normalizeTagName(input: string): string {
  return normalizeTagNameKey(input);
}

/** True if `value` matches any entry (accent/case/spacing insensitive). */
export function tagArrayContainsNormalized(arr: string[] | null | undefined, value: string): boolean {
  if (!arr?.length || !String(value).trim()) return false;
  const v = normalizeTagName(value);
  return arr.some((x) => normalizeTagName(x) === v);
}

/** Accent/case/spacing insensitive string compare for city-like fields. */
export function sameTagSpelling(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeTagName(a ?? '') === normalizeTagName(b ?? '');
}

function toRecord(row: { id: string; cluster_id?: string; tag_type: string; canonical_name: string }): TagIdentityRecord {
  const cid = row.cluster_id ?? row.id;
  return {
    id: row.id,
    clusterId: cid,
    tag_type: row.tag_type,
    canonical_name: row.canonical_name,
  };
}

export async function findIdentityByName(tagType: TagType, name: string): Promise<TagIdentityRecord | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const { data: canonicalRows } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name, normalized_name, cluster_id')
    .eq('tag_type', tagType)
    .eq('normalized_name', normalized)
    .limit(1);
  if (canonicalRows && canonicalRows.length > 0) {
    return toRecord(canonicalRows[0] as { id: string; cluster_id: string; tag_type: string; canonical_name: string });
  }

  const { data: aliasRows } = await supabase
    .from('tag_aliases')
    .select('identity_id')
    .eq('normalized_alias', normalized)
    .limit(50);
  const identityIds = [...new Set((aliasRows || []).map((r: { identity_id: string }) => r.identity_id))];
  if (identityIds.length === 0) return null;

  const { data: identities } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name, normalized_name, cluster_id')
    .in('id', identityIds)
    .eq('tag_type', tagType);
  if (!identities?.length) return null;
  if (identities.length === 1) {
    return toRecord(identities[0] as { id: string; cluster_id: string; tag_type: string; canonical_name: string });
  }

  const exactCanonical = identities.find((row: { normalized_name: string }) => row.normalized_name === normalized) as
    | { id: string; cluster_id: string; tag_type: string; canonical_name: string }
    | undefined;
  const pick =
    exactCanonical ?? [...identities].sort((a, b) => a.id.localeCompare(b.id))[0] as {
      id: string;
      cluster_id: string;
      tag_type: string;
      canonical_name: string;
    };
  return toRecord(pick);
}

/**
 * All distinct “also credited as” display strings: row aliases, optional public display labels, and
 * **every other linked identity’s canonical** in the same cluster (separate `tag_identities` rows
 * are not each other’s `tag_aliases` rows, so we must list peer canonicals explicitly).
 * Excludes any spelling that matches `headlineTagValue` (normalized). Empty when there is no identity
 * (e.g. city/season).
 */
export async function fetchAliasStringsForTag(tagType: string, headlineTagValue: string): Promise<string[]> {
  if (tagType === 'city' || tagType === 'season') return [];

  const headlineNorm = normalizeTagName(headlineTagValue);
  if (!headlineNorm) return [];

  const identity = await findIdentityByName(tagType as TagType, headlineTagValue);
  if (!identity) return [];

  const { data: byCluster, error: clusterErr } = await supabase
    .from('tag_identities')
    .select('id, canonical_name, public_display_alias_id')
    .eq('tag_type', tagType)
    .eq('cluster_id', identity.clusterId);

  type Member = { id: string; canonical_name: string; public_display_alias_id: string | null };
  let members: Member[] = [];
  if (!clusterErr && byCluster && byCluster.length > 0) {
    members = byCluster as Member[];
  } else {
    const { data: one } = await supabase
      .from('tag_identities')
      .select('id, canonical_name, public_display_alias_id')
      .eq('id', identity.id)
      .maybeSingle();
    if (!one) return [];
    members = [one as Member];
  }

  const memberIds = members.map((m) => m.id);
  const seenNorm = new Set<string>();
  const out: string[] = [];
  const push = (s: string | null | undefined) => {
    if (!s) return;
    const n = normalizeTagName(s);
    if (!n || n === headlineNorm) return;
    if (seenNorm.has(n)) return;
    seenNorm.add(n);
    out.push(s);
  };

  for (const m of members) {
    push(m.canonical_name);
  }

  const pubIds = [...new Set(members.map((m) => m.public_display_alias_id).filter(Boolean))] as string[];
  if (pubIds.length) {
    const { data: pubAli } = await supabase.from('tag_aliases').select('id, alias').in('id', pubIds);
    const byPubId = new Map(
      (pubAli || []).map((r) => {
        const row = r as { id: string; alias: string };
        return [row.id, row.alias] as const;
      })
    );
    for (const m of members) {
      if (m.public_display_alias_id) {
        const a = byPubId.get(m.public_display_alias_id);
        if (a) push(a);
      }
    }
  }

  const { data: rows } = await supabase
    .from('tag_aliases')
    .select('alias')
    .in('identity_id', memberIds)
    .order('alias', { ascending: true });
  for (const row of rows || []) {
    push((row as { alias: string }).alias);
  }

  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function ensureIdentity(tagType: TagType, name: string, createdBy?: string): Promise<TagIdentityRecord | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const existing = await findIdentityByName(tagType, name);
  if (existing) return existing;

  const canonicalName = name.trim();
  const { data: inserted, error } = await supabase
    .from('tag_identities')
    .insert({
      tag_type: tagType,
      canonical_name: canonicalName,
      normalized_name: normalized,
      created_by: createdBy || null,
    })
    .select('id, tag_type, canonical_name, cluster_id')
    .limit(1)
    .maybeSingle();
  if (error || !inserted) return null;

  await supabase.from('tag_aliases').insert({
    identity_id: inserted.id,
    alias: canonicalName,
    normalized_alias: normalized,
    created_by: createdBy || null,
  });

  return toRecord(inserted as { id: string; cluster_id: string; tag_type: string; canonical_name: string });
}

/** True if another cluster of this tag type already has this normalized spelling as an alias. */
export async function isNormalizedAliasTakenByOtherIdentity(
  tagType: TagType,
  identityId: string,
  normalized: string
): Promise<boolean> {
  if (!normalized) return false;
  const { data: self } = await supabase
    .from('tag_identities')
    .select('cluster_id')
    .eq('id', identityId)
    .maybeSingle();
  const myCluster = (self as { cluster_id?: string } | null)?.cluster_id ?? identityId;

  const { data: rows } = await supabase
    .from('tag_aliases')
    .select('identity_id')
    .eq('normalized_alias', normalized);
  if (!rows?.length) return false;
  const otherIds = [...new Set(rows.map((r: { identity_id: string }) => r.identity_id))].filter(
    (id) => id !== identityId
  );
  if (otherIds.length === 0) return false;

  const { data: candidates } = await supabase
    .from('tag_identities')
    .select('id, cluster_id')
    .in('id', otherIds)
    .eq('tag_type', tagType);
  for (const row of candidates || []) {
    const cid = (row as { cluster_id?: string }).cluster_id ?? row.id;
    if (cid !== myCluster) return true;
  }
  return false;
}

export async function ensureAlias(identityId: string, alias: string, createdBy?: string): Promise<void> {
  const normalized = normalizeTagName(alias);
  if (!normalized) return;

  const { data: self } = await supabase
    .from('tag_identities')
    .select('tag_type')
    .eq('id', identityId)
    .maybeSingle();
  if (!self?.tag_type) return;

  const { data: existing } = await supabase
    .from('tag_aliases')
    .select('id')
    .eq('identity_id', identityId)
    .eq('normalized_alias', normalized)
    .limit(1);
  if (existing && existing.length > 0) return;

  if (await isNormalizedAliasTakenByOtherIdentity(self.tag_type as TagType, identityId, normalized)) return;

  await supabase.from('tag_aliases').insert({
    identity_id: identityId,
    alias: alias.trim(),
    normalized_alias: normalized,
    created_by: createdBy || null,
  });
}

type IdentityNameRow = { id: string; tag_type: string; canonical_name: string };

/**
 * Fetches cluster_id for search hits in one round-trip. If the column is missing or the query
 * fails, every row maps to `clusterId === id` so search still populates.
 */
async function toRecordsWithClusterIds(rows: IdentityNameRow[]): Promise<TagIdentityRecord[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.id))];
  const { data: clusterRows, error } = await supabase
    .from('tag_identities')
    .select('id, cluster_id')
    .in('id', ids);
  const clusterById = new Map<string, string>();
  if (!error && clusterRows) {
    for (const r of clusterRows as { id: string; cluster_id?: string }[]) {
      clusterById.set(r.id, r.cluster_id ?? r.id);
    }
  } else {
    for (const id of ids) clusterById.set(id, id);
  }
  return rows.map((row) =>
    toRecord({
      id: row.id,
      tag_type: row.tag_type,
      canonical_name: row.canonical_name,
      cluster_id: clusterById.get(row.id) ?? row.id,
    })
  );
}

/** Search tag identities by name (canonical or alias), any type. For "find yourself" / credit search. */
export async function searchTagIdentities(query: string): Promise<TagIdentityRecord[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const safe = (s: string) => s.replace(/'/g, "''");
  const trimQ = query.trim();
  const seen = new Set<string>();
  const out: IdentityNameRow[] = [];

  const { data: byCanonical } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .ilike('canonical_name', `%${safe(trimQ)}%`)
    .limit(15);
  (byCanonical || []).forEach((row: IdentityNameRow) => {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  });

  const { data: byNormalized } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .like('normalized_name', `%${q}%`)
    .limit(15);
  (byNormalized || []).forEach((row: IdentityNameRow) => {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      out.push(row);
    }
  });

  const { data: aliasRows } = await supabase
    .from('tag_aliases')
    .select('identity_id')
    .ilike('alias', `%${safe(trimQ)}%`)
    .limit(20);
  const aliasIds = (aliasRows || []).map((r: { identity_id: string }) => r.identity_id).filter((id) => !seen.has(id));
  if (aliasIds.length > 0) {
    const { data: identities } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name')
      .in('id', aliasIds)
      .limit(20);
    (identities || []).forEach((row: IdentityNameRow) => {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        out.push(row);
      }
    });
  }

  if (out.length === 0) return [];

  // Keep all matching **rows** (not one per cluster) so every linked spelling stays searchable
  // and remains visible by its canonical or alias. Filter dedupes by type+value.
  return toRecordsWithClusterIds(out.slice(0, 20));
}

const EVENT_TAG_COLUMNS: { key: keyof EventTagSource; tagType: TagType }[] = [
  { key: 'producers', tagType: 'producer' },
  { key: 'featured_designers', tagType: 'designer' },
  { key: 'models', tagType: 'model' },
  { key: 'hair_makeup', tagType: 'hair_makeup' },
  { key: 'header_tags', tagType: 'header_tags' },
  { key: 'footer_tags', tagType: 'footer_tags' },
];

/** Fields on an event row used to register tag identities + aliases (does not change event text). */
export interface EventFieldsForIdentitySync {
  producers?: string[] | null;
  featured_designers?: string[] | null;
  models?: string[] | null;
  hair_makeup?: string[] | null;
  header_tags?: string[] | null;
  footer_tags?: string[] | null;
  location?: string | null;
  custom_tags?: Record<string, string[]> | null;
}

/**
 * For each credit line on the event, ensure a `tag_identities` row exists and the exact spelling is an alias.
 * Call after a successful create/update so search, filters, and profiles can resolve all spellings to one person.
 */
export async function syncTagIdentitiesFromEventFields(
  fields: EventFieldsForIdentitySync,
  createdBy?: string | null
): Promise<void> {
  for (const { key, tagType } of EVENT_TAG_COLUMNS) {
    const arr = fields[key] as string[] | null | undefined;
    if (!Array.isArray(arr)) continue;
    for (const name of arr) {
      if (typeof name !== 'string' || !name.trim()) continue;
      const identity = await ensureIdentity(tagType, name, createdBy || undefined);
      if (identity) await ensureAlias(identity.id, name, createdBy || undefined);
    }
  }
  const loc = fields.location;
  if (typeof loc === 'string' && loc.trim()) {
    const identity = await ensureIdentity('venue', loc, createdBy || undefined);
    if (identity) await ensureAlias(identity.id, loc, createdBy || undefined);
  }
  const ct = fields.custom_tags;
  if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
    for (const [slug, vals] of Object.entries(ct)) {
      if (!Array.isArray(vals)) continue;
      const tagType = `custom:${slug}` as TagType;
      for (const name of vals) {
        if (typeof name !== 'string' || !name.trim()) continue;
        const identity = await ensureIdentity(tagType, name, createdBy || undefined);
        if (identity) await ensureAlias(identity.id, name, createdBy || undefined);
      }
    }
  }
}

/** Link `p_subject_id` → `p_target_id` (same tag type). Reversible via `adminUnlinkTagIdentity`. */
export async function adminLinkTagIdentities(subjectId: string, targetId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('admin_link_tag_identities', {
    p_subject_id: subjectId,
    p_target_id: targetId,
  });
  return { error: error as Error | null };
}

/** Split this name out to its own cluster (admin only). */
export async function adminUnlinkTagIdentity(identityId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('admin_unlink_tag_identity', { p_identity_id: identityId });
  return { error: error as Error | null };
}

/** @deprecated Prefer `adminLinkTagIdentities`; destructive merge (deletes a row). */
export async function adminMergeTagIdentities(keepId: string, absorbId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('admin_merge_tag_identities', {
    p_keep_id: keepId,
    p_absorb_id: absorbId,
  });
  return { error: error as Error | null };
}

interface EventTagSource {
  producers?: string[] | null;
  featured_designers?: string[] | null;
  models?: string[] | null;
  hair_makeup?: string[] | null;
  location?: string | null;
  header_tags?: string[] | null;
  footer_tags?: string[] | null;
  custom_tags?: Record<string, unknown> | null;
}

/** Search tags from events (producers, designers, etc.). Use when tag_identities is empty or doesn't have the tag yet. */
export async function searchEventTags(query: string): Promise<Pick<TagIdentityRecord, 'tag_type' | 'canonical_name'>[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const { data: events, error } = await supabase
    .from('events')
    .select('producers, featured_designers, models, hair_makeup, location, header_tags, footer_tags, custom_tags')
    .order('date', { ascending: false })
    .limit(500);

  if (error || !events) return [];

  const seen = new Map<string, { tag_type: string; canonical_name: string }>();
  const add = (tagType: TagType, name: string) => {
    const n = normalizeTagName(name);
    if (!n || !n.includes(q)) return;
    const key = `${tagType}:${n}`;
    if (seen.has(key)) return;
    seen.set(key, { tag_type: tagType, canonical_name: name.trim() });
  };

  for (const ev of events as EventTagSource[]) {
    for (const { key, tagType } of EVENT_TAG_COLUMNS) {
      const arr = ev[key];
      if (Array.isArray(arr)) {
        for (const v of arr) {
          if (typeof v === 'string') add(tagType, v);
        }
      }
    }
    if (typeof ev.location === 'string') add('venue', ev.location);
    const ct = ev.custom_tags;
    if (ct && typeof ct === 'object' && !Array.isArray(ct)) {
      for (const [slug, vals] of Object.entries(ct)) {
        const tagType = `custom:${slug}` as TagType;
        if (Array.isArray(vals)) {
          for (const v of vals) {
            if (typeof v === 'string') add(tagType, v);
          }
        }
      }
    }
  }

  return Array.from(seen.values()).slice(0, 15);
}
