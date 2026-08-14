# AGENTS.md

## Cursor Cloud specific instructions

### Product
Secret Blogger (`hot-potato-repo`): React + Vite PWA for discovering/rating fashion and music shows. Data and auth are remote Supabase (`uhljagzmwnsqpkasqfyn`); there is no local Postgres/Supabase stack in this repo.

### Commands
See `package.json` scripts. Typical local loop:
- `npm run client:dev` (Vite on **5173**) for UI work
- `npm run dev` runs Vite + Express together; set `PORT=3001` for the Express process so Vite’s `/api` proxy works (`vite.config.ts`)
- `npm run lint`, `npm run check`, `npm run build`

### Gotchas
- **Express is a stub** (`/api/auth` returns 501). Real auth is Supabase client-side (`src/contexts/AuthContext.tsx`). Do not expect the local API for product flows.
- **Env**: `.env.example` lists `VITE_SUPABASE_*`. `src/config.ts` also has hardcoded anon fallbacks for hosted builds, so the client can run without `.env`, but production-like builds that prerender sitemap/event HTML need env vars set.
- **Lint**: `npm run lint` currently reports existing unused-import errors in a few files; typecheck (`npm run check`) and `npm run build` are the stronger green checks for this repo.
- **No automated test suite** (no Jest/Vitest/Playwright). Prefer manual UI checks against the Vite app + remote Supabase.
- Optional city/venue autocomplete uses Photon (`photon.komoot.io`); forms still work if it is unreachable.
