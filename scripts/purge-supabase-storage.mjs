/**
 * Delete all objects from legacy public Supabase Storage buckets after R2 migration.
 *
 * Requires .env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/purge-supabase-storage.mjs
 *   DRY_RUN=1 node scripts/purge-supabase-storage.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const BUCKETS = ['event-images', 'profile-images', 'list-covers', 'branding-images'];
const BATCH = 100;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listPrefix(bucketId, prefix) {
  const paths = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucketId).list(prefix, {
      limit: 1000,
      offset,
    });
    if (error) throw error;
    if (!data?.length) break;

    for (const entry of data) {
      if (!entry?.name) continue;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folders have null id in Storage list API; files have an id.
      if (entry.id == null) {
        const nested = await listPrefix(bucketId, path);
        paths.push(...nested);
      } else {
        paths.push(path);
      }
    }

    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

async function purgeBucket(bucketId) {
  const paths = await listPrefix(bucketId, '');
  console.log(`${bucketId}: ${paths.length} object(s)`);
  if (!paths.length) return { deleted: 0, failed: 0 };

  if (DRY_RUN) {
    console.log(`  DRY_RUN: would delete ${Math.min(3, paths.length)} sample(s):`, paths.slice(0, 3));
    return { deleted: 0, failed: 0 };
  }

  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < paths.length; i += BATCH) {
    const chunk = paths.slice(i, i + BATCH);
    const { data, error } = await supabase.storage.from(bucketId).remove(chunk);
    if (error) {
      console.error(`  remove batch failed at ${i}:`, error.message);
      failed += chunk.length;
      continue;
    }
    deleted += data?.length ?? chunk.length;
    console.log(`  deleted ${deleted}/${paths.length}`);
  }
  return { deleted, failed };
}

async function makeBucketsPrivate() {
  if (DRY_RUN) {
    console.log('DRY_RUN: would set buckets public=false via Management API skip (use SQL)');
    return;
  }

  // storage.buckets is not exposed to PostgREST; use REST Storage admin endpoint.
  for (const bucket of BUCKETS) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public: false }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to privatize ${bucket}: ${res.status} ${text}`);
    }
    console.log(`Set ${bucket} public=false`);
  }
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN' : 'LIVE PURGE');
  let totalDeleted = 0;
  let totalFailed = 0;
  for (const bucket of BUCKETS) {
    const { deleted, failed } = await purgeBucket(bucket);
    totalDeleted += deleted;
    totalFailed += failed;
  }
  await makeBucketsPrivate();
  console.log(`Done. deleted=${totalDeleted} failed=${totalFailed}`);
  if (totalFailed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
