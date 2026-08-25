import { useEffect, useRef, type ReactNode } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import EventCard from '../components/EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from '../components/MasonryLaneFeed';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeCatalog } from '../contexts/HomeCatalogContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { useT } from '../hooks/useCopy';
import { compareEventsForFeed } from '../lib/eventsFeed';
import { isEventUpcoming } from '../lib/eventDates';
import { eventPagePath } from '../lib/siteBase';

const PRIORITY_FEED_IMAGES = 6;

export default function HomePage() {
  const t = useT();
  const { user } = useAuth();
  const { appSettings } = useAppSettings();
  const { onTagClick, openEvent, onAddEvent, overlayEventId } = useAppChrome();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const eventIdFromUrl = params.eventId ?? searchParams.get('event');
  const embedMode = searchParams.get('embed') === '1';
  const hasClearedFiltersForSharedLink = useRef(false);
  const {
    loading,
    events,
    eventsError,
    setEventsError,
    fetchEvents,
    filtering,
    catalogStillLoading,
    filteredEvents,
    eventCardRefs,
    refreshEventRating,
    hasMoreEvents,
    browsing,
    feedSentinelRef,
    clearFilters,
    mergeDeepLinkedEvent,
  } = useHomeCatalog();

  useEffect(() => {
    if (embedMode || !eventIdFromUrl || loading || events.length === 0) return;
    if (hasClearedFiltersForSharedLink.current) return;
    const eventExists = events.some((e) => e.id === eventIdFromUrl);
    const eventInFiltered = filteredEvents.some((e) => e.id === eventIdFromUrl);
    if (eventExists && !eventInFiltered) {
      clearFilters();
      hasClearedFiltersForSharedLink.current = true;
    }
  }, [embedMode, eventIdFromUrl, loading, events, filteredEvents, clearFilters]);

  useEffect(() => {
    if (!eventIdFromUrl || loading) return;
    if (events.some((e) => e.id === eventIdFromUrl)) return;
    void mergeDeepLinkedEvent(eventIdFromUrl);
  }, [eventIdFromUrl, loading, events, mergeDeepLinkedEvent]);

  useEffect(() => {
    if (embedMode || !eventIdFromUrl || loading || filteredEvents.length === 0 || overlayEventId) return;
    const el = eventCardRefs.current[eventIdFromUrl];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [embedMode, eventIdFromUrl, loading, filteredEvents, overlayEventId, eventCardRefs]);

  if (!appSettings) return null;

  const sortedByDate = [...filteredEvents].sort((a, b) => compareEventsForFeed(a, b));
  const pastEvents = sortedByDate.filter((e) => !isEventUpcoming(e.date));
  const upcoming = sortedByDate.filter((e) => isEventUpcoming(e.date));

  let feedImageIndex = 0;

  const renderCard = (event: (typeof filteredEvents)[number]) => {
    const imagePriority = feedImageIndex < PRIORITY_FEED_IMAGES;
    feedImageIndex += 1;
    return (
      <div
        key={event.id}
        ref={(el) => {
          eventCardRefs.current[event.id] = el;
        }}
      >
        <EventCard
          event={event}
          averageRating={event.average_rating}
          ratingCount={event.rating_count}
          userRating={event.user_rating}
          onRatingSubmitted={() => void refreshEventRating(event.id)}
          onEventUpdated={() => void fetchEvents()}
          onTagClick={onTagClick}
          tagColors={appSettings}
          customPerformerTags={[]}
          viewHref={eventPagePath(event.id)}
          onViewClick={openEvent}
          imagePriority={imagePriority}
        />
      </div>
    );
  };

  const cardCell = (content: ReactNode) => (
    <div className="flex min-w-0 w-full flex-col self-start">
      <div className="min-w-0">{content}</div>
    </div>
  );

  const laneItems: MasonryLaneItem[] = [];
  for (const event of upcoming) {
    laneItems.push({ id: event.id, children: cardCell(renderCard(event)) });
  }
  for (const event of pastEvents) {
    laneItems.push({ id: event.id, children: cardCell(renderCard(event)) });
  }

  return (
    <div className="max-w-[2400px] mx-auto px-4 py-8 sm:px-6 lg:px-8 my-8">
      <div className="mb-8 overflow-visible">
        <h2 className="mb-2 text-3xl font-bold text-gray-900">{t('home.title')}</h2>
        <p className="max-w-2xl text-gray-600">
          {user ? t('home.subtitleSignedIn') : t('home.subtitleSignedOut')}
        </p>
      </div>

      {eventsError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-red-800">{t('home.loadErrorTitle')}</p>
            <p className="text-sm text-red-700 mt-1 font-mono">{eventsError}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => {
                setEventsError(null);
                void fetchEvents();
              }}
              className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              {t('home.loadErrorRetry')}
            </button>
            <button
              onClick={() => setEventsError(null)}
              className="px-3 py-1.5 border border-red-300 rounded hover:bg-red-100 text-red-700 text-sm"
            >
              {t('home.loadErrorDismiss')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      ) : events.length === 0 && !eventsError ? (
        <div className="text-center py-12">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
            <Sparkles size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('empty.noShows.title')}</h3>
            <p className="text-gray-600 mb-4">{t('empty.noShows.body')}</p>
            {user && (
              <button
                onClick={onAddEvent}
                className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-neutral-800"
              >
                {t('empty.noShows.cta')}
              </button>
            )}
          </div>
        </div>
      ) : filtering && catalogStillLoading && filteredEvents.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md mx-auto">
            <Search size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('empty.noMatch.title')}</h3>
            <p className="text-gray-600 mb-4">{t('empty.noMatch.body')}</p>
            <button
              onClick={clearFilters}
              className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:bg-neutral-800"
            >
              {t('empty.noMatch.cta')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
          {hasMoreEvents && browsing && (
            <div ref={feedSentinelRef} className="h-1 w-full" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
