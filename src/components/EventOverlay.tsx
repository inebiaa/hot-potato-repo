import { useId, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useT } from "../hooks/useCopy";
import type { Event, Rating } from "../lib/supabase";
import type { AppSettings } from "../types/appSettings";
import EventCard from "./EventCard/EventCard";
import { LoadingSpinner } from "./ui";
import { EVENT_FEED_CARD_MAX_WIDTH_CLASS } from "../lib/eventCardLayout";

type EventOverlayProps = {
  eventId: string;
  event:
    | (Event & {
        average_rating: number;
        rating_count: number;
        user_rating?: Rating;
      })
    | null;
  elevated?: boolean;
  appSettings: AppSettings;
  onClose: () => void;
  onTagClick: (type: string, value: string, displayLabel?: string) => void;
  onRatingSubmitted: () => void;
  onEventUpdated: () => void;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return [...nodes].filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
}

/**
 * Full-screen event card dialog used from home, stats, and profile.
 * Focus trap + restore focus on close (ModalShell parity).
 */
export default function EventOverlay({
  eventId: _eventId,
  event,
  elevated = false,
  appSettings,
  onClose,
  onTagClick,
  onRatingSubmitted,
  onEventUpdated,
}: EventOverlayProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [event?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        panelRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || active === panelRef.current) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const label = event?.name?.trim() || "Event details";

  return (
    <div
      className={`fixed inset-0 flex flex-col justify-end bg-black/50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:justify-center sm:p-4 ${
        elevated ? "z-[75]" : "z-[60]"
      }`}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={event ? titleId : undefined}
      aria-label={event ? undefined : "Event details"}
      data-testid="event-overlay"
    >
      {event ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`relative ${EVENT_FEED_CARD_MAX_WIDTH_CLASS} mx-auto w-full max-h-[min(100dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-shrink-0 overflow-y-auto overscroll-y-contain outline-none sm:max-h-[min(90dvh,900px)] sm:rounded-lg`}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-1 top-1 z-10 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:right-2 sm:top-2"
            aria-label={t("chrome.closeDialog")}
          >
            <X size={20} strokeWidth={2} />
          </button>
          <span id={titleId} className="sr-only">
            {label}
          </span>
          <EventCard
            event={event}
            averageRating={event.average_rating}
            ratingCount={event.rating_count}
            userRating={event.user_rating}
            onRatingSubmitted={onRatingSubmitted}
            onEventUpdated={onEventUpdated}
            onTagClick={onTagClick}
            tagColors={appSettings}
            customPerformerTags={[]}
            imagePriority
          />
        </div>
      ) : (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="flex flex-1 items-center justify-center py-16 outline-none sm:flex-none"
          aria-busy="true"
        >
          <LoadingSpinner className="text-white" />
        </div>
      )}
    </div>
  );
}
