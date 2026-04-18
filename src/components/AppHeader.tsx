import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Plus, LogOut, LogIn, Sparkles, BarChart3, User, Settings, Home, MoreVertical } from 'lucide-react';
import type { AppSettings } from '../types/appSettings';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export type AppHeaderActiveView = 'home' | 'stats' | 'profile';

/** Primary actions: no chrome box — icon / text only, tint on hover. */
const ctaGhost =
  'text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

interface AppHeaderProps {
  pathname: string;
  activeView?: AppHeaderActiveView;
  /** Mouse/trackpad-style device: never show the phone bottom tab bar, even at narrow widths. */
  desktopLikePointer: boolean;
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
  searchBar?: ReactNode;
}

/** Icon tools: no border or card — hover wash only. */
const iconBtn =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export default function AppHeader({
  pathname: _pathname,
  activeView = 'home',
  desktopLikePointer,
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
  searchBar,
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

  const showPhoneBottomNav = !desktopLikePointer;
  const drawerFullNavClass = desktopLikePointer ? 'flex flex-col gap-1' : 'hidden flex-col gap-1 md:flex';
  const drawerMobileOverflowClass = desktopLikePointer ? 'hidden' : 'flex flex-col gap-1 md:hidden';

  return (
    <>
      <header className="sticky top-0 z-40 shrink-0 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto max-w-[2400px] px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex flex-col gap-2 sm:gap-3 lg:contents">
              <div className="flex min-w-0 items-center justify-between gap-2 pr-2 lg:shrink-0 lg:pr-0">
                <div className="flex min-w-0 items-center gap-3">
                  {appSettings.app_logo_url ? (
                    <button
                      type="button"
                      onClick={onGoHome}
                      className="shrink-0 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
                    >
                      <img src={appSettings.app_logo_url} alt={appSettings.app_name} className="h-9 object-contain sm:h-10" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onGoHome}
                      className="flex min-w-0 max-w-[70vw] items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 sm:max-w-none lg:max-w-md"
                    >
                      {appSettings.app_icon_url ? (
                        <img src={appSettings.app_icon_url} alt="App Icon" className="h-9 w-9 shrink-0 sm:h-10 sm:w-10" />
                      ) : (
                        <div className="shrink-0 bg-gradient-to-br from-blue-600 to-blue-700 p-2">
                          <Sparkles className="text-white" size={22} />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h1 className="truncate text-lg font-bold text-gray-900 sm:text-2xl">{appSettings.app_name}</h1>
                        {appSettings.tagline ? (
                          <p className="truncate text-xs text-gray-500">{appSettings.tagline}</p>
                        ) : null}
                      </div>
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 lg:hidden">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    className={iconBtn}
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

              {searchBar ? <div className="min-w-0 w-full lg:flex-1 lg:min-w-0">{searchBar}</div> : null}

              <div className="hidden shrink-0 items-center gap-1 lg:flex lg:pl-1">
                <button type="button" onClick={onGoHome} className={iconBtn} title="Home">
                  <Home size={20} strokeWidth={activeView === 'home' ? 2.25 : 2} className={activeView === 'home' ? 'text-blue-600' : ''} />
                </button>
                <button type="button" onClick={onOpenStats} className={iconBtn} title="Statistics">
                  <BarChart3 size={20} strokeWidth={activeView === 'stats' ? 2.25 : 2} className={activeView === 'stats' ? 'text-blue-600' : ''} />
                </button>
                {user ? (
                  <>
                    <button type="button" onClick={onOpenProfile} className={iconBtn} title="My profile">
                      <User size={20} strokeWidth={activeView === 'profile' ? 2.25 : 2} className={activeView === 'profile' ? 'text-blue-600' : ''} />
                    </button>
                    <button type="button" onClick={onOpenSettings} className={iconBtn} title="Settings">
                      <Settings size={20} strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={onAddEvent}
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition ${ctaGhost}`}
                      title="Add show"
                    >
                      <Plus size={20} strokeWidth={2.5} />
                    </button>
                    <button type="button" onClick={onSignOut} className={iconBtn} title="Sign out">
                      <LogOut size={20} strokeWidth={2} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={onSignIn}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold transition ${ctaGhost}`}
                  >
                    <LogIn size={18} strokeWidth={2.5} />
                    <span>Sign in</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Touch phones: bottom tab bar. Narrow desktop windows keep this hidden (desktopLikePointer). */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] ${showPhoneBottomNav ? 'md:hidden' : 'hidden'}`}
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

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={closeDrawer} />
          <div
            ref={drawerPanelRef}
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            className="absolute right-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-l border-gray-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button type="button" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close" onClick={closeDrawer}>
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {/* Non-phone or md+: full nav in drawer when there is no bottom tab bar. */}
              <div className={drawerFullNavClass}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                  onClick={() => runAndClose(onGoHome)}
                >
                  <Home size={20} className="shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">Home</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                  onClick={() => runAndClose(onOpenStats)}
                >
                  <BarChart3 size={20} className="shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">Statistics</span>
                </button>
                {user ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                    onClick={() => runAndClose(onOpenProfile)}
                  >
                    <User size={20} className="shrink-0 text-gray-600" />
                    <span className="text-sm font-medium">My profile</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                  onClick={() => runAndClose(onAddEvent)}
                >
                  <Plus size={20} className="shrink-0 text-gray-600" />
                  <span className="text-sm font-medium">Add show</span>
                </button>
                {!user ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-gray-800 hover:bg-gray-50"
                    onClick={() => runAndClose(onSignIn)}
                  >
                    <LogIn size={20} className="shrink-0 text-gray-600" />
                    <span className="text-sm font-medium">Sign in</span>
                  </button>
                ) : null}
                {user ? (
                  <>
                    <div className="my-2 border-t border-gray-100" role="separator" />
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
                ) : null}
              </div>

              {/* Phone + tab bar: drawer is settings/sign-out (or sign-in) only. */}
              <div className={drawerMobileOverflowClass}>
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
        </div>
      )}
    </>
  );
}
