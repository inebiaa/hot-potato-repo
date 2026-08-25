import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { clearAppModalParams, setAppModalParams } from '../lib/searchParamsModal';
import { resolveAppModalState } from '../lib/appModalState';

export function useAppModals() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const modalState = useMemo(
    () => resolveAppModalState(location.pathname, searchParams),
    [location.pathname, searchParams],
  );

  const closeAppModal = useCallback(() => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  }, [navigate, location.pathname, searchParams]);

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

  return {
    modalRoute: modalState.modalRoute,
    closeAppModal,
    openAddEventModal,
    openTagModal,
    openAuthModal,
    closeAuthModal,
    isAddEventModalOpen: modalState.isAddEventModalOpen,
    isAuthModalOpen: modalState.isAuthModalOpen,
    isTagRatingsModalOpen: modalState.isTagRatingsModalOpen,
    tagRatingsData: modalState.tagRatingsData,
    isEventPanelModal: modalState.isEventPanelModal,
  };
}
