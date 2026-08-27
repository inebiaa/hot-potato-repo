import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flag, MoreVertical } from "lucide-react";
import {
  supabase,
  type Event,
  type Rating,
  type UserList,
} from "../lib/supabase";
import EventCard from "./EventCard/EventCard";
import MasonryLaneFeed, { type MasonryLaneItem } from "./MasonryLaneFeed";
import { TagDisplayProvider } from "../contexts/TagDisplayContext";
import { useHomeCatalogOptional } from "../contexts/HomeCatalogContext";
import { usePagePullToRefresh, usePullRefreshing } from "../contexts/PullToRefreshContext";
import {
  fetchTagResolutionForEvents,
  type TagResolutionMap,
} from "../lib/tagDisplayResolution";
import {
  eventMatchesTextQuery,
  filterEventsBySelectedTags,
} from "../lib/eventTagFilter";
import { normalizeEventTagArrays } from "../lib/eventTagArray";
import { fetchEventRatingStats } from "../lib/eventRatingStats";
import { useAuth } from "../contexts/AuthContext";
import { useAppChrome } from "../contexts/AppChromeContext";
import { useT } from "../hooks/useCopy";
import { listPagePath } from "../lib/siteBase";
import { ListCover } from "./ListCoverCollage";
import { pickListCollageUrls } from "../lib/listCoverCollage";
import ListSocialMeta from "./ListSocialMeta";
import { isUserBlocked } from "../lib/ugcSafety";
import ReportContentModal from "./ReportContentModal";
import { LoadingSpinner, menuRowClass, typeCallout } from "./ui";
import { useAppSettings } from "../hooks/useAppSettings";

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
  customPerformerTags?: {
    slug: string;
    bg_color: string;
    text_color: string;
  }[];
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
  const { user, blockedUserIds } = useAuth();
  const t = useT();
  const { appSettings } = useAppSettings();
  const navigate = useNavigate();
  const home = useHomeCatalogOptional();
  const { setProfileBoardEvents } = useAppChrome();
  const [list, setList] = useState<UserList | null>(null);
  const [ownerUsername, setOwnerUsername] = useState("");
  const [ownerHandle, setOwnerHandle] = useState("");
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [tagMap, setTagMap] = useState<TagResolutionMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const listMenuRef = useRef<HTMLDivElement | null>(null);
  const pullReloadRef = useRef(false);
  const ptrResolveRef = useRef<(() => void) | null>(null);
  const pullRefreshing = usePullRefreshing();

  useEffect(() => {
    if (!listMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (
        listMenuRef.current &&
        !listMenuRef.current.contains(e.target as Node)
      ) {
        setListMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [listMenuOpen]);

  usePagePullToRefresh(
    () =>
      new Promise<void>((resolve) => {
        ptrResolveRef.current = resolve;
        pullReloadRef.current = true;
        setReloadToken((token) => token + 1);
      }),
  );

  useEffect(() => {
    let cancelled = false;
    const silent = pullReloadRef.current;
    pullReloadRef.current = false;
    const finishPtr = () => {
      ptrResolveRef.current?.();
      ptrResolveRef.current = null;
    };
    (async () => {
      if (!silent) {
        setLoading(true);
        setError(null);
        setOwnerUsername("");
        setOwnerHandle("");
      }
      const listRes = await supabase
        .from("user_lists")
        .select("*")
        .eq("id", listId)
        .maybeSingle();
      if (cancelled) return;
      if (listRes.error || !listRes.data) {
        setError("List not found");
        setList(null);
        setRows([]);
        setLoading(false);
        finishPtr();
        return;
      }
      const listRow = listRes.data as UserList;
      const isOwner = user?.id === listRow.user_id;
      if (!listRow.is_public && !isOwner) {
        setError("This list is private");
        setList(listRow);
        setRows([]);
        setLoading(false);
        finishPtr();
        return;
      }
      setList(listRow);

      {
        const profileRes = await supabase
          .from("user_profiles")
          .select("username, user_id_public")
          .eq("user_id", listRow.user_id)
          .maybeSingle();
        if (!cancelled) {
          setOwnerUsername((profileRes.data?.username || "").trim());
          setOwnerHandle((profileRes.data?.user_id_public || "").trim());
        }
      }

      if (listRow.is_rated_list) {
        const ratingsRes = await supabase
          .from("ratings")
          .select("*")
          .eq("user_id", listRow.user_id)
          .order("created_at", { ascending: false });
        const ratings = (ratingsRes.data || []) as Rating[];
        const eventIds = [...new Set(ratings.map((r) => r.event_id))];
        const eventsRes =
          eventIds.length > 0
            ? await supabase.from("events").select("*").in("id", eventIds)
            : { data: [] as Event[] };
        const eventsMap = new Map(
          ((eventsRes.data || []) as Event[]).map((e) => [
            e.id,
            normalizeEventTagArrays(e),
          ]),
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
        board.sort((a, b) =>
          (b.event.date || "").localeCompare(a.event.date || ""),
        );
        if (!cancelled) setRows(board);
      } else {
        const membership = await supabase
          .from("user_list_events")
          .select("*")
          .eq("list_id", listId)
          .order("position");
        const ids = (membership.data || []).map((e) => e.event_id as string);
        const eventsRes =
          ids.length > 0
            ? await supabase.from("events").select("*").in("id", ids)
            : { data: [] as Event[] };
        const eventsMap = new Map(
          ((eventsRes.data || []) as Event[]).map((e) => [
            e.id,
            normalizeEventTagArrays(e),
          ]),
        );
        const [statsRes, viewerRatingsRes] = await Promise.all([
          fetchEventRatingStats(ids),
          user?.id && ids.length > 0
            ? supabase
                .from("ratings")
                .select("*")
                .eq("user_id", user.id)
                .in("event_id", ids)
            : Promise.resolve({ data: [] as Rating[] }),
        ]);
        const viewerByEvent = new Map(
          ((viewerRatingsRes.data || []) as Rating[]).map((r) => [
            r.event_id,
            r,
          ]),
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
        board.sort((a, b) =>
          (b.event.date || "").localeCompare(a.event.date || ""),
        );
        if (!cancelled) setRows(board);
      }
      if (!cancelled) setLoading(false);
      if (!cancelled) finishPtr();
    })();
    return () => {
      cancelled = true;
      finishPtr();
    };
  }, [listId, user?.id, reloadToken]);

  // Canonical path is /:handle/list/:id (rewrite legacy /list/:id and wrong handles).
  useEffect(() => {
    if (!ownerHandle || !listId) return;
    const current = (urlHandle || "").trim();
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

  useEffect(() => {
    setProfileBoardEvents(rows.map((r) => r.event).filter((e) => e?.id));
    return () => setProfileBoardEvents(null);
  }, [rows, setProfileBoardEvents]);

  const searchQuery = home?.searchQuery ?? "";
  const selectedTags = home?.selectedTags ?? [];
  const searchActive =
    selectedTags.length > 0 || searchQuery.trim().length >= 2;
  const visibleRows = useMemo(() => {
    if (!searchActive) return rows;
    return rows.filter((row) => {
      const event = row.event;
      if (!event?.id) return false;
      if (!eventMatchesTextQuery(event, searchQuery, tagMap)) return false;
      return (
        filterEventsBySelectedTags([event], selectedTags, tagMap).length > 0
      );
    });
  }, [rows, searchActive, searchQuery, selectedTags, tagMap]);

  const title = useMemo(() => {
    if (!list) return "";
    if (list.is_rated_list) {
      const isOwner = !!user && user.id === list.user_id;
      if (isOwner) return t("event.ratedListName");
      const name = ownerUsername || t("nav.profile");
      return t("event.ratedListNameForUser").replace("{name}", name);
    }
    if (list.is_liked_list) {
      const isOwner = !!user && user.id === list.user_id;
      if (isOwner) return t("event.likedListName");
      const name = ownerUsername || t("nav.profile");
      return t("event.likedListNameForUser").replace("{name}", name);
    }
    return list.name;
  }, [list, t, user, ownerUsername]);

  /** Public-facing title for OG / crawlers (never “My …”). */
  const shareTitle = useMemo(() => {
    if (!list) return "";
    const name = ownerUsername || t("nav.profile");
    if (list.is_rated_list) {
      return t("event.ratedListNameForUser").replace("{name}", name);
    }
    if (list.is_liked_list) {
      return t("event.likedListNameForUser").replace("{name}", name);
    }
    return list.name;
  }, [list, t, ownerUsername]);

  const collageUrls = useMemo(
    () => pickListCollageUrls(rows.map((r) => r.event?.image_url)),
    [rows],
  );
  const shareImageUrl =
    (list?.cover_image_url || "").trim() || collageUrls[0] || null;
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
  }, [
    list,
    shareTitle,
    shareImageUrl,
    ownerHandle,
    ownerUsername,
    rows.length,
    error,
  ]);

  if (loading && !pullRefreshing) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-white/80 py-16 px-6 text-center">
        <p className={`${typeCallout} text-muted-foreground`}>{error}</p>
      </div>
    );
  }

  const laneItems: MasonryLaneItem[] = visibleRows.map(
    ({ event, averageRating, ratingCount, userRating }, index) => ({
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
    }),
  );

  const canReportList = !!user && !!list && list.user_id !== user.id;
  const ownerBlocked =
    !!list &&
    isUserBlocked(blockedUserIds, list.user_id) &&
    list.user_id !== user?.id;

  if (ownerBlocked) {
    return (
      <div className="rounded-lg bg-card/80 py-16 px-6 text-center">
        <p className={`text-muted-foreground ${typeCallout}`}>
          {t("safety.block.hiddenBody")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {sharePayload ? <ListSocialMeta list={sharePayload} /> : null}
      <ListCover
        coverUrl={list?.cover_image_url}
        collageUrls={collageUrls}
        className="mb-6 h-40 w-full rounded-lg sm:h-52"
      />
      <div className="mb-6 flex items-start justify-between gap-3">
        <h1 className="type-title text-foreground">{title}</h1>
        {canReportList ? (
          <div ref={listMenuRef} className="relative shrink-0">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
              aria-label="List options"
              onClick={() => setListMenuOpen((v) => !v)}
            >
              <MoreVertical size={18} />
            </button>
            {listMenuOpen ? (
              <div className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-card py-1 ">
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${menuRowClass} hover:bg-muted`}
                  onClick={() => {
                    setListMenuOpen(false);
                    setReportOpen(true);
                  }}
                >
                  <Flag size={14} className="shrink-0 text-muted-foreground" />
                  <span>{t("safety.report.action")}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg bg-card/80 py-16 px-6 text-center">
          <p className={`text-muted-foreground ${typeCallout}`}>
            No shows in this list yet.
          </p>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-lg bg-card/80 py-16 px-6 text-center">
          <p className={`text-muted-foreground ${typeCallout}`}>
            {t("empty.noMatch.title")}
          </p>
        </div>
      ) : (
        <TagDisplayProvider map={tagMap}>
          <MasonryLaneFeed
            items={laneItems}
            columnMinWidthPx={220}
            gapPx={24}
          />
        </TagDisplayProvider>
      )}
      {list && reportOpen ? (
        <ReportContentModal
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="list"
          targetId={list.id}
          targetUserId={list.user_id}
          supportEmail={appSettings?.support_email}
          privacyUrl={appSettings?.privacy_policy_url}
          termsUrl={appSettings?.terms_of_service_url}
        />
      ) : null}
    </div>
  );
}
