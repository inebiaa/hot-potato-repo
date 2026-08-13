import { Link, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Calendar, MapPin, Star, Edit, Trash2, Share2, Mail, MoreVertical, Heart, ListPlus, Check, Plus } from 'lucide-react';
import { Event, Rating, supabase, type UserList } from '../lib/supabase';
import { getIcon } from '../lib/eventCardIcons';
import { getSeasonFromDate } from '../lib/season';
import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import RatingModal from './RatingModal';
import EditEventModal from './EditEventModal';
import ViewRatingsModal from './ViewRatingsModal';
import CommentWithTags from './CommentWithTags';
import TagPillSplitLabel, { tagPillSplitSegmentGroupClass } from './TagPillSplitLabel';
import { tagPillShellClass } from './tagPillShell';
import { useAuth } from '../contexts/AuthContext';
import { useTagDisplayMap } from '../contexts/TagDisplayContext';
import { tagResolutionKey } from '../lib/tagDisplayResolution';
import { tryNormalizeExternalUrl } from '../lib/externalUrl';
import { isEventUpcoming } from '../lib/eventDates';
import { clearExpiredCountdownLink } from '../lib/clearExpiredCountdownLink';
import EventCountdownPill from './EventCountdownPill';
import { effectiveHeaderTags } from '../lib/eventHeaderTags';
import { coalesceTagList } from '../lib/eventTagArray';
import { buildEventEmailPlainText, buildEventEmailRichHtml } from '../lib/eventEmailRichCard';
import { formatEventDateDisplay } from '../lib/formatEventDate';
import { canonicalEventUrl } from '../lib/siteBase';
import { clearAppModalParams, parseAppModal, setAppModalParams } from '../lib/searchParamsModal';
import { normalizeShowType, starringColumn, starringTagType } from '../lib/showType';
import { useT } from '../contexts/CopyContext';
import {
  getSpecialGuests,
  isSpecialGuestsSlug,
} from '../lib/specialGuests';
import { eventCardImageUrl } from '../lib/eventCardImageUrl';
import { deleteStoredEventImage } from '../lib/eventImageUpload';
import { addEventToListAndLiked, createUserPlaylist, fetchLikedEventIds, fetchUserPlaylists, toggleLikedEvent } from '../lib/userLists';
import { BackIconButton } from './ui';
import { formControlClass, formControlPaddingClass, formControlTextClass } from './ui/field';

/** City / season / genre: shared pill shell + hover (same metrics as TagInput chips). */
const HEADER_ICON_INSIDE_PILL_CLASS = `${tagPillShellClass} transition-colors hover:opacity-80`;

