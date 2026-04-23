/**
 * Centralized brand / SEO defaults.
 * Override with Vite env vars when branding changes.
 */
export const DEFAULT_APP_NAME = 'Secret Blogger';
export const DEFAULT_SITE_ORIGIN = 'https://www.secretblogger.app';
export const DEFAULT_APP_DESCRIPTION = 'Discover, rate, and review fashion shows from around the world.';

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** In the browser Vite injects `import.meta.env`. In the static-site `closeBundle` hook (Node) it can be undefined. */
function viteEnvString(key: 'VITE_APP_NAME' | 'VITE_APP_DESCRIPTION'): string {
  const meta = import.meta as { env?: Record<string, string | boolean | undefined> };
  return clean(meta.env?.[key]);
}

export function appName(): string {
  return viteEnvString('VITE_APP_NAME') || DEFAULT_APP_NAME;
}

export function appDescription(): string {
  return viteEnvString('VITE_APP_DESCRIPTION') || DEFAULT_APP_DESCRIPTION;
}
