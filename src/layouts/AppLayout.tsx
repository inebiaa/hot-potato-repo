import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader, { type AppHeaderActiveView } from '../components/AppHeader';
import { useHomeCatalogOptional } from '../contexts/HomeCatalogContext';
import { isHomeCatalogRoute } from '../lib/homeCatalogRoute';
import type { AppSettings } from '../types/appSettings';

type AppLayoutProps = {
  activeView: AppHeaderActiveView;
  desktopLikePointer: boolean;
  appSettings: AppSettings;
  user: { id: string } | null;
  isAdmin: boolean;
  pathname: string;
  onGoHome: () => void;
  onOpenStats: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onAddEvent: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  searchBar?: ReactNode;
  pinnedArtistBar?: ReactNode;
  children: ReactNode;
};

/** Shared chrome: header + scrollable main for home, settings, stats, profile, lists. */
export default function AppLayout({
  activeView,
  desktopLikePointer,
  appSettings,
  user,
  isAdmin,
  pathname,
  onGoHome,
  onOpenStats,
  onOpenProfile,
  onOpenSettings,
  onAddEvent,
  onSignIn,
  onSignOut,
  searchBar,
  pinnedArtistBar,
  children,
}: AppLayoutProps) {
  const location = useLocation();
  const home = useHomeCatalogOptional();
  const mainRef =
    isHomeCatalogRoute(location.pathname) && home ? home.feedScrollRef : undefined;
  return (
    <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
      <AppHeader
        pathname={pathname}
        activeView={activeView}
        desktopLikePointer={desktopLikePointer}
        appSettings={appSettings}
        user={user}
        isAdmin={isAdmin}
        onGoHome={onGoHome}
        onOpenStats={onOpenStats}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
        onAddEvent={onAddEvent}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        searchBar={searchBar}
        pinnedArtistBar={pinnedArtistBar}
      />
      <main
        ref={mainRef}
        className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden ${
          desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'
        }`}
      >
        {children}
      </main>
    </div>
  );
}
