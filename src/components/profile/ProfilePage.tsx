import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, UserList, Rating, Event } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAppChrome } from '../../contexts/AppChromeContext';
import { USER_LISTS_SETUP_SQL, getSupabaseSqlEditorUrl } from '../../lib/userListsSetupSql';
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
} from '../../lib/userLists';
import { fetchTagResolutionForEvents, type TagResolutionMap } from '../../lib/tagDisplayResolution';
import { normalizeEventTagArrays } from '../../lib/eventTagArray';
import { normalizeForSearch } from '../../lib/normalize';
import { fetchEventRatingStats } from '../../lib/eventRatingStats';
import { canonicalListUrl } from '../../lib/siteBase';
import { useT } from '../../hooks/useCopy';
import {
  deleteStoredListCover,
  uploadListCoverFile,
} from '../../lib/listCoverUpload';
import { compareEventsForFeed, fetchEventsByIds, toEventWithStats, type EventWithStats } from '../../lib/eventsFeed';
import { eventMatchesTextQuery, filterEventsBySelectedTags } from '../../lib/eventTagFilter';
import { useHomeCatalogOptional } from '../../contexts/HomeCatalogContext';
import { pickListCollageUrls } from '../../lib/listCoverCollage';
import type { BoardRow, ListWithCount, ProfilePageProps, ReviewRow } from './types';
import { listDisplayName as formatListDisplayName } from './listDisplayName';
import ProfileHeader from './ProfileHeader';
import ProfileLibraryBoards from './ProfileLibraryBoards';
import ProfileBoardView from './ProfileBoardView';
import CreateListModal from './CreateListModal';
import PageBack from '../layout/PageBack';
import { LoadingSpinner } from '../ui';

export type { ProfilePageProps } from './types';

