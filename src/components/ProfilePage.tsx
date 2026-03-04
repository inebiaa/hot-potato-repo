import { useState, useEffect } from 'react';
import { Star, List, Plus, Trash2, X, ChevronRight, Copy, RefreshCw } from 'lucide-react';
import { supabase, UserList, UserListEvent, Rating, Event } from '../lib/supabase';
import ViewRatingsModal from './ViewRatingsModal';
import CommentWithTags from './CommentWithTags';
import { USER_LISTS_SETUP_SQL, getSupabaseSqlEditorUrl } from '../lib/userListsSetupSql';

interface ProfilePageProps {
  userId: string;
  pathname: string;
  onClose: () => void;
  onTagClick?: (type: string, value: string) => void;
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
  };
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
}

interface ReviewRow {
  rating: Rating;
  event: Event;
  eventName: string;
  eventDate: string;
}

interface ListWithCount extends UserList {
  event_count: number;
}

export default function ProfilePage({ userId, pathname, onClose, tagColors, customPerformerTags = [], onOpenEvent }: ProfilePageProps) {
  const [username, setUsername] = useState<string>('');
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
  const [viewRatingsFor, setViewRatingsFor] = useState<ReviewRow | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('user_id', userId)
        .maybeSingle();
      setUsername(profile?.username || 'My profile');

      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const eventIds = [...new Set((ratingsData || []).map((r) => r.event_id))];
      const { data: eventsData } = await supabase.from('events').select('*').in('id', eventIds);
      const eventsMap = new Map((eventsData || []).map((e) => [e.id, e]));
      const reviewsUnsorted = (ratingsData || []).map((r) => {
        const event = eventsMap.get(r.event_id);
        return {
          rating: r,
          event: event || ({} as Event),
          eventName: event?.name || 'Unknown',
          eventDate: event?.date || ''
        };
      });
      reviewsUnsorted.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
      setReviews(reviewsUnsorted);

      const { data: listsData, error: listsErr } = await supabase
        .from('user_lists')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order')
        .order('created_at', { ascending: false });
      if (listsErr) {
        setListsError(listsErr.message || 'Could not load lists');
        setLists([]);
      } else {
        setListsError(null);
        const listIds = (listsData || []).map((l) => l.id);
        let countByList: Record<string, number> = {};
        if (listIds.length > 0) {
          const { data: countsData, error: countsErr } = await supabase
            .from('user_list_events')
            .select('list_id')
            .in('list_id', listIds);
          if (!countsErr && countsData) {
            countByList = countsData.reduce<Record<string, number>>((acc, row) => {
              acc[row.list_id] = (acc[row.list_id] || 0) + 1;
              return acc;
            }, {});
          }
        }
        setLists(
          (listsData || []).map((l) => ({
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
  }, [userId]);

  const openManageList = async (listId: string) => {
    setManageListId(listId);
    const { data: listEventsData } = await supabase
      .from('user_list_events')
      .select('*')
      .eq('list_id', listId)
      .order('position');
    const ids = (listEventsData || []).map((e) => e.event_id);
    const { data: eventsData } = await supabase.from('events').select('*').in('id', ids);
    const eventsMap = new Map((eventsData || []).map((e) => [e.id, e]));
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setManageListId(null); setIsAddEventOpen(false); }}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to profile
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{currentList?.name}</h2>
              {currentList?.description && (
                <p className="text-sm text-gray-500 mt-1">{currentList.description}</p>
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

        {isAddEventOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="relative max-w-lg w-full my-8">
              <button
                onClick={() => { setIsAddEventOpen(false); setAddEventError(''); }}
                className="absolute -top-10 right-0 w-8 h-8 flex items-center justify-center text-white/90 hover:text-white rounded-full hover:bg-white/10 transition-colors text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to shows
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">{username}</h1>
        <p className="text-gray-500 text-sm">Your profile</p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Star size={20} className="text-amber-500" />
          My reviews
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {reviews.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm">You haven’t rated any shows yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {reviews.map(({ rating, event, eventName, eventDate }) => (
                <li
                  key={rating.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewRatingsFor({ rating, event, eventName, eventDate })}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewRatingsFor({ rating, event, eventName, eventDate }); } }}
                >
                  <div>
                    <span className="font-medium text-gray-900 hover:text-blue-600">
                      {eventName}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {eventDate ? new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={16}
                          className={s <= rating.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                        />
                      ))}
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-gray-600 max-w-xs line-clamp-2 italic" title={rating.comment}>
                        {event?.id ? (
                          <>"<CommentWithTags
                            comment={rating.comment}
                            event={event}
                            tagColors={tagColors}
                            customPerformerTags={customPerformerTags}
                          />"</>
                        ) : (
                          <>"{rating.comment}"</>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <List size={20} />
          My lists
        </h2>
        {listsError ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-4">
            <p className="text-sm text-amber-800 mb-3">
              Lists need a one-time setup. Click below to copy the setup SQL and open your Supabase SQL Editor.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={enableLists}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
              >
                <Copy size={16} />
                Copy SQL & open Supabase
              </button>
              <button
                onClick={fetchProfile}
                className="flex items-center gap-2 px-4 py-2 border border-amber-300 rounded-lg text-sm text-amber-800 hover:bg-amber-100"
              >
                <RefreshCw size={16} />
                I&apos;ve run it — Refresh
              </button>
              {copyFeedback && (
                <span className="self-center text-sm text-amber-700">{copyFeedback}</span>
              )}
            </div>
          </div>
        ) : null}
        <p className="text-sm text-gray-500 mb-3">
          Create lists like “Greatest shows of all time” or a model resume.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => { setIsCreateListOpen(true); setCreateError(''); setNewListName(''); setNewListDescription(''); }}
            className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            <Plus size={20} />
            Create list
          </button>
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => openManageList(list.id)}
              className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow text-left min-w-[200px]"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{list.name}</p>
                <p className="text-xs text-gray-500">{list.event_count} show{list.event_count !== 1 ? 's' : ''}</p>
              </div>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      </section>

      {viewRatingsFor && viewRatingsFor.event.id && (
        <ViewRatingsModal
          isOpen={true}
          onClose={() => setViewRatingsFor(null)}
          eventId={viewRatingsFor.event.id}
          eventName={viewRatingsFor.eventName}
          event={viewRatingsFor.event}
          currentUserId={userId}
          onRatingSubmitted={fetchProfile}
          tagColors={tagColors}
          customPerformerTags={customPerformerTags}
          onViewEvent={onOpenEvent}
        />
      )}

      {isCreateListOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create list</h3>
            <form onSubmit={createList} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g. Greatest shows of all time"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  type="text"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="e.g. My personal top 10"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateListOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
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
