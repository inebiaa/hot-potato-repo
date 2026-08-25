import { useNavigate } from 'react-router-dom';
import PageBack from '../components/layout/PageBack';
import { routePageShellClass } from '../components/layout/routePageShell';
import { Button } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../hooks/useCopy';

export default function AccountDeletionPage() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className={routePageShellClass('narrow')}>
      <PageBack className="mb-6" />
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-foreground">
        {t('auth.deleteAccountPage.title')}
      </h1>
      <p className="mb-4 text-sm text-muted-foreground">{t('auth.deleteAccountPage.body')}</p>
      <p className="mb-6 text-sm text-foreground">{t('auth.deleteAccountPage.stepApp')}</p>
      {user ? (
        <Button type="button" onClick={() => navigate('/settings')}>
          {t('auth.deleteAccountPage.openSettings')}
        </Button>
      ) : (
        <Button type="button" variant="secondary" onClick={() => navigate('/?modal=auth')}>
          {t('nav.signIn')}
        </Button>
      )}
    </div>
  );
}
