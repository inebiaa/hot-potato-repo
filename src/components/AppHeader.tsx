import { Plus, LogOut, LogIn, Sparkles, BarChart3, User, Settings, Home } from 'lucide-react';
import type { AppSettings } from '../types/appSettings';

interface AppHeaderProps {
  pathname: string;
  appSettings: AppSettings;
  user: { id: string } | null;
  isAdmin: boolean;
  onGoHome: () => void;
  onOpenStats: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onAddEvent: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function AppHeader({
  pathname: _pathname,
  appSettings,
  user,
  isAdmin: _isAdmin,
  onGoHome,
  onOpenStats,
  onOpenProfile,
  onOpenSettings,
  onAddEvent,
  onSignIn,
  onSignOut,
}: AppHeaderProps) {

  return (
    <header className="shrink-0 bg-white shadow-sm border-b sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {appSettings.app_logo_url ? (
              <button type="button" onClick={onGoHome} className="p-0 border-0 bg-transparent cursor-pointer">
                <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-10 object-contain" />
              </button>
            ) : (
              <>
                {appSettings.app_icon_url ? (
                  <img src={appSettings.app_icon_url} alt="App Icon" className="w-10 h-10" />
                ) : (
                  <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2">
                    <Sparkles className="text-white" size={24} />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{appSettings.app_name}</h1>
                  {appSettings.tagline && (
                    <p className="text-xs text-gray-500">{appSettings.tagline}</p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end sm:gap-3">
            <button
              onClick={onGoHome}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="Home"
            >
              <Home size={20} />
              <span className="hidden sm:inline text-sm">Home</span>
            </button>
            <button
              onClick={onOpenStats}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              title="View Statistics"
            >
              <BarChart3 size={20} />
              <span className="hidden sm:inline text-sm">Stats</span>
            </button>
            {user ? (
              <>
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="My Profile"
                >
                  <User size={20} />
                  <span className="hidden sm:inline text-sm">My Profile</span>
                </button>
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="App Settings"
                >
                  <Settings size={20} />
                  <span className="hidden sm:inline text-sm">Settings</span>
                </button>
                <button
                  onClick={onAddEvent}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} />
                  <span className="hidden sm:inline">Add Show</span>
                </button>
                <button
                  onClick={onSignOut}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <LogIn size={20} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
