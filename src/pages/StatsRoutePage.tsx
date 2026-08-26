import StatisticsPage from '../components/StatisticsPage';
import PageBack from '../components/layout/PageBack';
import { routePageShellClass } from '../components/layout/routePageShell';
import { typeTitle } from '../components/ui';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { useT } from '../hooks/useCopy';

export default function StatsRoutePage() {
  const t = useT();
  const { appSettings } = useAppSettings();
  const { openEvent, overlayEventId, closeEventOverlay, tagModalRefreshTrigger } = useAppChrome();

  if (!appSettings) return null;

  return (
    <div className={`${routePageShellClass('wide')} py-8`}>
      <PageBack className="mb-6" />
      <h1 className={`mb-6 ${typeTitle} text-foreground`}>{t('stats.title')}</h1>
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