export default function ProfilePage({
  userId,
  onTagClick,
  onOpenEvent,
  onBoardEventsChange,
  onSearchEventRatingSubmitted,
  onSearchEventUpdated,
  tagColors,
  customPerformerTags = [],
  refreshTrigger = 0,
  cachedEvents,
}: ProfilePageProps) {
  const { user: currentUser } = useAuth();
  const { setHeaderSearchCounts } = useAppChrome();
  const t = useT();
  const home = useHomeCatalogOptional();
  const isOwnProfile = !!currentUser && currentUser.id === userId;
  const [username, setUsername] = useState<string>('');
  const [userIdPublic, setUserIdPublic] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [coverUrl, setCoverUrl] = useState<string>('');
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
  const [savedLibraryEvents, setSavedLibraryEvents] = useState<Event[]>([]);
  const [libraryTagMap, setLibraryTagMap] = useState<TagResolutionMap | null>(null);
  const [addEventSearch, setAddEventSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [listLinkCopied, setListLinkCopied] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [editListDescription, setEditListDescription] = useState('');
  const [editListCoverUrl, setEditListCoverUrl] = useState('');
  const [editListCoverBusy, setEditListCoverBusy] = useState(false);
  const [editListError, setEditListError] = useState('');
  const [editListBusy, setEditListBusy] = useState(false);
  const editListCoverOriginalRef = useRef('');
  const boardMenuRef = useRef<HTMLDivElement | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setSavedLibraryEvents([]);
    try {
      if (currentUser?.id === userId) {
        try {
          await ensureLibraryLists(userId);
        } catch {
          // Lists may be unset up; fetch below surfaces the SQL banner
        }
      }

      const [profileRes, ratingsRes, listsRes] = await Promise.all([
        supabase.from('user_profiles').select('username, user_id_public, avatar_url, cover_image_url').eq('user_id', userId).maybeSingle(),
        supabase.from('ratings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_lists').select('*').eq('user_id', userId).order('sort_order').order('created_at', { ascending: false }),
      ]);

      const profile = profileRes.data;
      const ratingsData = ratingsRes.data || [];
      const listsData = sortListsLibraryFirst(listsRes.data || []);

      setUsername(profile?.username || 'My profile');
      setUserIdPublic(profile?.user_id_public || '');
      setAvatarUrl(profile?.avatar_url || '');
      setCoverUrl(profile?.cover_image_url || '');

      const eventIds = [...new Set(ratingsData.map((r) => r.event_id))];

      const [allRatingsRes, listMembershipRes] = await Promise.all([
        eventIds.length > 0
          ? supabase.from('ratings').select('event_id, rating').in('event_id', eventIds)
          : Promise.resolve({ data: [] }),
        listsData.length > 0
          ? supabase
              .from('user_list_events')
              .select('list_id, event_id, position')
              .in(
                'list_id',
                listsData.map((l) => l.id),
              )
              .order('position')
          : Promise.resolve({ data: [] }),
      ]);

      const membershipRows = (listMembershipRes.data || []) as {
        list_id: string;
        event_id: string;
        position: number;
      }[];
      const membershipEventIds = [...new Set(membershipRows.map((r) => r.event_id))];
      const allSavedIds = [...new Set([...eventIds, ...membershipEventIds])];
      const cacheMapAll = cachedEvents?.length ? new Map(cachedEvents.map((e) => [e.id, e])) : null;
      const useSavedCache =
        cacheMapAll && allSavedIds.length > 0 && allSavedIds.every((id) => cacheMapAll.has(id));
      const savedRes = useSavedCache
        ? { data: allSavedIds.map((id) => cacheMapAll!.get(id)!).filter(Boolean) as Event[], error: null }
        : await fetchEventsByIds(allSavedIds);
      if (savedRes.error) {
        console.error('Error fetching profile shows:', savedRes.error);
      }
      const eventsData = savedRes.data || [];
      setSavedLibraryEvents(eventsData);

      const eventsMap = new Map(eventsData.map((e) => [e.id, e]));
      const imageByEventId = new Map<string, string | null | undefined>();
      for (const e of eventsData) imageByEventId.set(e.id, e.image_url);

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

      const ratedCollage = pickListCollageUrls(reviewsUnsorted.map((r) => r.event?.image_url));
      const eventIdsByList = new Map<string, string[]>();
      for (const row of membershipRows) {
        const arr = eventIdsByList.get(row.list_id) || [];
        arr.push(row.event_id);
        eventIdsByList.set(row.list_id, arr);
      }

      if (listsRes.error) {
        setListsError(listsRes.error.message || 'Could not load lists');
        setLists([]);
      } else {
        setListsError(null);
        const countByList: Record<string, number> = {};
        membershipRows.forEach((row) => {
          countByList[row.list_id] = (countByList[row.list_id] || 0) + 1;
        });
        setLists(
          listsData.map((l) => {
            const ids = l.is_rated_list
              ? ratingsData.map((r) => r.event_id)
              : eventIdsByList.get(l.id) || [];
            const collage = l.is_rated_list
              ? ratedCollage
              : pickListCollageUrls(ids.map((id) => imageByEventId.get(id)));
            return {
              ...l,
              event_count: l.is_rated_list ? ratingsData.length : countByList[l.id] || 0,
              cover_collage_urls: collage,
              event_ids: ids,
            };
          }),
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

  useEffect(() => {
    let cancelled = false;
    void fetchTagResolutionForEvents(savedLibraryEvents).then((map) => {
      if (!cancelled) setLibraryTagMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [savedLibraryEvents]);

  const searchQuery = home?.searchQuery ?? '';
  const selectedTags = home?.selectedTags ?? [];
  const searchActive = selectedTags.length > 0 || searchQuery.trim().length >= 2;
  const searchEvents = useMemo(() => {
    if (!searchActive) return [] as EventWithStats[];
    const textMatched = savedLibraryEvents.filter((event) =>
      eventMatchesTextQuery(event, searchQuery, libraryTagMap),
    );
    return filterEventsBySelectedTags(textMatched, selectedTags, libraryTagMap).map((event) =>
      toEventWithStats(event),
    );
  }, [savedLibraryEvents, searchActive, searchQuery, selectedTags, libraryTagMap]);

  useEffect(() => {
    if (!searchActive) {
      setHeaderSearchCounts(null);
      return;
    }
    if (manageListId) {
      const total = listEvents.filter((row) => row.event?.id).length;
      const matchIds = new Set(searchEvents.map((event) => event.id));
      const filtered = listEvents.filter(
        (row) => row.event?.id && matchIds.has(row.event.id),
      ).length;
      setHeaderSearchCounts({ filtered, total });
      return;
    }
    setHeaderSearchCounts({
      filtered: searchEvents.length,
      total: savedLibraryEvents.length,
    });
  }, [
    searchActive,
    manageListId,
    listEvents,
    searchEvents,
    savedLibraryEvents,
    setHeaderSearchCounts,
  ]);

  useEffect(() => {
    return () => setHeaderSearchCounts(null);
  }, [setHeaderSearchCounts]);

  useEffect(() => {
    if (manageListId) {
      onBoardEventsChange?.(listEvents.map((r) => r.event).filter((e) => e?.id));
      return;
    }
    onBoardEventsChange?.(savedLibraryEvents);
  }, [manageListId, listEvents, savedLibraryEvents, onBoardEventsChange]);

  useEffect(() => {
    return () => {
      onBoardEventsChange?.(null);
    };
  }, [onBoardEventsChange]);

  const leaveBoard = () => {
    setManageListId(null);
    setIsAddEventOpen(false);
    setShowBoardMenu(false);
    setIsEditListOpen(false);
    home?.clearFilters();
  };

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

  const openEditList = async () => {
    if (!isOwnProfile || !manageListId) return;
    setShowBoardMenu(false);
    let listId = manageListId;
    let current =
      libraryLists.find((l) => l.id === listId) || lists.find((l) => l.id === listId);

    if (listId === VIRTUAL_LIKED_LIST_ID || listId === VIRTUAL_RATINGS_LIST_ID) {
      const realId = await resolveRealListId(listId);
      if (!realId) {
        setEditListError('Could not open list');
        setIsEditListOpen(true);
        return;
      }
      listId = realId;
      setManageListId(realId);
      const refreshed = await supabase.from('user_lists').select('*').eq('id', realId).maybeSingle();
      if (refreshed.data) {
        current = { ...(refreshed.data as UserList), event_count: current?.event_count ?? 0 };
      }
    }

    if (!current) return;
    setEditListName(current.name || '');
    setEditListDescription(current.description || '');
    const cover = current.cover_image_url || '';
    editListCoverOriginalRef.current = cover;
    setEditListCoverUrl(cover);
    setEditListError('');
    setIsEditListOpen(true);
  };

  const onEditListCoverFile = async (file: File | null) => {
    if (!file || !currentUser?.id) return;
    setEditListCoverBusy(true);
    setEditListError('');
    try {
      const result = await uploadListCoverFile(file, currentUser.id);
      if ('error' in result) {
        setEditListError(result.error);
        return;
      }
      if (editListCoverUrl && editListCoverUrl !== editListCoverOriginalRef.current) {
        void deleteStoredListCover(editListCoverUrl);
      }
      setEditListCoverUrl(result.url);
    } finally {
      setEditListCoverBusy(false);
    }
  };

  const closeEditList = () => {
    if (editListCoverUrl && editListCoverUrl !== editListCoverOriginalRef.current) {
      void deleteStoredListCover(editListCoverUrl);
    }
    setIsEditListOpen(false);
  };

  const saveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageListId || editListBusy) return;
    const current =
      libraryLists.find((l) => l.id === manageListId) || lists.find((l) => l.id === manageListId);
    const systemList = isSystemLibraryList(current);
    const name = editListName.trim();
    if (!systemList && !name) {
      setEditListError('Name is required');
      return;
    }
    setEditListBusy(true);
    setEditListError('');
    try {
      const nextCover = editListCoverUrl.trim() || null;
      const previousCover = editListCoverOriginalRef.current || null;
      const payload = systemList
        ? {
            description: editListDescription.trim() || null,
            cover_image_url: nextCover,
          }
        : {
            name,
            description: editListDescription.trim() || null,
            cover_image_url: nextCover,
          };
      const { error } = await supabase.from('user_lists').update(payload).eq('id', manageListId);
      if (error) {
        setEditListError(error.message || 'Failed to update list');
        return;
      }
      if (previousCover && previousCover !== nextCover) {
        void deleteStoredListCover(previousCover);
      }
      editListCoverOriginalRef.current = nextCover || '';
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

  /** Always surface Liked + Reviews boards on own library; inject if DB rows missing. */
  const libraryLists = useMemo((): ListWithCount[] => {
    const ratedIds = reviews.map((r) => r.event?.id).filter(Boolean) as string[];
    const ratedCollage = pickListCollageUrls(reviews.map((r) => r.event?.image_url));
    const items = lists.map((l) =>
      l.is_rated_list
        ? {
            ...l,
            event_count: reviews.length,
            cover_collage_urls: ratedCollage,
            event_ids: ratedIds,
          }
        : l,
    );
    const hasRated = items.some((l) => l.is_rated_list);
    const hasLiked = items.some((l) => l.is_liked_list);

    if (isOwnProfile && !hasLiked) {
      items.push({
        id: VIRTUAL_LIKED_LIST_ID,
        user_id: userId,
        name: 'My Liked Events',
        description: null,
        sort_order: -2,
        is_liked_list: true,
        is_rated_list: false,
        is_public: false,
        cover_image_url: null,
        cover_collage_urls: [],
        event_ids: [],
        created_at: '',
        event_count: 0,
      });
    }
    if (isOwnProfile && !hasRated) {
      items.push({
        id: VIRTUAL_RATINGS_LIST_ID,
        user_id: userId,
        name: 'My Reviews',
        description: null,
        sort_order: -1,
        is_liked_list: false,
        is_rated_list: true,
        is_public: false,
        cover_image_url: null,
        cover_collage_urls: ratedCollage,
        event_ids: ratedIds,
        created_at: '',
        event_count: reviews.length,
      });
    }
    return sortListsLibraryFirst(items);
  }, [lists, reviews, userId, isOwnProfile]);

  /** Public visitors only see boards marked public (including Liked / Reviews).
   *  With an active search, keep boards that have at least one matching show. */
  const visibleLibraryLists = useMemo((): ListWithCount[] => {
    const base = isOwnProfile
      ? libraryLists
      : libraryLists.filter((l) => l.is_public === true);
    if (!searchActive) return base;
    const matchIds = new Set(searchEvents.map((e) => e.id));
    return base.filter((l) => (l.event_ids || []).some((id) => matchIds.has(id)));
  }, [libraryLists, isOwnProfile, searchActive, searchEvents]);

  /** Search hits that are actually saved on one of this profile's boards. */
  const boardSavedSearchEvents = useMemo(() => {
    if (!searchActive) return [];
    const savedIds = new Set<string>();
    for (const l of libraryLists) {
      for (const id of l.event_ids || []) savedIds.add(id);
    }
    return [...searchEvents]
      .filter((e) => savedIds.has(e.id))
      .sort((a, b) => compareEventsForFeed(a, b));
  }, [searchActive, searchEvents, libraryLists]);

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
      const handle = userIdPublic.trim();
      if (!handle) return;
      await navigator.clipboard.writeText(canonicalListUrl(handle, realId));
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

  const listDisplayName = (list: ListWithCount | undefined) =>
    formatListDisplayName(list, { isOwnProfile, username, t });

  if (loading) {
    return (
      <>
        <PageBack className="mb-6" />
        <div className="flex items-center justify-center py-24">
          <LoadingSpinner />
        </div>
      </>
    );
  }

  if (manageListId) {
    const currentList =
      visibleLibraryLists.find((l) => l.id === manageListId) || lists.find((l) => l.id === manageListId);

    return (
      <ProfileBoardView
        manageListId={manageListId}
        currentList={currentList}
        listEvents={listEvents}
        boardTagMap={boardTagMap}
        isOwnProfile={isOwnProfile}
        searchActive={searchActive}
        searchEvents={searchEvents}
        showBoardMenu={showBoardMenu}
        boardMenuRef={boardMenuRef}
        listLinkCopied={listLinkCopied}
        shareBusy={shareBusy}
        listDisplayName={listDisplayName}
        onToggleBoardMenu={() => setShowBoardMenu((v) => !v)}
        onCloseBoardMenu={() => setShowBoardMenu(false)}
        onOpenEditList={openEditList}
        onOpenAddEvent={openAddEvent}
        onCopyBoardLink={copyBoardLink}
        onToggleBoardPublic={toggleBoardPublic}
        onDeleteList={deleteList}
        onReloadBoard={() => {
          void loadListBoard(manageListId, currentList);
        }}
        onRefreshProfile={fetchProfile}
        onTagClick={onTagClick}
        onOpenEvent={onOpenEvent}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
        isAddEventOpen={isAddEventOpen}
        addEventSearch={addEventSearch}
        addEventError={addEventError}
        filteredAddEvents={filteredAddEvents}
        onAddEventSearchChange={setAddEventSearch}
        onAddEvent={addEventToList}
        onCloseAddEvent={() => setIsAddEventOpen(false)}
        isEditListOpen={isEditListOpen}
        editListName={editListName}
        editListDescription={editListDescription}
        editListCoverUrl={editListCoverUrl}
        editListCoverOriginal={editListCoverOriginalRef.current}
        editListCoverBusy={editListCoverBusy}
        editListBusy={editListBusy}
        editListError={editListError}
        canUploadCover={!!currentUser}
        onEditListNameChange={setEditListName}
        onEditListDescriptionChange={setEditListDescription}
        onEditListCoverUrlChange={setEditListCoverUrl}
        onEditListCoverFile={onEditListCoverFile}
        onSaveEditList={saveEditList}
        onCloseEditList={closeEditList}
        onLeaveBoard={leaveBoard}
      />
    );
  }

  return (
    <div className="pb-16">
      <PageBack className="mb-6" />
      <ProfileHeader
        coverUrl={coverUrl}
        avatarUrl={avatarUrl}
        username={username}
        userIdPublic={userIdPublic}
        isOwnProfile={isOwnProfile}
        currentUserFullName={currentUser?.user_metadata?.full_name as string | undefined}
        currentUserEmailPrefix={currentUser?.email?.split('@')[0]}
        tagColors={tagColors}
      />

      <ProfileLibraryBoards
        isOwnProfile={isOwnProfile}
        listsError={listsError}
        reviewsCount={reviews.length}
        visibleLibraryLists={visibleLibraryLists}
        boardSavedSearchEvents={boardSavedSearchEvents}
        searchActive={searchActive}
        listDisplayName={listDisplayName}
        onOpenList={(listId) => {
          void openManageList(listId);
        }}
        onEnableLists={() => {
          void enableLists();
        }}
        onRefresh={fetchProfile}
        copyFeedback={copyFeedback}
        onStartCreateList={() => {
          setIsCreateListOpen(true);
          setCreateError('');
          setNewListName('');
          setNewListDescription('');
          setNewListPrivate(false);
        }}
        onTagClick={onTagClick}
        onOpenEvent={onOpenEvent}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
        onSearchEventRatingSubmitted={onSearchEventRatingSubmitted}
        onSearchEventUpdated={onSearchEventUpdated}
      />

      {isCreateListOpen && (
        <CreateListModal
          name={newListName}
          description={newListDescription}
          isPrivate={newListPrivate}
          error={createError}
          onNameChange={setNewListName}
          onDescriptionChange={setNewListDescription}
          onPrivateChange={setNewListPrivate}
          onSubmit={createList}
          onClose={() => setIsCreateListOpen(false)}
        />
      )}
    </div>
  );
}
