import { isProfileHandlePathSegment, RESERVED_PROFILE_HANDLES } from './userProfile';

function cleanPath(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

/** Home browse feed + home search only run on these URLs. */
export function isHomeCatalogRoute(pathname: string): boolean {
  const path = cleanPath(pathname);
  return path === '/' || path.startsWith('/event/');
}

export function isStatsRoute(pathname: string): boolean {
  return cleanPath(pathname) === '/stats';
}

export function isSettingsRoute(pathname: string): boolean {
  return cleanPath(pathname) === '/settings';
}

/** Own profile or public /:handle. Not shared-list URLs. */
export function isProfilePageRoute(pathname: string): boolean {
  const path = cleanPath(pathname);
  if (path === '/profile') return true;
  const parts = path.split('/').filter(Boolean);
  if (parts.length !== 1) return false;
  if (RESERVED_PROFILE_HANDLES.has(parts[0].toLowerCase())) return false;
  return isProfileHandlePathSegment(parts[0]);
}

/**
 * Header search and filter pills open the home feed.
 * Stats, profile, and lists keep search on that page.
 */
export function isListPageRoute(pathname: string): boolean {
  const parts = cleanPath(pathname).split('/').filter(Boolean);
  if (parts[0] === 'list' && parts.length >= 2) return true;
  if (parts.length >= 3 && parts[1] === 'list') return true;
  return false;
}

export function headerSearchOpensHome(pathname: string): boolean {
  if (isHomeCatalogRoute(pathname)) return false;
  if (isStatsRoute(pathname)) return false;
  if (isProfilePageRoute(pathname)) return false;
  if (isListPageRoute(pathname)) return false;
  return true;
}

export type HeaderActiveView = 'home' | 'stats' | 'profile' | 'settings';

/** Which header tab is current. */
export function headerActiveView(pathname: string): HeaderActiveView {
  if (isSettingsRoute(pathname)) return 'settings';
  if (isStatsRoute(pathname)) return 'stats';
  if (isProfilePageRoute(pathname) || isListPageRoute(pathname)) return 'profile';
  return 'home';
}
