import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, ChevronRight, Copy, RefreshCw, Link2, MoreVertical, Pencil, Lock, Unlock } from 'lucide-react';
import { supabase, UserList, UserListEvent, Rating, Event } from '../lib/supabase';
import EventCard from './EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from './MasonryLaneFeed';
import { useAuth } from '../contexts/AuthContext';
import { USER_LISTS_SETUP_SQL, getSupabaseSqlEditorUrl } from '../lib/userListsSetupSql';
import {
  addEventToListAndLiked,
  createUserPlaylist,
  ensureLibraryLists,
  ensureLikedList,
  ensureRatedList,
  isSystemLibraryList,
  sortListsLibraryFirst,
  VIRTUAL_LIKED_LIST_ID,
  VIRTUAL_RATINGS_LIST_ID,
} from '../lib/userLists';
import { TagDisplayProvider } from '../contexts/TagDisplayContext';
import { fetchTagResolutionForEvents, type TagResolutionMap } from '../lib/tagDisplayResolution';
import { normalizeEventTagArrays } from '../lib/eventTagArray';
import { normalizeForSearch } from '../lib/normalize';
import { fetchEventRatingStats } from '../lib/eventRatingStats';
import { canonicalListUrl } from '../lib/siteBase';
import { Button, Input, Label } from './ui';
import { useT } from '../contexts/CopyContext';

interface ProfilePageProps {
  userId: string;
  pathname: string;
  onClose: () => void;
  onTagClick?: (type: string, value: string, displayLabel?: string) => void;
  onOpenEvent?: (eventId: string) => void;
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
    footer_tags_bg_color?: string;
    footer_tags_text_color?: string;
    optional_tags_bg_color?: string;
    optional_tags_text_color?: string;
  };
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
  refreshTrigger?: number;
  /** Optional cached events from App - avoids re-fetching when navigating */
  cachedEvents?: Event[];
  /** Optional app-wide filtered event ids from primary search bar. */
  visibleEventIds?: Set<string>;
  onVisibleReviewCountsChange?: (counts: { visible: number; total: number }) => void;
}

interface ReviewRow {
  rating: Rating;
  event: Event;
  eventName: string;
  eventDate: string;
  averageRating: number;
  ratingCount: number;
}

interface ListWithCount extends UserList {
  event_count: number;
}

type BoardRow = {
  event: Event;
  listEvent: UserListEvent;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
};

