/**
 * Verifies production event URLs return prerendered Event JSON-LD (same checks Google needs in HTML).
 *
 * Discovery order:
 * 1. EVENT_URL env
 * 2. First /event/ URL from SITE/sitemap.xml
 * 3. If .env has VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, fetch one event id and use SITE/event/{id}
 *
 * Run: npm run verify:jsonld
 * Optional: EVENT_URL=https://www.secretblogger.app/event/<uuid> npm run verify:jsonld
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
config({ path: resolve(repoRoot, '.env') });

const SITE = (process.env.SITE_URL || process.env.VITE_PUBLIC_SITE_URL || 'https://www.secretblogger.app').replace(
  /\/$/,
  ''
);

function extractJsonLd(html) {
  const re =
    /<script([^>]*id=["']secret-blogger-event-jsonld["'][^>]*)>([\s\S]*?)<\/script>|<script([^>]*type=["']application\/ld\+json["'][^>]*id=["']secret-blogger-event-jsonld["'][^>]*)>([\s\S]*?)<\/script>/i;
  let m = html.match(re);
  if (m) return m[2] || m[4];
  const all = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
  for (const [, attrs, body] of all) {
    if (attrs.includes('secret-blogger-event-jsonld') && attrs.includes('application/ld+json')) {
      return body;
    }
  }
  return null;
}

function validateJsonLd(data) {
  const t = data['@type'];
  if (t !== 'Event' && t !== 'https://schema.org/Event') {
    throw new Error(`@type is not Event: ${t}`);
  }
  if (!data.name || !data.startDate) {
    throw new Error('missing name or startDate');
  }
  if (!data.location || typeof data.location !== 'object') {
    throw new Error('missing location');
  }
}

/** Link previews (email, Slack): prerendered head should include Open Graph basics. */
function validateOgMeta(html) {
  if (!/<meta\s[^>]*property=["']og:title["'][^>]*>/i.test(html)) {
    throw new Error('missing og:title meta');
  }
  if (!/<meta\s[^>]*property=["']og:url["'][^>]*>/i.test(html)) {
    throw new Error('missing og:url meta');
  }
}

async function discoverEventUrl() {
  if (process.env.EVENT_URL?.trim()) {
    return process.env.EVENT_URL.trim();
  }

  const smRes = await fetch(`${SITE}/sitemap.xml`);
  if (smRes.ok) {
    const sm = await smRes.text();
    const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    const eventUrl = locs.find((u) => u.includes('/event/'));
    if (eventUrl) return eventUrl;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    const client = createClient(url, key);
    const { data, error } = await client.from('events').select('id').limit(1);
    if (!error && data?.length) {
      return `${SITE}/event/${data[0].id}`;
    }
  }

  return null;
}

async function main() {
  const eventUrl = await discoverEventUrl();
  if (!eventUrl) {
    console.error(
      'FAIL: No event URL to check. Set EVENT_URL, or deploy sitemap.xml, or add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY to .env'
    );
    process.exit(1);
  }

  let html;
  const pageRes = await fetch(eventUrl, { redirect: 'follow' });
  if (pageRes.ok) {
    html = await pageRes.text();
  } else if (pageRes.status === 404) {
    const id = eventUrl.split('/event/')[1]?.replace(/\/$/, '');
    const localPath = id ? resolve(repoRoot, 'dist', 'event', id, 'index.html') : '';
    if (localPath && existsSync(localPath)) {
      console.warn(`WARN: live URL returned 404 (not deployed yet?). Verifying local build: ${localPath}`);
      html = readFileSync(localPath, 'utf8');
    } else {
      console.error(`FAIL: event page HTTP ${pageRes.status} ${eventUrl}`);
      console.error('      Run `npm run build` with Supabase env, deploy dist/, or set VERIFY_LOCAL after build.');
      process.exit(1);
    }
  } else {
    console.error(`FAIL: event page HTTP ${pageRes.status} ${eventUrl}`);
    process.exit(1);
  }
  const raw = extractJsonLd(html);
  if (!raw) {
    console.error('FAIL: no prerendered script#secret-blogger-event-jsonld (application/ld+json) in HTML');
    console.error('      Deploy a build where staticSitePlugin ran (Supabase env at build time).');
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(raw.trim());
  } catch (e) {
    console.error('FAIL: JSON-LD parse error', e);
    process.exit(1);
  }
  try {
    validateJsonLd(data);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }

  try {
    validateOgMeta(html);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }

  console.log('OK: Event JSON-LD + Open Graph (og:title, og:url) present in first HTML response.');
  console.log('    URL:', eventUrl);
  console.log('    name:', data.name);
  console.log('    startDate:', data.startDate);
  console.log('    Next: open Rich Results Test with this URL and confirm “Event” items (future dates help).');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
