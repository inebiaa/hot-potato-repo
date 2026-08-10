import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Label, Modal } from './ui';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  promptMessage?: string;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin', promptMessage }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [yourName, setYourName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setIsLogin(initialMode !== 'signup');
      setError('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);

    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, yourName, username);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      if (!isLogin) {
        setError('Account created! Please sign in.');
        setIsLogin(true);
      } else {
        onClose();
      }
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setYourName('');
      setUsername('');
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={isLogin ? 'Sign In' : 'Create Account'}
      panelClassName="max-w-md sm:rounded-xl"
    >
      <div className="p-4 sm:p-6">
        {promptMessage && (
          <p className="mb-5 text-sm text-muted-foreground">{promptMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" required>
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter email"
              autoComplete="email"
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <Label htmlFor="yourName" required>
                  Display Name
                </Label>
                <Input
                  id="yourName"
                  type="text"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  required={!isLogin}
                  maxLength={80}
                  placeholder="e.g., Jane Doe"
                />
                <p className="mt-1 text-xs text-muted-foreground">Your public display name for credits and mentions</p>
              </div>
              <div>
                <Label htmlFor="username" required>
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                  minLength={4}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_-]+"
                  title="Username must be 4-30 characters and contain only letters, numbers, underscores, and hyphens"
                  placeholder="e.g., janedoe2024"
                />
                <p className="mt-1 text-xs text-muted-foreground">Your unique username for your profile link and credits</p>
              </div>
            </>
          )}

          <div>
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {!isLogin && (
            <div>
              <Label htmlFor="confirmPassword" required>
                Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                minLength={6}
                placeholder="Re-enter your password"
              />
            </div>
          )}

          {error && (
            <div className={`text-sm ${error.includes('created') ? 'text-green-700' : 'text-destructive'}`}>
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-foreground underline-offset-2 hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
