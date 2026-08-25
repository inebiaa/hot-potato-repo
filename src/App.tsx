import { useState, useEffect, useCallback, startTransition, useMemo, type ReactNode } from 'react';
import { useNavigate, useParams, useLocation, useSearchParams, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { supabase, Event } from './lib/supabase';
import AuthModal from './components/AuthModal';
import AddEventModal from './components/AddEventModal';
import TagRatingsModal from './components/TagRatingsModal';
import { profilePagePath } from './lib/siteBase';
import { isProfileHandlePathSegment } from './lib/userProfile';
import { CopyProvider } from './contexts/CopyContext';
import { overridesFromSettings, t as copyT } from './copy';
import { clearAppModalParams, parseAppModal, setAppModalParams } from './lib/searchParamsModal';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { useDesktopLikePointer } from './hooks/useDesktopLikePointer';
import { useAppSettings } from './hooks/useAppSettings';
import {
  brandShareImageUrl,
  setRuntimeBrandShareImage,
  syncSiteSocialOgDescriptionInDocument,
  syncSiteSocialOgImageInDocument,
} from './lib/brandSocial';
import AppLayout from './layouts/AppLayout';
import { headerActiveView, headerSearchOpensHome, isHomeCatalogRoute, isListPageRoute, isProfilePageRoute, isStatsRoute } from './lib/homeCatalogRoute';
import { HomeCatalogProvider, useHomeCatalog } from './contexts/HomeCatalogContext';
import { AppChromeProvider } from './contexts/AppChromeContext';
import HomeHeaderSearch from './components/layout/HomeHeaderSearch';
import HomePinnedArtistsSlot from './components/layout/HomePinnedArtistsSlot';
import EventOverlayHost from './components/layout/EventOverlayHost';
import EmbedEventView from './components/layout/EmbedEventView';

function App() {
  const [profileBoardEvents, setProfileBoardEvents] = useState<Event[] | null>(null);
  return (
    <HomeCatalogProvider profileBoardEvents={profileBoardEvents}>
      <AppShell setProfileBoardEvents={setProfileBoardEvents} />
    </HomeCatalogProvider>
  );
}

function AppShell({
  setProfileBoardEvents,
}: {
  setProfileBoardEvents: (events: Event[] | null) => void;
}) {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, signOut, isAdmin } = useAuth();
  const desktopLikePointer = useDesktopLikePointer();
  const { appSettings } = useAppSettings();
  const home = useHomeCatalog();

  const [overlayEventId, setOverlayEventId] = useState<string | null>(null);
  const [overlaySource, setOverlaySource] = useState<'tagModal' | 'viewRatings' | null>(null);
  const [tagModalRefreshTrigger, setTagModalRefreshTrigger] = useState(0);

  const pathname = location.pathname;
  const showStats = isStatsRoute(pathname);
  const embedMode = searchParams.get('embed') === '1';
  const eventIdFromQuery = searchParams.get('event');
  const eventIdFromPath = params.eventId ?? null;
  const eventIdFromUrl = eventIdFromPath ?? eventIdFromQuery;
  const showSharedList = isListPageRoute(pathname);
  const showProfileView = isProfilePageRoute(pathname);
  const profileHandle =
    showProfileView && params.handle && isProfileHandlePathSegment(params.handle)
      ? params.handle
      : null;

  const modalRoute = useMemo(() => parseAppModal(searchParams), [searchParams]);

  const closeAppModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

  const openSettings = useCallback(() => {
    startTransition(() => {
      navigate('/settings');
      window.scrollTo(0, 0);
    });
  }, [navigate]);

  const openStats = useCallback(() => {
    navigate('/stats');
    window.scrollTo(0, 0);
  }, [navigate]);

  const openAddEventModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: setAppModalParams(searchParams, 'add-event') });
  }, [navigate, location.pathname, searchParams]);

  const openTagModal = useCallback(
    (type: string, value: string) => {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'tag', { tagType: type, tagValue: value }),
      });
    },
    [navigate, location.pathname, searchParams],
  );

  const openAuthModal = useCallback(
    (mode: 'signin' | 'signup' = 'signin', prompt?: string) => {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'auth', { authMode: mode, authPrompt: prompt }),
      });
    },
    [navigate, location.pathname, searchParams],
  );

  const closeAuthModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

  useEffect(() => {
    if (appSettings?.app_favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) link.href = appSettings.app_favicon_url;
    }
  }, [appSettings?.app_favicon_url]);

  useEffect(() => {
    if (!appSettings) return;
    const image = brandShareImageUrl(appSettings);
    setRuntimeBrandShareImage(image);
    syncSiteSocialOgImageInDocument(image, appSettings.app_name || 'Secret Blogger');
    syncSiteSocialOgDescriptionInDocument(
      copyT('home.subtitleSignedIn', overridesFromSettings(appSettings)),
    );
  }, [appSettings]);

  useEffect(() => {
    const q = searchParams.get('event');
    if (!q || params.eventId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    const qs = next.toString();
    navigate(`/event/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.eventId, navigate]);

  useEffect(() => {
    const q = searchParams.get('list');
    if (!q || params.listId) return;
    if (location.pathname !== '/') return;
    const next = new URLSearchParams(searchParams);
    next.delete('list');
    const qs = next.toString();
    navigate(`/list/${q}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [location.pathname, searchParams, params.listId, navigate]);

  const closeEventOverlay = useCallback(() => {
    setOverlayEventId(null);
    setOverlaySource(null);
    setTagModalRefreshTrigger((t) => t + 1);
    if (showProfileView) {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      if (profileHandle) {
        const qs = next.toString();
        navigate(qs ? { pathname: profilePagePath(profileHandle), search: qs } : profilePagePath(profileHandle));
      } else {
        navigate({ pathname: '/profile', search: next.toString() });
      }
    } else if (showSharedList) {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      navigate({ pathname: location.pathname, search: next.toString() });
    } else {
      navigate('/');
    }
  }, [showProfileView, showSharedList, searchParams, profileHandle, navigate, location.pathname]);

  const openEventOverlay = useCallback(
    (eventId: string, source?: 'tagModal' | 'viewRatings') => {
      setOverlayEventId(eventId);
      setOverlaySource(source ?? null);
      if (showProfileView) {
        const next = new URLSearchParams(searchParams);
        next.delete('profile');
        next.set('event', eventId);
        if (profileHandle) {
          navigate({ pathname: profilePagePath(profileHandle), search: next.toString() });
        } else {
          navigate({ pathname: '/profile', search: next.toString() });
        }
      } else if (showSharedList) {
        const next = new URLSearchParams(searchParams);
        next.set('event', eventId);
        navigate({ pathname: location.pathname, search: next.toString() });
      } else {
        navigate(`/event/${eventId}`);
      }
    },
    [showProfileView, showSharedList, profileHandle, searchParams, navigate, location.pathname],
  );

  const handleTagClick = useCallback(
    (type: string, value: string, explicitLabel?: string) => {
      if (headerSearchOpensHome(location.pathname) || isHomeCatalogRoute(location.pathname)) {
        home.applyHomeTagFilter(type, value, explicitLabel);
        return;
      }
      home.selectTagFilter(type, value, explicitLabel);
    },
    [home.applyHomeTagFilter, home.selectTagFilter, location.pathname],
  );

  const isAddEventModalOpen = modalRoute.modal === 'add-event';
  const isAuthModalOpen = modalRoute.modal === 'auth';
  const isTagRatingsModalOpen =
    !showStats && modalRoute.modal === 'tag' && !!modalRoute.tagType && !!modalRoute.tagValue;
  const tagRatingsData = isTagRatingsModalOpen
    ? { type: modalRoute.tagType, value: modalRoute.tagValue }
    : null;
  const isEventPanelModal =
    modalRoute.modal === 'rate' ||
    modalRoute.modal === 'view-ratings' ||
    modalRoute.modal === 'edit-event';

  useEffect(() => {
    if (params.eventId) {
      setOverlayEventId(params.eventId);
    } else if (!searchParams.get('event')) {
      setOverlayEventId(null);
      setOverlaySource(null);
    }
  }, [params.eventId, searchParams]);

  useEffect(() => {
    const sync = () => {
      if (typeof window !== 'undefined') window.scrollTo(0, 0);
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    if (!embedMode && eventIdFromUrl) {
      setOverlayEventId(eventIdFromUrl);
    }
  }, [embedMode, eventIdFromUrl]);

  const anyPopupOpen = !!(
    overlayEventId ||
    isTagRatingsModalOpen ||
    isAddEventModalOpen ||
    isAuthModalOpen ||
    isEventPanelModal
  );
  useBodyScrollLock(anyPopupOpen);

  const goHome = () => {
    setProfileBoardEvents(null);
    home.goHome();
  };

  const goBack = useCallback(() => {
    if (location.key === 'default') {
      navigate('/');
      window.scrollTo(0, 0);
      return;
    }
    navigate(-1);
  }, [navigate, location.key]);

  const openProfile = () => {
    void (async () => {
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('user_id_public')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.user_id_public) {
          navigate(profilePagePath(data.user_id_public));
          window.scrollTo(0, 0);
          return;
        }
      }
      navigate('/profile');
      window.scrollTo(0, 0);
    })();
  };

  const layoutNav = appSettings
    ? {
        appSettings,
        user,
        isAdmin: !!isAdmin,
        pathname,
        desktopLikePointer,
        onGoHome: goHome,
        onOpenStats: openStats,
        onOpenProfile: openProfile,
        onOpenSettings: openSettings,
        onAddEvent: openAddEventModal,
        onSignIn: () => openAuthModal('signin'),
        onSignOut: () => signOut(),
        pinnedArtistBar: <HomePinnedArtistsSlot />,
      }
    : null;

  const renderSharedModals = () => (
    <>
      <AddEventModal
        isOpen={isAddEventModalOpen}
        onClose={closeAppModal}
        onEventAdded={() => void home.fetchEvents()}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        initialMode={modalRoute.authMode}
        promptMessage={modalRoute.authPrompt}
      />
      {isTagRatingsModalOpen && (
        <TagRatingsModal
          isOpen={isTagRatingsModalOpen}
          onClose={closeAppModal}
          tagType={tagRatingsData?.type || ''}
          tagValue={tagRatingsData?.value || ''}
          onEventClick={(eventId) => openEventOverlay(eventId, 'tagModal')}
          refreshTrigger={tagModalRefreshTrigger}
          tagColors={appSettings}
          onTagClick={openTagModal}
        />
      )}
    </>
  );

  if (embedMode && eventIdFromUrl) {
    return (
      <CopyProvider settings={appSettings}>
        <EmbedEventView eventId={eventIdFromUrl} onTagClick={handleTagClick}>
          {renderSharedModals()}
        </EmbedEventView>
      </CopyProvider>
    );
  }

  if (!appSettings || !layoutNav) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 via-neutral-100 to-neutral-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
      </div>
    );
  }

  const activeView = headerActiveView(pathname);
  const searchBar: ReactNode = <HomeHeaderSearch />;

  const chromeValue = {
    openEvent: openEventOverlay,
    closeEventOverlay,
    overlayEventId,
    tagModalRefreshTrigger,
    onTagClick: handleTagClick,
    onAddEvent: openAddEventModal,
    setProfileBoardEvents,
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
        <AppLayout {...layoutNav} activeView={activeView} searchBar={searchBar}>
          <Outlet />
        </AppLayout>
        {renderSharedModals()}
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
export default App;
