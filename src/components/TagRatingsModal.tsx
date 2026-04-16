import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import type { Event } from '../lib/supabase';
import { eventMatchesVenueTag, type TagResolutionMap } from '../lib/tagDisplayResolution';
import { sameTagSpelling, tagArrayContainsNormalized } from '../lib/tagIdentity';
import TagCardRouter from './tagCards/TagCardRouter';
import ModalShell from './ModalShell';
import type { EventRating, TagRatingEventSlice } from './tagCards/types';

interface TagRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagType: string;
  tagValue: string;
  /** When set, clicking an event opens it (e.g. in an overlay) for viewing/rating. */
  onEventClick?: (eventId: string) => void;
  /** Increment to refetch list (e.g. after closing an event overlay so ratings stay in sync). */
  refreshTrigger?: number;
  /** Tag colors for pill styling (matches EventCard). */
  tagColors?: {
    producer_bg_color?: string;
    producer_text_color?: string;
    designer_bg_color?: string;
    designer_text_color?: string;
    model_bg_color?: string;
    model_text_color?: string;
    hair_makeup_bg_color?: string;
    hair_makeup_text_color?: string;
    city_bg_color?: string;
    city_text_color?: string;
    season_bg_color?: string;
    season_text_color?: string;
    header_tags_bg_color?: string;
    header_tags_text_color?: string;
    footer_tags_bg_color?: string;
    footer_tags_text_color?: string;
    producer_icon?: string;
    designer_icon?: string;
    model_icon?: string;
    hair_makeup_icon?: string;
    city_icon?: string;
    season_icon?: string;
    header_tags_icon?: string;
    footer_tags_icon?: string;
    optional_tags_bg_color?: string;
    optional_tags_text_color?: string;
  };
  /** When set, clicking a pill opens that tag's modal. */
  onTagClick?: (type: string, value: string) => void;
  /** Pre-filtered events matching the tag (from stats page). When provided, used instead of fetching events. */
  eventsForTag?: Event[];
  /** Full events list from the app shell (e.g. already loaded for the feed). Avoids a second events query when set. */
  cachedAllEvents?: Event[];
  tagResolutionMap?: TagResolutionMap | null;
  /** When true, event overlay is open on top; modal gets pointer-events-none so clicks pass through (stats flow). */
  eventOverlayOpen?: boolean;
  onCloseEventOverlay?: () => void;
}

