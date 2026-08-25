import { parseAppModal } from './searchParamsModal';
import { isStatsRoute } from './homeCatalogRoute';

export type AppModalState = {
  modalRoute: ReturnType<typeof parseAppModal>;
  isAddEventModalOpen: boolean;
  isAuthModalOpen: boolean;
  isTagRatingsModalOpen: boolean;
  tagRatingsData: { type: string; value: string } | null;
  isEventPanelModal: boolean;
};

/** Pure modal open state from URL (testable without React Router). */
export function resolveAppModalState(pathname: string, searchParams: URLSearchParams): AppModalState {
  const modalRoute = parseAppModal(searchParams);
  const isAddEventModalOpen = modalRoute.modal === 'add-event';
  const isAuthModalOpen = modalRoute.modal === 'auth';
  const isTagRatingsModalOpen =
    !isStatsRoute(pathname) &&
    modalRoute.modal === 'tag' &&
    !!modalRoute.tagType &&
    !!modalRoute.tagValue;
  const tagRatingsData = isTagRatingsModalOpen
    ? { type: modalRoute.tagType, value: modalRoute.tagValue }
    : null;
  const isEventPanelModal =
    modalRoute.modal === 'rate' ||
    modalRoute.modal === 'view-ratings' ||
    modalRoute.modal === 'edit-event';

  return {
    modalRoute,
    isAddEventModalOpen,
    isAuthModalOpen,
    isTagRatingsModalOpen,
    tagRatingsData,
    isEventPanelModal,
  };
}
