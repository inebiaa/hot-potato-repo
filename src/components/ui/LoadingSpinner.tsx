import { cn } from '../../lib/utils';
import { HammerSpin } from './HammerSpin';

/** Shared hammer loader size for page spinners and pull-to-refresh. */
export const APP_LOADER_SIZE = 28;

type LoadingSpinnerProps = {
  className?: string;
  size?: number;
  /** Continuous spin loop. Default true (page loaders). PTR pull uses false + rotation. */
  animate?: boolean;
  /** Manual rotation in degrees when animate is false. */
  rotation?: number;
  /** Screen-reader label. Pass false to hide from assistive tech (PTR pull phase). */
  label?: string | false;
};

/** Hammer loader: page bodies, modals, and pull-to-refresh (same asset everywhere). */
export default function LoadingSpinner({
  className = 'text-muted-foreground',
  size = APP_LOADER_SIZE,
  animate = true,
  rotation = 0,
  label = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <span
      className={cn('inline-flex', className)}
      {...(label === false
        ? { 'aria-hidden': true }
        : { role: 'status' as const, 'aria-label': label })}
    >
      <HammerSpin size={size} animate={animate} rotation={rotation} />
    </span>
  );
}
