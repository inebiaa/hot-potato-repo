import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { setAppModalParams, type AppModalKind } from '../lib/searchParamsModal';

type EventPanelKind = 'rate' | 'view-ratings' | 'edit-event';

export function useEventPanelNavigation() {
 const navigate = useNavigate();
 const location = useLocation();
 const [searchParams] = useSearchParams();

 const openEventPanel = useCallback(
 (kind: EventPanelKind, eventId: string) => {
 navigate({
 pathname: location.pathname,
 search: setAppModalParams(searchParams, kind, { targetEventId: eventId }),
 });
 },
 [navigate, location.pathname, searchParams],
 );

 const openAuthForEvent = useCallback(
 (prompt: string) => {
 navigate({
 pathname: location.pathname,
 search: setAppModalParams(searchParams, 'auth', {
 authMode: 'signin',
 authPrompt: prompt,
 }),
 });
 },
 [navigate, location.pathname, searchParams],
 );

 return { openEventPanel, openAuthForEvent };
}

export function isEventPanelModal(modal: AppModalKind | null): boolean {
 return modal === 'rate' || modal === 'view-ratings' || modal === 'edit-event';
}