export default function TagRatingsModal({
  isOpen,
  onClose,
  tagType,
  tagValue,
  onEventClick,
  refreshTrigger = 0,
  tagColors,
  eventsForTag,
  cachedAllEvents,
  tagResolutionMap,
  eventOverlayOpen = false,
  onCloseEventOverlay,
}: TagRatingsModalProps) {
  const [eventRatings, setEventRatings] = useState<EventRating[]>([]);
  const [totalShows, setTotalShows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overallAverage, setOverallAverage] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const fetchSeqRef = useRef(0);

  /** Clear stale list/totals and show loading before paint when the open tag identity changes (avoids new title + old rows). */
  useLayoutEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setEventRatings([]);
    setTotalShows(0);
    setOverallAverage(0);
    setTotalRatings(0);
  }, [isOpen, tagType, tagValue]);

  useEffect(() => {
    if (!isOpen) return;
    const seq = ++fetchSeqRef.current;
    void fetchTagRatings(seq);
    return () => {
      fetchSeqRef.current += 1;
    };
    // fetchTagRatings is async and reads latest props; listing all deps would refetch excessively
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tagType, tagValue, refreshTrigger, tagResolutionMap, eventsForTag, cachedAllEvents]);

  const matchEvent = (e: {
    producers?: string[] | null;
    featured_designers?: string[] | null;
    models?: string[] | null;
    hair_makeup?: string[] | null;
    city?: string;
    location?: string | null;
    date?: string;
    header_tags?: string[] | null;
    genre?: string[] | null;
    footer_tags?: string[] | null;
  }) => {
    switch (tagType) {
      case 'producer':
        return tagArrayContainsNormalized(e.producers, tagValue);
      case 'designer':
        return tagArrayContainsNormalized(e.featured_designers, tagValue);
      case 'model':
        return tagArrayContainsNormalized(e.models, tagValue);
      case 'hair_makeup':
        return tagArrayContainsNormalized(e.hair_makeup, tagValue);
      case 'city':
        return sameTagSpelling(e.city, tagValue);
      case 'venue':
        return eventMatchesVenueTag({ location: e.location || null }, tagValue, tagResolutionMap);
      case 'season':
        return getSeasonFromDate(e.date || '') === tagValue;
      case 'header_tags':
        return tagArrayContainsNormalized(e.header_tags || e.genre, tagValue);
      case 'footer_tags':
        return tagArrayContainsNormalized(e.footer_tags, tagValue);
      default:
        return false;
    }
  };

  const isFetchStale = (seq: number) => seq !== fetchSeqRef.current;

  const fetchTagRatings = async (seq: number) => {
    if (!tagType || !tagValue) {
      if (!isFetchStale(seq)) {
        setEventRatings([]);
        setTotalShows(0);
        setOverallAverage(0);
        setTotalRatings(0);
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    try {
      let events: TagRatingEventSlice[];
      if (eventsForTag != null) {
        events = eventsForTag;
      } else if (cachedAllEvents !== undefined) {
        events = cachedAllEvents.filter((e) => matchEvent(e));
      } else {
        const { data: allEvents, error: eventsError } = await supabase
          .from('events')
          .select('id, name, date, producers, featured_designers, models, hair_makeup, city, location, genre, header_tags, footer_tags, custom_tags, custom_tag_meta')
          .order('date', { ascending: false });

        if (eventsError) throw eventsError;

        if (isFetchStale(seq)) return;
        events = ((allEvents || []) as TagRatingEventSlice[]).filter((e) => matchEvent(e));
      }

      if (isFetchStale(seq)) return;

      if (!events.length) {
        if (!isFetchStale(seq)) {
          setEventRatings([]);
          setTotalShows(0);
          setOverallAverage(0);
          setTotalRatings(0);
          setLoading(false);
        }
        return;
      }

      const eventIds = events.map((e) => e.id);

      const { data: ratingsRows, error: ratingsError } = await supabase
        .from('ratings')
        .select('event_id, rating')
        .in('event_id', eventIds);

      if (ratingsError) throw ratingsError;

      if (isFetchStale(seq)) return;

      const ratings = ratingsRows || [];

      const eventRatingsMap = new Map<string, { sum: number; count: number; name: string; event?: TagRatingEventSlice }>();

      events.forEach((event) => {
        eventRatingsMap.set(event.id, { sum: 0, count: 0, name: event.name, event });
      });

      let totalSum = 0;
      let totalCount = 0;

      ratings.forEach((rating: { event_id: string; rating: number }) => {
        const eventData = eventRatingsMap.get(rating.event_id);
        if (eventData) {
          eventData.sum += rating.rating;
          eventData.count += 1;
          totalSum += rating.rating;
          totalCount += 1;
        }
      });

      const results: EventRating[] = Array.from(eventRatingsMap.entries())
        .map(([id, data]) => ({
          event_id: id,
          event_name: data.name,
          avg_rating: data.count > 0 ? data.sum / data.count : 0,
          rating_count: data.count,
          event: data.event,
        }))
        .sort((a, b) => {
          const dateA = a.event?.date || '';
          const dateB = b.event?.date || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return a.event_name.localeCompare(b.event_name);
        });

      if (!isFetchStale(seq)) {
        setEventRatings(results);
        setTotalShows(events.length);
        setOverallAverage(totalCount > 0 ? totalSum / totalCount : 0);
        setTotalRatings(totalCount);
      }
    } catch (error) {
      console.error('Error fetching tag ratings:', error);
    } finally {
      if (!isFetchStale(seq)) {
        setLoading(false);
      }
    }
  };

  const handleBackdropClick = () => {
    if (eventOverlayOpen && onCloseEventOverlay) {
      onCloseEventOverlay();
    } else {
      onClose();
    }
  };

  const sharedCardProps = {
    tagValue,
    eventRatings,
    totalShows,
    overallAverage,
    totalRatings,
    onEventClick,
    tagColors,
  };

  const modal = (
    <ModalShell
      onClose={handleBackdropClick}
      ariaLabel="Tag ratings"
      zClass="z-[70]"
      panelClassName="max-w-md sm:rounded-lg"
      hideTitleBar
      backdropClassName={eventOverlayOpen ? 'pointer-events-none' : ''}
    >
      <div className={eventOverlayOpen ? 'pointer-events-none' : ''}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        ) : (
          <TagCardRouter tagType={tagType} {...sharedCardProps} />
        )}
      </div>
    </ModalShell>
  );

  return isOpen && typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
