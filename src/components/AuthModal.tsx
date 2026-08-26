import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { validateProfileDisplayName, validateProfileHandle } from '../lib/userProfile';
import { useT } from '../hooks/useCopy';
import { Button, Input, Label, Modal, formErrorClass, formSuccessClass, typeCallout } from './ui';

type AuthMode = 'signin' | 'signup' | 'forgot';

interface AuthModalProps {
 isOpen: boolean;
 onClose: () => void;
 initialMode?: 'signin' | 'signup';
 promptMessage?: string;
 privacyUrl?: string;
 termsUrl?: string;
}

export default function AuthModal({
 isOpen,
 onClose,
 initialMode = 'signin',
 promptMessage,
 privacyUrl,
 termsUrl,
}: AuthModalProps) {
 const t = useT();
 const [mode, setMode] = useState<AuthMode>('signin');
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [displayName, setDisplayName] = useState('');
 const [handle, setHandle] = useState('');
 const [termsAccepted, setTermsAccepted] = useState(false);
 const [error, setError] = useState('');
 const [success, setSuccess] = useState('');
 const [loading, setLoading] = useState(false);
 const { signIn, signUp, resetPassword } = useAuth();

 const privacy = (privacyUrl || '').trim();
 const terms = (termsUrl || '').trim();
 const needsLegal = !!(privacy || terms);

 useEffect(() => {
 if (isOpen) {
 setMode(initialMode === 'signup' ? 'signup' : 'signin');
 setError('');
 setSuccess('');
 setTermsAccepted(false);
 }
 }, [isOpen, initialMode]);

 if (!isOpen) return null;

 const title =
 mode === 'forgot' ? t('auth.forgot.title') : mode === 'signup' ? t('auth.signUp.title') : t('auth.signIn.title');

 const resetFormFields = () => {
 setEmail('');
 setPassword('');
 setConfirmPassword('');
 setDisplayName('');
 setHandle('');
 setTermsAccepted(false);
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError('');
 setSuccess('');

 if (mode === 'forgot') {
 setLoading(true);
 const { error: resetError } = await resetPassword(email);
 setLoading(false);
 if (resetError) {
 setError(resetError.message);
 return;
 }
 setSuccess(t('auth.forgot.sent'));
 return;
 }

 if (mode === 'signup') {
 if (password !== confirmPassword) {
 setError(t('auth.errors.passwordMismatch'));
 return;
 }
 if (!termsAccepted) {
 setError(t('auth.errors.termsRequired'));
 return;
 }
 const nameError = validateProfileDisplayName(displayName);
 if (nameError) {
 setError(nameError);
 return;
 }
 const handleError = validateProfileHandle(handle);
 if (handleError) {
 setError(handleError);
 return;
 }
 }

 setLoading(true);
 const { error: authError } =
 mode === 'signin'
 ? await signIn(email, password)
 : await signUp(email, password, displayName, handle);
 setLoading(false);

 if (authError) {
 setError(authError.message);
 return;
 }

 if (mode === 'signup') {
 setSuccess(t('auth.accountCreated'));
 setMode('signin');
 resetFormFields();
 return;
 }

 onClose();
 resetFormFields();
 };

 return (
 <Modal onClose={onClose} title={title} panelClassName="max-w-md sm:rounded-lg">
 <div className="p-4 sm:p-6">
 {promptMessage && mode !== 'forgot' ? (
 <p className={`mb-5 ${typeCallout} text-muted-foreground`}>{promptMessage}</p>
 ) : null}

 {mode === 'forgot' ? (
 <p className={`mb-4 ${typeCallout} text-muted-foreground`}>{t('auth.forgot.body')}</p>
 ) : null}

 <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
 <div>
 <Label htmlFor="auth-email" required>
 {t('auth.email')}
 </Label>
 <Input
 id="auth-email"
 type="email"
 value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 autoComplete="email"
 />
 </div>

 {mode === 'signup' ? (
 <>
 <div>
 <Label htmlFor="auth-displayName" required>
 {t('auth.name')}
 </Label>
 <Input
 id="auth-displayName"
 type="text"
 value={displayName}
 onChange={(e) => setDisplayName(e.target.value)}
 required
 maxLength={80}
 autoComplete="name"
 />
 </div>
 <div>
 <Label htmlFor="auth-handle" required>
 {t('auth.username')}
 </Label>
 <Input
 id="auth-handle"
 type="text"
 value={handle}
 onChange={(e) => setHandle(e.target.value)}
 required
 minLength={4}
 maxLength={30}
 pattern="[a-zA-Z0-9_-]+"
 autoComplete="username"
 />
 </div>
 </>
 ) : null}

 {mode !== 'forgot' ? (
 <div>
 <div className="mb-1 flex items-center justify-between gap-2">
 <Label htmlFor="auth-password" required>
 {t('auth.password')}
 </Label>
 {mode === 'signin' ? (
 <button
 type="button"
 onClick={() => {
 setMode('forgot');
 setError('');
 setSuccess('');
 }}
 className={`${typeCallout} text-foreground underline-offset-2 hover:underline`}
 >
 {t('auth.forgotPassword')}
 </button>
 ) : null}
 </div>
 <Input
 id="auth-password"
 type="password"
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 minLength={6}
 autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
 />
 </div>
 ) : null}

 {mode === 'signup' ? (
 <div>
 <Label htmlFor="auth-confirmPassword" required>
 {t('auth.confirmPassword')}
 </Label>
 <Input
 id="auth-confirmPassword"
 type="password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 required
 minLength={6}
 autoComplete="new-password"
 />
 </div>
 ) : null}

 {mode === 'signup' ? (
 <div className="space-y-2">
 <label className={`flex cursor-pointer items-start gap-2 ${typeCallout}`}>
 <input
 type="checkbox"
 checked={termsAccepted}
 onChange={(e) => setTermsAccepted(e.target.checked)}
 className="mt-0.5"
 />
 <span>
 {needsLegal ? (
 <>
 {t('auth.termsPrefix')}{' '}
 {terms ? (
 <a
 href={terms}
 target="_blank"
 rel="noopener noreferrer"
 className="underline underline-offset-2"
 >
 {t('safety.legal.terms')}
 </a>
 ) : (
 t('safety.legal.terms')
 )}
 {privacy && terms ? ` ${t('auth.termsJoiner')} ` : null}
 {privacy ? (
 <a
 href={privacy}
 target="_blank"
 rel="noopener noreferrer"
 className="underline underline-offset-2"
 >
 {t('safety.legal.privacy')}
 </a>
 ) : !terms ? (
 t('safety.legal.privacy')
 ) : null}
 </>
 ) : (
 t('auth.termsConfirm')
 )}
 </span>
 </label>
 </div>
 ) : null}

 {error && !success ? <p className={formErrorClass}>{error}</p> : null}
 {success ? <p className={formSuccessClass}>{success}</p> : null}

 <Button type="submit" disabled={loading} className="w-full">
 {loading
 ? t('auth.loading')
 : mode === 'forgot'
 ? t('auth.forgot.submit')
 : mode === 'signup'
 ? t('auth.signUp.submit')
 : t('auth.signIn.submit')}
 </Button>
 </form>

 <div className={`mt-4 text-center ${typeCallout}`}>
 {mode === 'forgot' ? (
 <button
 type="button"
 onClick={() => {
 setMode('signin');
 setError('');
 setSuccess('');
 }}
 className="text-foreground underline-offset-2 hover:underline"
 >
 {t('auth.forgot.back')}
 </button>
 ) : (
 <button
 type="button"
 onClick={() => {
 setMode(mode === 'signin' ? 'signup' : 'signin');
 setError('');
 setSuccess('');
 }}
 className="text-foreground underline-offset-2 hover:underline"
 >
 {mode === 'signin' ? t('auth.toggleSignUp') : t('auth.toggleSignIn')}
 </button>
 )}
 </div>
 </div>
 </Modal>
 );
}
