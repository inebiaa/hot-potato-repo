import { useEffect, useRef, useState } from 'react';

export const PTR_HAMMER_SIZE = 28;
export const PTR_REFRESH_BAND_PX = 52;
const PULL_THRESHOLD_PX = 64;
const MAX_PULL_PX = 96;

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
  const [bandHeight, setBandHeight] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
      setBandHeight(0);
      setIsRefreshing(false);
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
      pullRef.current = 0;
      setPull(0);
      setBandHeight(0);
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
        setBandHeight(0);
        return;
      }

      const next = Math.min(delta * 0.45, MAX_PULL_PX);
      pullRef.current = next;
      setPull(next);
      setBandHeight(next);
      if (next > 0) e.preventDefault();
    };

    const finishPull = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const releasePull = pullRef.current;
      const shouldRefresh = releasePull >= PULL_THRESHOLD_PX;
      pullRef.current = 0;
      setPull(0);
      if (!shouldRefresh || refreshingRef.current) {
        setBandHeight(0);
        return;
      }

      refreshingRef.current = true;
      setIsRefreshing(true);
      setRefreshing(true);
      setBandHeight(Math.max(releasePull, PTR_REFRESH_BAND_PX));

      void Promise.resolve(onRefresh()).finally(() => {
        refreshingRef.current = false;
        setIsRefreshing(false);
        setRefreshing(false);
        setBandHeight(0);
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
    bandHeight,
    isRefreshing,
    pullThreshold: PULL_THRESHOLD_PX,
  };
}
