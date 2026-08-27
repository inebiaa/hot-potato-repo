import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Sparkles, Search } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import EventCard from '../components/EventCard/EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from '../components/MasonryLaneFeed';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAuth } from '../contexts/AuthContext';
import { useHomeCatalog } from '../contexts/HomeCatalogContext';
import { usePullRefreshing, useRegisterPullToRefresh } from '../contexts/PullToRefreshContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { useT } from '../hooks/useCopy';
import { compareEventsForFeed } from '../lib/eventsFeed';
import { isEventUpcoming } from '../lib/eventDates';
import { eventPagePath } from '../lib/siteBase';
import { LoadingSpinner, typeTitle, typeHeadline, typeCallout } from '../components/ui';

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
    fetchEvents,
    loadMoreError,
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

  const refreshFeed = useCallback(
    () => fetchEvents({ force: true, silent: true }),
    [fetchEvents],
  );
  useRegisterPullToRefresh(refreshFeed);
  const pullRefreshing = usePullRefreshing();

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
    <div className="max-w-[2400px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 my-4 sm:my-8">
      {!user ? (
        <div className="mb-8 overflow-visible">
          <h2 className={`mb-2 ${typeTitle} text-foreground`}>{t('home.title')}</h2>
          <p className={`max-w-2xl ${typeCallout} text-muted-foreground`}>
            {t('home.subtitleSignedOut')}
          </p>
        </div>
      ) : null}

      {(loading && events.length === 0 && !pullRefreshing) ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : events.length === 0 && eventsError ? (
        <div className="py-16 text-center">
          <p className={`${typeCallout} text-muted-foreground`}>{t('home.loadErrorTitle')}</p>
          <button
            type="button"
            onClick={() => void fetchEvents({ force: true })}
            className="mt-4 rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:opacity-90"
          >
            {t('home.loadErrorRetry')}
          </button>
        </div>
      ) : events.length === 0 && !eventsError ? (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md rounded-lg bg-card p-8 shadow-md">
            <Sparkles size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className={`mb-2 ${typeHeadline} text-foreground`}>{t('empty.noShows.title')}</h3>
            <p className={`mb-4 ${typeCallout} text-muted-foreground`}>{t('empty.noShows.body')}</p>
            {user && (
              <button
                onClick={onAddEvent}
                className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:opacity-90"
              >
                {t('empty.noShows.cta')}
              </button>
            )}
          </div>
        </div>
      ) : filtering && catalogStillLoading && filteredEvents.length === 0 && !pullRefreshing ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto max-w-md rounded-lg bg-card p-8 shadow-md">
            <Search size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h3 className={`mb-2 ${typeHeadline} text-foreground`}>{t('empty.noMatch.title')}</h3>
            <p className={`mb-4 ${typeCallout} text-muted-foreground`}>{t('empty.noMatch.body')}</p>
            <button
              onClick={clearFilters}
              className="rounded-lg bg-primary px-6 py-3 text-primary-foreground transition-colors hover:opacity-90"
            >
              {t('empty.noMatch.cta')}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full">
          <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
          {loadMoreError ? (
            <div className="py-8 text-center">
              <p className={`${typeCallout} text-muted-foreground`}>{t('home.loadMoreError')}</p>
              <button
                type="button"
                  onClick={() => void fetchEvents({ append: true })}
                className="mt-2 text-sm text-foreground underline underline-offset-2 hover:opacity-80"
              >
                {t('home.loadErrorRetry')}
              </button>
            </div>
          ) : null}
          {hasMoreEvents && browsing && !loadMoreError && (
            <div ref={feedSentinelRef} className="h-1 w-full" aria-hidden />
          )}
        </div>
      )}
    </div>
  );
}
