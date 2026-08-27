import { useCallback, useState, type MutableRefObject, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import AppHeader, { type AppHeaderActiveView } from '../components/AppHeader';
import PullToRefreshIndicator from '../components/layout/PullToRefreshIndicator';
import { usePullToRefreshControl } from '../contexts/PullToRefreshContext';
import { useHomeCatalogOptional } from '../contexts/HomeCatalogContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
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
  onOpenAddShow: () => void;
  onOpenCreateList: () => void;
  isPlusActive?: boolean;
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
  onOpenAddShow,
  onOpenCreateList,
  isPlusActive = false,
  onSignIn,
  onSignOut,
  searchBar,
  pinnedArtistBar,
  children,
}: AppLayoutProps) {
  const location = useLocation();
  const home = useHomeCatalogOptional();
  const { runRefresh } = usePullToRefreshControl();
  const [mainScrollEl, setMainScrollEl] = useState<HTMLElement | null>(null);

  const assignMainRef = useCallback(
    (node: HTMLElement | null) => {
      setMainScrollEl(node);
      if (isHomeCatalogRoute(location.pathname) && home) {
        (home.feedScrollRef as MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    [home, location.pathname],
  );

  const { pull, refreshing, pullThreshold } = usePullToRefresh({
    scrollEl: mainScrollEl,
    enabled: !desktopLikePointer,
    onRefresh: runRefresh,
  });

  return (
    <div className="flex max-h-dvh min-h-dvh flex-col overflow-hidden bg-background">
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
        onOpenAddShow={onOpenAddShow}
        onOpenCreateList={onOpenCreateList}
        isPlusActive={isPlusActive}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        searchBar={searchBar}
        pinnedArtistBar={pinnedArtistBar}
      />
      <main
        ref={assignMainRef}
        className={`relative flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain ${
          desktopLikePointer ? '' : 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0'
        }`}
      >
        <PullToRefreshIndicator
          pull={pull}
          refreshing={refreshing}
          pullThreshold={pullThreshold}
        />
        <div
          style={{
            transform: pull > 0 ? `translateY(${pull}px)` : undefined,
            transition:
              pull === 0 && !refreshing ? 'transform 0.2s ease-out' : 'none',
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
