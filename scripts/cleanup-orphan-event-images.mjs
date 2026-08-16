#!/usr/bin/env node
/**
 * Remove event-images Storage objects not referenced by any events.image_url.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ||
  'https://uhljagzmwnsqpkasqfyn.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobGphZ3ptd25zcXBrYXNxZnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzUxMDEsImV4cCI6MjA4NzY1MTEwMX0.AHA56nDM0LGqNqpKAU7WzBtk6_ssq026zjoJHqNk-CQ';
const DELETE_URL = `${SUPABASE_URL}/functions/v1/cleanup-orphan-event-images`;
const TOKEN = process.env.RECOMPRESS_TOKEN || 'sb-recompress-augl6-9k2m';
const BUCKET = 'event-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const DRY_RUN = process.env.DRY_RUN === '1';

const supabase = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function pathFromImageUrl(url) {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(MARKER);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + MARKER.length)) || null;
  } catch {
    return null;
  }
}

async function listAllObjectPaths() {
  const paths = [];
  const { data: roots, error: rootError } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
  });
  if (rootError) throw rootError;

  for (const entry of roots || []) {
    if (!entry?.name) continue;
    const prefix = entry.name;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
        limit: 1000,
        offset,
      });
      if (error) throw error;
      if (!data?.length) break;
      for (const file of data) {
        if (!file?.name || !file.id) continue;
        paths.push(`${prefix}/${file.name}`);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return paths;
}

async function referencedPaths() {
  const referenced = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select('image_url')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const path = pathFromImageUrl(String(row.image_url || '').trim());
      if (path) referenced.add(path);
    }
    if (data.length < 1000) break;
    from += 1000;
  }
  return referenced;
}

async function deletePaths(paths) {
  const res = await fetch(DELETE_URL, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: TOKEN, paths, dryRun: DRY_RUN }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function main() {
  const [allPaths, referenced] = await Promise.all([listAllObjectPaths(), referencedPaths()]);
  const orphans = allPaths.filter((p) => !referenced.has(p));
  console.log(
    `Found ${orphans.length} orphan(s) of ${allPaths.length} object(s); ${referenced.size} referenced URL(s)` +
      (DRY_RUN ? ' [DRY RUN]' : ''),
  );
  if (!orphans.length) return;

  const result = await deletePaths(orphans);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
