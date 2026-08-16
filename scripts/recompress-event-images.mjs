/**
 * Recompress stored event-images that are larger than card size (1200px / JPEG).
 *
 * Requires:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   node scripts/recompress-event-images.mjs
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
import { compressEventPhoto } from './compress-event-photo.mjs';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/$/,
  '',
);
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'event-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
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

function storagePathFromUrl(url) {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(MARKER);
    if (idx === -1) return null;
    const path = decodeURIComponent(u.pathname.slice(idx + MARKER.length));
    return path || null;
  } catch {
    return null;
  }
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
          url: items[idx]?.url,
          status: 'error',
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

async function recompressOne(item) {
  const path = storagePathFromUrl(item.url);
  if (!path) return { url: item.url, status: 'skip', reason: 'not-stored' };

  const res = await fetch(item.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const original = new Uint8Array(await res.arrayBuffer());
  if (!original.byteLength) throw new Error('empty');

  const compressed = await compressEventPhoto(original);
  if (!compressed) {
    return { url: item.url, status: 'skip', reason: 'no-savings', bytes: original.byteLength };
  }

  if (DRY_RUN) {
    return {
      url: item.url,
      status: 'dry-run',
      from: original.byteLength,
      to: compressed.bytes.byteLength,
    };
  }

  const alreadyJpeg = /\.jpe?g$/i.test(path);
  const nextPath = alreadyJpeg ? path : `${path.replace(/\.[^./]+$/, '')}.jpg`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(nextPath, compressed.bytes, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  });
  if (uploadError) throw new Error(uploadError.message || 'upload failed');

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(nextPath);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('no public url');

  if (publicUrl !== item.url) {
    const { error: updateError } = await supabase
      .from('events')
      .update({ image_url: publicUrl })
      .eq('image_url', item.url);
    if (updateError) throw new Error(updateError.message || 'db update failed');
  }

  return {
    url: item.url,
    status: 'ok',
    path: nextPath,
    from: original.byteLength,
    to: compressed.bytes.byteLength,
    events: item.eventIds.length,
  };
}

async function main() {
  const pageSize = 1000;
  let from = 0;
  const byUrl = new Map();

  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const url = String(row.image_url || '').trim();
      if (!url.includes(MARKER)) continue;
      const existing = byUrl.get(url);
      if (existing) existing.eventIds.push(row.id);
      else byUrl.set(url, { url, eventIds: [row.id] });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const all = [...byUrl.values()];
  const queue = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  console.log(
    `Recompress: ${queue.length} of ${all.length} stored image URL(s)` +
      (DRY_RUN ? ' [DRY RUN]' : '') +
      ` (concurrency=${CONCURRENCY})`,
  );

  if (!queue.length) {
    console.log('Nothing to do.');
    return;
  }

  const started = Date.now();
  const results = await mapPool(queue, CONCURRENCY, recompressOne);
  const ok = results.filter((r) => r.status === 'ok');
  const skipped = results.filter((r) => r.status === 'skip' || r.status === 'dry-run');
  const failed = results.filter((r) => r.status === 'error');
  const saved = ok.reduce((sum, r) => sum + Math.max(0, (r.from || 0) - (r.to || 0)), 0);

  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ok=${ok.length} skip=${skipped.length} error=${failed.length} saved=${(saved / 1024 / 1024).toFixed(1)}MB`,
  );
  if (failed.length) {
    console.log('Failures (up to 40):');
    for (const f of failed.slice(0, 40)) {
      console.log(`  ${f.url}: ${f.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
