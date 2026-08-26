import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import RatingModal from '../RatingModal';
import ViewRatingsModal from '../ViewRatingsModal';
import EditEventModal from '../EditEventModal';
import { useAuth } from '../../contexts/AuthContext';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { useHomeCatalogOptional } from '../../contexts/HomeCatalogContext';
import { useT } from '../../hooks/useCopy';
import { isEventUpcoming } from '../../lib/eventDates';
import { fetchEventWithStats, type EventWithStats } from '../../lib/eventsFeed';
import {
  clearAppModalParams,
  parseAppModal,
  setAppModalParams,
} from '../../lib/searchParamsModal';
import type { AppSettings } from '../../types/appSettings';

type EventPanelModalsHostProps = {
  appSettings: AppSettings;
};

/**
 * Single mount point for rate / view-ratings / edit-event panels (URL-driven).
 * Cards navigate here; they do not mount modal trees per instance.
 */
export default function EventPanelModalsHost({ appSettings }: EventPanelModalsHostProps) {
  const t = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const params = useParams();
  const { onTagClick, refreshHomeEventRating, refreshHomeCatalog } = useAppChrome();
  const catalog = useHomeCatalogOptional();

  const parsedModal = useMemo(() => parseAppModal(searchParams), [searchParams]);
  const panelEventId = params.eventId ?? parsedModal.targetEventId ?? '';

  const isRatingModalOpen = parsedModal.modal === 'rate' && !!panelEventId;
  const isViewRatingsModalOpen = parsedModal.modal === 'view-ratings' && !!panelEventId;
  const isEditModalOpen = parsedModal.modal === 'edit-event' && !!panelEventId;

  const anyPanelOpen = isRatingModalOpen || isViewRatingsModalOpen || isEditModalOpen;

  const cached =
    catalog?.events.find((e) => e.id === panelEventId) ??
    catalog?.filteredEvents.find((e) => e.id === panelEventId) ??
    null;

  const [fetched, setFetched] = useState<EventWithStats | null>(null);

  useEffect(() => {
    if (!anyPanelOpen || !panelEventId) {
      setFetched(null);
      return;
    }
    if (cached) {
      setFetched(null);
      return;
    }
    let cancelled = false;
    void fetchEventWithStats(panelEventId, user?.id).then(({ data }) => {
      if (!cancelled && data) setFetched(data);
    });
    return () => {
      cancelled = true;
    };
  }, [anyPanelOpen, panelEventId, cached, user?.id]);

  const event =
    cached?.id === panelEventId ? cached : fetched?.id === panelEventId ? fetched : null;

  const ratingAllowed = event ? !isEventUpcoming(event.date) : false;

  const closeEventPanels = () => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  };

  useEffect(() => {
    if (!isRatingModalOpen || user) return;
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, 'auth', {
        authMode: 'signin',
        authPrompt: t('auth.prompt.leaveReview'),
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react when rate modal opens while signed out
  }, [isRatingModalOpen, user]);

  if (!anyPanelOpen || !event) return null;

  return (
    <>
      <RatingModal
        isOpen={isRatingModalOpen && ratingAllowed && !!user}
        onClose={closeEventPanels}
        event={event}
        existingRating={event.user_rating}
        onRatingSubmitted={() => refreshHomeEventRating(event.id)}
        tagColors={appSettings}
        customPerformerTags={[]}
      />

      <ViewRatingsModal
        isOpen={isViewRatingsModalOpen && ratingAllowed}
        onClose={closeEventPanels}
        eventId={event.id}
        eventName={event.name}
        event={event}
        currentUserId={user?.id}
        onRatingSubmitted={() => refreshHomeEventRating(event.id)}
        tagColors={appSettings}
        customPerformerTags={[]}
        allowRatingEdits={ratingAllowed}
        onTagClick={onTagClick}
      />

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={closeEventPanels}
        event={event}
        onEventUpdated={refreshHomeCatalog}
      />
    </>
  );
}
