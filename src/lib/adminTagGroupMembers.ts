import { supabase } from './supabase';

export type AdminTagGroupMember = { id: string; canonical_name: string };

function missingCol(msg: string, col: 'cluster_id' | 'links_to_identity_id') {
  return new RegExp(`${col}.*does not exist`, 'i').test(msg);
}

/**
 * Walks a links_to "tree" (parent edges) to collect the whole connected component, same tag_type only.
 */
async function linkTreeMembers(identityId: string, tagType: string): Promise<AdminTagGroupMember[] | 'no_links_col'> {
  const map = new Map<string, { id: string; canonical_name: string }>();
  const queue: string[] = [identityId];
  let i = 0;
  const max = 200;
  while (i < queue.length && map.size < max) {
    const id = queue[i++];
    if (map.has(id)) continue;
    const { data, error } = await supabase
      .from('tag_identities')
      .select('id, canonical_name, links_to_identity_id, tag_type')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      if (missingCol(error.message, 'links_to_identity_id')) {
        return 'no_links_col';
      }
      continue;
    }
    if (!data) continue;
    const row = data as { id: string; canonical_name: string; tag_type: string; links_to_identity_id?: string | null };
    if (row.tag_type !== tagType) continue;
    map.set(id, { id, canonical_name: row.canonical_name });
    if (row.links_to_identity_id) {
      queue.push(row.links_to_identity_id);
    }
    const { data: ch, error: chErr } = await supabase
      .from('tag_identities')
      .select('id, tag_type')
      .eq('links_to_identity_id', id)
      .eq('tag_type', tagType);
    if (chErr) {
      if (missingCol(chErr.message, 'links_to_identity_id')) {
        return 'no_links_col';
      }
    } else {
      for (const c of ch || []) {
        const cid = (c as { id: string }).id;
        if (!map.has(cid)) queue.push(cid);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
}

/**
 * All identities shown together in admin for “same person”. Prefers `cluster_id` when the column exists;
 * otherwise walks `links_to_identity_id` if present.
 */
export async function loadAdminTagGroupMembers(
  r: { id: string; canonical_name: string; tag_type: string; cluster_id?: string },
  alsoPartnerId?: string
): Promise<{
  members: AdminTagGroupMember[];
  errorMessage: string | null;
}> {
  const groupId = r.cluster_id ?? r.id;
  const tagType = r.tag_type;
  // All linked rows share `cluster_id`; `eq` alone is symmetric. The old `or(id.eq…)` is redundant
  // and can interact badly with PostgREST in edge cases.
  const r2 = await supabase
    .from('tag_identities')
    .select('id, canonical_name')
    .eq('tag_type', tagType)
    .eq('cluster_id', groupId)
    .order('canonical_name', { ascending: true });

  if (!r2.error) {
    const byId = new Map<string, AdminTagGroupMember>();
    (r2.data || []).forEach((x) => {
      const t = x as { id: string; canonical_name: string };
      byId.set(t.id, t);
    });
    byId.set(r.id, { id: r.id, canonical_name: r.canonical_name });
    let members = Array.from(byId.values()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
    if (alsoPartnerId && !members.some((m) => m.id === alsoPartnerId)) {
      const { data: p, error: pErr } = await supabase
        .from('tag_identities')
        .select('id, canonical_name, cluster_id, tag_type')
        .eq('id', alsoPartnerId)
        .maybeSingle();
      if (!pErr && p) {
        const pr = p as { id: string; cluster_id?: string; canonical_name: string; tag_type: string };
        if (pr.tag_type === tagType) {
          const pCluster = pr.cluster_id ?? pr.id;
          if (pCluster === groupId) {
            if (!byId.has(pr.id)) {
              byId.set(pr.id, { id: pr.id, canonical_name: pr.canonical_name });
              members = Array.from(byId.values()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
            }
          }
        }
      }
    }
    return { members, errorMessage: null };
  }

  if (!r2.error?.message || !missingCol(r2.error.message, 'cluster_id')) {
    return {
      members: [{ id: r.id, canonical_name: r.canonical_name }],
      errorMessage: r2.error?.message
        ? `Could not load linked group: ${r2.error.message}`
        : 'Could not load linked group.',
    };
  }

  const graph = await linkTreeMembers(r.id, tagType);
  if (graph === 'no_links_col') {
    return {
      members: [{ id: r.id, canonical_name: r.canonical_name }],
      errorMessage:
        'This database is missing tag_identities.cluster_id. In Supabase SQL, run the migrations in order: first supabase/migrations/20260422120000_tag_identity_link_graph.sql, then supabase/migrations/20260424120000_tag_identity_symmetric_cluster.sql (or use: supabase db push on a project linked to this repo).',
    };
  }
  let members = graph;
  if (!members.length) {
    members = [{ id: r.id, canonical_name: r.canonical_name }];
  }
  if (alsoPartnerId && !members.some((m) => m.id === alsoPartnerId)) {
    const g2 = await linkTreeMembers(alsoPartnerId, tagType);
    if (g2 !== 'no_links_col' && g2.length) {
      const aIds = new Set(members.map((m) => m.id));
      if (g2.some((m) => aIds.has(m.id))) {
        const by = new Map<string, AdminTagGroupMember>();
        for (const m of members) by.set(m.id, m);
        for (const m of g2) if (!by.has(m.id)) by.set(m.id, m);
        members = Array.from(by.values()).sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
      }
    }
  }
  return { members, errorMessage: null };
}
