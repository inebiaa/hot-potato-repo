import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { profilePagePath } from '../lib/siteBase';
import { useDesktopLikePointer } from './useDesktopLikePointer';
import { useAppSettings } from './useAppSettings';
import { useHomeCatalog } from '../contexts/HomeCatalogContext';
import type { Event } from '../lib/supabase';

type UseAppLayoutNavOptions = {
  setProfileBoardEvents: (events: Event[] | null) => void;
  openAddEventModal: () => void;
  openAuthModal: (mode?: 'signin' | 'signup', prompt?: string) => void;
};

function scrollTop() {
  window.scrollTo(0, 0);
}

/** Header nav targets and AppLayout prop bundle. */
export function useAppLayoutNav({
  setProfileBoardEvents,
  openAddEventModal,
  openAuthModal,
}: UseAppLayoutNavOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isAdmin } = useAuth();
  const desktopLikePointer = useDesktopLikePointer();
  const { appSettings } = useAppSettings();
  const home = useHomeCatalog();
  const pathname = location.pathname;

  const goHome = useCallback(() => {
    setProfileBoardEvents(null);
    home.goHome();
  }, [setProfileBoardEvents, home]);

  const goBack = useCallback(() => {
    if (location.key === 'default') {
      navigate('/');
      scrollTop();
      return;
    }
    navigate(-1);
  }, [navigate, location.key]);

  const openSettings = useCallback(() => {
    navigate('/settings');
    scrollTop();
  }, [navigate]);

  const openStats = useCallback(() => {
    navigate('/stats');
    scrollTop();
  }, [navigate]);

  const openProfile = useCallback(() => {
    void (async () => {
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
  }, [navigate, user]);

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
            onAddEvent: openAddEventModal,
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
      openAuthModal,
      signOut,
    ],
  );

  return { layoutNav, goBack };
}
