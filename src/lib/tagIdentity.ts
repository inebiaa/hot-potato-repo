import { supabase } from './supabase';

export type TagType =
  | 'producer'
  | 'designer'
  | 'model'
  | 'hair_makeup'
  | 'header_tags'
  | 'footer_tags'
  | `custom:${string}`;

export interface TagIdentityRecord {
  id: string;
  tag_type: string;
  canonical_name: string;
}

export function normalizeTagName(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function findIdentityByName(tagType: TagType, name: string): Promise<TagIdentityRecord | null> {
  const normalized = normalizeTagName(name);
  if (!normalized) return null;

  const { data: canonicalRows } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .eq('tag_type', tagType)
    .eq('normalized_name', normalized)
    .limit(1);
  if (canonicalRows && canonicalRows.length > 0) return canonicalRows[0] as TagIdentityRecord;

  const { data: aliasRows } = await supabase
    .from('tag_aliases')
    .select('identity_id')
    .eq('normalized_alias', normalized)
    .limit(20);
  const identityIds = (aliasRows || []).map((r: { identity_id: string }) => r.identity_id);
  if (identityIds.length === 0) return null;

  const { data: identities } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .in('id', identityIds)
    .eq('tag_type', tagType)
    .limit(1);
  return identities && identities.length > 0 ? (identities[0] as TagIdentityRecord) : null;
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
    .select('id, tag_type, canonical_name')
    .limit(1)
    .maybeSingle();
  if (error || !inserted) return null;

  await supabase.from('tag_aliases').insert({
    identity_id: inserted.id,
    alias: canonicalName,
    normalized_alias: normalized,
    created_by: createdBy || null,
  });

  return inserted as TagIdentityRecord;
}

export async function ensureAlias(identityId: string, alias: string, createdBy?: string): Promise<void> {
  const normalized = normalizeTagName(alias);
  if (!normalized) return;

  const { data: existing } = await supabase
    .from('tag_aliases')
    .select('id')
    .eq('identity_id', identityId)
    .eq('normalized_alias', normalized)
    .limit(1);
  if (existing && existing.length > 0) return;

  await supabase.from('tag_aliases').insert({
    identity_id: identityId,
    alias: alias.trim(),
    normalized_alias: normalized,
    created_by: createdBy || null,
  });
}

/** Search tag identities by name (canonical or alias), any type. For "find yourself" / credit search. */
export async function searchTagIdentities(query: string): Promise<TagIdentityRecord[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const safe = (s: string) => s.replace(/'/g, "''");
  const trimQ = query.trim();
  const seen = new Set<string>();
  const out: TagIdentityRecord[] = [];

  const { data: byCanonical } = await supabase
    .from('tag_identities')
    .select('id, tag_type, canonical_name')
    .ilike('canonical_name', `%${safe(trimQ)}%`)
    .limit(15);
  (byCanonical || []).forEach((row: TagIdentityRecord) => {
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
  (byNormalized || []).forEach((row: TagIdentityRecord) => {
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
      .limit(15);
    (identities || []).forEach((row: TagIdentityRecord) => {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        out.push(row);
      }
    });
  }

  return out.slice(0, 15);
}

const EVENT_TAG_COLUMNS: { key: keyof EventTagSource; tagType: TagType }[] = [
  { key: 'producers', tagType: 'producer' },
  { key: 'featured_designers', tagType: 'designer' },
  { key: 'models', tagType: 'model' },
  { key: 'hair_makeup', tagType: 'hair_makeup' },
  { key: 'header_tags', tagType: 'header_tags' },
  { key: 'footer_tags', tagType: 'footer_tags' },
];

interface EventTagSource {
  producers?: string[] | null;
  featured_designers?: string[] | null;
  models?: string[] | null;
  hair_makeup?: string[] | null;
  header_tags?: string[] | null;
  footer_tags?: string[] | null;
}

/** Search tags from events (producers, designers, etc.). Use when tag_identities is empty or doesn't have the tag yet. */
export async function searchEventTags(query: string): Promise<Pick<TagIdentityRecord, 'tag_type' | 'canonical_name'>[]> {
  const q = normalizeTagName(query);
  if (!q || q.length < 2) return [];

  const { data: events, error } = await supabase
    .from('events')
    .select('producers, featured_designers, models, hair_makeup, header_tags, footer_tags')
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
  }

  return Array.from(seen.values()).slice(0, 15);
}
