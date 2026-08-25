import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageBack from '../components/layout/PageBack';
import { routePageShellClass } from '../components/layout/routePageShell';
import { Button, Input, Label } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../hooks/useCopy';
import { supabase } from '../lib/supabase';

export default function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setReady(!!session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(!!session);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError(t('auth.errors.passwordMismatch'));
      return;
    }
    setLoading(true);
    const { error: updateError } = await updatePassword(password);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    window.setTimeout(() => navigate('/'), 2000);
  };

  return (
    <div className={routePageShellClass('narrow')}>
      <PageBack className="mb-6" />
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">{t('auth.reset.title')}</h1>

      {!ready ? (
        <p className="text-sm text-muted-foreground">
          Open the reset link from your email to choose a new password.{' '}
          <Link to="/" className="underline underline-offset-2">
            Back home
          </Link>
        </p>
      ) : success ? (
        <p className="text-sm text-green-700">{t('auth.reset.success')}</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="max-w-md space-y-4">
          <div>
            <Label htmlFor="reset-password" required>
              {t('auth.reset.password')}
            </Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="reset-confirm" required>
              {t('auth.reset.confirmPassword')}
            </Label>
            <Input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={loading}>
            {loading ? t('auth.loading') : t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </div>
  );
}
