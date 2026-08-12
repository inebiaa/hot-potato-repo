import { supabase, type UserList } from './supabase';

export const LIKED_EVENTS_LIST_NAME = 'Liked Events';
export const RATED_EVENTS_LIST_NAME = 'Reviews';
/** Sentinel when viewing ratings without a DB system row (e.g. another user’s profile). */
export const VIRTUAL_RATINGS_LIST_ID = '__ratings__';
/** Sentinel when Liked list row is missing from DB. */
export const VIRTUAL_LIKED_LIST_ID = '__liked__';

type LikedIdsCache = { userId: string; ids: Set<string> };
let likedIdsCache: LikedIdsCache | null = null;
let likedIdsInflight: { userId: string; promise: Promise<Set<string>> } | null = null;

export function invalidateLikedEventIdsCache(userId?: string): void {
  if (!userId || likedIdsCache?.userId === userId) {
    likedIdsCache = null;
  }
  if (!userId || likedIdsInflight?.userId === userId) {
    likedIdsInflight = null;
  }
}

async function ensureSystemList(
  userId: string,
  flag: 'is_liked_list' | 'is_rated_list',
  name: string,
  sortOrder: number,
): Promise<{ data: UserList | null; error: Error | null }> {
  const existing = await supabase
    .from('user_lists')
    .select('*')
    .eq('user_id', userId)
    .eq(flag, true)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error };
  }
  if (existing.data) {
    return { data: existing.data as UserList, error: null };
  }

  const created = await supabase
    .from('user_lists')
    .insert({
      user_id: userId,
      name,
      description: null,
      sort_order: sortOrder,
      is_liked_list: flag === 'is_liked_list',
      is_rated_list: flag === 'is_rated_list',
      is_public: true,
    })
    .select('*')
    .single();

  if (created.error) {
    const again = await supabase
      .from('user_lists')
      .select('*')
      .eq('user_id', userId)
      .eq(flag, true)
      .maybeSingle();
    if (again.data) return { data: again.data as UserList, error: null };
    return { data: null, error: created.error };
  }

  if (flag === 'is_liked_list') invalidateLikedEventIdsCache(userId);
  return { data: created.data as UserList, error: null };
}

/** Ensure the system Liked list exists for this user; return it. */
export async function ensureLikedList(userId: string): Promise<{ data: UserList | null; error: Error | null }> {
  return ensureSystemList(userId, 'is_liked_list', LIKED_EVENTS_LIST_NAME, -2);
}

/** Ensure the system Reviews list exists (library identity; events come from ratings). */
export async function ensureRatedList(userId: string): Promise<{ data: UserList | null; error: Error | null }> {
  return ensureSystemList(userId, 'is_rated_list', RATED_EVENTS_LIST_NAME, -1);
}

/** Ensure both system library lists for the signed-in owner. */
export async function ensureLibraryLists(userId: string): Promise<void> {
  await Promise.all([ensureRatedList(userId), ensureLikedList(userId)]);
}

/**
 * Read liked event ids only (does not create the Liked list).
 * Safe to call from every EventCard — requests are coalesced per user.
 */
export async function fetchLikedEventIds(userId: string, force = false): Promise<Set<string>> {
  if (!force && likedIdsCache?.userId === userId) {
    return likedIdsCache.ids;
  }
  if (!force && likedIdsInflight?.userId === userId) {
    return likedIdsInflight.promise;
  }

  const promise = (async () => {
    try {
      const listRes = await supabase
        .from('user_lists')
        .select('id')
        .eq('user_id', userId)
        .eq('is_liked_list', true)
        .maybeSingle();

      if (listRes.error || !listRes.data) {
        const empty = new Set<string>();
        likedIdsCache = { userId, ids: empty };
        return empty;
      }

      const { data, error } = await supabase
        .from('user_list_events')
        .select('event_id')
        .eq('list_id', listRes.data.id);

      if (error) {
        const empty = new Set<string>();
        likedIdsCache = { userId, ids: empty };
        return empty;
      }

      const ids = new Set((data || []).map((row) => row.event_id as string));
      likedIdsCache = { userId, ids };
      return ids;
    } catch {
      const empty = new Set<string>();
      likedIdsCache = { userId, ids: empty };
      return empty;
    } finally {
      if (likedIdsInflight?.userId === userId) {
        likedIdsInflight = null;
      }
    }
  })();

  likedIdsInflight = { userId, promise };
  return promise;
}

async function nextPosition(listId: string): Promise<number> {
  const { data } = await supabase
    .from('user_list_events')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1);
  const max = data?.[0]?.position;
  return typeof max === 'number' ? max + 1 : 1;
}

