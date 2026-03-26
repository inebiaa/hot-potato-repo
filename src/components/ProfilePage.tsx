import { useState, useEffect } from 'react';
import { Plus, Trash2, X, ChevronRight, Rows3, LayoutGrid, Copy, RefreshCw, Star } from 'lucide-react';
import { supabase, UserList, UserListEvent, Rating, Event } from '../lib/supabase';
import EventCard from './EventCard';
import { useAuth } from '../contexts/AuthContext';
import { USER_LISTS_SETUP_SQL, getSupabaseSqlEditorUrl } from '../lib/userListsSetupSql';

interface ProfilePageProps {
  userId: string;
  pathname: string;
  onClose: () => void;
  onTagClick?: (type: string, value: string) => void;
  onOpenEvent?: (eventId: string, openWithWiggle?: boolean, suggestSection?: keyof { producers: string[]; featured_designers: string[]; models: string[]; hair_makeup: string[]; header_tags: string[]; footer_tags: string[] } | 'custom', suggestCustomSlug?: string) => void;
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

export default function ProfilePage({ userId, pathname, onClose, onTagClick, onOpenEvent, tagColors, customPerformerTags = [], refreshTrigger = 0, cachedEvents }: ProfilePageProps) {
  const { user: currentUser } = useAuth();
  const isOwnProfile = !!currentUser && currentUser.id === userId;
  const [username, setUsername] = useState<string>('');
  const [userIdPublic, setUserIdPublic] = useState<string>('');
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [lists, setLists] = useState<ListWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [manageListId, setManageListId] = useState<string | null>(null);
  const [listEvents, setListEvents] = useState<{ event: Event; listEvent: UserListEvent }[]>([]);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [addEventError, setAddEventError] = useState('');
  const [listsError, setListsError] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [addEventSearch, setAddEventSearch] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [reviewsLayout, setReviewsLayout] = useState<'list' | 'cards'>(() => {
    try {
      const saved = window.localStorage.getItem('profile_reviews_layout');
      return saved === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('profile_reviews_layout', reviewsLayout);
    } catch {
      // Ignore storage errors.
    }
  }, [reviewsLayout]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Run profile, ratings, and lists in parallel
      const [profileRes, ratingsRes, listsRes] = await Promise.all([
        supabase.from('user_profiles').select('username, user_id_public').eq('user_id', userId).maybeSingle(),
        supabase.from('ratings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('user_lists').select('*').eq('user_id', userId).order('sort_order').order('created_at', { ascending: false })
      ]);

      const profile = profileRes.data;
      const ratingsData = ratingsRes.data || [];
      const listsData = listsRes.data || [];

      setUsername(profile?.username || 'My profile');
      setUserIdPublic(profile?.user_id_public || '');

      const eventIds = [...new Set(ratingsData.map((r) => r.event_id))];

      // Use cached events when available to avoid re-fetch
      const cacheMap = cachedEvents?.length ? new Map(cachedEvents.map((e) => [e.id, e])) : null;
      const useCache = cacheMap && eventIds.length > 0 && eventIds.every((id) => cacheMap.has(id));

      // Run events fetch (or use cache), allRatingsForEvents, and list counts in parallel
      const [eventsRes, allRatingsRes, listCountsRes] = await Promise.all([
        useCache ? Promise.resolve({ data: eventIds.map((id) => cacheMap!.get(id)!).filter(Boolean) }) : (eventIds.length > 0 ? supabase.from('events').select('*').in('id', eventIds) : Promise.resolve({ data: [] })),
        eventIds.length > 0 ? supabase.from('ratings').select('event_id, rating').in('event_id', eventIds) : Promise.resolve({ data: [] }),
        listsData.length > 0
          ? supabase.from('user_list_events').select('list_id').in('list_id', listsData.map((l) => l.id))
          : Promise.resolve({ data: [] })
      ]);

      const eventsData = eventsRes.data || [];
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
          { averageRating: s.count ? s.sum / s.count : 0, ratingCount: s.count }
        ])
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
          ratingCount: stats?.ratingCount || 0
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
            event_count: countByList[l.id] || 0
          }))
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
  }, [userId, refreshTrigger]);

  const openManageList = async (listId: string) => {
    setManageListId(listId);
    const { data: listEventsData } = await supabase
      .from('user_list_events')
      .select('*')
      .eq('list_id', listId)
      .order('position');
    const ids = (listEventsData || []).map((e) => e.event_id);
    const cacheMap = cachedEvents?.length ? new Map(cachedEvents.map((e) => [e.id, e])) : null;
    const useCache = cacheMap && ids.length > 0 && ids.every((id) => cacheMap.has(id));
    const eventsData = useCache ? ids.map((id) => cacheMap!.get(id)!).filter(Boolean) : (await supabase.from('events').select('*').in('id', ids)).data || [];
    const eventsMap = new Map(eventsData.map((e) => [e.id, e]));
    const eventsList = (listEventsData || [])
      .map((le) => ({
        listEvent: le,
        event: eventsMap.get(le.event_id)!
      }))
      .filter((x) => x.event);
    eventsList.sort((a, b) => (b.event.date || '').localeCompare(a.event.date || ''));
    setListEvents(eventsList);
  };

  const removeFromList = async (listEventId: string) => {
    await supabase.from('user_list_events').delete().eq('id', listEventId);
    if (manageListId) openManageList(manageListId);
    fetchProfile();
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!newListName.trim()) {
      setCreateError('Name is required');
      return;
    }
    const { error } = await supabase.from('user_lists').insert({
      user_id: userId,
      name: newListName.trim(),
      description: newListDescription.trim() || null,
      sort_order: lists.length
    });
    if (error) {
      const msg = error.message || (error as { message?: string })?.message || 'Failed to create list';
      setCreateError(msg);
      return;
    }
    setNewListName('');
    setNewListDescription('');
    setIsCreateListOpen(false);
    fetchProfile();
  };

  const deleteList = async (listId: string) => {
    if (!window.confirm('Delete this list? Events in it are not deleted.')) return;
    await supabase.from('user_lists').delete().eq('id', listId);
    setManageListId(null);
    fetchProfile();
  };

  const openAddEvent = async () => {
    setAddEventError('');
    const { data } = await supabase.from('events').select('*').order('date', { ascending: false });
    setAllEvents(data || []);
    setAddEventSearch('');
    setIsAddEventOpen(true);
  };

  const addEventToList = async (eventId: string) => {
    if (!manageListId) return;
    const maxPos = listEvents.length ? Math.max(...listEvents.map((e) => e.listEvent.position), 0) : 0;
    const { error } = await supabase.from('user_list_events').insert({
      list_id: manageListId,
      event_id: eventId,
      position: maxPos + 1
    });
    if (error) {
      setAddEventError(error.message || 'Failed to add show to list');
      return;
    }
    setAddEventError('');
    openManageList(manageListId);
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

  const filteredAddEvents = allEvents.filter(
    (e) =>
      !listEvents.some((le) => le.event.id === e.id) &&
      (e.name.toLowerCase().includes(addEventSearch.toLowerCase()) ||
        (e.city || '').toLowerCase().includes(addEventSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (manageListId) {
    const currentList = lists.find((l) => l.id === manageListId);
    return (
      <div className="min-h-screen bg-stone-50/80">
        <div className="max-w-2xl mx-auto px-4 pb-16 pt-6">
          <button
            onClick={() => { setManageListId(null); setIsAddEventOpen(false); }}
            className="text-sm text-stone-500 hover:text-stone-900 mb-8 transition-colors"
          >
            ← Back to profile
          </button>
          <div className="rounded-2xl bg-white/90 p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-stone-900 tracking-tight">{currentList?.name}</h2>
              {currentList?.description && (
                <p className="text-sm text-stone-500 mt-1">{currentList.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={openAddEvent}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              >
                <Plus size={16} />
                Add show
              </button>
              <button
                onClick={() => deleteList(manageListId)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                title="Delete list"
              >
                <Trash2 size={18} />
              </button>
            </div>
            </div>
            <ul className="space-y-2">
            {listEvents.map(({ event, listEvent }) => (
              <li
                key={listEvent.id}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <div>
                  <a href={`${pathname}?event=${event.id}`} className="text-gray-900 hover:text-blue-600 font-medium">
                    {event.name}
                  </a>
                  {event.date && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeFromList(listEvent.id)}
                  className="text-gray-400 hover:text-red-600 p-1"
                  title="Remove from list"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
            {listEvents.length === 0 && (
              <li className="text-gray-500 py-4">No shows in this list yet. Click “Add show” to add events.</li>
            )}
          </ul>
          </div>
        </div>

        {isAddEventOpen && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={(e) => e.target === e.currentTarget && setIsAddEventOpen(false)}
          >
            <div className="relative max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white rounded-xl w-full max-h-[80vh] flex flex-col">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Add show to list</h3>
              </div>
              {addEventError && <p className="px-4 py-2 text-sm text-red-600 bg-red-50">{addEventError}</p>}
              <div className="p-4 border-b">
                <input
                  type="text"
                  placeholder="Search shows..."
                  value={addEventSearch}
                  onChange={(e) => setAddEventSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
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
                  <li className="text-gray-500 py-4 text-sm">No matching shows or all are already in this list.</li>
                )}
              </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50/80">
      <div className="max-w-[2400px] mx-auto px-4 pb-16 pt-6">

        <header className="mb-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span
                className="inline-block text-sm font-medium px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: tagColors?.optional_tags_bg_color || '#e0e7ff',
                  color: tagColors?.optional_tags_text_color || '#3730a3'
                }}
              >
                {username || (currentUser?.user_metadata?.full_name as string) || (currentUser?.email?.split('@')[0]) || 'Profile'}
              </span>
              <div className="text-stone-500 text-sm mt-1 space-y-0.5">
                {isOwnProfile && currentUser?.email && (
                  <p className="text-stone-600">{currentUser.email}</p>
                )}
                {isOwnProfile && userIdPublic && (
                  <p className="text-stone-500">Sign in as: <span className="font-mono text-stone-600">{userIdPublic}</span></p>
                )}
                <p>
                  {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                  {lists.length > 0 && ` · ${lists.length} list${lists.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="inline-flex rounded-lg border border-stone-200 bg-white/80 p-1">
                <button
                  type="button"
                  onClick={() => setReviewsLayout('list')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    reviewsLayout === 'list' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'
                  }`}
                  title="List view"
                  aria-label="List view"
                >
                  <Rows3 size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setReviewsLayout('cards')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    reviewsLayout === 'cards' ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:text-stone-700'
                  }`}
                  title="Card view"
                  aria-label="Card view"
                >
                  <LayoutGrid size={15} />
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-stone-900">My reviews</h2>
          {reviews.length === 0 ? (
            <div className="rounded-2xl bg-white/80 py-16 px-6 text-center"><p className="text-stone-500 text-sm">No reviews yet. Rate a show to see it here.</p></div>
          ) : reviewsLayout === 'cards' ? (
            <div className="columns-[300px] gap-6">
              {reviews
                .filter((row, idx, arr) => arr.findIndex((x) => x.event.id === row.event.id) === idx)
                .map(({ rating, event, averageRating, ratingCount }) => (
                  event?.id ? (
                    <div key={rating.id} className="break-inside-avoid mb-6">
                      <EventCard
                        event={event}
                        averageRating={averageRating}
                        ratingCount={ratingCount}
                        userRating={rating}
                        onRatingSubmitted={fetchProfile}
                        onEventUpdated={fetchProfile}
                        onTagClick={onTagClick || (() => {})}
                        onViewClick={onOpenEvent}
                        tagColors={tagColors}
                        customPerformerTags={customPerformerTags}
                      />
                    </div>
                  ) : null
                ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {reviews.map(({ rating, eventName, eventDate, event }) => (
                <li key={rating.id}>
                  <button
                    type="button"
                    onClick={() => onOpenEvent?.(event.id)}
                    className="w-full text-left rounded-xl bg-white/90 px-3 py-3 hover:bg-white transition-all border border-stone-100 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-stone-100 overflow-hidden shrink-0">
                        {event.image_url ? (
                          <img src={event.image_url} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-stone-800 truncate">{eventName}</span>
                          <span className="text-xs text-stone-500 shrink-0">
                            {eventDate ? new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={14}
                              className={s <= rating.rating ? 'fill-yellow-400 text-yellow-400' : 'text-stone-300'}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">Lists</h2>
          {listsError ? (
            <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-6">
              <p className="text-sm text-amber-800 mb-4">
                Lists require a one-time database setup. Copy the SQL and run it in your Supabase SQL Editor.
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
          ) : (
            <>
        <p className="text-sm text-stone-500 mb-4">
          Create lists like “Greatest shows of all time” or a model resume.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setIsCreateListOpen(true); setCreateError(''); setNewListName(''); setNewListDescription(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-stone-500 hover:text-stone-700 hover:bg-white/60 transition-colors border border-stone-200/60"
          >
            <Plus size={18} />
            New list
          </button>
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => openManageList(list.id)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/90 hover:bg-white transition-all hover:shadow-md hover:shadow-stone-200/30 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 truncate">{list.name}</p>
                <p className="text-xs text-stone-500">{list.event_count} show{list.event_count !== 1 ? 's' : ''}</p>
              </div>
              <ChevronRight size={16} className="text-stone-300 shrink-0" />
            </button>
          ))}
        </div>
            </>
          )}
        </section>
      </div>

      {isCreateListOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setIsCreateListOpen(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-stone-900 mb-4">Create list</h3>
            <form onSubmit={createList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Greatest shows of all time"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-stone-300 focus:border-transparent"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="e.g. My personal top 10"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-stone-900 focus:ring-2 focus:ring-stone-300 focus:border-transparent"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2.5 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-colors">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateListOpen(false)}
                  className="px-4 py-2.5 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
