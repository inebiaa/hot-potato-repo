/**
 * Rehost external event image_url values into the `event-images` Storage bucket.
 *
 * Requires:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/backfill-event-images.mjs
 *
 * Optional:
 *   LIMIT=50          — max events this run
 *   CONCURRENCY=4     — parallel downloads
 *   DRY_RUN=1         — list only, no writes
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'event-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const MAX_BYTES = 5 * 1024 * 1024;
const LIMIT = Math.max(0, Number(process.env.LIMIT || 0) || 0);
const CONCURRENCY = Math.max(1, Math.min(8, Number(process.env.CONCURRENCY || 4) || 4));
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function isAlreadyStored(url) {
  return typeof url === 'string' && url.includes(MARKER);
}

function extForContentType(ct) {
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  return 'jpg';
}

function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: 'image/png', ext: 'png' };
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    return { contentType: 'image/gif', ext: 'gif' };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: 'image/webp', ext: 'webp' };
  }
  return null;
}

async function fetchImage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'SecretBloggerEventImageBackfill/1.0',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.byteLength) throw new Error('Empty body');
  if (bytes.byteLength > MAX_BYTES) throw new Error(`Too large (${bytes.byteLength} bytes)`);

  const sniffed = sniffImage(bytes);
  if (!contentType.startsWith('image/')) {
    if (!sniffed) throw new Error(`Not an image (${contentType || 'no content-type'})`);
    contentType = sniffed.contentType;
  } else if (
    !['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'].includes(contentType)
  ) {
    if (!sniffed) throw new Error(`Unsupported type ${contentType}`);
    contentType = sniffed.contentType;
  }

  const ext = sniffed?.ext || extForContentType(contentType);
  return { bytes, contentType, ext };
}

async function backfillOne(row) {
  const source = String(row.image_url || '').trim();
  if (!source) return { id: row.id, status: 'skip', reason: 'empty' };
  if (isAlreadyStored(source)) return { id: row.id, status: 'skip', reason: 'already-stored' };

  if (DRY_RUN) return { id: row.id, status: 'dry-run', source };

  const { bytes, contentType, ext } = await fetchImage(source);
  const owner = row.created_by || 'backfill';
  const path = `${owner}/${row.id}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: '31536000',
  });
  if (uploadError) throw new Error(uploadError.message || 'upload failed');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('no public url');

  const { error: updateError } = await supabase
    .from('events')
    .update({ image_url: publicUrl })
    .eq('id', row.id);
  if (updateError) throw new Error(updateError.message || 'db update failed');

  return { id: row.id, status: 'ok', path, bytes: bytes.byteLength };
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

async function main() {
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
      if (!isAlreadyStored(row.image_url)) rows.push(row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const queue = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(
    `Backfill: ${queue.length} of ${rows.length} external image(s)` +
      (DRY_RUN ? ' [DRY RUN]' : '') +
      ` (concurrency=${CONCURRENCY})`
  );

  if (!queue.length) {
    console.log('Nothing to do.');
    return;
  }

  const started = Date.now();
  const results = await mapPool(queue, CONCURRENCY, backfillOne);

  const ok = results.filter((r) => r.status === 'ok').length;
  const skipped = results.filter((r) => r.status === 'skip' || r.status === 'dry-run').length;
  const failed = results.filter((r) => r.status === 'error');

  console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ok=${ok} skip=${skipped} error=${failed.length}`);
  if (failed.length) {
    console.log('Failures (up to 40):');
    for (const f of failed.slice(0, 40)) {
      console.log(`  ${f.id}: ${f.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
