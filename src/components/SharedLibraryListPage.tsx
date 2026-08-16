import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, type Event, type Rating, type UserList } from '../lib/supabase';
import EventCard from './EventCard';
import MasonryLaneFeed, { type MasonryLaneItem } from './MasonryLaneFeed';
import { TagDisplayProvider } from '../contexts/TagDisplayContext';
import { fetchTagResolutionForEvents, type TagResolutionMap } from '../lib/tagDisplayResolution';
import { normalizeEventTagArrays } from '../lib/eventTagArray';
import { fetchEventRatingStats } from '../lib/eventRatingStats';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../contexts/CopyContext';
import { listPagePath } from '../lib/siteBase';
import { ListCover, pickListCollageUrls } from './ListCoverCollage';
import ListSocialMeta from './ListSocialMeta';

type BoardRow = {
  event: Event;
  averageRating: number;
  ratingCount: number;
  userRating?: Rating;
};

type SharedLibraryListPageProps = {
  listId: string;
  /** Handle from `/:handle/list/:id` when present (may be missing on legacy `/list/:id`). */
  urlHandle?: string | null;
  onOpenEvent?: (eventId: string) => void;
  onTagClick?: (type: string, value: string, displayLabel?: string) => void;
  tagColors?: ProfileTagColors;
  customPerformerTags?: { slug: string; bg_color: string; text_color: string }[];
};