export default function ProfilePage({
  userId,
  pathname,
  onClose: _onClose,
  onTagClick,
  onOpenEvent,
  tagColors,
  customPerformerTags = [],
  refreshTrigger = 0,
  cachedEvents,
  visibleEventIds,
  onVisibleReviewCountsChange,
}: ProfilePageProps) {
  const { user: currentUser } = useAuth();
  const t = useT();
  const isOwnProfile = !!currentUser && currentUser.id === userId;
  const [username, setUsername] = useState<string>('');
  const [userIdPublic, setUserIdPublic] = useState<string>('');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [lists, setLists] = useState<ListWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageListId, setManageListId] = useState<string | null>(null);
  const [listEvents, setListEvents] = useState<BoardRow[]>([]);
  const [boardTagMap, setBoardTagMap] = useState<TagResolutionMap | null>(null);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [newListPrivate, setNewListPrivate] = useState(false);
  const [createError, setCreateError] = useState('');
  const [addEventError, setAddEventError] = useState('');
  const [listsError, setListsError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [addEventSearch, setAddEventSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [listLinkCopied, setListLinkCopied] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [editListDescription, setEditListDescription] = useState('');
  const [editListError, setEditListError] = useState('');
  const [editListBusy, setEditListBusy] = useState(false);
  const boardMenuRef = useRef<HTMLDivElement | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      if (currentUser?.id === userId) {
        try {
          await ensureLibraryLists(userId);
        } catch {
          // Lists may be unset up; fetch below surfaces the SQL banner
        }
      }

      const [profileRes, ratingsRes, listsRes] = await Promise.all([
        supabase.from('user_profiles').select('username, user_id_public').eq('user_id', userId).maybeSingle(),
        supabase.from('ratings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_lists').select('*').eq('user_id', userId).order('sort_order').order('created_at', { ascending: false }),
      ]);

      const profile = profileRes.data;
      const ratingsData = ratingsRes.data || [];
      const listsData = sortListsLibraryFirst(listsRes.data || []);

      setUsername(profile?.username || 'My profile');
      setUserIdPublic(profile?.user_id_public || '');

      const eventIds = [...new Set(ratingsData.map((r) => r.event_id))];

      const cacheMap = cachedEvents?.length ? new Map(cachedEvents.map((e) => [e.id, e])) : null;
      const useCache = cacheMap && eventIds.length > 0 && eventIds.every((id) => cacheMap.has(id));

      const [eventsRes, allRatingsRes, listCountsRes] = await Promise.all([
        useCache
          ? Promise.resolve({ data: eventIds.map((id) => cacheMap!.get(id)!).filter(Boolean) })
          : eventIds.length > 0
            ? supabase.from('events').select('*').in('id', eventIds)
            : Promise.resolve({ data: [] }),
        eventIds.length > 0
          ? supabase.from('ratings').select('event_id, rating').in('event_id', eventIds)
          : Promise.resolve({ data: [] }),
        listsData.length > 0
          ? supabase.from('user_list_events').select('list_id').in('list_id', listsData.map((l) => l.id))
          : Promise.resolve({ data: [] }),
      ]);

      const eventsData = (eventsRes.data || []).map((e) => normalizeEventTagArrays(e as Event));
      const eventsMap = new Map(eventsData.map((e) => [e.id, e]));

      const statsAccumulator = new Map<string, { sum: number; count: number }>();
      (allRatingsRes.data || []).forEach((r) => {
        const existing = statsAccumulator.get(r.event_id) || { sum: 0, count: 0 };
        existing.sum += Number(r.rating) || 0;
        existing.count += 1;
        statsAccumulator.set(r.event_id, existing);
      });
      const ratingStatsMap = new Map(
        Array.from(statsAccumulator.entries()).map(([eventId, s]) => [
          eventId,
          { averageRating: s.count ? s.sum / s.count : 0, ratingCount: s.count },
        ]),
      );

      const reviewsUnsorted = ratingsData.map((r) => {
        const event = eventsMap.get(r.event_id);
        const stats = ratingStatsMap.get(r.event_id);
        return {
          rating: r,
          event: event || ({} as Event),
          eventName: event?.name || 'Unknown',
          eventDate: event?.date || '',
          averageRating: stats?.averageRating || 0,
          ratingCount: stats?.ratingCount || 0,
        };
      });
      reviewsUnsorted.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
      setReviews(reviewsUnsorted);

      if (listsRes.error) {
        setListsError(listsRes.error.message || 'Could not load lists');
        setLists([]);
      } else {
        setListsError(null);
        const countByList: Record<string, number> = {};
        (listCountsRes.data || []).forEach((row) => {
          countByList[row.list_id] = (countByList[row.list_id] || 0) + 1;
        });
        setLists(
          listsData.map((l) => ({
            ...l,
            event_count: l.is_rated_list ? ratingsData.length : countByList[l.id] || 0,
          })),
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshTrigger]);

  const loadListBoard = async (listId: string, target: ListWithCount | undefined) => {
    const isRatings = listId === VIRTUAL_RATINGS_LIST_ID || !!target?.is_rated_list;
    if (isRatings) {
      const rows: BoardRow[] = reviews
        .filter((r) => r.event?.id)
        .filter((r, idx, arr) => arr.findIndex((x) => x.event.id === r.event.id) === idx)
        .map((r, index) => ({
          event: r.event,
          averageRating: r.averageRating,
          ratingCount: r.ratingCount,
          userRating: r.rating,
          listEvent: {
            id: r.rating.id,
            list_id: listId,
            event_id: r.event.id,
            position: index,
            created_at: r.rating.created_at,
          },
        }));
      rows.sort((a, b) => (b.event.date || '').localeCompare(a.event.date || ''));
      setListEvents(rows);
      return;
    }

    let resolvedListId = listId;
    if (listId === VIRTUAL_LIKED_LIST_ID && currentUser?.id === userId) {
      const { data } = await ensureLikedList(userId);
      if (data?.id) resolvedListId = data.id;
    }

    const { data: listEventsData } = await supabase
      .from('user_list_events')
      .select('*')
      .eq('list_id', resolvedListId)
      .order('position');
    const ids = (listEventsData || []).map((e) => e.event_id);
    const cacheMap = cachedEvents?.length ? new Map(cachedEvents.map((e) => [e.id, e])) : null;
    const useCache = cacheMap && ids.length > 0 && ids.every((id) => cacheMap.has(id));
    const eventsData = (
      useCache
        ? ids.map((id) => cacheMap!.get(id)!).filter(Boolean)
        : (await supabase.from('events').select('*').in('id', ids)).data || []
    ).map((e) => normalizeEventTagArrays(e as Event));
    const eventsMap = new Map(eventsData.map((e) => [e.id, e]));

    const [statsRes, userRatingsRes] = await Promise.all([
      fetchEventRatingStats(ids),
      currentUser && ids.length > 0
        ? supabase.from('ratings').select('*').eq('user_id', currentUser.id).in('event_id', ids)
        : Promise.resolve({ data: [] as Rating[] }),
    ]);
    const userRatingByEvent = new Map(
      ((userRatingsRes.data || []) as Rating[]).map((r) => [r.event_id, r]),
    );

    const eventsList = (listEventsData || [])
      .map((le) => {
        const event = eventsMap.get(le.event_id);
        if (!event) return null;
        const stats = statsRes.data.get(le.event_id);
        const row: BoardRow = {
          listEvent: le,
          event,
          averageRating: stats?.average_rating || 0,
          ratingCount: stats?.rating_count || 0,
          userRating: userRatingByEvent.get(le.event_id),
        };
        return row;
      })
      .filter((x): x is BoardRow => x != null);
    eventsList.sort((a, b) => (b.event.date || '').localeCompare(a.event.date || ''));
    setListEvents(eventsList);
  };

  const openManageList = async (listId: string) => {
    setManageListId(listId);
    setIsAddEventOpen(false);
    const target =
      lists.find((l) => l.id === listId) ||
      (listId === VIRTUAL_RATINGS_LIST_ID
        ? ({ id: listId, is_rated_list: true } as ListWithCount)
        : listId === VIRTUAL_LIKED_LIST_ID
          ? ({ id: listId, is_liked_list: true } as ListWithCount)
          : undefined);
    await loadListBoard(listId, target);
  };

  useEffect(() => {
    const events = listEvents.map((r) => r.event).filter((e) => e?.id);
    if (events.length === 0) {
      setBoardTagMap(new Map());
      return;
    }
    let cancelled = false;
    fetchTagResolutionForEvents(events).then((m) => {
      if (!cancelled) setBoardTagMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [listEvents]);

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newListName.trim()) {
      setCreateError('Name is required');
      return;
    }
    const { error } = await createUserPlaylist(userId, newListName, {
      description: newListDescription,
      isPublic: !newListPrivate,
      sortOrder: lists.length,
    });
    if (error) {
      setCreateError(error.message || 'Failed to create list');
      return;
    }
    setNewListName('');
    setNewListDescription('');
    setNewListPrivate(false);
    setIsCreateListOpen(false);
    fetchProfile();
  };

  const deleteList = async (listId: string) => {
    const target = lists.find((l) => l.id === listId);
    if (isSystemLibraryList(target) || listId === VIRTUAL_RATINGS_LIST_ID || listId === VIRTUAL_LIKED_LIST_ID) {
      return;
    }
    if (!window.confirm('Delete this list? Events in it are not deleted.')) return;
    setShowBoardMenu(false);
    await supabase.from('user_lists').delete().eq('id', listId);
    setManageListId(null);
    fetchProfile();
  };

  const openEditList = () => {
    const current =
      libraryLists.find((l) => l.id === manageListId) || lists.find((l) => l.id === manageListId);
    if (!current || isSystemLibraryList(current)) return;
    setEditListName(current.name || '');
    setEditListDescription(current.description || '');
    setEditListError('');
    setShowBoardMenu(false);
    setIsEditListOpen(true);
  };

  const saveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageListId || editListBusy) return;
    const name = editListName.trim();
    if (!name) {
      setEditListError('Name is required');
      return;
    }
    setEditListBusy(true);
    setEditListError('');
    try {
      const { error } = await supabase
        .from('user_lists')
        .update({
          name,
          description: editListDescription.trim() || null,
        })
        .eq('id', manageListId);
      if (error) {
        setEditListError(error.message || 'Failed to update list');
        return;
      }
      setIsEditListOpen(false);
      await fetchProfile();
    } finally {
      setEditListBusy(false);
    }
  };

  const openAddEvent = async () => {
    setAddEventError('');
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false });
    setAllEvents((data || []).map((e) => normalizeEventTagArrays(e as Event)));
    setAddEventSearch('');
    setIsAddEventOpen(true);
  };

  const addEventToList = async (eventId: string) => {
    if (!manageListId || !currentUser) return;
    let listId = manageListId;
    if (listId === VIRTUAL_LIKED_LIST_ID) {
      const { data } = await ensureLikedList(currentUser.id);
      if (!data?.id) {
        setAddEventError('Could not open Liked list');
        return;
      }
      listId = data.id;
      setManageListId(listId);
    }
    const maxPos = listEvents.length ? Math.max(...listEvents.map((e) => e.listEvent.position), 0) : 0;
    const { error } = await addEventToListAndLiked(currentUser.id, listId, eventId, maxPos + 1);
    if (error) {
      setAddEventError(error.message || 'Failed to add show to list');
      return;
    }
    setAddEventError('');
    await openManageList(listId);
    fetchProfile();
    setIsAddEventOpen(false);
  };

  const enableLists = async () => {
    setCopyFeedback(null);
    try {
      await navigator.clipboard.writeText(USER_LISTS_SETUP_SQL);
      setCopyFeedback('SQL copied!');
      const url = getSupabaseSqlEditorUrl();
      if (url) window.open(url, '_blank', 'noopener');
      setTimeout(() => setCopyFeedback(null), 3000);
    } catch {
      setCopyFeedback('Failed to copy');
    }
  };

  const addSearchNorm = normalizeForSearch(addEventSearch);
  const filteredAddEvents = allEvents.filter(
    (e) =>
      !listEvents.some((le) => le.event.id === e.id) &&
      (!addSearchNorm ||
        normalizeForSearch(e.name || '').includes(addSearchNorm) ||
        normalizeForSearch(e.city || '').includes(addSearchNorm)),
  );

  const visibleReviews = useMemo(
    () => (visibleEventIds ? reviews.filter((r) => visibleEventIds.has(r.event?.id)) : reviews),
    [reviews, visibleEventIds],
  );
  useEffect(() => {
    onVisibleReviewCountsChange?.({ visible: visibleReviews.length, total: reviews.length });
  }, [onVisibleReviewCountsChange, visibleReviews.length, reviews.length]);

  /** Always surface Ratings + Liked boards on own library; inject if DB rows missing. */
  const libraryLists = useMemo((): ListWithCount[] => {
    const items = lists.map((l) =>
      l.is_rated_list ? { ...l, event_count: reviews.length } : l,
    );
    const hasRated = items.some((l) => l.is_rated_list);
    const hasLiked = items.some((l) => l.is_liked_list);

    if (!hasRated) {
      items.push({
        id: VIRTUAL_RATINGS_LIST_ID,
        user_id: userId,
        name: 'Your Ratings',
        description: null,
        sort_order: -2,
        is_liked_list: false,
        is_rated_list: true,
        is_public: true,
        created_at: '',
        event_count: reviews.length,
      });
    }
    if (isOwnProfile && !hasLiked) {
      items.push({
        id: VIRTUAL_LIKED_LIST_ID,
        user_id: userId,
        name: 'Your Liked Events',
        description: null,
        sort_order: -1,
        is_liked_list: true,
        is_rated_list: false,
        is_public: true,
        created_at: '',
        event_count: 0,
      });
    }
    return sortListsLibraryFirst(items);
  }, [lists, reviews.length, userId, isOwnProfile]);

  const resolveRealListId = async (listId: string): Promise<string | null> => {
    if (listId !== VIRTUAL_LIKED_LIST_ID && listId !== VIRTUAL_RATINGS_LIST_ID) return listId;
    if (!currentUser || currentUser.id !== userId) return null;
    if (listId === VIRTUAL_LIKED_LIST_ID) {
      const { data } = await ensureLikedList(userId);
      return data?.id ?? null;
    }
    const { data } = await ensureRatedList(userId);
    return data?.id ?? null;
  };

  const copyBoardLink = async () => {
    if (!manageListId || shareBusy) return;
    setShareBusy(true);
    try {
      const realId = await resolveRealListId(manageListId);
      if (!realId) return;
      if (manageListId !== realId) {
        setManageListId(realId);
        await fetchProfile();
      }
      await navigator.clipboard.writeText(canonicalListUrl(realId));
      setListLinkCopied(true);
      window.setTimeout(() => setListLinkCopied(false), 2000);
    } catch {
      // ignore
    } finally {
      setShareBusy(false);
    }
  };

  const toggleBoardPublic = async () => {
    if (!manageListId || !isOwnProfile || shareBusy) return;
    setShareBusy(true);
    try {
      const realId = await resolveRealListId(manageListId);
      if (!realId) return;
      const current =
        libraryLists.find((l) => l.id === manageListId || l.id === realId) ||
        lists.find((l) => l.id === realId);
      const nextPublic = !current?.is_public;
      const { error } = await supabase
        .from('user_lists')
        .update({ is_public: nextPublic })
        .eq('id', realId);
      if (error) return;
      if (manageListId !== realId) setManageListId(realId);
      await fetchProfile();
    } finally {
      setShareBusy(false);
    }
  };

  const listDisplayName = (list: ListWithCount | undefined) => {
    if (!list) return '';
    if (list.is_rated_list) return t('event.ratedListName');
    if (list.is_liked_list) return t('event.likedListName');
    return list.name;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (manageListId) {
    const currentList =
      libraryLists.find((l) => l.id === manageListId) || lists.find((l) => l.id === manageListId);
    const isRatingsList = manageListId === VIRTUAL_RATINGS_LIST_ID || !!currentList?.is_rated_list;
    const isLikedList = manageListId === VIRTUAL_LIKED_LIST_ID || !!currentList?.is_liked_list;
    const canDeleteList =
      isOwnProfile &&
      !isSystemLibraryList(currentList) &&
      manageListId !== VIRTUAL_RATINGS_LIST_ID &&
      manageListId !== VIRTUAL_LIKED_LIST_ID;
    const canAddShows = isOwnProfile && !isRatingsList;

    const boardRows = visibleEventIds
      ? listEvents.filter((row) => visibleEventIds.has(row.event.id))
      : listEvents;

    const laneItems: MasonryLaneItem[] = boardRows.map(
      ({ event, listEvent, averageRating, ratingCount, userRating }) => ({
        id: listEvent.id,
        children: (
          <EventCard
            event={event}
            averageRating={averageRating}
            ratingCount={ratingCount}
            userRating={userRating}
            onRatingSubmitted={() => {
              void loadListBoard(manageListId, currentList);
              fetchProfile();
            }}
            onEventUpdated={() => {
              void loadListBoard(manageListId, currentList);
              fetchProfile();
            }}
            onTagClick={onTagClick || (() => {})}
            onViewClick={onOpenEvent}
            tagColors={tagColors}
            customPerformerTags={customPerformerTags}
          />
        ),
      }),
    );

    return (
      <div className="min-h-screen bg-neutral-50/80">
        <div className="max-w-[2400px] mx-auto px-4 pb-16 pt-6">
          <button
            onClick={() => {
              setManageListId(null);
              setIsAddEventOpen(false);
              setShowBoardMenu(false);
              setIsEditListOpen(false);
            }}
            className="text-sm text-neutral-500 hover:text-neutral-900 mb-6 transition-colors"
          >
            ← Back to library
          </button>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
                {listDisplayName(currentList)}
              </h2>
              {currentList?.description && (
                <p className="text-sm text-neutral-500 mt-1">{currentList.description}</p>
              )}
            </div>
            {isOwnProfile && (
              <div className="relative shrink-0" ref={boardMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowBoardMenu((v) => !v)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg transition-colors"
                  title="Actions"
                  aria-haspopup="true"
                  aria-expanded={showBoardMenu}
                >
                  <MoreVertical size={20} />
                </button>
                {showBoardMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowBoardMenu(false)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-50">
                      {canDeleteList && (
                        <button
                          type="button"
                          onClick={openEditList}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <Pencil size={14} className="text-neutral-500" />
                          <span>{t('event.editList')}</span>
                        </button>
                      )}
                      {canAddShows && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowBoardMenu(false);
                            void openAddEvent();
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2"
                        >
                          <Plus size={14} className="text-neutral-500" />
                          <span>{t('event.addShow')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={shareBusy}
                        onClick={() => {
                          void copyBoardLink().then(() => {
                            /* keep menu open briefly so “Copied” is visible */
                          });
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center justify-between gap-2 disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Link2 size={14} className="text-neutral-500" />
                          <span>{t('event.copyListLink')}</span>
                        </span>
                        {listLinkCopied ? (
                          <span className="text-xs text-neutral-500">{t('event.listLinkCopied')}</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        disabled={shareBusy}
                        onClick={() => {
                          void toggleBoardPublic();
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        {(currentList?.is_public !== false) ? (
                          <Lock size={14} className="shrink-0 text-neutral-500" />
                        ) : (
                          <Unlock size={14} className="shrink-0 text-neutral-500" />
                        )}
                        <span>
                          {(currentList?.is_public !== false)
                            ? t('event.makeListPrivate')
                            : t('event.makeListPublic')}
                        </span>
                      </button>
                      {canDeleteList && (
                        <button
                          type="button"
                          onClick={() => deleteList(manageListId)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 flex items-center gap-2 text-red-600 border-t border-neutral-100 mt-1"
                        >
                          <Trash2 size={14} />
                          <span>{t('event.deleteList')}</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {boardRows.length === 0 ? (
            <div className="rounded-2xl bg-white/80 py-16 px-6 text-center">
              <p className="text-neutral-500 text-sm">
                {isRatingsList
                  ? 'No ratings yet.'
                  : isLikedList
                    ? 'No saved shows yet.'
                    : 'No shows in this list yet.'}
              </p>
            </div>
          ) : (
            <TagDisplayProvider map={boardTagMap}>
              <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
            </TagDisplayProvider>
          )}
        </div>

        {isAddEventOpen && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsAddEventOpen(false)}
          >
            <div className="relative max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white rounded-xl w-full max-h-[80vh] flex flex-col">
                <div className="p-4 border-b">
                  <h3 className="font-semibold">{t('event.addShow')}</h3>
                </div>
                {addEventError && (
                  <p className="px-4 py-2 text-sm text-red-600 bg-red-50">{addEventError}</p>
                )}
                <div className="p-4 border-b">
                  <Input
                    type="text"
                    placeholder="Search shows..."
                    value={addEventSearch}
                    onChange={(e) => setAddEventSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <ul className="overflow-y-auto flex-1 p-4 space-y-1">
                  {filteredAddEvents.slice(0, 50).map((event) => (
                    <li key={event.id}>
                      <button
                        onClick={() => addEventToList(event.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span className="font-medium text-gray-900">{event.name}</span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    </li>
                  ))}
                  {filteredAddEvents.length === 0 && (
                    <li className="text-gray-500 py-4 text-sm">
                      No matching shows or all are already in this list.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {isEditListOpen && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsEditListOpen(false)}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-foreground">{t('event.editList')}</h3>
              <form onSubmit={saveEditList} className="space-y-4">
                <div>
                  <Label htmlFor="edit-list-name">Name</Label>
                  <Input
                    id="edit-list-name"
                    type="text"
                    value={editListName}
                    onChange={(e) => setEditListName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="edit-list-description">Description</Label>
                  <Input
                    id="edit-list-description"
                    type="text"
                    value={editListDescription}
                    onChange={(e) => setEditListDescription(e.target.value)}
                  />
                </div>
                {editListError && <p className="text-sm text-destructive">{editListError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={editListBusy}>
                    Save
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setIsEditListOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50/80">
      <div className="max-w-[2400px] mx-auto px-4 pb-16 pt-6">
        <header className="mb-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span
                className="inline-block text-sm font-medium px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: tagColors?.optional_tags_bg_color || '#e0e7ff',
                  color: tagColors?.optional_tags_text_color || '#3730a3',
                }}
              >
                {username ||
                  (currentUser?.user_metadata?.full_name as string) ||
                  currentUser?.email?.split('@')[0] ||
                  'Profile'}
              </span>
              <div className="text-neutral-500 text-sm mt-1 space-y-0.5">
                {isOwnProfile && currentUser?.email && (
                  <p className="text-neutral-600">{currentUser.email}</p>
                )}
                {isOwnProfile && userIdPublic && (
                  <p className="text-neutral-500">
                    Sign in as: <span className="font-mono text-neutral-600">{userIdPublic}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-2">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('profile.yourLibrary')}</h2>
          {listsError ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => openManageList(VIRTUAL_RATINGS_LIST_ID)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white transition-all hover:shadow-md hover:shadow-neutral-200/30 text-left min-w-[200px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{t('event.ratedListName')}</p>
                    <p className="text-xs text-neutral-500">
                      {reviews.length} show{reviews.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                </button>
              </div>
              <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-6">
                <p className="text-sm text-amber-800 mb-4">
                  Lists require a one-time database setup. Copy the SQL and run it in your Supabase SQL
                  Editor.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={enableLists}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm hover:bg-amber-700 transition-colors"
                  >
                    <Copy size={16} />
                    Copy SQL & open Supabase
                  </button>
                  <button
                    onClick={fetchProfile}
                    className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 rounded-xl text-sm text-amber-800 hover:bg-amber-100 transition-colors"
                  >
                    <RefreshCw size={16} />
                    I&apos;ve run it — Refresh
                  </button>
                  {copyFeedback && (
                    <span className="self-center text-sm text-amber-700">{copyFeedback}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {libraryLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => openManageList(list.id)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white transition-all hover:shadow-md hover:shadow-neutral-200/30 text-left min-w-[200px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-900 truncate">{listDisplayName(list)}</p>
                    <p className="text-xs text-neutral-500">
                      {list.event_count} show{list.event_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300 shrink-0" />
                </button>
              ))}
              {isOwnProfile && (
                <button
                  onClick={() => {
                    setIsCreateListOpen(true);
                    setCreateError('');
                    setNewListName('');
                    setNewListDescription('');
                    setNewListPrivate(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-neutral-500 hover:text-neutral-700 hover:bg-white/60 transition-colors border border-neutral-200/60 min-w-[200px]"
                >
                  <Plus size={18} />
                  New list
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {isCreateListOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setIsCreateListOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-foreground">{t('event.createList')}</h3>
            <form onSubmit={createList} className="space-y-4">
              <div>
                <Label htmlFor="new-list-name">Name</Label>
                <Input
                  id="new-list-name"
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Greatest shows of all time"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="new-list-description">Description</Label>
                <Input
                  id="new-list-description"
                  type="text"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="e.g. My personal top 10"
                />
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={newListPrivate}
                onClick={() => setNewListPrivate((v) => !v)}
                className="w-full flex items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 hover:bg-neutral-50"
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
              {createError && <p className="text-sm text-destructive">{createError}</p>}
              <div className="flex gap-2">
                <Button type="submit">{t('event.createList')}</Button>
                <Button type="button" variant="secondary" onClick={() => setIsCreateListOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