function normalizeCustomCategoryKey(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCustomCategorySortRank(slug: string, hasPresentedBy: boolean): number {
  const key = normalizeCustomCategoryKey(slug);
  if (key === 'specialguests') return -1;
  if (key === 'hostedby') return 0;
  if (key === 'performanceby') return 1;
  if (key === 'benefiting') return hasPresentedBy ? 3 : 999;
  if (key === 'presentedby') return 1000;
  return 2;
}

const EVENT_TITLE_CLASS =
  'inline min-w-0 text-lg sm:text-xl font-bold leading-snug text-gray-900';

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
  tagColors?: {
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
    countdown_bg_color?: string;
    countdown_text_color?: string;
    footer_tags_bg_color?: string;
    footer_tags_text_color?: string;
    producer_icon?: string;
    designer_icon?: string;
    model_icon?: string;
    hair_makeup_icon?: string;
    city_icon?: string;
    season_icon?: string;
    header_tags_icon?: string;
    footer_tags_icon?: string;
    special_guests_icon?: string;
    optional_tags_bg_color?: string;
    optional_tags_text_color?: string;
    special_guests_bg_color?: string;
    special_guests_text_color?: string;
  };
  /** When true, only show the photo (for stacked upcoming cards) */
  stackPhotoOnly?: boolean;
  /** Opacity for the image only (for stack front card photo blending) */
  imageOpacity?: number;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
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
}: EventCardProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { user, isAdmin } = useAuth();
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

  const [isDeleting, setIsDeleting] = useState(false);
  const [shareCopied, setShareCopied] = useState<'link' | 'embed' | 'embedcode' | 'email' | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionsView, setActionsView] = useState<'main' | 'add-to-list' | 'create-list'>('main');
  const [playlists, setPlaylists] = useState<UserList[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState('');
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [addedToListId, setAddedToListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [newListPrivate, setNewListPrivate] = useState(false);
  const [createListBusy, setCreateListBusy] = useState(false);
  const [createListError, setCreateListError] = useState('');
  const [expandedTagSections, setExpandedTagSections] = useState<Record<string, boolean>>({});
  const [isLiked, setIsLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const actionsMenuBtnRef = useRef<HTMLButtonElement | null>(null);
  const playlistsFetchGen = useRef(0);

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

  useEffect(() => {
    if (!showActionsMenu) {
      setActionsView('main');
      setPlaylists([]);
      setPlaylistsError('');
      setAddingToListId(null);
      setAddedToListId(null);
      setNewListName('');
      setNewListPrivate(false);
      setCreateListBusy(false);
      setCreateListError('');
      setMenuPos(null);
    }
  }, [showActionsMenu]);

  useLayoutEffect(() => {
    if (!showActionsMenu) return;
    const update = () => {
      const el = actionsMenuBtnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 4,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [showActionsMenu, actionsView]);

  const loadPlaylists = async () => {
    if (!user) return;
    const gen = ++playlistsFetchGen.current;
    setPlaylistsLoading(true);
    setPlaylistsError('');
    try {
      const { data, error } = await fetchUserPlaylists(user.id);
      if (gen !== playlistsFetchGen.current) return;
      if (error) {
        setPlaylists([]);
        setPlaylistsError(error.message || 'Failed to load lists');
        return;
      }
      setPlaylists(data);
    } catch (err) {
      if (gen !== playlistsFetchGen.current) return;
      setPlaylists([]);
      setPlaylistsError(err instanceof Error ? err.message : 'Failed to load lists');
    } finally {
      if (gen === playlistsFetchGen.current) setPlaylistsLoading(false);
    }
  };

  const openAddToList = async () => {
    if (!user) {
      setShowActionsMenu(false);
      navigate({
        pathname: location.pathname,
        search: setAppModalParams(searchParams, 'auth', {
          authMode: 'signin',
          authPrompt: t('auth.prompt.addToList'),
        }),
      });
      return;
    }
    setActionsView('add-to-list');
    await loadPlaylists();
  };

  const openCreateList = () => {
    setCreateListError('');
    setNewListName('');
    setNewListPrivate(false);
    setActionsView('create-list');
  };

  const handleCreateListAndAdd = async () => {
    if (!user || createListBusy) return;
    const name = newListName.trim();
    if (!name) {
      setCreateListError('Name is required');
      return;
    }
    setCreateListBusy(true);
    setCreateListError('');
    try {
      const { data: list, error } = await createUserPlaylist(user.id, name, {
        isPublic: !newListPrivate,
        sortOrder: playlists.length,
      });
      if (error || !list) {
        setCreateListError(error?.message || 'Failed to create list');
        return;
      }
      const addRes = await addEventToListAndLiked(user.id, list.id, event.id);
      if (addRes.error) {
        setCreateListError(addRes.error.message || 'Failed to add show');
        return;
      }
      setIsLiked(true);
      setAddedToListId(list.id);
      setPlaylists((prev) => [list, ...prev]);
      window.setTimeout(() => {
        setShowActionsMenu(false);
      }, 600);
    } finally {
      setCreateListBusy(false);
    }
  };

  const handleAddToPlaylist = async (listId: string) => {
    if (!user || addingToListId) return;
    setAddingToListId(listId);
    try {
      const { error } = await addEventToListAndLiked(user.id, listId, event.id);
      if (!error) {
        setAddedToListId(listId);
        setIsLiked(true);
        window.setTimeout(() => {
          setShowActionsMenu(false);
        }, 600);
      }
    } finally {
      setAddingToListId(null);
    }
  };

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

  const tagsBySection = useMemo(() => ({
    producers: coalesceTagList(event.producers),
    featured_designers: coalesceTagList(event.featured_designers),
    featured_artists: coalesceTagList(event.featured_artists),
    hair_makeup: coalesceTagList(event.hair_makeup),
    header_tags: effectiveHeaderTags(event),
    footer_tags: coalesceTagList(event.footer_tags),
  }), [
    event.producers,
    event.featured_designers,
    event.featured_artists,
    event.hair_makeup,
    event.header_tags,
    event.footer_tags,
  ]);

  const customTags = useMemo(
    () =>
      (event.custom_tags && typeof event.custom_tags === 'object' && !Array.isArray(event.custom_tags))
        ? (event.custom_tags as Record<string, string[]>)
        : {},
    [event.custom_tags]
  );

  const TAG_LIMIT = 3; // show 3 pills, then +N
  const toggleTagSection = (key: string) => {
    setExpandedTagSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const tagDisplayMap = useTagDisplayMap();
  const resolveTag = (tagType: string, raw: string) => {
    const entry = tagDisplayMap?.get(tagResolutionKey(tagType, raw));
    return {
      /** Always the exact string on the event; identities must not relabel the card. */
      display: raw,
      canonical: entry?.canonical ?? raw,
      identityId: entry?.identityId ?? null,
    };
  };

  /** Filter-drag payload for search bar (not tag repositioning). */
  const tagFilterDragProps = (dragType: string, dragValue: string) => ({
    draggable: true as const,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', `tag-filter:${dragType}:${dragValue}`);
      e.dataTransfer.effectAllowed = 'copy';
    },
  });

  const countdownOpenUrl = useMemo(
    () => tryNormalizeExternalUrl(event.countdown_link),
    [event.countdown_link]
  );

  const ProducerIcon = getIcon(tagColors?.producer_icon, 'producer_icon');
  const DesignerIcon = getIcon(tagColors?.designer_icon, 'designer_icon');
  const HairMakeupIcon = getIcon(tagColors?.hair_makeup_icon, 'hair_makeup_icon');
  const CityIcon = getIcon(tagColors?.city_icon, 'city_icon');
  const SeasonIcon = getIcon(tagColors?.season_icon, 'season_icon');
  const HeaderTagsIcon = getIcon(tagColors?.header_tags_icon, 'header_tags_icon');

  const shareLink = canonicalEventUrl(event.id);
  const embedLink = `${canonicalEventUrl(event.id)}?embed=1`;
  const embedCode = `<iframe src="${embedLink}" width="400" height="600" frameborder="0" title="${event.name}"></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed' | 'embedcode') => {
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setShareCopied(type);
      setTimeout(() => setShareCopied(null), 2000);
    }
  };

  const copyEventEmailCard = async () => {
    const plain = buildEventEmailPlainText(event);
    const html = buildEventEmailRichHtml(event);
    const markCopied = () => {
      setShareCopied('email');
      setTimeout(() => setShareCopied(null), 2000);
    };
    try {
      if (typeof navigator.clipboard?.write === 'function' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([plain], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
        markCopied();
        return;
      }
    } catch {
      /* fall through to plain text */
    }
    try {
      await navigator.clipboard.writeText(plain);
      markCopied();
    } catch {
      const ta = document.createElement('textarea');
      ta.value = plain;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      markCopied();
    }
  };

  const canEdit = user && (isAdmin || event.created_by === user.id);

  const handleDelete = async () => {
    if (!user || !canEdit) return;

    if (!confirm('Are you sure you want to delete this show? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      void deleteStoredEventImage(event.image_url);

      onEventUpdated();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event');
    } finally {
      setIsDeleting(false);
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
      <div className={`rounded-lg shadow-md overflow-hidden shrink-0 h-48 ${cardImageSrc ? 'bg-transparent' : 'bg-gray-200'}`}>
        {cardImageSrc ? (
          <img
            src={cardImageSrc}
            alt=""
            loading="lazy"
            decoding="async"
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
          <div className="overflow-hidden rounded-t-lg shrink-0">
            <img
              src={cardImageSrc}
              alt=""
              loading="lazy"
              decoding="async"
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
              <button
                ref={actionsMenuBtnRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (showActionsMenu) {
                    setShowActionsMenu(false);
                    return;
                  }
                  const el = actionsMenuBtnRef.current;
                  if (el) {
                    const rect = el.getBoundingClientRect();
                    setMenuPos({
                      top: rect.bottom + 4,
                      right: Math.max(8, window.innerWidth - rect.right),
                    });
                  }
                  setShowActionsMenu(true);
                }}
                className="p-0.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Actions"
                aria-haspopup="true"
                aria-expanded={showActionsMenu}
              >
                <MoreVertical size={16} />
              </button>
              {showActionsMenu && menuPos && createPortal(
                <>
                  <div
                    className="fixed inset-0 z-[80]"
                    onClick={() => setShowActionsMenu(false)}
                    aria-hidden="true"
                  />
                  <div
                    className="fixed z-[90] w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
                    style={{ top: menuPos.top, right: menuPos.right }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {actionsView === 'create-list' ? (
                      <div className="px-3 py-2 space-y-2">
                        <BackIconButton
                          size="sm"
                          label={t('nav.back')}
                          className="-ml-1 mb-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionsView('add-to-list');
                            setCreateListError('');
                            void loadPlaylists();
                          }}
                        />
                        <input
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleCreateListAndAdd();
                            }
                          }}
                          autoFocus
                          className={`${formControlClass} ${formControlPaddingClass} ${formControlTextClass}`}
                          aria-label={t('event.createList')}
                        />
                        <button
                          type="button"
                          role="switch"
                          aria-checked={newListPrivate}
                          onClick={() => setNewListPrivate((v) => !v)}
                          className="w-full flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
                        >
                          <span>{t('event.listPrivate')}</span>
                          <span
                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                              newListPrivate ? 'bg-neutral-900' : 'bg-neutral-300'
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                                newListPrivate ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </button>
                        {createListError ? (
                          <p className="text-xs text-red-600">{createListError}</p>
                        ) : null}
                        <button
                          type="button"
                          disabled={createListBusy}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleCreateListAndAdd();
                          }}
                          className="w-full rounded-md bg-neutral-900 px-2 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
                        >
                          {addedToListId ? t('event.addedToList') : t('event.createList')}
                        </button>
                      </div>
                    ) : actionsView === 'add-to-list' ? (
                      <>
                        <div className="border-b border-gray-100 px-2 py-1.5">
                          <BackIconButton
                            size="sm"
                            label={t('nav.back')}
                            className="-ml-0.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionsView('main');
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCreateList();
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100"
                        >
                          <Plus size={14} className="text-gray-500" />
                          <span>{t('event.newList')}</span>
                        </button>
                        {playlistsLoading ? (
                          <div className="px-3 py-3 text-sm text-gray-400">…</div>
                        ) : playlistsError ? (
                          <div className="px-3 py-3 text-sm text-red-600">{playlistsError}</div>
                        ) : playlists.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-gray-500">{t('event.noLists')}</div>
                        ) : (
                          <div className="max-h-56 overflow-y-auto">
                            {playlists.map((list) => {
                              const justAdded = addedToListId === list.id;
                              const busy = addingToListId === list.id;
                              return (
                                <button
                                  key={list.id}
                                  type="button"
                                  disabled={busy || justAdded}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleAddToPlaylist(list.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2 disabled:opacity-60"
                                >
                                  <span className="truncate">{list.name}</span>
                                  {justAdded ? (
                                    <Check size={14} className="text-green-600 shrink-0" />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void openAddToList();
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <ListPlus size={14} className="text-gray-500" />
                      <span>{t('event.addToList')}</span>
                    </button>
                    <button
                      onClick={() => { copyToClipboard(shareLink, 'link'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Share2 size={14} className="shrink-0 text-gray-500" />
                      <span className="min-w-0 flex-1">Copy link</span>
                      {shareCopied === 'link' && <span className="shrink-0 text-green-600 text-xs">Copied!</span>}
                    </button>
                    <button
                      onClick={() => { copyToClipboard(embedLink, 'embed'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Share2 size={14} className="shrink-0 text-gray-500" />
                      <span>Copy embed URL</span>
                    </button>
                    <button
                      onClick={() => { copyToClipboard(embedCode, 'embedcode'); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Share2 size={14} className="shrink-0 text-gray-500" />
                      <span>Copy embed code</span>
                    </button>
                    <button
                      onClick={() => { void copyEventEmailCard(); setShowActionsMenu(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Mail size={14} className="shrink-0 text-gray-500" />
                      <span className="min-w-0 flex-1">Copy for email</span>
                      {shareCopied === 'email' && <span className="shrink-0 text-green-600 text-xs">Copied!</span>}
                    </button>
                    {canEdit && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                          onClick={() => {
                            openEventPanel('edit-event');
                            setShowActionsMenu(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit size={14} className="text-neutral-900" />
                          <span>Edit show</span>
                        </button>
                        <button
                          onClick={() => { handleDelete(); setShowActionsMenu(false); }}
                          disabled={isDeleting}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 text-red-600"
                        >
                          <Trash2 size={14} />
                          <span>Delete show</span>
                        </button>
                      </>
                    )}
                      </>
                    )}
                  </div>
                </>,
                document.body,
              )}
            </div>
            {viewHref && !onViewClick ? (
              viewHref.startsWith('http://') || viewHref.startsWith('https://') ? (
                <a href={viewHref} className={EVENT_TITLE_CLASS}>
                  {event.name}
                </a>
              ) : (
                <Link to={viewHref} className={EVENT_TITLE_CLASS}>
                  {event.name}
                </Link>
              )
            ) : (
              <h3 className={EVENT_TITLE_CLASS}>
                {event.name}
              </h3>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-2">
            {event.city && (
                <button
                data-tag-pill
                onClick={() => onTagClick('city', event.city, event.city)}
                {...tagFilterDragProps('city', event.city)}
                className={HEADER_ICON_INSIDE_PILL_CLASS}
                style={{
                  backgroundColor: tagColors?.city_bg_color || '#dbeafe',
                  color: tagColors?.city_text_color || '#1e40af',
                }}
              >
                <CityIcon size={12} className="shrink-0" />
                <span className="min-w-0 max-w-full text-left">
                  <TagPillSplitLabel fitToContainer text={event.city} />
                </span>
              </button>
            )}
            {(() => {
              const season = getSeasonFromDate(event.date);
              return (
                <button
                  data-tag-pill
                  onClick={() => onTagClick('season', season, season)}
                  {...tagFilterDragProps('season', season)}
                  className={HEADER_ICON_INSIDE_PILL_CLASS}
                  style={{
                    backgroundColor: tagColors?.season_bg_color || '#ffedd5',
                    color: tagColors?.season_text_color || '#c2410c',
                  }}
                >
                  <SeasonIcon size={12} className="shrink-0" />
                  <span className="min-w-0 max-w-full text-left">
                    <TagPillSplitLabel fitToContainer text={season} />
                  </span>
                </button>
              );
            })()}
          </div>

          {(() => {
            const tags = tagsBySection.header_tags || [];
            const hasHeader =
              tags.length > 0 ||
              !!(event.date && isEventUpcoming(event.date));
            if (!hasHeader) return null;
            const showMore = tags.length > TAG_LIMIT && !expandedTagSections['header_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mb-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {visible.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('header_tags', resolveTag('header_tags', tag).identityId || tag, tag)}
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                      {...tagFilterDragProps('header_tags', tag)}
                    >
                      <TagPillSplitLabel
                        fitToContainer
                        leadingSlot={<HeaderTagsIcon size={12} className="shrink-0" aria-hidden />}
                        text={resolveTag('header_tags', tag).display}
                        segmentColors={{
                          backgroundColor: tagColors?.header_tags_bg_color || '#ccfbf1',
                          color: tagColors?.header_tags_text_color || '#0f766e',
                        }}
                      />
                    </button>
                  ))}
                  {event.date && isEventUpcoming(event.date) && (
                    <EventCountdownPill
                      eventDate={event.date}
                      eventName={event.name}
                      countdownOpenUrl={countdownOpenUrl}
                      countdownBg={tagColors?.countdown_bg_color}
                      countdownText={tagColors?.countdown_text_color}
                      onExpired={() => {
                        void (async () => {
                          if (event.countdown_link) {
                            await clearExpiredCountdownLink(event.id);
                          }
                          onEventUpdated();
                        })();
                      }}
                      onButtonClick={() => {
                        if (countdownOpenUrl) window.open(countdownOpenUrl, '_blank', 'noopener,noreferrer');
                      }}
                    />
                  )}
                  {tags.length > TAG_LIMIT && (
                    <button
                      type="button"
                      onClick={() => toggleTagSection('header_tags')}
                      className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center shrink-0 justify-center rounded-md"
                      title={expandedTagSections['header_tags'] ? 'Show less' : 'View more tags'}
                    >
                      {expandedTagSections['header_tags'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

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

          <div className="space-y-3 mb-4 pt-4 border-t">
            {(() => {
              const starringKey = starringColumn(event.show_type);
              const starringType = starringTagType(event.show_type);
              const tags = tagsBySection[starringKey];
              if (!(tags?.length > 0)) return null;
              const expandKey = starringKey === 'featured_artists' ? 'artists' : 'designers';
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections[expandKey];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              const pillColors = {
                backgroundColor: tagColors?.designer_bg_color || '#fef3c7',
                color: tagColors?.designer_text_color || '#b45309',
              };
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <DesignerIcon size={14} className="mr-1" />
                      {t('event.starring')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick(starringType, resolveTag(starringType, name).identityId || name, name)}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                        {...tagFilterDragProps(starringType, name)}
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag(starringType, name).display}
                          segmentColors={pillColors}
                        />
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection(expandKey)} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections[expandKey] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections[expandKey] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const tags = getSpecialGuests(customTags);
              if (!(tags.length > 0)) {
                return null;
              }
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['special_guests'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              const SpecialGuestsIcon = getIcon(tagColors?.special_guests_icon, 'special_guests_icon');
              const pillColors = {
                backgroundColor: tagColors?.special_guests_bg_color ?? tagColors?.optional_tags_bg_color ?? '#e0e7ff',
                color: tagColors?.special_guests_text_color ?? tagColors?.optional_tags_text_color ?? '#3730a3',
              };
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <SpecialGuestsIcon size={14} className="mr-1" />
                      {t(tags.length === 1 ? 'event.specialGuest' : 'event.specialGuests')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const r = resolveTag('artist', name);
                          onTagClick('artist', r.identityId || name, name);
                        }}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                        {...tagFilterDragProps('artist', name)}
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('artist', name).display}
                          segmentColors={pillColors}
                        />
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('special_guests')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['special_guests'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['special_guests'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(tagsBySection.producers?.length > 0) && (() => {
              const tags = tagsBySection.producers;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['producers'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <ProducerIcon size={14} className="mr-1" />
                      {t('event.producedBy')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((producer, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('producer', resolveTag('producer', producer).identityId || producer, producer)}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                        {...tagFilterDragProps('producer', producer)}
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('producer', producer).display}
                          segmentColors={{
                            backgroundColor: tagColors?.producer_bg_color || '#f3f4f6',
                            color: tagColors?.producer_text_color || '#374151',
                          }}
                        />
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('producers')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['producers'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['producers'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {normalizeShowType(event.show_type) === 'fashion' && (tagsBySection.hair_makeup?.length > 0) && (() => {
              const tags = tagsBySection.hair_makeup;
              const showMore = tags.length > TAG_LIMIT && !expandedTagSections['hair_makeup'];
              const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
              return (
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                    <div className="flex items-center">
                      <HairMakeupIcon size={14} className="mr-1" />
                      {t('event.hairMakeup')}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 items-center">
                    {visible.map((artist, idx) => (
                      <button
                        key={idx}
                        onClick={() => onTagClick('hair_makeup', resolveTag('hair_makeup', artist).identityId || artist, artist)}
                        data-tag-pill
                        className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                        {...tagFilterDragProps('hair_makeup', artist)}
                      >
                        <TagPillSplitLabel fitToContainer
                          text={resolveTag('hair_makeup', artist).display}
                          segmentColors={{
                            backgroundColor: tagColors?.hair_makeup_bg_color || '#f3e8ff',
                            color: tagColors?.hair_makeup_text_color || '#7e22ce',
                          }}
                        />
                      </button>
                    ))}
                    {tags.length > TAG_LIMIT && (
                      <button type="button" onClick={() => toggleTagSection('hair_makeup')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['hair_makeup'] ? 'Show less' : 'View more tags'}>
                        {expandedTagSections['hair_makeup'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const ct = customTags;
              const meta = (event.custom_tag_meta && typeof event.custom_tag_meta === 'object') ? event.custom_tag_meta : {};
              const slugToLabel = (s: string) => s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              const sharedBg = tagColors?.optional_tags_bg_color ?? '#e0e7ff';
              const sharedText = tagColors?.optional_tags_text_color ?? '#3730a3';
              const allTagDefs = Object.keys(ct)
                .filter((slug) => !isSpecialGuestsSlug(slug))
                .map((slug) => ({
                id: slug,
                slug,
                label: slugToLabel(slug),
                icon: meta[slug]?.icon ?? 'Tag',
                bg_color: sharedBg,
                text_color: sharedText,
              }));
              const hasPresentedBy = allTagDefs.some((tagDef) => normalizeCustomCategoryKey(tagDef.slug) === 'presentedby');
              return allTagDefs
                .sort((a, b) => {
                  const rankDiff = getCustomCategorySortRank(a.slug, hasPresentedBy) - getCustomCategorySortRank(b.slug, hasPresentedBy);
                  if (rankDiff !== 0) return rankDiff;
                  return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
                })
                .map((tagDef) => {
                  const tags = ct[tagDef.slug];
                  if (!tags || tags.length === 0) return null;
                  const CustomIcon = getIcon(tagDef.icon, 'producer_icon');
                  const showMore = tags.length > TAG_LIMIT && !expandedTagSections[`custom_${tagDef.slug}`];
                  const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
                  return (
                    <div key={tagDef.id ?? tagDef.slug}>
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                        <div className="flex items-center">
                          <CustomIcon size={14} className="mr-1" />
                          {tagDef.label}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 items-center">
                        {visible.map((val, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              const r = resolveTag(`custom:${tagDef.slug}`, val);
                              onTagClick(`custom_performer`, `${tagDef.slug}\x00${r.identityId || val}`, val);
                            }}
                            data-tag-pill
                            className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                            {...tagFilterDragProps('custom_performer', `${tagDef.slug}\x00${val}`)}
                          >
                            <TagPillSplitLabel fitToContainer
                              text={resolveTag(`custom:${tagDef.slug}`, val).display}
                              segmentColors={{
                                backgroundColor: tagDef.bg_color || '#e0e7ff',
                                color: tagDef.text_color || '#3730a3',
                              }}
                            />
                          </button>
                        ))}
                        {tags.length > TAG_LIMIT && (
                          <button
                            type="button"
                            onClick={() => toggleTagSection(`custom_${tagDef.slug}`)}
                            className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md"
                          >
                            {expandedTagSections[`custom_${tagDef.slug}`] ? '−' : `+${tags.length - TAG_LIMIT}`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
            })()}
            </div>

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
                <p className="text-sm text-gray-500 mt-1 italic">
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

          {(tagsBySection.footer_tags?.length > 0) && (() => {
            const tags = tagsBySection.footer_tags || [];
            const showMore = tags.length > TAG_LIMIT && !expandedTagSections['footer_tags'];
            const visible = showMore ? tags.slice(0, TAG_LIMIT) : tags;
            return (
              <div className="mt-3 pt-3 border-t">
                <div className="flex flex-wrap gap-1 items-center">
                  {visible.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => onTagClick('footer_tags', resolveTag('footer_tags', tag).identityId || tag, tag)}
                      data-tag-pill
                      className={`${tagPillSplitSegmentGroupClass} p-0 text-xs transition-colors hover:opacity-80`}
                      {...tagFilterDragProps('footer_tags', tag)}
                    >
                      <TagPillSplitLabel fitToContainer
                        text={resolveTag('footer_tags', tag).display}
                        segmentColors={{
                          backgroundColor: tagColors?.footer_tags_bg_color || '#d1fae5',
                          color: tagColors?.footer_tags_text_color || '#065f46',
                        }}
                      />
                    </button>
                  ))}
                  {tags.length > TAG_LIMIT && (
                    <button type="button" onClick={() => toggleTagSection('footer_tags')} className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center rounded-md" title={expandedTagSections['footer_tags'] ? 'Show less' : 'View more tags'}>
                      {expandedTagSections['footer_tags'] ? '−' : `+${tags.length - TAG_LIMIT}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
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
