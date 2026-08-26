export function getFocusable(container: HTMLElement): HTMLElement[] {
 const nodes = container.querySelectorAll<HTMLElement>(
 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
 );
 return [...nodes].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
}

export function trapTabKey(
 e: KeyboardEvent,
 container: HTMLElement,
 onEscape?: () => void,
): void {
 if (e.key === 'Escape' && onEscape) {
 e.preventDefault();
 onEscape();
 return;
 }
 if (e.key !== 'Tab') return;
 const focusable = getFocusable(container);
 if (focusable.length === 0) {
 e.preventDefault();
 container.focus();
 return;
 }
 const first = focusable[0];
 const last = focusable[focusable.length - 1];
 const active = document.activeElement;
 if (e.shiftKey) {
 if (active === first || active === container) {
 e.preventDefault();
 last.focus();
 }
 } else if (active === last) {
 e.preventDefault();
 first.focus();
 }
}
