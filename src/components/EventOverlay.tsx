import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import type { Event, Rating } from '../lib/supabase';
import type { AppSettings } from '../types/appSettings';
import EventCard from './EventCard/EventCard';
import { LoadingSpinner } from './ui';

type EventOverlayProps = {
  eventId: string;
  event: (Event & {
    average_rating: number;
    rating_count: number;
    user_rating?: Rating;
  }) | null;
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
  return [...nodes].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, [event?.id]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
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
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const label = event?.name?.trim() || 'Event details';

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center p-4 bg-black/50 overflow-y-auto ${
        elevated ? 'z-[75]' : 'z-[60]'
      }`}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={event ? titleId : undefined}
      aria-label={event ? undefined : 'Event details'}
      data-testid="event-overlay"
    >
      {event ? (
        <div
          ref={panelRef}
          tabIndex={-1}
          className="relative max-w-md w-full my-8 flex-shrink-0 outline-none"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 z-10 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 bg-white/90 shadow-sm border border-gray-100"
            aria-label="Close dialog"
          >
            <X size={22} strokeWidth={2} />
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
          className="flex items-center justify-center py-16 outline-none"
          aria-busy="true"
        >
          <LoadingSpinner className="text-white" />
        </div>
      )}
    </div>
  );
}
