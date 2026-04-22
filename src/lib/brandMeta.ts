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

export function appName(): string {
  const env = clean(import.meta.env.VITE_APP_NAME);
  return env || DEFAULT_APP_NAME;
}

export function appDescription(): string {
  const env = clean(import.meta.env.VITE_APP_DESCRIPTION);
  return env || DEFAULT_APP_DESCRIPTION;
}
