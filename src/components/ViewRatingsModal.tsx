import { useState, useEffect } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, Event } from '../lib/supabase';
import RatingModal from './RatingModal';
import CommentWithTags from './CommentWithTags';

interface Rating {
  id: string;
  user_id: string;
  event_id: string;
  rating: number;
  comment?: string;
  created_at: string;
  username?: string;
}

interface ViewRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  singleUserId?: string;
  /** When set, shows a "View full event" button that opens the event card */
  onViewEvent?: (eventId: string) => void;
}

export default function ViewRatingsModal({ isOpen, onClose, eventId, eventName, event, currentUserId, onRatingSubmitted, tagColors, customPerformerTags = [], onViewEvent, singleUserId }: ViewRatingsModalProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRatingId, setExpandedRatingId] = useState<string | null>(null);
  const [editingRating, setEditingRating] = useState<Rating | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchRatings();
    }
  }, [isOpen, eventId]);

  const fetchRatings = async () => {
    setLoading(true);
    try {
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('ratings')
        .select('*')
        .eq('event_id', eventId)
        .order('rating', { ascending: false });

      if (ratingsError) throw ratingsError;

      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('user_id, username');

      if (profilesError) throw profilesError;

      const ratingsWithUsernames = (ratingsData || []).map((rating) => {
        const profile = profilesData?.find((p) => p.user_id === rating.user_id);
        return {
          ...rating,
          username: profile?.username || 'Unknown User'
        };
      });

      const filteredRatings = singleUserId
        ? ratingsWithUsernames.filter((rating) => rating.user_id === singleUserId)
        : ratingsWithUsernames;

      setRatings(filteredRatings);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getAverageRating = () => {
    if (ratings.length === 0) return 0;
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    return (total / ratings.length).toFixed(1);
  };

  const seasonLabel = Array.isArray(event?.season)
    ? event.season.join(', ')
    : (event?.season || 'Season TBD');

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-2xl w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {!singleUserId ? (
          <div className="p-6 border-b">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="text-2xl font-bold text-gray-900">All Ratings</h2>
            </div>
            <p className="text-gray-600">{eventName}</p>
          </div>
        ) : null}

        {!singleUserId ? (
          <div className="p-6 border-b bg-gradient-to-br from-blue-50 to-slate-50">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="text-yellow-400 fill-yellow-400" size={32} />
                <span className="text-4xl font-bold text-gray-900">{getAverageRating()}</span>
              </div>
              <p className="text-gray-600">
                Average rating from {ratings.length} {ratings.length === 1 ? 'user' : 'users'}
              </p>
            </div>
          </div>
        ) : null}

        {singleUserId && ratings.length > 0 ? (
          <div className="px-6 py-5 border-b bg-gray-50/70">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setEditingRating({ ...ratings[0], rating: s })}
                  className="focus:outline-none"
                  aria-label={`Set rating to ${s}`}
                >
                  <Star
                    size={92}
                    className={s <= ratings[0].rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                  />
                </button>
              ))}
              </div>
              <span className="text-xs text-gray-500">{eventName}</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : ratings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 italic">No ratings yet for this event</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-3">
              {ratings.map((rating) => (
                <div
                  key={rating.id}
                  className={singleUserId ? 'rounded-2xl bg-white/90 px-5 py-4 border border-stone-200 shadow-sm overflow-hidden' : 'bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors overflow-hidden'}
                >
                  <div
                    className={`p-4 ${!singleUserId && (rating.comment || (currentUserId && rating.user_id === currentUserId)) ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (singleUserId) return;
                      if (currentUserId && rating.user_id === currentUserId) {
                        setEditingRating(rating);
                        return;
                      }
                      if (rating.comment) {
                        setExpandedRatingId(expandedRatingId === rating.id ? null : rating.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-gray-100 text-gray-700">
                            {rating.username}
                          </span>
                          {singleUserId ? (
                            <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-gray-100 text-gray-700">
                              {seasonLabel}
                            </span>
                          ) : (
                            <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-gray-100 text-gray-700">
                              {formatDate(rating.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!singleUserId ? (
                          <div className="flex items-center gap-1">
                            <Star className="text-yellow-400 fill-yellow-400" size={20} />
                            <span className="text-xl font-bold text-gray-900">{rating.rating}</span>
                            <span className="text-gray-500">/5</span>
                          </div>
                        ) : null}
                        {rating.comment && !singleUserId && (
                          <div className="ml-2">
                            {expandedRatingId === rating.id ? (
                              <ChevronUp size={20} className="text-gray-400" />
                            ) : (
                              <ChevronDown size={20} className="text-gray-400" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {rating.comment && (singleUserId || expandedRatingId === rating.id) && (
                    <div
                      className={`px-4 pb-4 pt-0 border-t border-gray-200 ${singleUserId && currentUserId && rating.user_id === currentUserId ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (singleUserId && currentUserId && rating.user_id === currentUserId) {
                          setEditingRating(rating);
                        }
                      }}
                    >
                      <p className="text-base text-gray-700 italic mt-3">
                        {event ? (
                          <>"<CommentWithTags
                            comment={rating.comment}
                            event={event}
                            tagColors={tagColors}
                            customPerformerTags={customPerformerTags}
                          />"</>
                        ) : (
                          <>"{rating.comment}"</>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {onViewEvent && !singleUserId ? (
          <div className="p-4 border-t bg-gray-50 flex gap-2">
            <button
              onClick={() => onViewEvent(eventId)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View full event
            </button>
          </div>
        ) : null}
        </div>
      </div>

      {editingRating && event && (
        <RatingModal
          isOpen={true}
          onClose={() => setEditingRating(null)}
          event={event}
          existingRating={editingRating}
          onRatingSubmitted={() => { setEditingRating(null); fetchRatings(); onRatingSubmitted?.(); }}
          tagColors={tagColors}
          customPerformerTags={customPerformerTags}
        />
      )}
    </div>
  );
}
