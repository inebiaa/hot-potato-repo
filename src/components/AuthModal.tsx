import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  promptMessage?: string;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin', promptMessage }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [emailOrUserId, setEmailOrUserId] = useState('');
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
      ? await signIn(emailOrUserId, password)
      : await signUp(emailOrUserId, password, yourName, username);

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
      setEmailOrUserId('');
      setPassword('');
      setConfirmPassword('');
      setYourName('');
      setUsername('');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-md w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg shadow-xl w-full p-6">
        <h2 className="text-2xl font-bold mb-3">
          {isLogin ? 'Sign In' : 'Create Account'}
        </h2>
        {promptMessage && (
          <p className="text-sm text-gray-600 mb-5">{promptMessage}</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="emailOrUserId" className="block text-sm font-medium text-gray-700 mb-1">
              {isLogin ? 'Email or User ID' : 'Email'}
            </label>
            <input
              id="emailOrUserId"
              type={isLogin ? "text" : "email"}
              value={emailOrUserId}
              onChange={(e) => setEmailOrUserId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={isLogin ? "Enter email or User ID" : "Enter email"}
            />
          </div>

          {!isLogin && (
            <>
              <div>
                <label htmlFor="yourName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name
                </label>
                <input
                  id="yourName"
                  type="text"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  required={!isLogin}
                  maxLength={80}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jane Doe"
                />
                <p className="text-xs text-gray-500 mt-1">Display name; can act as a credit when connected</p>
              </div>
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                  minLength={4}
                  maxLength={30}
                  pattern="[a-zA-Z0-9_-]+"
                  title="Username must be 4-30 characters and contain only letters, numbers, underscores, and hyphens"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., janedoe2024"
                />
                <p className="text-xs text-gray-500 mt-1">Your unique ID for signing in</p>
              </div>
            </>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!isLogin}
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Re-enter your password"
              />
            </div>
          )}

          {error && (
            <div className={`text-sm ${error.includes('created') ? 'text-green-600' : 'text-red-600'}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-blue-600 hover:underline"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
