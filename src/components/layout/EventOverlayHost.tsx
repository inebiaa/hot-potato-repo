import { useEffect, useState } from 'react';
import EventOverlay from '../EventOverlay';
import EventJsonLd from '../EventJsonLd';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { useHomeCatalogOptional } from '../../contexts/HomeCatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { fetchEventWithStats, type EventWithStats } from '../../lib/eventsFeed';

type EventOverlayHostProps = {
  eventId: string;
  elevated?: boolean;
  onClose: () => void;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
};

/** Shared overlay. Loads one event; may reuse the home catalog if that show is already there. */
export default function EventOverlayHost({
  eventId,
  elevated = false,
  onClose,
  onTagClick,
}: EventOverlayHostProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const { refreshHomeCatalog, refreshHomeEventRating } = useAppChrome();
  const catalog = useHomeCatalogOptional();
  const cached =
    catalog?.events.find((e) => e.id === eventId) ??
    catalog?.filteredEvents.find((e) => e.id === eventId) ??
    null;
  const [fetched, setFetched] = useState<EventWithStats | null>(null);

  const mergeDeepLinkedEvent = catalog?.mergeDeepLinkedEvent;

  useEffect(() => {
    if (cached) {
      setFetched(null);
      return;
    }
    let cancelled = false;
    void fetchEventWithStats(eventId, user?.id).then(({ data }) => {
      if (cancelled || !data) return;
      setFetched(data);
      void mergeDeepLinkedEvent?.(eventId);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, cached, user?.id, mergeDeepLinkedEvent]);

  const event = cached ?? fetched;
  if (!appSettings) return null;

  return (
    <>
      {event ? <EventJsonLd event={event} /> : null}
      <EventOverlay
        eventId={eventId}
        event={event}
        elevated={elevated}
        appSettings={appSettings}
        onClose={onClose}
        onTagClick={onTagClick}
        onRatingSubmitted={() => refreshHomeEventRating(eventId)}
        onEventUpdated={refreshHomeCatalog}
      />
    </>
  );
}
