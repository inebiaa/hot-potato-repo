import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Star, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { supabase, Event, type Rating as DbRating } from "../lib/supabase";
import RatingModal from "./RatingModal";
import CommentWithTags from "./CommentWithTags";
import ReportContentModal from "./ReportContentModal";
import ModalShell from "./ModalShell";
import { Button, LoadingSpinner } from "./ui";
import { useT } from "../hooks/useCopy";
import { useAuth } from "../contexts/AuthContext";
import { useAppSettings } from "../hooks/useAppSettings";
import { isUserBlocked, ratingAuthorLabel } from "../lib/ugcSafety";
import { setAppModalParams } from "../lib/searchParamsModal";

type Rating = DbRating & { username?: string };

interface ViewRatingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventName: string;
  event?: Event;
  currentUserId?: string;
  onRatingSubmitted?: () => void;
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
  customPerformerTags?: {
    slug: string;
    bg_color: string;
    text_color: string;
  }[];
  singleUserId?: string;
  /** When set, shows a "View full event" button that opens the event card */
  onViewEvent?: (eventId: string) => void;
  /** When false, ratings are read-only (e.g. show has not occurred yet). Defaults to true. */
  allowRatingEdits?: boolean;
  onTagClick?: (type: string, value: string, displayLabel?: string) => void;
}

