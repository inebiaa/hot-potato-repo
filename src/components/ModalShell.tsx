import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { trapTabKey, getFocusable } from '../lib/focusTrap';
import { useT } from '../hooks/useCopy';

type ModalShellProps = {
  onClose: () => void;
  /** Screen-reader label when no visible title */
  ariaLabel?: string;
  /** Optional visible title (also sets aria-labelledby) */
  title?: string;
  titleId?: string;
  children: ReactNode;
  /** Tailwind z-index class */
  zClass?: string;
  /** Max width / shape of the panel (Tailwind classes) */
  panelClassName?: string;
  /** Extra classes on the backdrop (e.g. pointer-events-none when another overlay is active) */
  backdropClassName?: string;
  /** Floating close only — no title bar (e.g. tag card modal) */
  hideTitleBar?: boolean;
  /** Classes for the main body region below the header (default: scrollable) */
  bodyClassName?: string;
};

/**
 * Shared modal frame: safe-area insets, dynamic viewport height, Escape, backdrop click, close control.
 */
const modalCloseButtonClass =
  'inline-flex shrink-0 items-center justify-center min-h-[44px] min-w-[44px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

export default function ModalShell({
  onClose,
  ariaLabel = 'Dialog',
  title,
  titleId = 'modal-shell-title',
  children,
  zClass = 'z-50',
  panelClassName = 'max-w-2xl sm:rounded-lg',
  backdropClassName = '',
  hideTitleBar = false,
  bodyClassName = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain',
}: ModalShellProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = getFocusable(panel);
    if (focusable.length > 0) {
      focusable[0].focus({ preventScroll: true });
    } else {
      panel.setAttribute('tabindex', '-1');
      panel.focus({ preventScroll: true });
    }
    return () => {
      previouslyFocusedRef.current?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      trapTabKey(e, panel, onClose);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? undefined : ariaLabel}
      aria-labelledby={title ? titleId : undefined}
      className={`fixed inset-0 ${zClass} flex flex-col justify-end sm:justify-center items-stretch sm:items-center bg-black/50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sm:p-4 ${backdropClassName}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        className={`relative w-full ${panelClassName} mx-auto flex min-h-0 max-h-[min(100dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-col bg-card shadow-xl sm:max-h-[min(90dvh,900px)] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {hideTitleBar ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`absolute right-1 top-1 z-10 sm:right-2 sm:top-2 ${modalCloseButtonClass}`}
              aria-label={t('chrome.closeDialog')}
            >
              <X size={20} strokeWidth={2} />
            </button>
            <div className={`pt-2 ${bodyClassName}`}>{children}</div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
              {title ? (
                <h2 id={titleId} className="type-headline truncate pr-2 text-foreground">
                  {title}
                </h2>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <button
                type="button"
                onClick={onClose}
                className={`-mr-1 sm:-mr-2 ${modalCloseButtonClass}`}
                aria-label={t('chrome.closeDialog')}
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className={bodyClassName}>{children}</div>
          </>
        )}
      </div>
    </div>
  );
}
