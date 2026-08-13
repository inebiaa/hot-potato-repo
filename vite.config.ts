import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Plugin } from 'vite'
import type { Event } from './src/lib/eventTypes'
import { canonicalEventUrlFromParts, canonicalListUrlFromParts } from './src/lib/siteBase'
import { eventJsonLdScriptContentPrerender } from './src/lib/eventJsonLd'
import { buildEventSocialMetaTagsHtml, stripSiteSocialFromHtml } from './src/lib/eventSocialMeta'
import {
  buildListSocialMetaTagsHtml,
  listJsonLdScriptContentPrerender,
  type ListSharePayload,
} from './src/lib/listSocialMeta'
import {
  applyBrandDescriptionToSiteHtml,
  applyBrandShareImageToSiteHtml,
  brandShareImageUrl,
} from './src/lib/brandSocial'

const APP_NAME = (process.env.VITE_APP_NAME || 'Secret Blogger').trim() || 'Secret Blogger'
const APP_DESCRIPTION =
  (process.env.VITE_APP_DESCRIPTION || 'Discover, rate, and review fashion and music shows from around the world.').trim() ||
  'Discover, rate, and review fashion and music shows from around the world.'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function escapeTitleText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const SHARE_MIRROR_MAX_BYTES = 1_800_000

function shareExtFromContentType(ct: string): string {
  const t = ct.split(';')[0].trim().toLowerCase()
  if (t.includes('png')) return '.png'
  if (t.includes('webp')) return '.webp'
  if (t.includes('gif')) return '.gif'
  return '.jpg'
}

function shareExtFromUrl(url: string): string {
  try {
    const ext = extname(new URL(url).pathname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext
    }
  } catch {
    /* ignore */
  }
  return '.jpg'
}

/**
 * Copy a remote image into dist/share/… so crawlers fetch it from our site origin
 * (more reliable for iMessage/Slack/Facebook than hotlinked Storage URLs).
 */
async function mirrorShareImage(
  sourceUrl: string,
  destPathWithoutExt: string,
): Promise<string | null> {
  const src = sourceUrl.trim()
  if (!src || !/^https?:\/\//i.test(src)) return null
  try {
    const res = await fetch(src, {
      redirect: 'follow',
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'SecretBloggerShareMirror/1.0',
      },
    })
    if (!res.ok) return null
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.byteLength || buf.byteLength > SHARE_MIRROR_MAX_BYTES) return null
    const ext = contentType.startsWith('image/')
      ? shareExtFromContentType(contentType)
      : shareExtFromUrl(src)
    const filePath = `${destPathWithoutExt}${ext}`
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, buf)
    const marker = `${resolve(process.cwd(), 'dist')}`
    const rel = filePath.startsWith(marker)
      ? filePath.slice(marker.length).replace(/\\/g, '/').replace(/^\//, '')
      : `share/${filePath.split(/[/\\]/).pop()}`
    return rel
  } catch {
    return null
  }
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return results
}

/** JSON-LD safe inside <script> (prevents closing script if event text contains HTML). */
function jsonLdForHtml(json: string): string {
  return json.replace(/</g, '\\u003c')
}

function injectEventSeoShell(
  indexHtml: string,
  event: Event,
  site: string,
  viteBase: string,
  brandImageUrl?: string,
  shareImageUrl?: string,
): string {
  const prerender = { siteOrigin: site, viteBase, brandImageUrl, shareImageUrl }
  const canonical = canonicalEventUrlFromParts(event.id, site, viteBase)
  const jsonLd = jsonLdForHtml(eventJsonLdScriptContentPrerender(event, prerender))
  const socialMeta = buildEventSocialMetaTagsHtml(event, prerender)
  const title = `${event.name} | ${APP_NAME}`
  // Drop homepage OG + canonical so scrapers only see the event poster (not brand image first).
  let html = stripSiteSocialFromHtml(indexHtml)
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeTitleText(title)}</title>`)
  const block = `  <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />\n${socialMeta}\n  <script id="secret-blogger-event-jsonld" type="application/ld+json">${jsonLd}</script>\n`
  html = html.replace('</head>', `${block}</head>`)
  return html
}

function injectListSeoShell(
  indexHtml: string,
  list: ListSharePayload,
  site: string,
  viteBase: string,
  brandImageUrl?: string,
  shareImageUrl?: string,
): string {
  const prerender = { siteOrigin: site, viteBase, brandImageUrl, shareImageUrl }
  const canonical = canonicalListUrlFromParts(list.id, site, viteBase)
  const jsonLd = jsonLdForHtml(listJsonLdScriptContentPrerender(list, prerender))
  const socialMeta = buildListSocialMetaTagsHtml(list, prerender)
  const title = `${list.title.trim() || 'Shared list'} | ${APP_NAME}`
  let html = stripSiteSocialFromHtml(indexHtml)
  html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeTitleText(title)}</title>`)
  const block = `  <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />\n${socialMeta}\n  <script id="secret-blogger-list-jsonld" type="application/ld+json">${jsonLd}</script>\n`
  html = html.replace('</head>', `${block}</head>`)
  return html
}

type PublicListRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  is_public?: boolean
  is_liked_list?: boolean
  is_rated_list?: boolean
  cover_image_url?: string | null
}

/**
 * After build: sitemap.xml, one static index.html per event URL, and 404.html for SPA hosts.
 *
 * GitHub Pages (and similar static hosts) do not rewrite unknown paths to index.html. Without a real
 * file at /event/<id>, crawlers get HTTP 404 — Search Console reports "URL is not available to Google".
 * Copying the built shell to dist/event/<id>/index.html returns 200 so Google can fetch and render the app.
 */
function staticSitePlugin(): Plugin {
  return {
    name: 'secret-blogger-static-site',
    apply: 'build',
    async closeBundle() {
      const env = loadEnv('production', process.cwd(), '')
      const url = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const key = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      const site = (env.VITE_PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || 'https://www.secretblogger.app').replace(
        /\/$/,
        ''
      )
      const distDir = resolve(process.cwd(), 'dist')
      const rootIndex = resolve(distDir, 'index.html')
      const isCi = Boolean(process.env.GITHUB_ACTIONS || process.env.CI)

      if (!url || !key) {
        const msg =
          '[static-site] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY: cannot write sitemap.xml or event/*/list/*/index.html (GitHub Pages needs these files for /event/:id and /list/:id).'
        if (isCi) {
          throw new Error(
            `${msg} Add both as repository Secrets and re-run the workflow.`
          )
        }
        console.warn(`${msg} Skipping (local build without .env is OK).`)
        return
      }
      if (!existsSync(rootIndex)) {
        throw new Error('[static-site] dist/index.html missing after bundle')
      }

      try {
        const client = createClient(url, key)
        const viteBase = env.VITE_BASE || process.env.VITE_BASE || '/'
        const [{ data, error }, settingsRes] = await Promise.all([
          client.from('events').select('*'),
          client
            .from('app_settings')
            .select('key, value')
            .in('key', ['app_logo_url', 'app_icon_url', 'app_favicon_url', 'app_name', 'copy_overrides']),
        ])
        if (error) throw error
        if (settingsRes.error) throw settingsRes.error

        const settingsMap: Record<string, string> = {}
        for (const row of settingsRes.data || []) {
          if (row?.key && typeof row.value === 'string') settingsMap[row.key] = row.value
        }
        const brandImageRemote = brandShareImageUrl({
          app_logo_url: settingsMap.app_logo_url,
          app_icon_url: settingsMap.app_icon_url,
          app_favicon_url: settingsMap.app_favicon_url,
        })
        const brandAlt = (settingsMap.app_name || APP_NAME).trim() || APP_NAME
        // Dynamic import so editing copy/catalog does not restart the Vite config in dev.
        const { parseCopyOverrides, t: tCopy } = await import('./src/copy')
        const copyOverrides = parseCopyOverrides(settingsMap.copy_overrides)
        const brandDescription =
          tCopy('home.subtitleSignedIn', copyOverrides).trim() || APP_DESCRIPTION

        const shareDir = resolve(distDir, 'share')
        mkdirSync(shareDir, { recursive: true })
        let brandImage = brandImageRemote
        if (brandImageRemote) {
          const brandRel = await mirrorShareImage(brandImageRemote, resolve(shareDir, 'brand'))
          if (brandRel) {
            brandImage = `${site}/${brandRel}`
            console.log('[static-site] Mirrored brand share image →', brandRel)
          } else {
            console.warn('[static-site] Could not mirror brand share image; using remote URL')
          }
        }

        const rows = (data || []) as Event[]

        const listsRes = await client
          .from('user_lists')
          .select(
            'id, user_id, name, description, is_public, is_liked_list, is_rated_list, cover_image_url',
          )
          .eq('is_public', true)
        if (listsRes.error) throw listsRes.error
        const publicLists = ((listsRes.data || []) as PublicListRow[]).filter((l) => !!l?.id)

        const ownerIds = [...new Set(publicLists.map((l) => l.user_id).filter(Boolean))]
        const profilesRes =
          ownerIds.length > 0
            ? await client.from('user_profiles').select('user_id, username').in('user_id', ownerIds)
            : { data: [] as { user_id: string; username: string | null }[], error: null }
        if (profilesRes.error) throw profilesRes.error
        const usernameByUser = new Map(
          (profilesRes.data || []).map((p) => [p.user_id, (p.username || '').trim()]),
        )

        const customListIds = publicLists.filter((l) => !l.is_rated_list).map((l) => l.id)
        const membershipRes =
          customListIds.length > 0
            ? await client
                .from('user_list_events')
                .select('list_id, event_id, position')
                .in('list_id', customListIds)
                .order('position', { ascending: true })
            : { data: [] as { list_id: string; event_id: string; position: number }[], error: null }
        if (membershipRes.error) throw membershipRes.error

        const eventsByList = new Map<string, string[]>()
        for (const row of membershipRes.data || []) {
          const arr = eventsByList.get(row.list_id) || []
          arr.push(row.event_id)
          eventsByList.set(row.list_id, arr)
        }

        const ratedOwnerIds = [
          ...new Set(publicLists.filter((l) => l.is_rated_list).map((l) => l.user_id)),
        ]
        const ratingsByUser = new Map<string, string[]>()
        if (ratedOwnerIds.length > 0) {
          const ratingsRes = await client
            .from('ratings')
            .select('user_id, event_id, created_at')
            .in('user_id', ratedOwnerIds)
            .order('created_at', { ascending: false })
          if (ratingsRes.error) throw ratingsRes.error
          for (const row of ratingsRes.data || []) {
            const arr = ratingsByUser.get(row.user_id) || []
            if (!arr.includes(row.event_id)) arr.push(row.event_id)
            ratingsByUser.set(row.user_id, arr)
          }
        }

        const allEventIds = new Set<string>()
        for (const ids of eventsByList.values()) for (const id of ids) allEventIds.add(id)
        for (const ids of ratingsByUser.values()) for (const id of ids) allEventIds.add(id)
        const imageByEvent = new Map<string, string>()
        const eventIdList = [...allEventIds]
        // Chunk .in() queries to stay under URL limits.
        for (let i = 0; i < eventIdList.length; i += 200) {
          const chunk = eventIdList.slice(i, i + 200)
          const evRes = await client.from('events').select('id, image_url').in('id', chunk)
          if (evRes.error) throw evRes.error
          for (const ev of evRes.data || []) {
            const img = typeof ev.image_url === 'string' ? ev.image_url.trim() : ''
            if (img) imageByEvent.set(ev.id, img)
          }
        }

        const ratedTitleTemplate =
          tCopy('event.ratedListNameForUser', copyOverrides).trim() || "{name}'s Reviews"
        const likedTitleTemplate =
          tCopy('event.likedListNameForUser', copyOverrides).trim() || "{name}'s Liked Events"

        const listPayloads: ListSharePayload[] = publicLists.map((l) => {
          const handle = usernameByUser.get(l.user_id) || ''
          const eventIds = l.is_rated_list
            ? ratingsByUser.get(l.user_id) || []
            : eventsByList.get(l.id) || []
          let imageUrl = (l.cover_image_url || '').trim() || null
          if (!imageUrl) {
            for (const eid of eventIds) {
              const img = imageByEvent.get(eid)
              if (img) {
                imageUrl = img
                break
              }
            }
          }
          const displayName = handle || 'Profile'
          const title = l.is_rated_list
            ? ratedTitleTemplate.replace('{name}', displayName)
            : l.is_liked_list
              ? likedTitleTemplate.replace('{name}', displayName)
              : (l.name || 'Shared list').trim()
          return {
            id: l.id,
            title,
            description: l.description,
            imageUrl,
            ownerUsername: handle || null,
            eventCount: eventIds.length,
          }
        })

        const urls = [
          site + '/',
          ...rows.map((row) => `${site}/event/${row.id}`),
          ...listPayloads.map((l) => `${site}/list/${l.id}`),
        ]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>
`
        writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf8')
        console.log('[static-site] Wrote sitemap.xml', `(${urls.length} URLs)`)

        let indexHtml = readFileSync(rootIndex, 'utf8')
        indexHtml = applyBrandDescriptionToSiteHtml(indexHtml, brandDescription)
        console.log('[static-site] Homepage OG description set from home subtitle')
        if (brandImage) {
          indexHtml = applyBrandShareImageToSiteHtml(indexHtml, brandImage, brandAlt)
          writeFileSync(rootIndex, indexHtml, 'utf8')
          console.log('[static-site] Homepage OG image set from brand settings')
        } else {
          writeFileSync(rootIndex, indexHtml, 'utf8')
          console.warn('[static-site] No app_logo_url / app_icon_url / app_favicon_url: homepage OG image unchanged')
        }

        const eventsDir = resolve(shareDir, 'events')
        mkdirSync(eventsDir, { recursive: true })
        const mirrored = await mapPool(rows, 6, async (row) => {
          const src = typeof row.image_url === 'string' ? row.image_url.trim() : ''
          if (!src) return { id: row.id, shareImageUrl: undefined as string | undefined }
          const rel = await mirrorShareImage(src, resolve(eventsDir, row.id))
          return {
            id: row.id,
            shareImageUrl: rel ? `${site}/${rel}` : undefined,
          }
        })
        const shareById = new Map(mirrored.map((m) => [m.id, m.shareImageUrl]))
        const mirroredCount = mirrored.filter((m) => m.shareImageUrl).length
        console.log('[static-site] Mirrored', mirroredCount, 'event share image(s) into dist/share/events')

        let eventPages = 0
        for (const row of rows) {
          const id = row?.id
          if (!id || typeof id !== 'string') continue
          const dir = resolve(distDir, 'event', id)
          mkdirSync(dir, { recursive: true })
          const html = injectEventSeoShell(
            indexHtml,
            row,
            site,
            viteBase,
            brandImage,
            shareById.get(id),
          )
          writeFileSync(resolve(dir, 'index.html'), html, 'utf8')
          eventPages += 1
        }
        console.log('[static-site] Wrote', eventPages, 'event/*/index.html copies (HTTP 200 for crawlers)')

        const listsDir = resolve(shareDir, 'lists')
        mkdirSync(listsDir, { recursive: true })
        const listMirrored = await mapPool(listPayloads, 6, async (list) => {
          const src = (list.imageUrl || '').trim()
          if (!src) return { id: list.id, shareImageUrl: undefined as string | undefined }
          const rel = await mirrorShareImage(src, resolve(listsDir, list.id))
          return {
            id: list.id,
            shareImageUrl: rel ? `${site}/${rel}` : undefined,
          }
        })
        const listShareById = new Map(listMirrored.map((m) => [m.id, m.shareImageUrl]))
        const listMirroredCount = listMirrored.filter((m) => m.shareImageUrl).length
        console.log('[static-site] Mirrored', listMirroredCount, 'list share image(s) into dist/share/lists')

        let listPages = 0
        for (const list of listPayloads) {
          const dir = resolve(distDir, 'list', list.id)
          mkdirSync(dir, { recursive: true })
          const html = injectListSeoShell(
            indexHtml,
            list,
            site,
            viteBase,
            brandImage,
            listShareById.get(list.id),
          )
          writeFileSync(resolve(dir, 'index.html'), html, 'utf8')
          listPages += 1
        }
        console.log('[static-site] Wrote', listPages, 'list/*/index.html copies (HTTP 200 for crawlers)')

        writeFileSync(resolve(distDir, '404.html'), indexHtml, 'utf8')
        console.log('[static-site] Wrote 404.html (SPA fallback for static hosts)')

        writeFileSync(resolve(distDir, '.nojekyll'), '')
        console.log('[static-site] Wrote .nojekyll (disable Jekyll on any hosts that still run it)')
      } catch (e) {
        if (isCi) {
          throw e
        }
        console.warn('[static-site] Failed:', e)
      }
    },
  }
}

// https://vite.dev/config/
// Production (custom domain at site root): use VITE_BASE=/ so /assets/* resolves from nested /event/<id>/.
// For github.io/<repo>/ only, set VITE_BASE=/<repo>/ in the deploy workflow.
const viteBase = process.env.VITE_BASE ?? '/'
/** PWA manifest start_url / scope: must align with Vite `base` for subpath deploys. */
function pwaStartUrlAndScope(): { start_url: string; scope: string } {
  if (viteBase === '/' || viteBase === './') {
    return { start_url: '/', scope: '/' }
  }
  const withSlash = viteBase.endsWith('/') ? viteBase : `${viteBase}/`
  return { start_url: withSlash, scope: withSlash }
}

const { start_url: pwaStartUrl, scope: pwaScope } = pwaStartUrlAndScope()

export default defineConfig({
  base: viteBase,
  plugins: [
    react(),
    tsconfigPaths(),
    staticSitePlugin(),
    VitePWA({
      // Activate new builds promptly so clients don't stay on a stale precache forever.
      registerType: 'autoUpdate',
      includeAssets: ['robots.txt', 'CNAME'],
      manifest: {
        name: APP_NAME,
        short_name: APP_NAME,
        description: APP_DESCRIPTION,
        theme_color: '#f8fafc',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: pwaStartUrl,
        scope: pwaScope,
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Share mirrors are for crawlers only — do not precache hundreds of event posters.
        globIgnores: ['**/share/**'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
})
