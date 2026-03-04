import { useState, useEffect } from 'react';
import { Star, ChevronDown, ChevronUp, FileEdit } from 'lucide-react';
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
  /** When set, shows a "View full event" button that opens the event card */
  onViewEvent?: (eventId: string) => void;
}

export default function ViewRatingsModal({ isOpen, onClose, eventId, eventName, event, currentUserId, onRatingSubmitted, tagColors, customPerformerTags = [], onViewEvent }: ViewRatingsModalProps) {
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

      setRatings(ratingsWithUsernames);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="relative max-w-2xl w-full my-8">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors text-xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
        <div className="bg-white rounded-lg shadow-xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">All Ratings</h2>
          <p className="text-gray-600">{eventName}</p>
        </div>

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
                  className="bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors overflow-hidden"
                >
                  <div
                    className={`flex items-center justify-between p-4 ${rating.comment ? 'cursor-pointer' : ''}`}
                    onClick={() => rating.comment && setExpandedRatingId(expandedRatingId === rating.id ? null : rating.id)}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{rating.username}</div>
                      <div className="text-xs text-gray-500 mt-1">{formatDate(rating.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Star className="text-yellow-400 fill-yellow-400" size={20} />
                        <span className="text-xl font-bold text-gray-900">{rating.rating}</span>
                        <span className="text-gray-500">/5</span>
                      </div>
                      {currentUserId && event && rating.user_id === currentUserId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingRating(rating); }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit review"
                          aria-label="Edit review"
                        >
                          <FileEdit size={16} />
                        </button>
                      )}
                      {rating.comment && (
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
                  {rating.comment && expandedRatingId === rating.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-200">
                      <p className="text-sm text-gray-700 italic mt-3">
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

        <div className="p-4 border-t bg-gray-50 flex gap-2">
          {onViewEvent && (
            <button
              onClick={() => onViewEvent(eventId)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View full event
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
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
