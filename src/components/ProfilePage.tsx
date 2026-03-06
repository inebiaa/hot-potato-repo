import { useState, useEffect } from 'react';
import { Plus, Trash2, X, ChevronRight, Copy, RefreshCw, Star, Rows3, LayoutGrid, Settings } from 'lucide-react';
import { supabase, UserList, UserListEvent, Rating, Event } from '../lib/supabase';
import EventCard from './EventCard';
import { useAuth } from '../contexts/AuthContext';
import { USER_LISTS_SETUP_SQL, getSupabaseSqlEditorUrl } from '../lib/userListsSetupSql';
import { ensureIdentity, findIdentityByName, normalizeTagName, searchTagIdentities, searchEventTags, type TagType } from '../lib/tagIdentity';

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

interface CreditRow {
  id: string;
  identity_id: string;
  preferred_alias_id: string | null;
  tag_type: string;
  canonical_name: string;
  aliases: { id: string; alias: string }[];
}

export default function ProfilePage({ userId, pathname, onClose, onTagClick, onOpenEvent, tagColors, customPerformerTags = [] }: ProfilePageProps) {
  const { user: currentUser } = useAuth();
  const isOwnProfile = !!currentUser && currentUser.id === userId;
  const [username, setUsername] = useState<string>('');
  const [userIdPublic, setUserIdPublic] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [profileSaveError, setProfileSaveError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
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
  const [credits, setCredits] = useState<CreditRow[]>([]);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [connectName, setConnectName] = useState('');
  const [connectType, setConnectType] = useState<TagType>('producer');
  const [creditSearchResults, setCreditSearchResults] = useState<{ id: string; tag_type: string; canonical_name: string; fromEvent?: boolean }[]>([]);
  const [creditSearching, setCreditSearching] = useState(false);
  const [newAliasByIdentity, setNewAliasByIdentity] = useState<Record<string, string>>({});
  const [reviewsLayout, setReviewsLayout] = useState<'list' | 'cards'>(() => {
    try {
      const saved = window.localStorage.getItem('profile_reviews_layout');
      return saved === 'list' ? 'list' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const [profileSettingsExpanded, setProfileSettingsExpanded] = useState(false);

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
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('username, user_id_public')
        .eq('user_id', userId)
        .maybeSingle();
      setUsername(profile?.username || 'My profile');
      setUserIdPublic(profile?.user_id_public || '');
      setEditName(profile?.username || '');
      setEditUsername(profile?.user_id_public || '');

      const { data: ratingsData } = await supabase
        .from('ratings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      const eventIds = [...new Set((ratingsData || []).map((r) => r.event_id))];
      const { data: eventsData } = await supabase.from('events').select('*').in('id', eventIds);
      const eventsMap = new Map((eventsData || []).map((e) => [e.id, e]));
      let ratingStatsMap = new Map<string, { averageRating: number; ratingCount: number }>();
      if (eventIds.length > 0) {
        const { data: allRatingsForEvents } = await supabase
          .from('ratings')
          .select('event_id, rating')
          .in('event_id', eventIds);
        const statsAccumulator = new Map<string, { sum: number; count: number }>();
        (allRatingsForEvents || []).forEach((r) => {
          const existing = statsAccumulator.get(r.event_id) || { sum: 0, count: 0 };
          existing.sum += Number(r.rating) || 0;
          existing.count += 1;
          statsAccumulator.set(r.event_id, existing);
        });
        ratingStatsMap = new Map(
          Array.from(statsAccumulator.entries()).map(([eventId, s]) => [
            eventId,
            { averageRating: s.count ? s.sum / s.count : 0, ratingCount: s.count }
          ])
        );
      }
      const reviewsUnsorted = (ratingsData || []).map((r) => {
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

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaveError('');
    setProfileSaving(true);
    try {
      const newName = editName.trim();
      const newUsername = editUsername.trim();
      if (!newName || newName.length < 1) {
        setProfileSaveError('Your name is required.');
        setProfileSaving(false);
        return;
      }
      if (!newUsername || newUsername.length < 4) {
        setProfileSaveError('Username must be at least 4 characters.');
        setProfileSaving(false);
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        setProfileSaveError('Username may only contain letters, numbers, underscores, and hyphens.');
        setProfileSaving(false);
        return;
      }
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: newName, user_id_public: newUsername, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) {
        setProfileSaveError(error.message || 'Could not save profile.');
        setProfileSaving(false);
        return;
      }
      setUsername(newName);
      setUserIdPublic(newUsername);
    } catch (e) {
      setProfileSaveError('Could not save profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchCredits = async () => {
    const { data: creditRows, error: creditsErr } = await supabase
      .from('user_tag_credits')
      .select('id, identity_id, preferred_alias_id')
      .eq('user_id', userId);
    if (creditsErr) {
      setCreditsError(creditsErr.message || 'Could not load credits');
      setCredits([]);
      return;
    }

    const identityIds = (creditRows || []).map((r: { identity_id: string }) => r.identity_id);
    if (identityIds.length === 0) {
      setCreditsError(null);
      setCredits([]);
      return;
    }

    const { data: identities, error: identitiesErr } = await supabase
      .from('tag_identities')
      .select('id, tag_type, canonical_name')
      .in('id', identityIds);
    if (identitiesErr) {
      setCreditsError(identitiesErr.message || 'Could not load credit identities');
      setCredits([]);
      return;
    }

    const { data: aliasRows } = await supabase
      .from('tag_aliases')
      .select('id, identity_id, alias')
      .in('identity_id', identityIds)
      .order('alias', { ascending: true });

    const identityMap = new Map((identities || []).map((i: any) => [i.id, i]));
    const aliasMap = new Map<string, { id: string; alias: string }[]>();
    (aliasRows || []).forEach((a: any) => {
      const existing = aliasMap.get(a.identity_id) || [];
      existing.push({ id: a.id, alias: a.alias });
      aliasMap.set(a.identity_id, existing);
    });

    const merged: CreditRow[] = (creditRows || []).map((c: any) => {
      const identity = identityMap.get(c.identity_id);
      return {
        id: c.id,
        identity_id: c.identity_id,
        preferred_alias_id: c.preferred_alias_id || null,
        tag_type: identity?.tag_type || 'unknown',
        canonical_name: identity?.canonical_name || 'Unknown',
        aliases: aliasMap.get(c.identity_id) || [],
      };
    });
    setCreditsError(null);
    setCredits(merged);
  };

  useEffect(() => {
    const q = connectName.trim();
    if (q.length < 2) {
      setCreditSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      setCreditSearching(true);
      Promise.all([searchTagIdentities(q), searchEventTags(q)]).then(([identities, eventTags]) => {
        const seen = new Set<string>();
        const combined: { id: string; tag_type: string; canonical_name: string; fromEvent: boolean }[] = [];
        for (const r of identities) {
          const key = `${r.tag_type}:${normalizeTagName(r.canonical_name)}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined.push({ ...r, fromEvent: false });
          }
        }
        for (const r of eventTags) {
          const key = `${r.tag_type}:${normalizeTagName(r.canonical_name)}`;
          if (!seen.has(key)) {
            seen.add(key);
            combined.push({
              id: `event:${r.tag_type}:${encodeURIComponent(r.canonical_name)}`,
              tag_type: r.tag_type,
              canonical_name: r.canonical_name,
              fromEvent: true,
            });
          }
        }
        setCreditSearchResults(combined.slice(0, 20));
        setCreditSearching(false);
      }).catch(() => setCreditSearching(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [connectName]);

  const selectCreditSearchResult = async (item: { id: string; tag_type: string; canonical_name: string; fromEvent?: boolean }) => {
    let identity: { id: string; tag_type: string; canonical_name: string };
    if (item.fromEvent) {
      const resolved = await ensureIdentity(item.tag_type as TagType, item.canonical_name, userId);
      if (!resolved) {
        setCreditsError('Could not add tag');
        return;
      }
      identity = resolved;
    } else {
      identity = item;
    }
    await connectCreditByIdentity(identity);
  };

  const connectCreditByIdentity = async (identity: { id: string; tag_type: string; canonical_name: string }) => {
    const { data: existing } = await supabase
      .from('user_tag_credits')
      .select('id')
      .eq('user_id', userId)
      .eq('identity_id', identity.id)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('user_tag_credits').insert({
        user_id: userId,
        identity_id: identity.id,
      });
      if (error) {
        setCreditsError(error.message || 'Could not connect credit');
        return;
      }
    }
    setConnectName('');
    setCreditSearchResults([]);
    setCreditsError(null);
    fetchCredits();
  };

  const connectOrCreateCredit = async (createIfMissing: boolean) => {
    const name = connectName.trim();
    if (!name) return;
    let identity = await findIdentityByName(connectType, name);
    if (!identity && createIfMissing) identity = await ensureIdentity(connectType, name, userId);
    if (!identity) {
      setCreditsError('No matching tag found. Use "Create + connect" to add a new one.');
      return;
    }
    await connectCreditByIdentity(identity);
  };

  const addAliasForCredit = async (credit: CreditRow) => {
    const alias = (newAliasByIdentity[credit.identity_id] || '').trim();
    if (!alias) return;
    const normalized = alias.toLowerCase().replace(/\s+/g, ' ');
    const { data: existing } = await supabase
      .from('tag_aliases')
      .select('id')
      .eq('identity_id', credit.identity_id)
      .eq('normalized_alias', normalized)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabase.from('tag_aliases').insert({
        identity_id: credit.identity_id,
        alias,
        normalized_alias: normalized,
        created_by: userId,
      });
      if (error) {
        setCreditsError(error.message || 'Could not add alias');
        return;
      }
    }
    setNewAliasByIdentity((prev) => ({ ...prev, [credit.identity_id]: '' }));
    fetchCredits();
  };

  const setPreferredAlias = async (creditId: string, aliasId: string | null) => {
    const { error } = await supabase
      .from('user_tag_credits')
      .update({ preferred_alias_id: aliasId })
      .eq('id', creditId);
    if (error) {
      setCreditsError(error.message || 'Could not set preferred display name');
      return;
    }
    fetchCredits();
  };

  const removeCredit = async (creditId: string) => {
    const { error } = await supabase
      .from('user_tag_credits')
      .delete()
      .eq('id', creditId);
    if (error) {
      setCreditsError(error.message || 'Could not remove credit');
      return;
    }
    fetchCredits();
  };

  useEffect(() => {
    fetchProfile();
    if (isOwnProfile) {
      fetchCredits();
    } else {
      setCredits([]);
      setCreditsError(null);
    }
  }, [userId, isOwnProfile]);

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
        <button onClick={onClose} className="text-sm text-stone-500 hover:text-stone-900 mb-8 transition-colors">
          ← Back to shows
        </button>

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
              {isOwnProfile && (
                <button
                  type="button"
                  onClick={() => setProfileSettingsExpanded((v) => !v)}
                  className={`p-2 rounded-lg transition-colors ${
                    profileSettingsExpanded ? 'bg-stone-200 text-stone-800' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-700'
                  }`}
                  title="Profile settings"
                  aria-label="Profile settings"
                  aria-expanded={profileSettingsExpanded}
                >
                  <Settings size={18} />
                </button>
              )}
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

        {isOwnProfile && profileSettingsExpanded && (
        <section className="mb-10 rounded-2xl bg-white/90 border border-stone-100 overflow-hidden">
          <div className="px-4 pb-4 pt-4 space-y-4">
            <p className="text-xs text-stone-500">Edit your display name and sign-in username.</p>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label htmlFor="editName" className="block text-xs font-medium text-stone-600 mb-1">Your Name</label>
              <input
                id="editName"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={80}
                className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                placeholder="e.g., Jane Doe"
              />
              <p className="text-xs text-stone-400 mt-0.5">Display name; can act as a credit when connected</p>
            </div>
            <div>
              <label htmlFor="editUsername" className="block text-xs font-medium text-stone-600 mb-1">Username</label>
              <input
                id="editUsername"
                type="text"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                minLength={4}
                maxLength={30}
                pattern="[a-zA-Z0-9_-]+"
                className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
                placeholder="e.g., janedoe2024"
              />
              <p className="text-xs text-stone-400 mt-0.5">Your public profile ID (letters, numbers, _, -)</p>
            </div>
            {profileSaveError && (
              <p className="text-sm text-red-600">{profileSaveError}</p>
            )}
            <button
              type="submit"
              disabled={profileSaving || (editName.trim() === username && editUsername.trim() === userIdPublic)}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-stone-800 text-white hover:bg-stone-700 disabled:bg-stone-300 disabled:cursor-not-allowed"
            >
              {profileSaving ? 'Saving…' : 'Save'}
            </button>
          </form>
          </div>
        </section>
        )}

        {isOwnProfile && (
        <section className="mb-10 rounded-2xl bg-white/90 border border-stone-100 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">My credits</h2>
            <p className="text-xs text-stone-500">Connect to existing tags, add aliases, and choose display name.</p>
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                value={connectName}
                onChange={(e) => setConnectName(e.target.value)}
                placeholder="Search for yourself or a tag (e.g. name, producer, designer…)"
                className="w-full text-sm px-3 py-2 rounded-md border border-stone-200 bg-white"
              />
              {creditSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Searching…</span>
              )}
            </div>
            {creditSearchResults.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {creditSearchResults.map((identity) => (
                  <button
                    key={identity.id}
                    type="button"
                    onClick={() => selectCreditSearchResult(identity)}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300"
                  >
                    <span className="font-medium">{identity.canonical_name}</span>
                    <span className="ml-1.5 text-stone-400">{identity.tag_type.replace('custom:', '')}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
              <span className="text-xs text-stone-500">Not in the list?</span>
              <select
                value={connectType}
                onChange={(e) => setConnectType(e.target.value as TagType)}
                className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white"
              >
                <option value="producer">Producer</option>
                <option value="designer">Designer</option>
                <option value="model">Model</option>
                <option value="hair_makeup">Hair & Makeup</option>
                <option value="header_tags">Header Tag</option>
                <option value="footer_tags">Footer Tag</option>
              </select>
              <input
                value={connectName}
                onChange={(e) => setConnectName(e.target.value)}
                placeholder="Name"
                className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white min-w-[140px]"
              />
              <button
                type="button"
                onClick={() => connectOrCreateCredit(true)}
                className="text-xs px-2.5 py-1.5 rounded-md bg-stone-900 text-white hover:bg-stone-800"
              >
                Create + connect
              </button>
            </div>
          </div>
          {creditsError && <p className="text-xs text-amber-700">{creditsError}</p>}
          {credits.length > 0 && (
            <div className="space-y-2">
              {credits.map((credit) => {
                const currentAlias = credit.aliases.find((a) => a.id === credit.preferred_alias_id)?.alias || credit.canonical_name;
                const knownAs = credit.aliases.filter((a) => a.alias !== currentAlias);
                return (
                  <div key={credit.id} className="rounded-xl border border-stone-100 p-3 bg-stone-50/70">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded-md bg-white border border-stone-200 text-stone-700">
                        {credit.tag_type.replace('custom:', 'custom: ')}
                      </span>
                      <span className="text-sm font-medium text-stone-900">{currentAlias}</span>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('Remove this credit?')) removeCredit(credit.id); }}
                        className="ml-auto text-[11px] text-stone-400 hover:text-red-600"
                        title="Remove credit"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <select
                        value={credit.preferred_alias_id || ''}
                        onChange={(e) => setPreferredAlias(credit.id, e.target.value || null)}
                        className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white"
                      >
                        <option value="">Canonical</option>
                        {credit.aliases.map((a) => (
                          <option key={a.id} value={a.id}>{a.alias}</option>
                        ))}
                      </select>
                      <input
                        value={newAliasByIdentity[credit.identity_id] || ''}
                        onChange={(e) => setNewAliasByIdentity((prev) => ({ ...prev, [credit.identity_id]: e.target.value }))}
                        placeholder="Add alias"
                        className="text-xs px-2 py-1.5 rounded-md border border-stone-200 bg-white min-w-[160px]"
                      />
                      <button
                        type="button"
                        onClick={() => addAliasForCredit(credit)}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50"
                      >
                        Add alias
                      </button>
                    </div>
                    {knownAs.length > 0 && (
                      <p className="mt-2 text-[11px] text-stone-500">
                        Previously known as: {knownAs.map((a) => a.alias).join(', ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        )}

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
                Lists need a one-time setup. Copy the SQL below and run it in your Supabase SQL Editor.
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
