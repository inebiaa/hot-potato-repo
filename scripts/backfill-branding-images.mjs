/**
 * Rehost app branding image URLs (icon/logo/favicon) into `branding-images`.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL (or SUPABASE_URL).
 * Run: node scripts/backfill-branding-images.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'branding-images';
const MARKER = `/storage/v1/object/public/${BUCKET}/`;
const MAX_BYTES = 5 * 1024 * 1024;
const KEY_TO_SLOT = {
  app_icon_url: 'icon',
  app_logo_url: 'logo',
  app_favicon_url: 'favicon',
};

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: 'image/jpeg', ext: 'jpg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { contentType: 'image/png', ext: 'png' };
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
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

function extForContentType(ct) {
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('gif')) return 'gif';
  if (ct.includes('icon')) return 'ico';
  return 'jpg';
}

async function fetchImage(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'SecretBloggerBrandingImageBackfill/1.0',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  let contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (!bytes.byteLength) throw new Error('Empty body');
  if (bytes.byteLength > MAX_BYTES) throw new Error(`Too large (${bytes.byteLength} bytes)`);
  const sniffed = sniffImage(bytes);
  if (!contentType.startsWith('image/')) {
    if (!sniffed) throw new Error(`Not an image (${contentType || 'no type'})`);
    contentType = sniffed.contentType;
  }
  const ext = sniffed?.ext || extForContentType(contentType);
  return { bytes, contentType: sniffed?.contentType || contentType, ext };
}

async function main() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', Object.keys(KEY_TO_SLOT));
  if (error) throw error;

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const row of data || []) {
    const slot = KEY_TO_SLOT[row.key];
    const source = String(row.value || '').trim();
    if (!source) {
      console.log(`${row.key}: empty — skip`);
      skip++;
      continue;
    }
    if (source.includes(MARKER)) {
      console.log(`${row.key}: already stored — skip`);
      skip++;
      continue;
    }

    try {
      const { bytes, contentType, ext } = await fetchImage(source);
      const path = `${slot}/${randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType,
        upsert: false,
        cacheControl: '31536000',
      });
      if (uploadError) throw new Error(uploadError.message || 'upload failed');
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!pub?.publicUrl) throw new Error('no public url');
      const { error: updateError } = await supabase
        .from('app_settings')
        .upsert(
          { key: row.key, value: pub.publicUrl, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (updateError) throw new Error(updateError.message || 'db update failed');
      console.log(`${row.key}: ok → ${path}`);
      ok++;
    } catch (err) {
      console.log(`${row.key}: ERROR ${err instanceof Error ? err.message : String(err)}`);
      fail++;
    }
  }

  console.log(`Done — ok=${ok} skip=${skip} error=${fail}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
