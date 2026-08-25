import StatisticsPage from '../components/StatisticsPage';
import PageBack from '../components/layout/PageBack';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAppSettings } from '../hooks/useAppSettings';

export default function StatsRoutePage() {
  const { appSettings } = useAppSettings();
  const { openEvent, overlayEventId, closeEventOverlay, tagModalRefreshTrigger } = useAppChrome();

  if (!appSettings) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageBack className="mb-6" />
      <StatisticsPage
        tagColors={appSettings}
        onOpenEvent={(id) => openEvent(id, 'tagModal')}
        tagModalRefreshTrigger={tagModalRefreshTrigger}
        eventOverlayOpen={!!overlayEventId}
        onCloseEventOverlay={closeEventOverlay}
      />
    </div>
  );
}
