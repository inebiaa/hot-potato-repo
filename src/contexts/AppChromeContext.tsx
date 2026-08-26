import { createContext, useContext, type ReactNode } from 'react';
import type { Event } from '../lib/supabase';

export type OverlaySource = 'tagModal' | 'viewRatings';

/** Navigation/chrome callbacks. Not page data. */
export type AppChromeValue = {
  openEvent: (eventId: string, source?: OverlaySource) => void;
  closeEventOverlay: () => void;
  overlayEventId: string | null;
  tagModalRefreshTrigger: number;
  onTagClick: (type: string, value: string, explicitLabel?: string) => void;
  onAddEvent: () => void;
  setProfileBoardEvents: (events: Event[] | null) => void;
  /** Page-scoped search counts for profile and shared lists. */
  headerSearchCounts: { filtered: number; total: number } | null;
  setHeaderSearchCounts: (counts: { filtered: number; total: number } | null) => void;
  /** Back from secondary pages to the home feed. */
  goBack: () => void;
  /** Invalidate the home feed after another page changes events or the account. */
  refreshHomeCatalog: () => void;
  refreshHomeEventRating: (eventId: string) => void;
};

const AppChromeContext = createContext<AppChromeValue | null>(null);

export function AppChromeProvider({
  value,
  children,
}: {
  value: AppChromeValue;
  children: ReactNode;
}) {
  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}

export function useAppChrome(): AppChromeValue {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error('useAppChrome must be used inside AppChromeProvider');
  }
  return ctx;
}
