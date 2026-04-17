import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Plus, LogOut, LogIn, Sparkles, BarChart3, User, Settings, Home, MoreVertical } from 'lucide-react';
import type { AppSettings } from '../types/appSettings';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export type AppHeaderActiveView = 'home' | 'stats' | 'profile';

interface AppHeaderProps {
  pathname: string;
  /** Drives bottom-nav highlight when query-based views use `/`. */
  activeView?: AppHeaderActiveView;
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
  activeView = 'home',
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
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerWasOpenRef = useRef(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useBodyScrollLock(drawerOpen);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (drawerOpen) {
      drawerWasOpenRef.current = true;
      const t = window.setTimeout(() => {
        const panel = drawerPanelRef.current;
        const first = panel?.querySelector<HTMLElement>('button, a, [href]');
        first?.focus({ preventScroll: true });
      }, 0);
      return () => window.clearTimeout(t);
    }
    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false;
      menuButtonRef.current?.focus({ preventScroll: true });
    }
  }, [drawerOpen]);

  const navItemClass = (active: boolean) =>
    `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
      active ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
    }`;

  const runAndClose = (fn: () => void) => {
    fn();
    closeDrawer();
  };

  return (
    <>
      <header className="shrink-0 bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3 pr-2 md:pr-0">
              {appSettings.app_logo_url ? (
                <button type="button" onClick={onGoHome} className="p-0 border-0 bg-transparent cursor-pointer shrink-0">
                  <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-9 sm:h-10 object-contain" />
                </button>
              ) : (
                <>
                  {appSettings.app_icon_url ? (
                    <img src={appSettings.app_icon_url} alt="App Icon" className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
                  ) : (
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2 shrink-0">
                      <Sparkles className="text-white" size={22} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{appSettings.app_name}</h1>
                    {appSettings.tagline && (
                      <p className="text-xs text-gray-500 truncate">{appSettings.tagline}</p>
                    )}
                  </div>
                </>
              )}

              <div className="ml-auto flex shrink-0 items-center md:hidden">
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="rounded-lg p-2.5 text-gray-700 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-expanded={drawerOpen}
                  aria-controls={menuId}
                  aria-haspopup="dialog"
                  aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                  onClick={() => setDrawerOpen((o) => !o)}
                >
                  <MoreVertical size={22} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="hidden md:flex flex-wrap items-center gap-2 md:justify-end md:gap-3">
              <button
                onClick={onGoHome}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Home"
              >
                <Home size={20} />
                <span className="text-sm">Home</span>
              </button>
              <button
                onClick={onOpenStats}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="View Statistics"
              >
                <BarChart3 size={20} />
                <span className="text-sm">Stats</span>
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
                    <span className="text-sm">My Profile</span>
                  </button>
                  <button
                    onClick={onOpenSettings}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    title="App Settings"
                  >
                    <Settings size={20} />
                    <span className="text-sm">Settings</span>
                  </button>
                  <button
                    onClick={onAddEvent}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={20} />
                    <span>Add Show</span>
                  </button>
                  <button
                    onClick={onSignOut}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <LogOut size={20} />
                    <span>Sign Out</span>
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

      {/* Mobile bottom bar: primary destinations (overflow in ⋮ drawer) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around">
          <button type="button" className={navItemClass(activeView === 'home')} onClick={onGoHome}>
            <Home size={22} strokeWidth={activeView === 'home' ? 2.5 : 2} />
            <span>Home</span>
          </button>
          <button type="button" className={navItemClass(activeView === 'stats')} onClick={onOpenStats}>
            <BarChart3 size={22} strokeWidth={activeView === 'stats' ? 2.5 : 2} />
            <span>Stats</span>
          </button>
          {user ? (
            <button type="button" className={navItemClass(activeView === 'profile')} onClick={onOpenProfile}>
              <User size={22} strokeWidth={activeView === 'profile' ? 2.5 : 2} />
              <span>Profile</span>
            </button>
          ) : (
            <button type="button" className={navItemClass(false)} onClick={onSignIn}>
              <LogIn size={22} />
              <span>Sign in</span>
            </button>
          )}
          <button type="button" className={navItemClass(false)} onClick={onAddEvent}>
            <Plus size={22} />
            <span>Add</span>
          </button>
        </div>
      </nav>

      {/* Mobile ⋮ drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeDrawer}
          />
          <div
            ref={drawerPanelRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">More</span>
              <button
                type="button"
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
                onClick={closeDrawer}
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              {user ? (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                    onClick={() => runAndClose(onOpenSettings)}
                  >
                    <Settings size={20} className="shrink-0 text-gray-600" />
                    <span className="text-sm font-medium">Settings</span>
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                    onClick={() => runAndClose(onSignOut)}
                  >
                    <LogOut size={20} className="shrink-0 text-gray-600" />
                    <span className="text-sm font-medium">Sign out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                  onClick={() => runAndClose(onSignIn)}
                >
                  <LogIn size={20} className="shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">Sign in</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