/** Add event to Liked if missing. Does not remove from other lists. */
export async function addEventToLiked(
  userId: string,
  eventId: string,
): Promise<{ error: Error | null; likedListId: string | null }> {
  const { data: likedList, error: listError } = await ensureLikedList(userId);
  if (listError || !likedList) {
    return { error: listError || new Error('Could not create Liked list'), likedListId: null };
  }

  const { data: existing } = await supabase
    .from('user_list_events')
    .select('id')
    .eq('list_id', likedList.id)
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    if (likedIdsCache?.userId === userId) likedIdsCache.ids.add(eventId);
    return { error: null, likedListId: likedList.id };
  }

  const position = await nextPosition(likedList.id);
  const { error } = await supabase.from('user_list_events').insert({
    list_id: likedList.id,
    event_id: eventId,
    position,
  });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      if (likedIdsCache?.userId === userId) likedIdsCache.ids.add(eventId);
      return { error: null, likedListId: likedList.id };
    }
    return { error, likedListId: likedList.id };
  }

  if (likedIdsCache?.userId === userId) {
    likedIdsCache.ids.add(eventId);
  } else {
    invalidateLikedEventIdsCache(userId);
  }
  return { error: null, likedListId: likedList.id };
}

/** Remove from Liked only; leaves custom lists alone. */
export async function removeEventFromLiked(
  userId: string,
  eventId: string,
): Promise<{ error: Error | null }> {
  const { data: likedList, error: listError } = await ensureLikedList(userId);
  if (listError || !likedList) {
    return { error: listError || new Error('Could not load Liked list') };
  }

  const { error } = await supabase
    .from('user_list_events')
    .delete()
    .eq('list_id', likedList.id)
    .eq('event_id', eventId);

  if (error) return { error };

  if (likedIdsCache?.userId === userId) {
    likedIdsCache.ids.delete(eventId);
  } else {
    invalidateLikedEventIdsCache(userId);
  }
  return { error: null };
}

export async function toggleLikedEvent(
  userId: string,
  eventId: string,
  currentlyLiked: boolean,
): Promise<{ liked: boolean; error: Error | null }> {
  if (currentlyLiked) {
    const { error } = await removeEventFromLiked(userId, eventId);
    return { liked: error ? true : false, error };
  }
  const { error } = await addEventToLiked(userId, eventId);
  return { liked: error ? false : true, error };
}

/**
 * Add event to a custom list, and also to Your Liked Events.
 * Removals stay independent (caller removes from one list only).
 */
export async function addEventToListAndLiked(
  userId: string,
  listId: string,
  eventId: string,
  position?: number,
): Promise<{ error: Error | null }> {
  const pos = position ?? (await nextPosition(listId));
  const { error } = await supabase.from('user_list_events').insert({
    list_id: listId,
    event_id: eventId,
    position: pos,
  });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return addEventToLiked(userId, eventId).then((r) => ({ error: r.error }));
    }
    return { error };
  }

  const liked = await addEventToLiked(userId, eventId);
  return { error: liked.error };
}

type LibrarySortable = {
  is_liked_list?: boolean;
  is_rated_list?: boolean;
  sort_order: number;
  created_at: string;
};

function libraryRank(list: LibrarySortable): number {
  if (list.is_liked_list) return -2;
  if (list.is_rated_list) return -1;
  return 0;
}

/** Liked, then Reviews, then custom playlists. */
export function sortListsLibraryFirst<T extends LibrarySortable>(lists: T[]): T[] {
  return [...lists].sort((a, b) => {
    const ra = libraryRank(a);
    const rb = libraryRank(b);
    if (ra !== rb) return ra - rb;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });
}

/** @deprecated use sortListsLibraryFirst */
export function sortListsLikedFirst<T extends LibrarySortable>(lists: T[]): T[] {
  return sortListsLibraryFirst(lists);
}

/** User playlists excluding system Liked / Ratings lists (for “Add to list” pickers). */
export async function fetchUserPlaylists(userId: string): Promise<{ data: UserList[]; error: Error | null }> {
  // Same shape as profile fetch; filter system boards client-side so a PostgREST
  // boolean filter quirk cannot wipe the whole result set.
  const { data, error } = await supabase
    .from('user_lists')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return { data: [], error };
  const rows = (data || []) as UserList[];
  return {
    data: rows.filter((l) => !l.is_liked_list && !l.is_rated_list),
    error: null,
  };
}

/** Create a custom playlist (not Liked / Ratings). Defaults to public. */
export async function createUserPlaylist(
  userId: string,
  name: string,
  opts?: { description?: string | null; isPublic?: boolean; sortOrder?: number },
): Promise<{ data: UserList | null; error: Error | null }> {
  const trimmed = name.trim();
  if (!trimmed) return { data: null, error: new Error('Name is required') };

  const { data, error } = await supabase
    .from('user_lists')
    .insert({
      user_id: userId,
      name: trimmed,
      description: opts?.description?.trim() || null,
      sort_order: opts?.sortOrder ?? 0,
      is_liked_list: false,
      is_rated_list: false,
      is_public: opts?.isPublic !== false,
    })
    .select('*')
    .single();

  if (error) return { data: null, error };
  return { data: data as UserList, error: null };
}

export function isSystemLibraryList(
  list: { is_liked_list?: boolean; is_rated_list?: boolean } | null | undefined,
): boolean {
  return !!(list?.is_liked_list || list?.is_rated_list);
}
