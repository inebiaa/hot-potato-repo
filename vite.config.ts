import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Plugin } from 'vite'
import type { Event } from './src/lib/eventTypes'
import { canonicalEventUrlFromParts } from './src/lib/siteBase'
import { eventJsonLdScriptContentPrerender } from './src/lib/eventJsonLd'

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

/** JSON-LD safe inside <script> (prevents closing script if event text contains HTML). */
function jsonLdForHtml(json: string): string {
  return json.replace(/</g, '\\u003c')
}

function injectEventSeoShell(indexHtml: string, event: Event, site: string, viteBase: string): string {
  const prerender = { siteOrigin: site, viteBase }
  const canonical = canonicalEventUrlFromParts(event.id, site, viteBase)
  const jsonLd = jsonLdForHtml(eventJsonLdScriptContentPrerender(event, prerender))
  const title = `${event.name} | Secret Blogger`
  let html = indexHtml.replace(/<title>.*?<\/title>/s, `<title>${escapeTitleText(title)}</title>`)
  const block = `  <link rel="canonical" href="${escapeHtmlAttr(canonical)}" />\n  <script id="secret-blogger-event-jsonld" type="application/ld+json">${jsonLd}</script>\n`
  html = html.replace('</head>', `${block}</head>`)
  return html
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

      if (!url || !key) {
        console.warn(
          '[static-site] Skipping sitemap + event pages: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY at build time'
        )
        return
      }
      if (!existsSync(rootIndex)) {
        console.warn('[static-site] dist/index.html missing')
        return
      }

      try {
        const client = createClient(url, key)
        const viteBase = env.VITE_BASE || process.env.VITE_BASE || '/'
        const { data, error } = await client.from('events').select('*')
        if (error) throw error

        const rows = (data || []) as Event[]
        const urls = [site + '/', ...rows.map((row) => `${site}/event/${row.id}`)]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>
`
        writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf8')
        console.log('[static-site] Wrote sitemap.xml', `(${urls.length} URLs)`)

        const indexHtml = readFileSync(rootIndex, 'utf8')
        let eventPages = 0
        for (const row of rows) {
          const id = row?.id
          if (!id || typeof id !== 'string') continue
          const dir = resolve(distDir, 'event', id)
          mkdirSync(dir, { recursive: true })
          const html = injectEventSeoShell(indexHtml, row, site, viteBase)
          writeFileSync(resolve(dir, 'index.html'), html, 'utf8')
          eventPages += 1
        }
        console.log('[static-site] Wrote', eventPages, 'event/*/index.html copies (HTTP 200 for crawlers)')

        writeFileSync(resolve(distDir, '404.html'), indexHtml, 'utf8')
        console.log('[static-site] Wrote 404.html (SPA fallback for static hosts)')

        writeFileSync(resolve(distDir, '.nojekyll'), '')
        console.log('[static-site] Wrote .nojekyll (disable Jekyll on any hosts that still run it)')
      } catch (e) {
        console.warn('[static-site] Failed:', e)
      }
    },
  }
}

// https://vite.dev/config/
// Production (custom domain at site root): use VITE_BASE=/ so /assets/* resolves from nested /event/<id>/.
// For github.io/<repo>/ only, set VITE_BASE=/<repo>/ in the deploy workflow.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    tsconfigPaths(),
    staticSitePlugin(),
  ],
  server: {
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
