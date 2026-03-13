import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';
import type { Event } from '../lib/supabase';

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
  /** When true, event overlay is open on top; modal gets pointer-events-none so clicks pass through (stats flow). */
  eventOverlayOpen?: boolean;
  onCloseEventOverlay?: () => void;
}

interface EventRating {
  event_id: string;
  event_name: string;
  avg_rating: number;
  rating_count: number;
  event?: Event;
}

export default function TagRatingsModal({
  isOpen,
  onClose,
  tagType,
  tagValue,
  onEventClick,
  refreshTrigger = 0,
  tagColors,
  onTagClick,
  eventsForTag,
  eventOverlayOpen = false,
  onCloseEventOverlay,
}: TagRatingsModalProps) {
  const [eventRatings, setEventRatings] = useState<EventRating[]>([]);
  const [totalShows, setTotalShows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overallAverage, setOverallAverage] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);
  const [isListExpanded, setIsListExpanded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTagRatings();
    }
  }, [isOpen, tagType, tagValue, refreshTrigger]); // eventsForTag used inside fetchTagRatings; omit to avoid ref churn

  const matchEvent = (e: { producers?: string[] | null; featured_designers?: string[] | null; models?: string[] | null; hair_makeup?: string[] | null; city?: string; date?: string; header_tags?: string[] | null; genre?: string[] | null; footer_tags?: string[] | null }) => {
    switch (tagType) {
      case 'producer':
        return (e.producers || []).some((p) => p === tagValue);
      case 'designer':
        return (e.featured_designers || []).some((d) => d === tagValue);
      case 'model':
        return (e.models || []).some((m) => m === tagValue);
      case 'hair_makeup':
        return (e.hair_makeup || []).some((h) => h === tagValue);
      case 'city':
        return e.city === tagValue;
      case 'season':
        return getSeasonFromDate(e.date || '') === tagValue;
      case 'header_tags':
        return (e.header_tags || e.genre || []).some((t) => t === tagValue);
      case 'footer_tags':
        return (e.footer_tags || []).some((t) => t === tagValue);
      default:
        return false;
    }
  };

  const fetchTagRatings = async () => {
    if (!tagType || !tagValue) {
      setEventRatings([]);
      setTotalShows(0);
      setOverallAverage(0);
      setTotalRatings(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let events: any[];
      if (eventsForTag?.length) {
        events = eventsForTag;
      } else {
        const { data: allEvents, error: eventsError } = await supabase
          .from('events')
          .select('id, name, date, producers, featured_designers, models, hair_makeup, city, genre, header_tags, footer_tags, custom_tags, custom_tag_meta')
          .order('date', { ascending: false });

        if (eventsError) throw eventsError;

        events = (allEvents || []).filter((e: any) => matchEvent(e));
      }

      if (!events.length) {
        setEventRatings([]);
        setTotalShows(0);
        setOverallAverage(0);
        setTotalRatings(0);
        setLoading(false);
        return;
      }
      setTotalShows(events.length);

      const eventIds = events.map((e: any) => e.id);

      const { data: allRatings, error: ratingsError } = await supabase
        .from('ratings')
        .select('event_id, rating');

      if (ratingsError) throw ratingsError;

      const ratings = (allRatings || []).filter((r: { event_id: string }) => eventIds.includes(r.event_id));

      const eventRatingsMap = new Map<string, { sum: number; count: number; name: string; event?: Event }>();

      events.forEach((event: any) => {
        eventRatingsMap.set(event.id, { sum: 0, count: 0, name: event.name, event });
      });

      let totalSum = 0;
      let totalCount = 0;

      ratings?.forEach(rating => {
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
        .sort((a, b) => b.avg_rating - a.avg_rating);

      setEventRatings(results);
      setOverallAverage(totalCount > 0 ? totalSum / totalCount : 0);
      setTotalRatings(totalCount);
    } catch (error) {
      console.error('Error fetching tag ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTagTypeLabel = () => {
    switch (tagType) {
      case 'producer': return 'Producer';
      case 'designer': return 'Designer';
      case 'model': return 'Model';
      case 'hair_makeup': return 'Hair & Makeup Artist';
      case 'city': return 'City';
      case 'season': return 'Season';
      case 'header_tags': return 'Genre';
      case 'footer_tags': return 'Tag';
      default: return 'Tag';
    }
  };

  const handleEventClick = (eventId: string) => {
    onEventClick?.(eventId);
    // Don't close modal—keep it open behind the overlay so user returns to it when closing the event card
  };

  const handleBackdropClick = () => {
    if (eventOverlayOpen && onCloseEventOverlay) {
      onCloseEventOverlay();
    } else {
      onClose();
    }
  };

  const modal = (
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70] ${eventOverlayOpen ? 'pointer-events-none' : ''}`}
      onClick={(e) => e.target === e.currentTarget && handleBackdropClick()}
    >
      <div className="relative max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl shadow-xl p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Loading…</p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-lg font-semibold text-gray-900 truncate">{tagValue}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{getTagTypeLabel()}</p>
              </div>

              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={56}
                      className={star <= overallAverage ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="text-2xl font-bold text-gray-900">
                    {overallAverage > 0 ? overallAverage.toFixed(1) : '—'}
                  </span>
                  <span>{totalShows} show{totalShows === 1 ? '' : 's'}</span>
                  <span>{totalRatings} rating{totalRatings === 1 ? '' : 's'}</span>
                </div>
              </div>

              {eventRatings.length > 0 ? (
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setIsListExpanded((x) => !x)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      {isListExpanded ? 'Hide' : 'View'} shows
                    </span>
                    <span className="text-xs text-gray-500">
                      {eventRatings.length} total
                    </span>
                  </button>
                  {isListExpanded && (
                    <ul className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-100 min-h-[14rem]">
                      {eventRatings.map((eventRating) => (
                        <li
                          key={eventRating.event_id}
                          role={onEventClick ? 'button' : undefined}
                          tabIndex={onEventClick ? 0 : undefined}
                          onClick={onEventClick ? () => handleEventClick(eventRating.event_id) : undefined}
                          onKeyDown={onEventClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleEventClick(eventRating.event_id); } : undefined}
                          className={`flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${onEventClick ? 'hover:bg-amber-50 cursor-pointer active:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-inset' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900 truncate block">{eventRating.event_name}</span>
                            {eventRating.event?.date && (
                              <span className="text-xs text-gray-500">
                                {new Date(eventRating.event.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={12}
                                  className={s <= eventRating.avg_rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-medium text-gray-600 w-6">
                              {eventRating.avg_rating > 0 ? eventRating.avg_rating.toFixed(1) : '—'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p className="text-center text-sm text-gray-500 py-4">
                  No rated shows yet. {totalShows > 0 ? `${totalShows} show${totalShows === 1 ? '' : 's'} with this tag.` : ''}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return isOpen && typeof document !== 'undefined'
    ? createPortal(modal, document.body)
    : null;
}
