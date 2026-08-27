import { useEffect, useRef, useState } from 'react';

const PULL_THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;

type UsePullToRefreshOptions = {
  scrollEl: HTMLElement | null;
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
};

export function usePullToRefresh({
  scrollEl,
  enabled,
  onRefresh,
}: UsePullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    if (!enabled) {
      pullRef.current = 0;
      pullingRef.current = false;
      setPull(0);
      return;
    }

    const el = scrollEl;
    if (!el) return;

    const resetPull = () => {
      pullingRef.current = false;
      pullRef.current = 0;
      setPull(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullingRef.current || refreshingRef.current) return;
      if (el.scrollTop > 0) {
        resetPull();
        return;
      }

      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startYRef.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }

      const next = Math.min(delta * 0.45, MAX_PULL_PX);
      pullRef.current = next;
      setPull(next);
      if (next > 0) e.preventDefault();
    };

    const finishPull = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD_PX;
      pullRef.current = 0;
      setPull(0);
      if (!shouldRefresh || refreshingRef.current) return;

      refreshingRef.current = true;
      setRefreshing(true);
      void Promise.resolve(onRefresh()).finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', finishPull);
    el.addEventListener('touchcancel', finishPull);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', finishPull);
      el.removeEventListener('touchcancel', finishPull);
    };
  }, [enabled, onRefresh, scrollEl]);

  return {
    pull,
    refreshing,
    pullThreshold: PULL_THRESHOLD_PX,
  };
}
