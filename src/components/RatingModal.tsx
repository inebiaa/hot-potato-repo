import { useState, useRef, useMemo, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase, Event, Rating } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CommentEditor from './CommentEditor';
import { getEventTagStyles } from './CommentWithTags';

interface RatingModalTagColors {
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
  optional_tags_bg_color?: string;
  optional_tags_text_color?: string;
}

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: Event;
  existingRating?: Rating;
  onRatingSubmitted: () => void;
  tagColors?: RatingModalTagColors;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
}

export default function RatingModal({
  isOpen,
  onClose,
  event,
  existingRating,
  onRatingSubmitted,
  tagColors,
  customPerformerTags = []
}: RatingModalProps) {
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingRating?.comment || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const editorRef = useRef<{ insertAtCursor: (text: string) => void; focus: () => void }>(null);
  const { user } = useAuth();

  const eventTags = useMemo(
    () => getEventTagStyles(event, tagColors, customPerformerTags).map((t) => t.value),
    [event, tagColors, customPerformerTags]
  );

  useEffect(() => {
    if (isOpen) setComment(existingRating?.comment || '');
  }, [isOpen, existingRating?.id, existingRating?.comment]);

  const insertTag = (tag: string) => {
    editorRef.current?.insertAtCursor(tag);
  };

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
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-md w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-xl w-full p-6">
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
                    className={star <= (hoveredRating || rating) ? 'text-amber-500 fill-amber-500' : 'text-gray-300'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
              Comment (optional)
            </label>
            {eventTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1 items-center">
                <span className="text-xs text-gray-500 self-center mr-1">Insert tag:</span>
                {eventTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            <CommentEditor
              ref={editorRef}
              value={comment}
              onChange={setComment}
              event={event}
              tagColors={tagColors}
              customPerformerTags={customPerformerTags}
              placeholder="Share your thoughts... Tags appear styled as you type."
              rows={4}
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
    </div>
  );
}
