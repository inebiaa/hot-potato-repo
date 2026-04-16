import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

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
export default function ModalShell({
  onClose,
  ariaLabel = 'Dialog',
  title,
  titleId = 'modal-shell-title',
  children,
  zClass = 'z-50',
  panelClassName = 'max-w-2xl sm:rounded-xl',
  backdropClassName = '',
  hideTitleBar = false,
  bodyClassName = 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain',
}: ModalShellProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
        className={`relative w-full ${panelClassName} mx-auto flex min-h-0 max-h-[min(100dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))] flex-col bg-white shadow-xl sm:max-h-[min(90dvh,900px)] overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {hideTitleBar ? (
          <>
            <button
              type="button"
              onClick={onClose}
              className="absolute top-2 right-2 z-10 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 bg-white/90 shadow-sm border border-gray-100"
              aria-label="Close dialog"
            >
              <X size={22} strokeWidth={2} />
            </button>
            <div className={`pt-2 ${bodyClassName}`}>{children}</div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 sm:px-4">
              {title ? (
                <h2 id={titleId} className="text-lg font-semibold text-gray-900 truncate pr-2">
                  {title}
                </h2>
              ) : (
                <span className="flex-1 min-w-0" />
              )}
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Close dialog"
              >
                <X size={22} strokeWidth={2} />
              </button>
            </div>
            <div className={bodyClassName}>{children}</div>
          </>
        )}
      </div>
    </div>
  );
}
