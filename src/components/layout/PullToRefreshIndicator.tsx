import { Hammer } from 'lucide-react';
import { LoadingSpinner } from '../ui';

type PullToRefreshIndicatorProps = {
  pull: number;
  refreshing: boolean;
  pullThreshold: number;
};

export default function PullToRefreshIndicator({
  pull,
  refreshing,
  pullThreshold,
}: PullToRefreshIndicatorProps) {
  const visible = refreshing || pull > 4;
  const height = refreshing ? 40 : pull;
  const progress = Math.min(pull / pullThreshold, 1);

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none flex items-center justify-center overflow-hidden text-muted-foreground"
      style={{
        height,
        opacity: visible ? Math.max(0.35, progress) : 0,
        transition: refreshing
          ? 'height 0.15s ease-out, opacity 0.15s ease-out'
          : pull > 0
            ? 'none'
            : 'height 0.2s ease-out, opacity 0.2s ease-out',
      }}
    >
      {refreshing ? (
        <LoadingSpinner size={24} />
      ) : (
        <Hammer
          size={24}
          strokeWidth={2}
          aria-hidden
          style={{ transform: `rotate(${progress * 360}deg)` }}
        />
      )}
    </div>
  );
}
