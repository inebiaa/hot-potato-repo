import { useEffect, useState } from 'react';

function readDesktopLikePointer(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * True when the primary input is mouse/trackpad–like (fine pointer + hover).
 * Narrow browser widths alone must not switch to phone-only chrome (bottom tab bar).
 */
export function useDesktopLikePointer(): boolean {
  const [value, setValue] = useState(readDesktopLikePointer);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const onChange = () => setValue(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return value;
}
