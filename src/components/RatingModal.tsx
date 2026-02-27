import { useState } from 'react';
import { X, Star } from 'lucide-react';
import { supabase, Event, Rating } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  existingRating?: Rating;
  onRatingSubmitted: () => void;
}

export default function RatingModal({
  isOpen,
  onClose,
  event,
  existingRating,
  onRatingSubmitted
}: RatingModalProps) {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingRating?.comment || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    if (!user) {
      setError('You must be logged in to rate events');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (existingRating) {
        const { error: updateError } = await supabase
          .from('ratings')
          .update({ rating, comment: comment || null })
          .eq('id', existingRating.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('ratings')
          .insert({
            event_id: event.id,
            user_id: user.id,
            rating,
            comment: comment || null,
          });

        if (insertError) throw insertError;
      }

      onRatingSubmitted();
      onClose();
      setRating(0);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRating || !user) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('ratings')
        .delete()
        .eq('id', existingRating.id);

      if (deleteError) throw deleteError;

      onRatingSubmitted();
      onClose();
      setRating(0);
      setComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-4">
          {existingRating ? 'Update Your Rating' : 'Rate Event'}
        </h2>
        <p className="text-gray-600 mb-6">{event.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none"
                >
                  <Star
                    size={32}
                    className={
                      star <= (hoveredRating || rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Share your thoughts about this event..."
            />
          </div>

          {error && (
            <div className="text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
            </button>

            {existingRating && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="px-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
              >
                Delete
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
