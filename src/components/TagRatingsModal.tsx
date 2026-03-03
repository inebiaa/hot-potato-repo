import { X, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getSeasonFromDate } from '../lib/season';

interface TagRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagType: string;
  tagValue: string;
  /** When set, clicking an event opens it (e.g. in an overlay) for viewing/rating. */
  onEventClick?: (eventId: string) => void;
  /** Increment to refetch list (e.g. after closing an event overlay so ratings stay in sync). */
  refreshTrigger?: number;
}

interface EventRating {
  event_id: string;
  event_name: string;
  avg_rating: number;
  rating_count: number;
}

export default function TagRatingsModal({
  isOpen,
  onClose,
  tagType,
  tagValue,
  onEventClick,
  refreshTrigger = 0,
}: TagRatingsModalProps) {
  const [eventRatings, setEventRatings] = useState<EventRating[]>([]);
  const [totalShows, setTotalShows] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overallAverage, setOverallAverage] = useState(0);
  const [totalRatings, setTotalRatings] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchTagRatings();
    }
  }, [isOpen, tagType, tagValue, refreshTrigger]);

  const fetchTagRatings = async () => {
    setLoading(true);
    try {
      let query = supabase.from('events').select('id, name, date, season');

      switch (tagType) {
        case 'producer':
          query = query.contains('producers', [tagValue]);
          break;
        case 'designer':
          query = query.contains('featured_designers', [tagValue]);
          break;
        case 'model':
          query = query.contains('models', [tagValue]);
          break;
        case 'hair_makeup':
          query = query.contains('hair_makeup', [tagValue]);
          break;
        case 'city':
          query = query.eq('city', tagValue);
          break;
        case 'season':
          break;
        case 'header_tags':
          query = query.contains('genre', [tagValue]);
          break;
        case 'footer_tags':
          query = query.contains('footer_tags', [tagValue]);
          break;
      }

      let { data: events, error: eventsError } = await query;
      if (tagType === 'season' && events) {
        events = events.filter((e: { date: string; season?: string | null }) => (e.season || getSeasonFromDate(e.date)) === tagValue);
      }
      if (eventsError) throw eventsError;

      if (!events || events.length === 0) {
        setEventRatings([]);
        setTotalShows(0);
        setOverallAverage(0);
        setTotalRatings(0);
        setLoading(false);
        return;
      }
      setTotalShows(events.length);

      const eventIds = events.map(e => e.id);

      const { data: ratings, error: ratingsError } = await supabase
        .from('ratings')
        .select('event_id, rating')
        .in('event_id', eventIds);

      if (ratingsError) throw ratingsError;

      const eventRatingsMap = new Map<string, { sum: number; count: number; name: string }>();

      events.forEach(event => {
        eventRatingsMap.set(event.id, { sum: 0, count: 0, name: event.name });
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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {tagValue}
            </h2>
            <p className="text-sm text-gray-600">{getTagTypeLabel()}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Overall Rating</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={24}
                      className={star <= overallAverage ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-gray-900">
                  {overallAverage > 0 ? overallAverage.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-600">Shows</p>
                <p className="text-xl font-bold text-gray-900">{totalShows}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Ratings</p>
                <p className="text-xl font-bold text-gray-900">{totalRatings}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : eventRatings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No rated shows yet for this {getTagTypeLabel().toLowerCase()}. {totalShows > 0 ? `${totalShows} show${totalShows === 1 ? '' : 's'} with this tag.` : ''}
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Shows ({eventRatings.length}{totalShows > 0 ? ` of ${totalShows}` : ''})
                {onEventClick && (
                  <span className="block text-xs font-normal text-gray-500 mt-1">Click any show to open and rate</span>
                )}
              </h3>
              {eventRatings.map((eventRating) => (
                <div
                  key={eventRating.event_id}
                  role={onEventClick ? 'button' : undefined}
                  tabIndex={onEventClick ? 0 : undefined}
                  onClick={onEventClick ? () => onEventClick(eventRating.event_id) : undefined}
                  onKeyDown={onEventClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onEventClick(eventRating.event_id); } : undefined}
                  className={`rounded-lg p-4 transition-colors ${onEventClick ? 'bg-gray-50 hover:bg-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset' : 'bg-gray-50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {eventRating.event_name}
                      </h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              className={
                                star <= eventRating.avg_rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {eventRating.avg_rating > 0 ? eventRating.avg_rating.toFixed(2) : 'Unrated'}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({eventRating.rating_count} {eventRating.rating_count === 1 ? 'rating' : 'ratings'})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
