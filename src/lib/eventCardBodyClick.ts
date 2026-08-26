/** Targets inside an event card that should not trigger "open show" from a body click. */
export function isEventCardInteractiveTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return false;
  const el = target as Element;
  return !!(
    el.closest('button') ||
    el.closest('a') ||
    el.closest('[role="button"]') ||
    el.closest('[data-event-actions]') ||
    el.closest('[data-tag-pill]')
  );
}

/** Whether a card body click should open the show overlay. */
export function shouldOpenShowFromCardBodyClick(target: EventTarget | null): boolean {
  return !isEventCardInteractiveTarget(target);
}
