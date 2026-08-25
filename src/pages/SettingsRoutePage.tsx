import { useEffect } from 'react';
import SettingsPage from '../components/SettingsPage';
import PageBack from '../components/layout/PageBack';
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
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-800" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
        <PageBack className="mb-6" />
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-gray-700">{t('settings.signInToOpen')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <PageBack className="mb-6" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
        {t('settings.title')}
      </h1>
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
