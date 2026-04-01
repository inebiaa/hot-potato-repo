import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import type { Plugin } from 'vite'

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

/** After build, fetch event IDs and write dist/sitemap.xml (requires Supabase env at build time). */
function sitemapPlugin(): Plugin {
  return {
    name: 'secret-blogger-sitemap',
    async closeBundle() {
      const url = process.env.VITE_SUPABASE_URL
      const key = process.env.VITE_SUPABASE_ANON_KEY
      const site = (process.env.VITE_PUBLIC_SITE_URL || 'https://www.secretblogger.app').replace(/\/$/, '')
      if (!url || !key) {
        console.warn('[sitemap] Skipping: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for build-time sitemap generation')
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
        const out = resolve(process.cwd(), 'dist', 'sitemap.xml')
        writeFileSync(out, xml, 'utf8')
        console.log('[sitemap] Wrote', out, `(${urls.length} URLs)`)
      } catch (e) {
        console.warn('[sitemap] Failed:', e)
      }
    },
  }
}

// https://vite.dev/config/
// GitHub Pages: workflow sets VITE_BASE=./ so asset URLs work for both github.io/<repo>/ and custom domains.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    react(),
    tsconfigPaths(),
    sitemapPlugin(),
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
