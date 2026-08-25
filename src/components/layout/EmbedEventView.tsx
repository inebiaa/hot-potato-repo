import { useEffect, useState } from 'react';
import EventCard from '../EventCard';
import EventJsonLd from '../EventJsonLd';
import { useHomeCatalogOptional } from '../../contexts/HomeCatalogContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAppSettings } from '../../hooks/useAppSettings';
import { fetchEventWithStats, type EventWithStats } from '../../lib/eventsFeed';

type EmbedEventViewProps = {
  eventId: string;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
  children?: React.ReactNode;
};

/** Embed card. One-event fetch; does not wait on the home browse feed. */
export default function EmbedEventView({ eventId, onTagClick, children }: EmbedEventViewProps) {
  const { appSettings } = useAppSettings();
  const { user } = useAuth();
  const catalog = useHomeCatalogOptional();
  const cached = catalog?.events.find((e) => e.id === eventId) ?? null;
  const [fetched, setFetched] = useState<EventWithStats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    void fetchEventWithStats(eventId, user?.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setFailed(true);
        return;
      }
      setFetched(data);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, cached, user?.id]);

  const event = cached ?? fetched;

  if (!appSettings || (!event && !failed)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
      </div>
    );
  }
  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-600">Show not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <EventJsonLd event={event} />
      <div className="max-w-md mx-auto">
        <EventCard
          event={event}
          averageRating={event.average_rating}
          ratingCount={event.rating_count}
          userRating={event.user_rating}
          onRatingSubmitted={() => void catalog?.refreshEventRating(event.id)}
          onEventUpdated={() => void catalog?.fetchEvents()}
          onTagClick={onTagClick}
          tagColors={appSettings}
          customPerformerTags={[]}
          imagePriority
        />
      </div>
      {children}
    </div>
  );
}
