import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type PullHandler = () => void | Promise<void>;

type PullToRefreshContextValue = {
  register: (handler: PullHandler | null) => void;
  runRefresh: () => Promise<void>;
  /** True while a pull-triggered refresh is in flight (suppress page body spinners). */
  refreshing: boolean;
  setRefreshing: (refreshing: boolean) => void;
};

const PullToRefreshContext = createContext<PullToRefreshContextValue | null>(null);

export function PullToRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<PullHandler | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const register = useCallback((handler: PullHandler | null) => {
    handlerRef.current = handler;
  }, []);

  const runRefresh = useCallback(async () => {
    const handler = handlerRef.current;
    if (!handler) return;
    await handler();
  }, []);

  const value = useMemo(
    () => ({ register, runRefresh, refreshing, setRefreshing }),
    [register, runRefresh, refreshing],
  );

  return (
    <PullToRefreshContext.Provider value={value}>
      {children}
    </PullToRefreshContext.Provider>
  );
}

/** Register the active page refresh handler (cleared on unmount). */
export function useRegisterPullToRefresh(handler: PullHandler | null) {
  const ctx = useContext(PullToRefreshContext);
  if (!ctx) {
    throw new Error('useRegisterPullToRefresh must be used inside PullToRefreshProvider');
  }

  useEffect(() => {
    ctx.register(handler);
    return () => ctx.register(null);
  }, [ctx, handler]);
}

export function usePullToRefreshControl() {
  const ctx = useContext(PullToRefreshContext);
  if (!ctx) {
    throw new Error('usePullToRefreshControl must be used inside PullToRefreshProvider');
  }
  return ctx;
}

/** True during pull-to-refresh; hide inline page loaders so only the PTR hammer shows. */
export function usePullRefreshing(): boolean {
  const ctx = useContext(PullToRefreshContext);
  return ctx?.refreshing ?? false;
}
