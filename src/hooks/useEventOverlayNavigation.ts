import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { profilePagePath } from '../lib/siteBase';
import { isProfileHandlePathSegment } from '../lib/userProfile';
import { isListPageRoute, isProfilePageRoute } from '../lib/homeCatalogRoute';
import type { OverlaySource } from '../contexts/AppChromeContext';

export function useEventOverlayNavigation() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [overlayEventId, setOverlayEventId] = useState<string | null>(null);
  const [overlaySource, setOverlaySource] = useState<OverlaySource | null>(null);
  const [tagModalRefreshTrigger, setTagModalRefreshTrigger] = useState(0);

  const pathname = location.pathname;
  const embedMode = searchParams.get('embed') === '1';
  const eventIdFromQuery = searchParams.get('event');
  const eventIdFromPath = params.eventId ?? null;
  const eventIdFromUrl = eventIdFromPath ?? eventIdFromQuery;
  const showSharedList = isListPageRoute(pathname);
  const showProfileView = isProfilePageRoute(pathname);
  const profileHandle =
    showProfileView && params.handle && isProfileHandlePathSegment(params.handle)
      ? params.handle
      : null;

  const closeEventOverlay = useCallback(() => {
    setOverlayEventId(null);
    setOverlaySource(null);
    setTagModalRefreshTrigger((t) => t + 1);
    if (showProfileView) {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      if (profileHandle) {
        const qs = next.toString();
        navigate(qs ? { pathname: profilePagePath(profileHandle), search: qs } : profilePagePath(profileHandle));
      } else {
        navigate({ pathname: '/profile', search: next.toString() });
      }
    } else if (showSharedList) {
      const next = new URLSearchParams(searchParams);
      next.delete('event');
      navigate({ pathname: location.pathname, search: next.toString() });
    } else {
      navigate('/');
    }
  }, [showProfileView, showSharedList, searchParams, profileHandle, navigate, location.pathname]);

  const openEventOverlay = useCallback(
    (eventId: string, source?: OverlaySource) => {
      setOverlayEventId(eventId);
      setOverlaySource(source ?? null);
      if (showProfileView) {
        const next = new URLSearchParams(searchParams);
        next.delete('profile');
        next.set('event', eventId);
        if (profileHandle) {
          navigate({ pathname: profilePagePath(profileHandle), search: next.toString() });
        } else {
          navigate({ pathname: '/profile', search: next.toString() });
        }
      } else if (showSharedList) {
        const next = new URLSearchParams(searchParams);
        next.set('event', eventId);
        navigate({ pathname: location.pathname, search: next.toString() });
      } else {
        navigate(`/event/${eventId}`);
      }
    },
    [showProfileView, showSharedList, profileHandle, searchParams, navigate, location.pathname],
  );

  useEffect(() => {
    if (params.eventId) {
      setOverlayEventId(params.eventId);
    } else if (!searchParams.get('event')) {
      setOverlayEventId(null);
      setOverlaySource(null);
    }
  }, [params.eventId, searchParams]);

  useEffect(() => {
    if (!embedMode && eventIdFromUrl) {
      setOverlayEventId(eventIdFromUrl);
    }
  }, [embedMode, eventIdFromUrl]);

  return {
    overlayEventId,
    overlaySource,
    tagModalRefreshTrigger,
    embedMode,
    eventIdFromUrl,
    openEventOverlay,
    closeEventOverlay,
  };
}
