import { useParams, useSearchParams } from 'react-router-dom';
import SharedLibraryListPage from '../components/SharedLibraryListPage';
import PageBack from '../components/layout/PageBack';
import { routePageShellClass } from '../components/layout/routePageShell';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { isProfileHandlePathSegment } from '../lib/userProfile';

export default function SharedListRoutePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { appSettings } = useAppSettings();
  const { onTagClick, openEvent } = useAppChrome();

  const listId = params.listId ?? searchParams.get('list');
  const urlHandle =
    params.handle && isProfileHandlePathSegment(params.handle) ? params.handle : null;

  if (!appSettings || !listId) return null;

  return (
    <div className={routePageShellClass('wide')}>
      <PageBack className="mb-6" />
      <SharedLibraryListPage
        listId={listId}
        urlHandle={urlHandle}
        onTagClick={onTagClick}
        onOpenEvent={(id) => openEvent(id)}
        tagColors={appSettings}
        customPerformerTags={[]}
      />
    </div>
  );
}
