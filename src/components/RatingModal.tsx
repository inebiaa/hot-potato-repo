import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star } from 'lucide-react';
import { supabase, Event, Rating } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CommentEditor from './CommentEditor';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { getEventTagStyles } from '../lib/commentTagParsing';
import ModalShell from './ModalShell';

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
  zClass?: string;
}

export default function RatingModal({
  isOpen,
  onClose,
  event,
  existingRating,
  onRatingSubmitted,
  tagColors,
  customPerformerTags = [],
  zClass = 'z-[100]',
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

  /** Portal avoids ancestor stacking (e.g. upcoming stack `relative z-10`) painting above the overlay. */
  return createPortal(
    <ModalShell
      onClose={onClose}
      title={existingRating ? 'Update Your Rating' : 'Rate Event'}
      zClass={zClass}
      panelClassName="max-w-md sm:rounded-xl"
    >
        <p className="text-gray-600 mb-4 px-4 sm:px-6 pt-1">{event.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Rating
            </label>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
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
              Comment
            </label>
            {eventTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-gray-500 self-center mr-1">Insert tag:</span>
                {eventTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertTag(tag)}
                    className={`min-h-[44px] max-sm:min-h-[40px] ${tagPillSplitSegmentGroupClass} p-0 text-xs hover:opacity-90 sm:min-h-0 sm:py-1`}
                  >
                    <TagPillSplitLabel
                      text={tag}
                      segmentColors={{ backgroundColor: '#f3f4f6', color: '#374151' }}
                    />
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

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] flex-1 bg-blue-600 text-white py-2.5 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 text-base sm:text-sm font-medium"
            >
              {loading ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
            </button>

            {existingRating && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="min-h-[44px] px-4 bg-red-600 text-white py-2.5 rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400 text-base sm:text-sm font-medium"
              >
                Delete
              </button>
            )}
          </div>
        </form>
    </ModalShell>,
    document.body
  );
}
