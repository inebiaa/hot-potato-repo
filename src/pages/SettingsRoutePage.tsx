import { useEffect } from 'react';
import SettingsPage from '../components/SettingsPage';
import PageBack from '../components/layout/PageBack';
import RouteLoading from '../components/layout/RouteLoading';
import RouteMessage from '../components/layout/RouteMessage';
import { routePageShellClass } from '../components/layout/routePageShell';
import { typeCallout, typeTitle } from '../components/ui';
import { useAppChrome } from '../contexts/AppChromeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from '../hooks/useAppSettings';
import { useT } from '../hooks/useCopy';

export default function SettingsRoutePage() {
  const t = useT();
  const { user, loading: authLoading } = useAuth();
  const { appSettings, setAppSettings, fetchSettings } = useAppSettings();
  const { refreshHomeCatalog } = useAppChrome();

  useEffect(() => {
    return () => {
      void fetchSettings();
    };
  }, [fetchSettings]);

  if (!appSettings || authLoading) {
    return <RouteLoading />;
  }

  if (!user) {
    return (
      <RouteMessage>
        <p className={`mb-4 ${typeCallout} text-foreground`}>{t('settings.signInToOpen')}</p>
      </RouteMessage>
    );
  }

  return (
    <div className={`${routePageShellClass('wide')} py-8`}>
      <PageBack className="mb-6" />
      <h1 className={`mb-8 ${typeTitle} text-foreground`}>{t('settings.title')}</h1>
      <SettingsPage
        onSettingsUpdated={() => {
          void fetchSettings();
        }}
        onSettingsPreview={setAppSettings}
        onAccountUpdated={refreshHomeCatalog}
      />
    </div>
  );
}
