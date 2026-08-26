import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { profilePagePath } from '../lib/siteBase';
import { useDesktopLikePointer } from './useDesktopLikePointer';
import { useAppSettings } from './useAppSettings';
import { useHomeCatalog } from '../contexts/HomeCatalogContext';
import { COPY_CATALOG } from '../copy/catalog';
import type { Event } from '../lib/supabase';

type UseAppLayoutNavOptions = {
  setProfileBoardEvents: (events: Event[] | null) => void;
  openAddEventModal: () => void;
  openCreateListModal: () => void;
  openAuthModal: (mode?: 'signin' | 'signup', prompt?: string) => void;
};

function scrollTop() {
  window.scrollTo(0, 0);
}

/** Header nav targets and AppLayout prop bundle. */
export function useAppLayoutNav({
  setProfileBoardEvents,
  openAddEventModal,
  openCreateListModal,
  openAuthModal,
}: UseAppLayoutNavOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isAdmin } = useAuth();
  const desktopLikePointer = useDesktopLikePointer();
  const { appSettings } = useAppSettings();
  const home = useHomeCatalog();
  const pathname = location.pathname;

  const resetCatalogNav = useCallback(() => {
    setProfileBoardEvents(null);
    home.clearFilters();
  }, [setProfileBoardEvents, home]);

  const goHome = useCallback(() => {
    setProfileBoardEvents(null);
    home.goHome();
  }, [setProfileBoardEvents, home]);

  const goBack = useCallback(() => {
    goHome();
  }, [goHome]);

  const openSettings = useCallback(() => {
    resetCatalogNav();
    navigate('/settings');
    scrollTop();
  }, [resetCatalogNav, navigate]);

  const openStats = useCallback(() => {
    resetCatalogNav();
    navigate('/stats');
    scrollTop();
  }, [resetCatalogNav, navigate]);

  const openProfile = useCallback(() => {
    void (async () => {
      resetCatalogNav();
      if (user) {
        const { data } = await supabase
          .from('user_profiles')
          .select('user_id_public')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data?.user_id_public) {
          navigate(profilePagePath(data.user_id_public));
          scrollTop();
          return;
        }
      }
      navigate('/profile');
      scrollTop();
    })();
  }, [resetCatalogNav, navigate, user]);

  const openCreateList = useCallback(() => {
    if (!user) {
      openAuthModal('signin', COPY_CATALOG['auth.prompt.createList'].default);
      return;
    }
    openCreateListModal();
  }, [user, openAuthModal, openCreateListModal]);

  const layoutNav = useMemo(
    () =>
      appSettings
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
            onOpenAddShow: openAddEventModal,
            onOpenCreateList: openCreateList,
            onSignIn: () => openAuthModal('signin'),
            onSignOut: () => signOut(),
          }
        : null,
    [
      appSettings,
      user,
      isAdmin,
      pathname,
      desktopLikePointer,
      goHome,
      openStats,
      openProfile,
      openSettings,
      openAddEventModal,
      openCreateList,
      openAuthModal,
      signOut,
    ],
  );

  return { layoutNav, goBack };
}
