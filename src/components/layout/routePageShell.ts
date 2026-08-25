/** Shared horizontal padding + max width for route pages. */
export const ROUTE_PAGE_NARROW_CLASS = 'mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8';
export const ROUTE_PAGE_WIDE_CLASS = 'mx-auto min-w-0 max-w-[2400px] px-4 py-6 sm:px-6 lg:px-8';

export type RoutePageWidth = 'narrow' | 'wide';

export function routePageShellClass(width: RoutePageWidth = 'narrow'): string {
  return width === 'wide' ? ROUTE_PAGE_WIDE_CLASS : ROUTE_PAGE_NARROW_CLASS;
}
