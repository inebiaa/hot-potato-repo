import { useState, useEffect } from 'react';
import { X, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
}

export default function ViewRatingsModal({ isOpen, onClose, eventId, eventName }: ViewRatingsModalProps) {
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRatingId, setExpandedRatingId] = useState<string | null>(null);

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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">All Ratings</h2>
            <p className="text-gray-600">{eventName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
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
                      <p className="text-sm text-gray-700 italic mt-3">"{rating.comment}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
