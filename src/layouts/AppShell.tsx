import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Event } from '../lib/supabase';
import { CopyProvider } from '../contexts/CopyContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useLegacyHomeRedirects } from '../hooks/useLegacyHomeRedirects';
import { useAppDocumentMeta } from '../hooks/useAppDocumentMeta';
import { useAppModals } from '../hooks/useAppModals';
import { useEventOverlayNavigation } from '../hooks/useEventOverlayNavigation';
import { useAppLayoutNav } from '../hooks/useAppLayoutNav';
import { useAppSettings } from '../hooks/useAppSettings';
import AppLayout from './AppLayout';
import { headerActiveView, headerSearchOpensHome, isHomeCatalogRoute } from '../lib/homeCatalogRoute';
import { useHomeCatalog } from '../contexts/HomeCatalogContext';
import { AppChromeProvider } from '../contexts/AppChromeContext';
import HomeHeaderSearch from '../components/layout/HomeHeaderSearch';
import HomePinnedArtistsSlot from '../components/layout/HomePinnedArtistsSlot';
import EventOverlayHost from '../components/layout/EventOverlayHost';
import EmbedEventView from '../components/layout/EmbedEventView';
import AppSharedModals from '../components/layout/AppSharedModals';
import { LoadingSpinner } from '../components/ui';

type AppShellProps = {
  setProfileBoardEvents: (events: Event[] | null) => void;
};

/** Route layout shell: chrome, modals, overlay, and page outlet. */
export default function AppShell({ setProfileBoardEvents }: AppShellProps) {
  const location = useLocation();
  const home = useHomeCatalog();
  const { appSettings } = useAppSettings();

  const [headerSearchCounts, setHeaderSearchCounts] = useState<{
    filtered: number;
    total: number;
  } | null>(null);

  const {
    overlayEventId,
    overlaySource,
    tagModalRefreshTrigger,
    embedMode,
    eventIdFromUrl,
    openEventOverlay,
    closeEventOverlay,
  } = useEventOverlayNavigation();

  const {
    modalRoute,
    closeAppModal,
    openAddEventModal,
    openTagModal,
    openAuthModal,
    closeAuthModal,
    isAddEventModalOpen,
    isAuthModalOpen,
    isTagRatingsModalOpen,
    tagRatingsData,
    isEventPanelModal,
  } = useAppModals();

  const { layoutNav, goBack } = useAppLayoutNav({
    setProfileBoardEvents,
    openAddEventModal,
    openAuthModal,
  });

  useLegacyHomeRedirects();
  useAppDocumentMeta(appSettings);

  const handleTagClick = useCallback(
    (type: string, value: string, explicitLabel?: string) => {
      if (headerSearchOpensHome(location.pathname) || isHomeCatalogRoute(location.pathname)) {
        home.applyHomeTagFilter(type, value, explicitLabel);
        return;
      }
      home.selectTagFilter(type, value, explicitLabel);
    },
    [home, location.pathname],
  );

  useEffect(() => {
    const sync = () => {
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const anyPopupOpen = !!(
    overlayEventId ||
    isTagRatingsModalOpen ||
    isAddEventModalOpen ||
    isAuthModalOpen ||
    isEventPanelModal
  );
  useBodyScrollLock(anyPopupOpen);

  const sharedModals = (
    <AppSharedModals
      appSettings={appSettings}
      isAddEventModalOpen={isAddEventModalOpen}
      isAuthModalOpen={isAuthModalOpen}
      isTagRatingsModalOpen={isTagRatingsModalOpen}
      tagRatingsData={tagRatingsData}
      modalAuthMode={modalRoute.authMode}
      modalAuthPrompt={modalRoute.authPrompt}
      tagModalRefreshTrigger={tagModalRefreshTrigger}
      onCloseAppModal={closeAppModal}
      onCloseAuthModal={closeAuthModal}
      onEventAdded={() => void home.fetchEvents()}
      onOpenEventOverlay={openEventOverlay}
      onOpenTagModal={openTagModal}
    />
  );

  if (embedMode && eventIdFromUrl) {
    return (
      <CopyProvider settings={appSettings}>
        <EmbedEventView eventId={eventIdFromUrl} onTagClick={handleTagClick}>
          {sharedModals}
        </EmbedEventView>
      </CopyProvider>
    );
  }

  if (!appSettings || !layoutNav) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    );
  }

  const activeView = headerActiveView(layoutNav.pathname);
  const searchBar: ReactNode = <HomeHeaderSearch />;

  const chromeValue = {
    openEvent: openEventOverlay,
    closeEventOverlay,
    overlayEventId,
    tagModalRefreshTrigger,
    onTagClick: handleTagClick,
    onAddEvent: openAddEventModal,
    setProfileBoardEvents,
    headerSearchCounts,
    setHeaderSearchCounts,
    goBack,
    refreshHomeCatalog: () => {
      void home.fetchEvents();
    },
    refreshHomeEventRating: (eventId: string) => {
      void home.refreshEventRating(eventId);
    },
  };

  return (
    <AppChromeProvider value={chromeValue}>
      <CopyProvider settings={appSettings}>
        <AppLayout
          {...layoutNav}
          activeView={activeView}
          searchBar={searchBar}
          pinnedArtistBar={<HomePinnedArtistsSlot />}
        >
          <Outlet />
        </AppLayout>
        {sharedModals}
        {overlayEventId ? (
          <EventOverlayHost
            eventId={overlayEventId}
            elevated={!!overlaySource}
            onClose={closeEventOverlay}
            onTagClick={handleTagClick}
          />
        ) : null}
      </CopyProvider>
    </AppChromeProvider>
  );
}
