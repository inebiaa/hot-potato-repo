import { useEffect, useRef } from 'react';
import { getAppMainScrollElement } from '../lib/appMainScroll';

/**
 * Scroll lock for modals/overlays. Locks the app `<main>` scroll container when present,
 * plus body fixed positioning to reduce iOS background scroll bleed.
 */
export function useBodyScrollLock(locked: boolean) {
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (!locked) return;

    const scrollContainer = getAppMainScrollElement();
    const prevContainerOverflow = scrollContainer?.style.overflow ?? '';
    const prevContainerTouchAction = scrollContainer?.style.touchAction ?? '';
    const containerScrollTop = scrollContainer?.scrollTop ?? 0;

    if (scrollContainer) {
      scrollContainer.style.overflow = 'hidden';
      scrollContainer.style.touchAction = 'none';
    }

    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;
    scrollYRef.current = scrollContainer?.scrollTop ?? window.scrollY ?? 0;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYRef.current}px`;
    document.body.style.width = '100%';

    return () => {
      if (scrollContainer) {
        scrollContainer.style.overflow = prevContainerOverflow;
        scrollContainer.style.touchAction = prevContainerTouchAction;
        scrollContainer.scrollTop = containerScrollTop;
      }
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      if (scrollContainer) {
        scrollContainer.scrollTop = containerScrollTop;
      } else {
        window.scrollTo(0, scrollYRef.current);
      }
    };
  }, [locked]);
}