type ProfileTagColors = {
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

export default function SharedLibraryListPage({
  listId,
  urlHandle = null,
  onOpenEvent,
  onTagClick,
  tagColors,
  customPerformerTags = [],
}: SharedLibraryListPageProps) {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [list, setList] = useState<UserList | null>(null);
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerHandle, setOwnerHandle] = useState('');
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [tagMap, setTagMap] = useState<TagResolutionMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setOwnerUsername('');
      setOwnerHandle('');
      const listRes = await supabase.from('user_lists').select('*').eq('id', listId).maybeSingle();
      if (cancelled) return;
      if (listRes.error || !listRes.data) {
        setError('List not found');
        setList(null);
        setRows([]);
        setLoading(false);
        return;
      }
      const listRow = listRes.data as UserList;
      const isOwner = !!user && user.id === listRow.user_id;
      if (!listRow.is_public && !isOwner) {
        setError('This list is private');
        setList(listRow);
        setRows([]);
        setLoading(false);
        return;
      }
      setList(listRow);

      {
        const profileRes = await supabase
          .from('user_profiles')
          .select('username, user_id_public')
          .eq('user_id', listRow.user_id)
          .maybeSingle();
        if (!cancelled) {
          setOwnerUsername((profileRes.data?.username || '').trim());
          setOwnerHandle((profileRes.data?.user_id_public || '').trim());
        }
      }

      if (listRow.is_rated_list) {
        const ratingsRes = await supabase
          .from('ratings')
          .select('*')
          .eq('user_id', listRow.user_id)
          .order('created_at', { ascending: false });
        const ratings = (ratingsRes.data || []) as Rating[];
        const eventIds = [...new Set(ratings.map((r) => r.event_id))];
        const eventsRes =
          eventIds.length > 0
            ? await supabase.from('events').select('*').in('id', eventIds)
            : { data: [] as Event[] };
        const eventsMap = new Map(
          ((eventsRes.data || []) as Event[]).map((e) => [e.id, normalizeEventTagArrays(e)]),
        );
        const statsRes = await fetchEventRatingStats(eventIds);
        const board = ratings
          .map((r) => {
            const event = eventsMap.get(r.event_id);
            if (!event) return null;
            const stats = statsRes.data.get(r.event_id);
            const row: BoardRow = {
              event,
              averageRating: stats?.average_rating || 0,
              ratingCount: stats?.rating_count || 0,
              userRating: r,
            };
            return row;
          })
          .filter((x): x is BoardRow => x != null);
        board.sort((a, b) => (b.event.date || '').localeCompare(a.event.date || ''));
        if (!cancelled) setRows(board);
      } else {
        const membership = await supabase
          .from('user_list_events')
          .select('*')
          .eq('list_id', listId)
          .order('position');
        const ids = (membership.data || []).map((e) => e.event_id as string);
        const eventsRes =
          ids.length > 0 ? await supabase.from('events').select('*').in('id', ids) : { data: [] as Event[] };
        const eventsMap = new Map(
          ((eventsRes.data || []) as Event[]).map((e) => [e.id, normalizeEventTagArrays(e)]),
        );
        const [statsRes, viewerRatingsRes] = await Promise.all([
          fetchEventRatingStats(ids),
          user && ids.length > 0
            ? supabase.from('ratings').select('*').eq('user_id', user.id).in('event_id', ids)
            : Promise.resolve({ data: [] as Rating[] }),
        ]);
        const viewerByEvent = new Map(
          ((viewerRatingsRes.data || []) as Rating[]).map((r) => [r.event_id, r]),
        );
        const board = (membership.data || [])
          .map((le) => {
            const event = eventsMap.get(le.event_id);
            if (!event) return null;
            const stats = statsRes.data.get(le.event_id);
            const row: BoardRow = {
              event,
              averageRating: stats?.average_rating || 0,
              ratingCount: stats?.rating_count || 0,
              userRating: viewerByEvent.get(le.event_id),
            };
            return row;
          })
          .filter((x): x is BoardRow => x != null);
        board.sort((a, b) => (b.event.date || '').localeCompare(a.event.date || ''));
        if (!cancelled) setRows(board);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [listId, user?.id]);

  // Canonical path is /:handle/list/:id (rewrite legacy /list/:id and wrong handles).
  useEffect(() => {
    if (!ownerHandle || !listId) return;
    const current = (urlHandle || '').trim();
    if (current.toLowerCase() === ownerHandle.toLowerCase()) return;
    navigate(listPagePath(ownerHandle, listId), { replace: true });
  }, [ownerHandle, listId, urlHandle, navigate]);

  useEffect(() => {
    const events = rows.map((r) => r.event);
    if (events.length === 0) {
      setTagMap(new Map());
      return;
    }
    let cancelled = false;
    fetchTagResolutionForEvents(events).then((m) => {
      if (!cancelled) setTagMap(m);
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const title = useMemo(() => {
    if (!list) return '';
    if (list.is_rated_list) {
      const isOwner = !!user && user.id === list.user_id;
      if (isOwner) return t('event.ratedListName');
      const name = ownerUsername || t('nav.profile');
      return t('event.ratedListNameForUser').replace('{name}', name);
    }
    if (list.is_liked_list) {
      const isOwner = !!user && user.id === list.user_id;
      if (isOwner) return t('event.likedListName');
      const name = ownerUsername || t('nav.profile');
      return t('event.likedListNameForUser').replace('{name}', name);
    }
    return list.name;
  }, [list, t, user, ownerUsername]);

  /** Public-facing title for OG / crawlers (never “My …”). */
  const shareTitle = useMemo(() => {
    if (!list) return '';
    const name = ownerUsername || t('nav.profile');
    if (list.is_rated_list) {
      return t('event.ratedListNameForUser').replace('{name}', name);
    }
    if (list.is_liked_list) {
      return t('event.likedListNameForUser').replace('{name}', name);
    }
    return list.name;
  }, [list, t, ownerUsername]);

  const collageUrls = useMemo(
    () => pickListCollageUrls(rows.map((r) => r.event?.image_url)),
    [rows],
  );
  const shareImageUrl = (list?.cover_image_url || '').trim() || collageUrls[0] || null;
  const sharePayload = useMemo(() => {
    if (!list || !shareTitle || error || !ownerHandle) return null;
    return {
      id: list.id,
      title: shareTitle,
      description: list.description,
      imageUrl: shareImageUrl,
      ownerHandle,
      ownerUsername: ownerUsername || null,
      eventCount: rows.length,
    };
  }, [list, shareTitle, shareImageUrl, ownerHandle, ownerUsername, rows.length, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-white/80 py-16 px-6 text-center">
        <p className="text-neutral-600 text-sm">{error}</p>
      </div>
    );
  }

  const laneItems: MasonryLaneItem[] = rows.map(({ event, averageRating, ratingCount, userRating }, index) => ({
    id: event.id,
    children: (
      <EventCard
        event={event}
        averageRating={averageRating}
        ratingCount={ratingCount}
        userRating={userRating}
        onRatingSubmitted={() => {}}
        onEventUpdated={() => {}}
        onTagClick={onTagClick || (() => {})}
        onViewClick={onOpenEvent}
        tagColors={tagColors}
        customPerformerTags={customPerformerTags}
        imagePriority={index < 4}
      />
    ),
  }));

  return (
    <div className="min-w-0">
      {sharePayload ? <ListSocialMeta list={sharePayload} /> : null}
      <ListCover
        coverUrl={list?.cover_image_url}
        collageUrls={collageUrls}
        className="mb-6 h-40 w-full rounded-xl sm:h-52"
      />
      <h1 className="text-xl font-semibold text-neutral-900 tracking-tight mb-6">{title}</h1>
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-white/80 py-16 px-6 text-center">
          <p className="text-neutral-500 text-sm">No shows in this list yet.</p>
        </div>
      ) : (
        <TagDisplayProvider map={tagMap}>
          <MasonryLaneFeed items={laneItems} columnMinWidthPx={220} gapPx={24} />
        </TagDisplayProvider>
      )}
    </div>
  );
}
