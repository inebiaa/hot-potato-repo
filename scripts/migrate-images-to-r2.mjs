/**
 * Copy hosted photos from Supabase Storage (or leftover hotlinks) onto Cloudflare R2.
 *
 * Requires .env:
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_BASE_URL
 *
 * Run:
 *   node scripts/migrate-images-to-r2.mjs
 *
 * Optional:
 *   LIMIT=50
 *   CONCURRENCY=3
 *   DRY_RUN=1
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compressEventPhoto, encodeEventCardJpeg } from './compress-event-photo.mjs';
import { isCdnUrl, pairedCardKey, r2Put } from './lib/r2.mjs';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const MAX_BYTES = 5 * 1024 * 1024;
const LIMIT = Math.max(0, Number(process.env.LIMIT || 0) || 0);
const CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.CONCURRENCY || 3) || 3));
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function fetchBytes(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'SecretBloggerImageMigrate/1.0',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.byteLength) throw new Error('Empty body');
  if (bytes.byteLength > MAX_BYTES) throw new Error(`Too large (${bytes.byteLength})`);
  const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  return { bytes, contentType };
}

async function mapPool(items, concurrency, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      try {
        results[idx] = await fn(items[idx]);
      } catch (err) {
        results[idx] = {
          id: items[idx]?.id,
          status: 'error',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function putEventImage(source, owner) {
  const fetched = await fetchBytes(source);
  const compressed = await compressEventPhoto(fetched.bytes);
  const bytes = compressed?.bytes ?? fetched.bytes;
  const contentType = compressed?.contentType ?? fetched.contentType;
  const ext = compressed?.ext || 'jpg';
  const key = `event/${owner}/${crypto.randomUUID()}.${ext}`;
  const url = await r2Put(key, bytes, contentType);
  const card = await encodeEventCardJpeg(bytes);
  await r2Put(pairedCardKey(key), card?.bytes ?? bytes, card?.contentType ?? contentType);
  return url;
}

async function putSimpleImage(source, keyPrefix, forceJpeg) {
  const fetched = await fetchBytes(source);
  let bytes = fetched.bytes;
  let contentType = fetched.contentType || 'image/jpeg';
  let ext = 'jpg';
  if (forceJpeg) {
    const compressed = await compressEventPhoto(bytes);
    bytes = compressed?.bytes ?? bytes;
    contentType = compressed?.contentType ?? 'image/jpeg';
    ext = 'jpg';
  } else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('webp')) ext = 'webp';
  else if (contentType.includes('gif')) ext = 'gif';
  else if (contentType.includes('icon')) ext = 'ico';
  const key = `${keyPrefix}/${crypto.randomUUID()}.${ext}`;
  return r2Put(key, bytes, contentType);
}

async function migrateEvents() {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select('id, image_url, created_by')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (!isCdnUrl(row.image_url)) rows.push(row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const queue = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`Events: ${queue.length} of ${rows.length} not on CDN` + (DRY_RUN ? ' [DRY RUN]' : ''));

  const results = await mapPool(queue, CONCURRENCY, async (row) => {
    const source = String(row.image_url || '').trim();
    if (!source) return { id: row.id, status: 'skip', reason: 'empty' };
    if (DRY_RUN) return { id: row.id, status: 'dry-run', source };
    const owner = row.created_by || 'migrate';
    const url = await putEventImage(source, owner);
    const { error } = await supabase.from('events').update({ image_url: url }).eq('id', row.id);
    if (error) throw new Error(error.message);
    return { id: row.id, status: 'ok', url };
  });
  summarize('events', results);
}

async function migrateProfiles() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id, avatar_url, cover_image_url');
  if (error) throw error;
  const jobs = [];
  for (const row of data || []) {
    if (row.avatar_url && !isCdnUrl(row.avatar_url)) {
      jobs.push({ userId: row.user_id, field: 'avatar_url', url: row.avatar_url, kind: 'profile' });
    }
    if (row.cover_image_url && !isCdnUrl(row.cover_image_url)) {
      jobs.push({
        userId: row.user_id,
        field: 'cover_image_url',
        url: row.cover_image_url,
        kind: 'cover',
      });
    }
  }
  const queue = LIMIT > 0 ? jobs.slice(0, LIMIT) : jobs;
  console.log(`Profiles: ${queue.length} image(s)` + (DRY_RUN ? ' [DRY RUN]' : ''));
  const results = await mapPool(queue, CONCURRENCY, async (job) => {
    if (DRY_RUN) return { id: job.userId, status: 'dry-run' };
    const prefix = job.kind === 'cover' ? `profile/${job.userId}` : `profile/${job.userId}`;
    const url = await putSimpleImage(job.url, prefix, true);
    const { error: updError } = await supabase
      .from('user_profiles')
      .update({ [job.field]: url })
      .eq('user_id', job.userId);
    if (updError) throw new Error(updError.message);
    return { id: job.userId, status: 'ok' };
  });
  summarize('profiles', results);
}

async function migrateListCovers() {
  const { data, error } = await supabase
    .from('user_lists')
    .select('id, user_id, cover_image_url')
    .not('cover_image_url', 'is', null)
    .neq('cover_image_url', '');
  if (error) throw error;
  const rows = (data || []).filter((row) => !isCdnUrl(row.cover_image_url));
  const queue = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`List covers: ${queue.length}` + (DRY_RUN ? ' [DRY RUN]' : ''));
  const results = await mapPool(queue, CONCURRENCY, async (row) => {
    if (DRY_RUN) return { id: row.id, status: 'dry-run' };
    const url = await putSimpleImage(row.cover_image_url, `list/${row.user_id || 'list'}`, true);
    const { error: updError } = await supabase
      .from('user_lists')
      .update({ cover_image_url: url })
      .eq('id', row.id);
    if (updError) throw new Error(updError.message);
    return { id: row.id, status: 'ok' };
  });
  summarize('list-covers', results);
}

async function migrateBranding() {
  const keys = ['app_icon_url', 'app_logo_url', 'app_favicon_url'];
  const slots = { app_icon_url: 'icon', app_logo_url: 'logo', app_favicon_url: 'favicon' };
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', keys);
  if (error) throw error;
  const rows = (data || []).filter((row) => String(row.value || '').trim() && !isCdnUrl(row.value));
  console.log(`Branding: ${rows.length}` + (DRY_RUN ? ' [DRY RUN]' : ''));
  for (const row of rows) {
    const source = String(row.value || '').trim();
    if (DRY_RUN) {
      console.log(`  dry-run ${row.key} ${source}`);
      continue;
    }
    const slot = slots[row.key] || 'misc';
    const url = await putSimpleImage(source, `brand/${slot}`, false);
    const { error: updError } = await supabase
      .from('app_settings')
      .update({ value: url, updated_at: new Date().toISOString() })
      .eq('key', row.key);
    if (updError) throw new Error(updError.message);
    console.log(`  ok ${row.key}`);
  }
}

function summarize(label, results) {
  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skip' || r.status === 'dry-run').length;
  const failed = results.filter((r) => r.status === 'error');
  console.log(`  ${label}: ok=${ok} skip=${skipped} error=${failed.length}`);
  for (const f of failed.slice(0, 20)) {
    console.log(`    ${f.id}: ${f.reason}`);
  }
}

async function main() {
  await migrateEvents();
  await migrateProfiles();
  await migrateListCovers();
  await migrateBranding();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
