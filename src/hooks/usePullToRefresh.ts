import { useEffect, useRef, useState } from 'react';

/** Fixed slot height while refresh runs (fits APP_LOADER_SIZE hammer spin). */
export const PTR_REFRESH_HOLD_PX = 48;
const PULL_THRESHOLD_PX = 50;
const MAX_PULL_PX = 72;
const PULL_DAMPING = 0.42;
/** At least one full hammer rotation (see .loading-hammer-spin). */
const MIN_REFRESH_MS = 600;

type UsePullToRefreshOptions = {
  scrollEl: HTMLElement | null;
  enabled: boolean;
  routeKey: string;
  onRefresh: () => void | Promise<void>;
  setRefreshing: (refreshing: boolean) => void;
};

export function usePullToRefresh({
  scrollEl,
  enabled,
  routeKey,
  onRefresh,
  setRefreshing,
}: UsePullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [pullHeight, setPullHeight] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [atScrollTop, setAtScrollTop] = useState(true);
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const touchActiveRef = useRef(false);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);

  const resetAll = () => {
    touchActiveRef.current = false;
    pullingRef.current = false;
    pullRef.current = 0;
    refreshingRef.current = false;
    setPull(0);
    setPullHeight(0);
    setIsPulling(false);
    setIsRefreshing(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!enabled) {
      touchActiveRef.current = false;
      pullingRef.current = false;
      pullRef.current = 0;
      refreshingRef.current = false;
      setPull(0);
      setPullHeight(0);
      setIsPulling(false);
      setIsRefreshing(false);
      setAtScrollTop(true);
      setRefreshing(false);
    }
  }, [enabled, setRefreshing]);

  useEffect(() => {
    resetAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  useEffect(() => {
    if (!enabled) return;

    const el = scrollEl;
    if (!el) return;

    const resetPull = () => {
      if (refreshingRef.current) return;
      pullingRef.current = false;
      setIsPulling(false);
      pullRef.current = 0;
      setPull(0);
      setPullHeight(0);
    };

    const syncScrollTop = () => {
      const atTop = el.scrollTop <= 0;
      setAtScrollTop(atTop);
      if (atTop || refreshingRef.current) return;
      resetPull();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current || el.scrollTop > 0) return;
      touchActiveRef.current = true;
      startYRef.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchActiveRef.current || refreshingRef.current) return;
      if (el.scrollTop > 0) {
        resetPull();
        return;
      }

      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startYRef.current;
      if (delta <= 0) {
        resetPull();
        return;
      }

      if (!pullingRef.current) {
        pullingRef.current = true;
        setIsPulling(true);
      }

      const next = Math.min(delta * PULL_DAMPING, MAX_PULL_PX);
      pullRef.current = next;
      setPull(next);
      setPullHeight(next);
      e.preventDefault();
    };

    const finishPull = () => {
      touchActiveRef.current = false;
      if (!pullingRef.current) return;
      pullingRef.current = false;
      setIsPulling(false);
      const releasePull = pullRef.current;
      const shouldRefresh = releasePull >= PULL_THRESHOLD_PX;
      pullRef.current = 0;
      setPull(0);
      if (!shouldRefresh || refreshingRef.current) {
        setPullHeight(0);
        return;
      }

      refreshingRef.current = true;
      setIsRefreshing(true);
      setRefreshing(true);
      setPullHeight(PTR_REFRESH_HOLD_PX);

      const started = Date.now();
      void Promise.resolve(onRefresh())
        .catch(() => {})
        .finally(async () => {
          const wait = MIN_REFRESH_MS - (Date.now() - started);
          if (wait > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, wait));
          }
          refreshingRef.current = false;
          setIsRefreshing(false);
          setRefreshing(false);
          setPullHeight(0);
        });
    };

    syncScrollTop();
    el.addEventListener('scroll', syncScrollTop, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finishPull);
    el.addEventListener('touchcancel', finishPull);

    return () => {
      el.removeEventListener('scroll', syncScrollTop);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finishPull);
      el.removeEventListener('touchcancel', finishPull);
    };
  }, [enabled, onRefresh, routeKey, scrollEl, setRefreshing]);

  const visible = pullHeight > 0 && atScrollTop;

  return {
    pull,
    pullProgress: Math.min(pull / PULL_THRESHOLD_PX, 1),
    pullHeight: visible ? pullHeight : 0,
    isRefreshing,
    isPulling,
    visible,
  };
}
