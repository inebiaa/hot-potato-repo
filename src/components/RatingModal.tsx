import { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Star } from 'lucide-react';
import { supabase, Event, Rating } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import CommentEditor from './CommentEditor';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { TAG_PILL_ROW_CLASS } from './tagPillShell';
import { getEventInsertTagStyles } from '../lib/commentTagParsing';
import ModalShell from './ModalShell';
import { Button, formErrorClass, formHintClass, Label, typeCallout } from './ui';

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
    () => getEventInsertTagStyles(event, tagColors, customPerformerTags),
    [event, tagColors, customPerformerTags]
  );

  useEffect(() => {
    if (isOpen) setComment(existingRating?.comment || '');
  }, [isOpen, existingRating?.id, existingRating?.comment]);

  const insertTag = (tag: string) => {
    editorRef.current?.insertAtCursor(tag);
  };

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError('Please select a rating');
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
      panelClassName="max-w-md sm:rounded-lg"
    >
        <p className={`mb-4 px-4 pt-1 sm:px-6 ${typeCallout} text-muted-foreground`}>{event.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <div>
            <Label className="mb-2 block">Your Rating</Label>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={32}
                    className={star <= (hoveredRating || rating) ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/40'}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="comment">Comment</Label>
            {eventTags.length > 0 && (
              <div className={`mb-2 ${TAG_PILL_ROW_CLASS}`}>
                <span className={`mr-1 self-center ${formHintClass}`}>Insert tag:</span>
                {eventTags.map((tag) => {
                  const colors = {
                    backgroundColor: tag.bg || '#f3f4f6',
                    color: tag.text || '#374151',
                  };
                  return (
                    <button
                      key={`${tag.type}:${tag.value}`}
                      type="button"
                      onClick={() => insertTag(tag.value)}
                      className={`min-h-[44px] max-sm:min-h-[40px] ${tagPillSplitSegmentGroupClass} p-0 text-xs hover:opacity-90 sm:min-h-0 sm:py-1`}
                    >
                      <TagPillSplitLabel text={tag.value} segmentColors={colors} />
                    </button>
                  );
                })}
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

          {error ? <p className={formErrorClass}>{error}</p> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={loading} className="min-h-[44px] flex-1">
              {loading ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
            </Button>

            {existingRating && (
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={loading}
                className="min-h-[44px]"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
    </ModalShell>,
    document.body
  );
}
