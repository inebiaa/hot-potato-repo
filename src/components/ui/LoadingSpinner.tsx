import { Hammer } from 'lucide-react';
import { cn } from '../../lib/utils';

type LoadingSpinnerProps = {
  className?: string;
  size?: number;
};

/** Continuous spin around the handle grip (Lucide hammer pivot ~62% / 88%). */
export default function LoadingSpinner({
  className = 'text-muted-foreground',
  size = 28,
}: LoadingSpinnerProps) {
  const pivotX = size * 0.62;
  const pivotY = size * 0.88;

  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <span
        className="loading-hammer-spin block"
        style={{
          width: size,
          height: size,
          transformOrigin: `${pivotX}px ${pivotY}px`,
        }}
      >
        <Hammer size={size} strokeWidth={2} aria-hidden className="block" />
      </span>
    </span>
  );
}
