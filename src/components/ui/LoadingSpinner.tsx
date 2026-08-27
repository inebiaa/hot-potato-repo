import { cn } from '../../lib/utils';
import { HammerSpin } from './HammerSpin';

type LoadingSpinnerProps = {
  className?: string;
  size?: number;
};

/** Continuous spin around the handle grip. */
export default function LoadingSpinner({
  className = 'text-muted-foreground',
  size = 28,
}: LoadingSpinnerProps) {
  return (
    <span role="status" aria-label="Loading" className={cn('inline-flex', className)}>
      <HammerSpin size={size} animate />
    </span>
  );
}
