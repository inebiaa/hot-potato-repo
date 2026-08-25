import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Star, Heart } from 'lucide-react';
import { Event, Rating } from '../../lib/supabase';
import { useMemo, useState, useEffect } from 'react';
import RatingModal from '../RatingModal';
import EditEventModal from '../EditEventModal';
import ViewRatingsModal from '../ViewRatingsModal';
import CommentWithTags from '../CommentWithTags';
import { useAuth } from '../../contexts/AuthContext';
import { isEventUpcoming } from '../../lib/eventDates';
import { formatEventDateDisplay } from '../../lib/formatEventDate';
import { clearAppModalParams, parseAppModal, setAppModalParams } from '../../lib/searchParamsModal';
import { useT } from '../../hooks/useCopy';
import { eventCardImageUrl } from '../../lib/eventCardImageUrl';
import RemoteImg from '../RemoteImg';
import {
  fetchLikedEventIds,
  toggleLikedEvent,
} from '../../lib/userLists';
import type { TagColorsForPills } from '../tagCards/types';
import EventCardTitle from './EventCardTitle';
import EventCardActionsMenu from './EventCardActionsMenu';
import EventCardTags from './EventCardTags';

interface EventCardProps {
  event: Event;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
  onRatingSubmitted: () => void;
  onEventUpdated: () => void;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
  /** When set, the card title links to this URL (e.g. single-event view) */
  viewHref?: string;
  /** When set, clicking the title opens overlay instead of navigating (e.g. openEventOverlay). */
  onViewClick?: (eventId: string) => void;
  tagColors?: TagColorsForPills;
  /** When true, only show the photo (for stacked upcoming cards) */
  stackPhotoOnly?: boolean;
  /** Opacity for the image only (for stack front card photo blending) */
  imageOpacity?: number;
  /** Eager-load the photo (overlay / first feed cards). */
  imagePriority?: boolean;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  /** When set (own library board), overflow menu can remove this show from that list. */
  listMembership?: {
    listId: string;
    isLikedList?: boolean;
  };
}

