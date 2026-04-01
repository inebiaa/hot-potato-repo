import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Plugin } from 'vite'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
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
      const url = process.env.VITE_SUPABASE_URL
      const key = process.env.VITE_SUPABASE_ANON_KEY
      const site = (process.env.VITE_PUBLIC_SITE_URL || 'https://www.secretblogger.app').replace(/\/$/, '')
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
        const { data, error } = await client.from('events').select('id')
        if (error) throw error

        const urls = [site + '/', ...(data || []).map((row: { id: string }) => `${site}/event/${row.id}`)]
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((loc) => `  <url><loc>${escapeXml(loc)}</loc><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>
`
        writeFileSync(resolve(distDir, 'sitemap.xml'), xml, 'utf8')
        console.log('[static-site] Wrote sitemap.xml', `(${urls.length} URLs)`)

        const indexHtml = readFileSync(rootIndex, 'utf8')
        let eventPages = 0
        for (const row of data || []) {
          const id = row?.id
          if (!id || typeof id !== 'string') continue
          const dir = resolve(distDir, 'event', id)
          mkdirSync(dir, { recursive: true })
          writeFileSync(resolve(dir, 'index.html'), indexHtml, 'utf8')
          eventPages += 1
        }
        console.log('[static-site] Wrote', eventPages, 'event/*/index.html copies (HTTP 200 for crawlers)')

        writeFileSync(resolve(distDir, '404.html'), indexHtml, 'utf8')
        console.log('[static-site] Wrote 404.html (SPA fallback for static hosts)')
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
