/** Query keys for routable app modals (shareable URLs, Android back). */
export const APP_MODAL_KEYS = [
  'modal',
  'tagType',
  'tagValue',
  'authMode',
  'authPrompt',
  'targetEventId',
] as const;

export type AppModalKind =
  | 'add-event'
  | 'settings'
  | 'auth'
  | 'tag'
  | 'rate'
  | 'view-ratings'
  | 'edit-event';

function cloneParams(source: URLSearchParams): URLSearchParams {
  return new URLSearchParams(source.toString());
}

/** Remove only modal-related keys; keep stats, profile, embed, etc. */
export function clearAppModalParams(current: URLSearchParams): string {
  const next = cloneParams(current);
  for (const k of APP_MODAL_KEYS) {
    next.delete(k);
  }
  return next.toString();
}

export function setAppModalParams(
  current: URLSearchParams,
  modal: AppModalKind,
  extras?: {
    tagType?: string;
    tagValue?: string;
    authMode?: 'signin' | 'signup';
    authPrompt?: string;
    /** When not on `/event/:id`, identifies which event card panel is open */
    targetEventId?: string;
  }
): string {
  const next = cloneParams(current);
  for (const k of APP_MODAL_KEYS) {
    next.delete(k);
  }
  next.set('modal', modal);
  if (modal === 'tag') {
    if (extras?.tagType) next.set('tagType', extras.tagType);
    if (extras?.tagValue != null && extras.tagValue !== '') next.set('tagValue', extras.tagValue);
  }
  if (modal === 'auth') {
    next.set('authMode', extras?.authMode === 'signup' ? 'signup' : 'signin');
    if (extras?.authPrompt) next.set('authPrompt', extras.authPrompt);
  }
  if (modal === 'rate' || modal === 'view-ratings' || modal === 'edit-event') {
    if (extras?.targetEventId) next.set('targetEventId', extras.targetEventId);
  }
  return next.toString();
}

export function parseAppModal(current: URLSearchParams): {
  modal: AppModalKind | null;
  tagType: string;
  tagValue: string;
  authMode: 'signin' | 'signup';
  authPrompt: string | undefined;
  targetEventId: string;
} {
  const raw = current.get('modal');
  const modal =
    raw === 'add-event' ||
    raw === 'settings' ||
    raw === 'auth' ||
    raw === 'tag' ||
    raw === 'rate' ||
    raw === 'view-ratings' ||
    raw === 'edit-event'
      ? (raw as AppModalKind)
      : null;
  return {
    modal,
    tagType: current.get('tagType') || '',
    tagValue: current.get('tagValue') || '',
    authMode: current.get('authMode') === 'signup' ? 'signup' : 'signin',
    authPrompt: current.get('authPrompt') || undefined,
    targetEventId: current.get('targetEventId') || '',
  };
}
