#!/usr/bin/env node
/**
 * Compress stored event-images locally (Node + imagescript), upload via edge function.
 */
import { createClient } from '@supabase/supabase-js';
import { compressEventPhoto } from './compress-event-photo.mjs';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL ||
  'https://uhljagzmwnsqpkasqfyn.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVobGphZ3ptd25zcXBrYXNxZnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzUxMDEsImV4cCI6MjA4NzY1MTEwMX0.AHA56nDM0LGqNqpKAU7WzBtk6_ssq026zjoJHqNk-CQ';
const SAVE_URL = `${SUPABASE_URL}/functions/v1/save-compressed-event-image`;
const TOKEN = process.env.RECOMPRESS_TOKEN || 'sb-recompress-augl6-9k2m';
const BUCKET = 'event-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.CONCURRENCY || 4) || 4));
const LIMIT = Math.max(0, Number(process.env.LIMIT || 0) || 0);
const DRY_RUN = process.env.DRY_RUN === '1';

const supabase = createClient(SUPABASE_URL, ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function storagePathFromUrl(url) {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf(MARKER);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + MARKER.length)) || null;
  } catch {
    return null;
  }
}

async function saveCompressed(oldUrl, storagePath, bytes) {
  const res = await fetch(SAVE_URL, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: TOKEN,
      oldUrl,
      storagePath,
      jpegBase64: Buffer.from(bytes).toString('base64'),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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

  const alreadyJpeg = /\.jpe?g$/i.test(path);
  const nextPath = alreadyJpeg ? path : `${path.replace(/\.[^./]+$/, '')}.jpg`;

  if (DRY_RUN) {
    return {
      url: item.url,
      status: 'dry-run',
      from: original.byteLength,
      to: compressed.bytes.byteLength,
    };
  }

  await saveCompressed(item.url, nextPath, compressed.bytes);
  return {
    url: item.url,
    status: 'ok',
    from: original.byteLength,
    to: compressed.bytes.byteLength,
    path: nextPath,
  };
}

async function main() {
  const byUrl = new Map();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('events')
      .select('id, image_url')
      .not('image_url', 'is', null)
      .neq('image_url', '')
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const url = String(row.image_url || '').trim();
      if (!url.includes(MARKER)) continue;
      const existing = byUrl.get(url);
      if (existing) existing.eventIds.push(row.id);
      else byUrl.set(url, { url, eventIds: [row.id] });
    }
    if (data.length < 1000) break;
    from += 1000;
  }

  const all = [...byUrl.values()];
  const queue = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  console.log(
    `Recompress (local): ${queue.length} stored URL(s)` +
      (DRY_RUN ? ' [DRY RUN]' : '') +
      ` concurrency=${CONCURRENCY}`,
  );

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
    for (const f of failed.slice(0, 20)) {
      console.log(`  error ${f.url}: ${f.reason}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