export default function EventCard({
  event,
  averageRating,
  ratingCount,
  userRating,
  onRatingSubmitted,
  onEventUpdated,
  onTagClick,
  viewHref,
  onViewClick,
  tagColors,
  customPerformerTags = [],
  stackPhotoOnly = false,
  imageOpacity,
  imagePriority = false,
  listMembership,
}: EventCardProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const parsedModal = useMemo(() => parseAppModal(searchParams), [searchParams]);
  const panelEventId = params.eventId ?? parsedModal.targetEventId ?? '';
  const isRatingModalOpen = parsedModal.modal === 'rate' && panelEventId === event.id;
  const isViewRatingsModalOpen = parsedModal.modal === 'view-ratings' && panelEventId === event.id;
  const isEditModalOpen = parsedModal.modal === 'edit-event' && panelEventId === event.id;
  const ratingAllowed = !isEventUpcoming(event.date);

  const closeEventPanels = () => {
    navigate({ pathname: location.pathname, search: clearAppModalParams(searchParams) });
  };

  const openEventPanel = (m: 'rate' | 'view-ratings' | 'edit-event') => {
    if (m === 'rate' && !user) {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'auth', {
          authMode: 'signin',
          authPrompt: t('auth.prompt.leaveReview'),
        }),
      });
      return;
    }
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, m, { targetEventId: event.id }),
    });
  };

  // Signed-out deep link ?modal=rate → auth (once; do not depend on searchParams or it loops).
  useEffect(() => {
    if (!isRatingModalOpen || user) return;
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, 'auth', {
        authMode: 'signin',
        authPrompt: t('auth.prompt.leaveReview'),
      }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react when rate modal opens while signed out
  }, [isRatingModalOpen, user]);

  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setIsLiked(false);
      return;
    }
    let cancelled = false;
    void fetchLikedEventIds(user.id)
      .then((ids) => {
        if (!cancelled) setIsLiked(ids.has(event.id));
      })
      .catch(() => {
        if (!cancelled) setIsLiked(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, event.id]);

  const handleToggleLiked = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'auth', {
          authMode: 'signin',
          authPrompt: t('auth.prompt.saveShow'),
        }),
      });
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const prev = isLiked;
    setIsLiked(!prev);
    try {
      const { liked, error } = await toggleLikedEvent(user.id, event.id, prev);
      if (error) setIsLiked(prev);
      else setIsLiked(liked);
    } catch {
      setIsLiked(prev);
    } finally {
      setLikeBusy(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || target.closest('a') || target.closest('[data-event-actions]') || target.closest('[data-tag-pill]');
    if (isInteractive) return;
    if (!onViewClick) return;
    onViewClick(event.id);
  };

  const cardImageSrc = eventCardImageUrl(event.image_url);

  if (stackPhotoOnly) {
    return (
      <div className={`rounded-lg shadow-md overflow-hidden shrink-0 h-48 ${imageOpacity !== undefined ? 'bg-transparent' : 'bg-gray-200'}`}>
        {cardImageSrc ? (
          <RemoteImg
            src={cardImageSrc}
            alt=""
            priority={imagePriority}
            className="w-full h-full object-cover"
            style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
          />
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={`${imageOpacity !== undefined ? 'bg-transparent' : 'bg-white'} rounded-lg shadow-md hover:shadow-xl transition-all relative ${onViewClick ? 'cursor-pointer' : ''}`}
        onClick={handleCardClick}
        role={onViewClick ? 'button' : undefined}
        tabIndex={onViewClick ? 0 : undefined}
        onKeyDown={onViewClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewClick(event.id); } } : undefined}
      >
        {cardImageSrc && (
          <div className="overflow-hidden rounded-t-lg shrink-0 h-48 bg-gray-200">
            <RemoteImg
              src={cardImageSrc}
              alt=""
              priority={imagePriority}
              className="w-full h-48 object-cover flex-shrink-0 rounded-t-lg"
              style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
            />
          </div>
        )}
        <div className={`p-6 min-w-0 ${imageOpacity !== undefined ? 'bg-white' : ''}`}>
          <div className="mb-2 min-w-0 after:block after:clear-both after:content-['']">
            <div
              className="float-right -mr-0.5 flex h-[1.375em] shrink-0 items-center gap-0.5 text-lg sm:text-xl [shape-outside:margin-box]"
              data-event-actions
            >
              <button
                type="button"
                onClick={(e) => { void handleToggleLiked(e); }}
                disabled={likeBusy}
                className={`p-0.5 rounded transition-colors ${
                  isLiked
                    ? 'text-neutral-900 hover:text-neutral-700'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
                title={isLiked ? t('event.removeFromLiked') : t('event.saveToLiked')}
                aria-label={isLiked ? t('event.removeFromLiked') : t('event.saveToLiked')}
                aria-pressed={isLiked}
              >
                <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
              </button>
              <EventCardActionsMenu
                event={event}
                listMembership={listMembership}
                onEventUpdated={onEventUpdated}
                onOpenEdit={() => openEventPanel('edit-event')}
                onLikedChange={setIsLiked}
              />
            </div>
            <EventCardTitle
              name={event.name}
              viewHref={viewHref}
              onViewClick={onViewClick}
            />
          </div>

          <EventCardTags
            event={event}
            tagColors={tagColors}
            onTagClick={onTagClick}
            onEventUpdated={onEventUpdated}
            afterHeader={
              <div className="space-y-1 mb-4">
                <div className="flex items-center text-gray-500 text-sm">
                  <Calendar size={16} className="mr-2 flex-shrink-0" />
                  {formatEventDateDisplay(event.date)}
                </div>
                {event.location && (
                  <div className="flex items-center text-gray-500 text-sm">
                    <MapPin size={16} className="mr-2 flex-shrink-0" />
                    <span className="min-w-0">{event.location}</span>
                  </div>
                )}
              </div>
            }
            afterBody={
              <>
                {ratingAllowed && (
                  <div className="flex items-center pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => openEventPanel('view-ratings')}
                      className="flex items-center hover:bg-gray-50 p-2 -ml-2 transition-colors group"
                      title="View all ratings"
                    >
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={18}
                            className={star <= averageRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                          />
                        ))}
                      </div>
                      <span className="ml-2 text-gray-600 text-sm group-hover:text-neutral-900 transition-colors">
                        {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'} ({ratingCount})
                      </span>
                    </button>
                  </div>
                )}

                {ratingAllowed && userRating && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-gray-600 font-medium">
                      Your rating: {userRating.rating} stars
                    </p>
                    {userRating.comment && (
                      <p className="mt-1 text-sm text-gray-500 italic">
                        <CommentWithTags
                          comment={userRating.comment}
                          event={event}
                          tagColors={tagColors}
                          customPerformerTags={customPerformerTags}
                          fitTagPillsToContainer
                          onTagClick={onTagClick}
                        />
                      </p>
                    )}
                  </div>
                )}
              </>
            }
          />
        </div>
      </div>

      <RatingModal
        isOpen={isRatingModalOpen && ratingAllowed && !!user}
        onClose={closeEventPanels}
        event={event}
        existingRating={userRating}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
      />

      <ViewRatingsModal
        isOpen={isViewRatingsModalOpen && ratingAllowed}
        onClose={closeEventPanels}
        eventId={event.id}
        eventName={event.name}
        event={event}
        currentUserId={user?.id}
        onRatingSubmitted={onRatingSubmitted}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
        allowRatingEdits={ratingAllowed}
        onTagClick={onTagClick}
      />

      <EditEventModal
        isOpen={isEditModalOpen}
        onClose={closeEventPanels}
        event={event}
        onEventUpdated={onEventUpdated}
      />

    </>
  );
}
