import { useEffect, useRef, useState } from 'react';

export const PTR_HAMMER_SIZE = 28;
/** Held distance while refresh runs (matches loader footprint). */
export const PTR_REFRESH_HOLD_PX = 56;
const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 112;

type UsePullToRefreshOptions = {
  scrollEl: HTMLElement | null;
  enabled: boolean;
  onRefresh: () => void | Promise<void>;
  setRefreshing: (refreshing: boolean) => void;
};

export function usePullToRefresh({
  scrollEl,
  enabled,
  onRefresh,
  setRefreshing,
}: UsePullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [contentOffset, setContentOffset] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      pullRef.current = 0;
      pullingRef.current = false;
      refreshingRef.current = false;
      setPull(0);
      setContentOffset(0);
      setIsRefreshing(false);
      setIsPulling(false);
      setRefreshing(false);
    }
  }, [enabled, setRefreshing]);

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
      setContentOffset(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
      setIsPulling(true);
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
        setContentOffset(0);
        return;
      }

      const next = Math.min(delta * 0.5, MAX_PULL_PX);
      pullRef.current = next;
      setPull(next);
      setContentOffset(next);
      if (next > 0) e.preventDefault();
    };

    const finishPull = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      setIsPulling(false);
      const releasePull = pullRef.current;
      const shouldRefresh = releasePull >= PULL_THRESHOLD_PX;
      pullRef.current = 0;
      setPull(0);
      if (!shouldRefresh || refreshingRef.current) {
        setContentOffset(0);
        return;
      }

      refreshingRef.current = true;
      setIsRefreshing(true);
      setRefreshing(true);
      setContentOffset(Math.max(releasePull, PTR_REFRESH_HOLD_PX));

      void Promise.resolve(onRefresh()).finally(() => {
        refreshingRef.current = false;
        setIsRefreshing(false);
        setRefreshing(false);
        setContentOffset(0);
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
  }, [enabled, onRefresh, scrollEl, setRefreshing]);

  return {
    pull,
    pullProgress: Math.min(pull / PULL_THRESHOLD_PX, 1),
    contentOffset,
    isRefreshing,
    isPulling,
    pullThreshold: PULL_THRESHOLD_PX,
  };
}
