import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ProfilePage from '../components/profile/ProfilePage';
import RouteLoading from '../components/layout/RouteLoading';
import RouteMessage from '../components/layout/RouteMessage';
import { routePageShellClass } from '../components/layout/routePageShell';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { useT } from '../hooks/useCopy';
import { isProfileHandlePathSegment, resolveProfileByHandle } from '../lib/userProfile';

export default function ProfileRoutePage() {
  const t = useT();
  const params = useParams();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { appSettings } = useAppSettings();
  const {
    onTagClick,
    openEvent,
    setProfileBoardEvents,
    refreshHomeCatalog,
    refreshHomeEventRating,
  } = useAppChrome();

  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const pathnameIsOwn = location.pathname === '/profile' || location.pathname.endsWith('/profile');
  const handle =
    params.handle && isProfileHandlePathSegment(params.handle) ? params.handle : null;
  const showOwnProfile = pathnameIsOwn && !handle;

  useEffect(() => {
    if (handle) {
      let cancelled = false;
      setResolving(true);
      setNotFound(false);
      void resolveProfileByHandle(handle).then((row) => {
        if (cancelled) return;
        setResolving(false);
        if (!row) {
          setNotFound(true);
          setProfileUserId(null);
          return;
        }
        setProfileUserId(row.user_id);
      });
      return () => {
        cancelled = true;
      };
    }

    if (authLoading) {
      setResolving(true);
      return;
    }
    setResolving(false);
    if (user?.id) {
      setProfileUserId(user.id);
      setNotFound(false);
    } else {
      setProfileUserId(null);
    }
  }, [handle, user?.id, authLoading]);

  useEffect(() => {
    return () => {
      setProfileBoardEvents(null);
    };
  }, [setProfileBoardEvents]);

  if (!appSettings || resolving || (showOwnProfile && authLoading && !handle)) {
    return <RouteLoading width="wide" />;
  }

  if (notFound) {
    return (
      <RouteMessage width="wide">
        <p className="mb-4 text-gray-700">{t('profile.notFound')}</p>
      </RouteMessage>
    );
  }

  if (showOwnProfile && !user && !handle) {
    return (
      <RouteMessage width="wide">
        <p className="mb-4 text-gray-700">{t('profile.signInToView')}</p>
      </RouteMessage>
    );
  }

  if (!profileUserId) {
    return <RouteLoading width="wide" />;
  }

  return (
    <div className={routePageShellClass('wide')}>
      <ProfilePage
        userId={profileUserId}
        onTagClick={onTagClick}
        onOpenEvent={(id) => openEvent(id, 'viewRatings')}
        onBoardEventsChange={setProfileBoardEvents}
        onSearchEventRatingSubmitted={(id) => refreshHomeEventRating(id)}
        onSearchEventUpdated={refreshHomeCatalog}
        tagColors={appSettings}
        customPerformerTags={[]}
      />
    </div>
  );
}
