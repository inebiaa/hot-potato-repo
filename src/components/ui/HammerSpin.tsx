import { Hammer } from 'lucide-react';
import { cn } from '../../lib/utils';

type HammerSpinProps = {
  size?: number;
  className?: string;
  /** CSS spin loop (loader). */
  animate?: boolean;
  /** Manual rotation in degrees (pull progress). Ignored when animate is true. */
  rotation?: number;
};

/** Hammer icon with spin around the handle grip (Lucide pivot ~62% / 88%). */
export function HammerSpin({
  size = 28,
  className,
  animate = false,
  rotation = 0,
}: HammerSpinProps) {
  const pivotX = size * 0.62;
  const pivotY = size * 0.88;

  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn('block', animate && 'loading-hammer-spin')}
        style={{
          width: size,
          height: size,
          transformOrigin: `${pivotX}px ${pivotY}px`,
          transform: animate ? undefined : `rotate(${rotation}deg)`,
        }}
      >
        <Hammer size={size} strokeWidth={2} aria-hidden className="block" />
      </span>
    </span>
  );
}
