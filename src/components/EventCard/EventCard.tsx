import { useNavigate, useLocation, useParams, useSearchParams, Link } from 'react-router-dom';
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
import { cn } from '../../lib/utils';

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

  const cardImageSrc = eventCardImageUrl(event.image_url);

  const photoShellClass =
    'block h-48 w-full shrink-0 overflow-hidden rounded-t-lg bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const renderCardPhoto = () => {
    const img = (
      <RemoteImg
        src={cardImageSrc!}
        alt=""
        priority={imagePriority}
        className="h-48 w-full object-cover rounded-t-lg"
        style={imageOpacity !== undefined ? { opacity: imageOpacity } : undefined}
      />
    );

    if (onViewClick) {
      return (
        <button
          type="button"
          onClick={() => onViewClick(event.id)}
          className={cn(photoShellClass, 'cursor-pointer')}
          aria-label={t('event.openShow').replace('{name}', event.name)}
        >
          {img}
        </button>
      );
    }

    if (viewHref) {
      if (viewHref.startsWith('http://') || viewHref.startsWith('https://')) {
        return (
          <a href={viewHref} className={photoShellClass}>
            {img}
          </a>
        );
      }
      return (
        <Link to={viewHref} className={photoShellClass}>
          {img}
        </Link>
      );
    }

    return <div className={photoShellClass}>{img}</div>;
  };

  if (stackPhotoOnly) {
    return (
      <div className={`rounded-lg shadow-md overflow-hidden shrink-0 h-48 ${imageOpacity !== undefined ? 'bg-transparent' : 'bg-muted'}`}>
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
        className={`${imageOpacity !== undefined ? 'bg-transparent' : 'bg-card'} rounded-lg shadow-md relative`}
      >
        {cardImageSrc ? renderCardPhoto() : null}
        <div className={`min-w-0 p-6 ${imageOpacity !== undefined ? 'bg-card' : ''}`}>
          <div className="mb-2 min-w-0 after:block after:clear-both after:content-['']">
            <div
              className="float-right -mr-0.5 flex h-[1.375em] shrink-0 items-center gap-0.5 [shape-outside:margin-box]"
              data-event-actions
            >
              <button
                type="button"
                onClick={(e) => { void handleToggleLiked(e); }}
                disabled={likeBusy}
                className={`rounded p-0.5 transition-colors ${
                  isLiked
                    ? 'text-foreground hover:text-muted-foreground'
                    : 'text-muted-foreground hover:text-foreground'
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
              eventId={event.id}
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
              <div className="mb-4 space-y-1">
                <div className="flex items-center type-callout text-muted-foreground">
                  <Calendar size={16} className="mr-2 flex-shrink-0" />
                  {formatEventDateDisplay(event.date)}
                </div>
                {event.location && (
                  <div className="flex items-center type-callout text-muted-foreground">
                    <MapPin size={16} className="mr-2 flex-shrink-0" />
                    <span className="min-w-0">{event.location}</span>
                  </div>
                )}
              </div>
            }
            afterBody={
              <>
                {ratingAllowed && (
                  <div className="flex items-center border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => openEventPanel('view-ratings')}
                      className="group -ml-2 flex items-center p-2 transition-colors hover:bg-muted"
                      title="View all ratings"
                    >
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={18}
                            className={star <= averageRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/40'}
                          />
                        ))}
                      </div>
                      <span className="ml-2 type-callout text-muted-foreground transition-colors group-hover:text-foreground">
                        {averageRating > 0 ? averageRating.toFixed(1) : 'No ratings'} ({ratingCount})
                      </span>
                    </button>
                  </div>
                )}

                {ratingAllowed && userRating && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="type-callout font-medium text-muted-foreground">
                      Your rating: {userRating.rating} stars
                    </p>
                    {userRating.comment && (
                      <p className="mt-1 type-callout italic text-muted-foreground">
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
