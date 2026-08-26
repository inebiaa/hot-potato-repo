// Fallback values when env vars aren't set (e.g. on hosted builds).
// Node tests via `tsx` have `import.meta` but no Vite `import.meta.env`; read process.env too.
const viteEnv: Record<string, string | undefined> =
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env) ?? {};

export const SUPABASE_URL =
  viteEnv.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY =
  viteEnv.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