export default function ViewRatingsModal({
  isOpen,
  onClose,
  eventId,
  eventName,
  event,
  currentUserId,
  onRatingSubmitted,
  tagColors,
  customPerformerTags = [],
  onViewEvent,
  singleUserId,
  allowRatingEdits = true,
  onTagClick,
}: ViewRatingsModalProps) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { blockedUserIds } = useAuth();
  const { appSettings } = useAppSettings();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRatingId, setExpandedRatingId] = useState<string | null>(null);
  const [editingRating, setEditingRating] = useState<Rating | null>(null);
  const [isCreatingRating, setIsCreatingRating] = useState(false);
  const [reportRating, setReportRating] = useState<Rating | null>(null);

  const promptSignInToReview = () => {
    navigate({
      pathname: location.pathname,
      search: setAppModalParams(searchParams, "auth", {
        authMode: "signin",
        authPrompt: t("auth.prompt.leaveReview"),
      }),
    });
  };

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("ratings")
        .select("*")
        .eq("event_id", eventId)
        .order("rating", { ascending: false });

      if (ratingsError) throw ratingsError;

      const userIds = [
        ...new Set((ratingsData || []).map((r) => r.user_id).filter(Boolean)),
      ];
      const profilesByUserId = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("user_id, username")
          .in("user_id", userIds);

        if (profilesError) throw profilesError;
        for (const p of profilesData || []) {
          if (p.user_id)
            profilesByUserId.set(p.user_id, p.username || "Unknown User");
        }
      }

      const ratingsWithUsernames = (ratingsData || []).map((rating) => ({
        ...rating,
        username: rating.user_id
          ? profilesByUserId.get(rating.user_id) || undefined
          : undefined,
      }));

      let filteredRatings = singleUserId
        ? ratingsWithUsernames.filter(
            (rating) => rating.user_id === singleUserId,
          )
        : ratingsWithUsernames;

      filteredRatings = filteredRatings.filter(
        (rating) => !isUserBlocked(blockedUserIds, rating.user_id),
      );

      setRatings(filteredRatings);
    } catch (error) {
      console.error("Error fetching ratings:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId, singleUserId, blockedUserIds]);

  useEffect(() => {
    if (isOpen) {
      void fetchRatings();
    }
  }, [isOpen, fetchRatings]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getAverageRating = () => {
    if (ratings.length === 0) return 0;
    const total = ratings.reduce((sum, r) => sum + r.rating, 0);
    return (total / ratings.length).toFixed(1);
  };

  const seasonLabel = Array.isArray(event?.season)
    ? event.season.join(", ")
    : event?.season || "Season TBD";
  const currentUserRating = useMemo(
    () =>
      currentUserId
        ? ratings.find((rating) => rating.user_id === currentUserId)
        : undefined,
    [ratings, currentUserId],
  );

  if (!isOpen) return null;

  return createPortal(
    <>
      <ModalShell
        onClose={onClose}
        title={singleUserId ? "Your review" : "All Ratings"}
        zClass="z-[100]"
        panelClassName="max-w-2xl sm:rounded-lg"
        bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-0"
      >
        {!singleUserId ? (
          <div className="px-4 sm:px-6 py-4 border-b">
            <p className="text-muted-foreground">{eventName}</p>
          </div>
        ) : null}

        {!singleUserId ? (
          <div className="p-6 border-b bg-muted">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Star className="text-yellow-400 fill-yellow-400" size={32} />
                <span className="text-4xl font-bold text-foreground">
                  {getAverageRating()}
                </span>
              </div>
              <p className="text-muted-foreground">
                Average rating from {ratings.length}{" "}
                {ratings.length === 1 ? "user" : "users"}
              </p>
            </div>
          </div>
        ) : null}

        {singleUserId && ratings.length > 0 ? (
          <div className="px-6 py-5 border-b bg-muted/70">
            <div className="flex items-end justify-between gap-3">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) =>
                  allowRatingEdits ? (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setEditingRating({ ...ratings[0], rating: s })
                      }
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Set rating to ${s}`}
                    >
                      <Star
                        size={92}
                        className={
                          s <= ratings[0].rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-muted-foreground/40"
                        }
                      />
                    </button>
                  ) : (
                    <span
                      key={s}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center"
                      aria-hidden
                    >
                      <Star
                        size={92}
                        className={
                          s <= ratings[0].rating
                            ? "text-yellow-400 fill-yellow-400"
                            : "text-muted-foreground/40"
                        }
                      />
                    </span>
                  ),
                )}
              </div>
              <span className="text-xs text-muted-foreground">{eventName}</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : ratings.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground italic">
              No ratings yet for this event
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-3">
              {ratings.map((rating) => (
                <div
                  key={rating.id}
                  className={
                    singleUserId
                      ? "rounded-lg bg-card/90 px-5 py-4 border border-border overflow-hidden"
                      : "bg-muted rounded-lg hover:bg-muted transition-colors overflow-hidden"
                  }
                >
                  <div
                    className={`p-4 ${!singleUserId && (rating.comment || (allowRatingEdits && currentUserId && rating.user_id === currentUserId)) ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (singleUserId) return;
                      if (
                        allowRatingEdits &&
                        currentUserId &&
                        rating.user_id === currentUserId
                      ) {
                        setEditingRating(rating);
                        return;
                      }
                      if (rating.comment) {
                        setExpandedRatingId(
                          expandedRatingId === rating.id ? null : rating.id,
                        );
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-muted text-foreground">
                            {ratingAuthorLabel(rating)}
                          </span>
                          {singleUserId ? (
                            <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-muted text-foreground">
                              {seasonLabel}
                            </span>
                          ) : (
                            <span className="inline-block text-xs px-2 py-1 rounded-md transition-colors bg-muted text-foreground">
                              {formatDate(rating.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentUserId &&
                        rating.user_id &&
                        rating.user_id !== currentUserId ? (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                            aria-label={t("safety.report.action")}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportRating(rating);
                            }}
                          >
                            <Flag size={14} />
                          </button>
                        ) : null}
                        {!singleUserId ? (
                          <div className="flex items-center gap-1">
                            <Star
                              className="text-yellow-400 fill-yellow-400"
                              size={20}
                            />
                            <span className="text-xl font-bold text-foreground">
                              {rating.rating}
                            </span>
                            <span className="text-muted-foreground">/5</span>
                          </div>
                        ) : null}
                        {rating.comment && !singleUserId && (
                          <div className="ml-2">
                            {expandedRatingId === rating.id ? (
                              <ChevronUp
                                size={20}
                                className="text-muted-foreground"
                              />
                            ) : (
                              <ChevronDown
                                size={20}
                                className="text-muted-foreground"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {rating.comment &&
                    (singleUserId || expandedRatingId === rating.id) && (
                      <div
                        className={`px-4 pb-4 pt-0 border-t border-border ${allowRatingEdits && singleUserId && currentUserId && rating.user_id === currentUserId ? "cursor-pointer" : ""}`}
                        onClick={() => {
                          if (
                            allowRatingEdits &&
                            singleUserId &&
                            currentUserId &&
                            rating.user_id === currentUserId
                          ) {
                            setEditingRating(rating);
                          }
                        }}
                      >
                        <p className="mt-3 text-base text-foreground italic">
                          {event ? (
                            <>
                              "
                              <CommentWithTags
                                comment={rating.comment}
                                event={event}
                                tagColors={tagColors}
                                customPerformerTags={customPerformerTags}
                                onTagClick={onTagClick}
                              />
                              "
                            </>
                          ) : (
                            <>"{rating.comment}"</>
                          )}
                        </p>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(onViewEvent || (allowRatingEdits && event)) && !singleUserId ? (
          <div className="flex shrink-0 gap-2 border-t border-border bg-muted p-4">
            {allowRatingEdits && event ? (
              <Button
                type="button"
                className="min-h-[44px] flex-1"
                onClick={() => {
                  if (!currentUserId) {
                    promptSignInToReview();
                    return;
                  }
                  if (currentUserRating) {
                    setEditingRating(currentUserRating);
                    return;
                  }
                  setIsCreatingRating(true);
                }}
              >
                {currentUserRating ? "Update" : "Rate Show"}
              </Button>
            ) : null}
            {onViewEvent ? (
              <Button
                type="button"
                className="min-h-[44px] flex-1"
                onClick={() => onViewEvent(eventId)}
              >
                View full event
              </Button>
            ) : null}
          </div>
        ) : null}
      </ModalShell>

      {editingRating && event && allowRatingEdits && (
        <RatingModal
          isOpen={true}
          onClose={() => setEditingRating(null)}
          event={event}
          existingRating={editingRating}
          onRatingSubmitted={() => {
            setEditingRating(null);
            void fetchRatings();
            onRatingSubmitted?.();
          }}
          tagColors={tagColors}
          customPerformerTags={customPerformerTags}
          zClass="z-[110]"
        />
      )}
      {isCreatingRating && event && allowRatingEdits && (
        <RatingModal
          isOpen={true}
          onClose={() => setIsCreatingRating(false)}
          event={event}
          onRatingSubmitted={() => {
            setIsCreatingRating(false);
            void fetchRatings();
            onRatingSubmitted?.();
          }}
          tagColors={tagColors}
          customPerformerTags={customPerformerTags}
          zClass="z-[110]"
        />
      )}
      {reportRating ? (
        <ReportContentModal
          isOpen={!!reportRating}
          onClose={() => setReportRating(null)}
          targetType="rating"
          targetId={reportRating.id}
          targetUserId={reportRating.user_id}
          supportEmail={appSettings?.support_email}
          privacyUrl={appSettings?.privacy_policy_url}
          termsUrl={appSettings?.terms_of_service_url}
        />
      ) : null}
    </>,
    document.body,
  );
}
