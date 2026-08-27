import { HammerSpin } from '../ui/HammerSpin';
import { PTR_HAMMER_SIZE } from '../../hooks/usePullToRefresh';

type PullToRefreshIndicatorProps = {
  isRefreshing: boolean;
  pullProgress: number;
};

/** Compact hammer: same motion as app loader, smaller footprint for PTR only. */
export default function PullToRefreshIndicator({
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) {
  const reveal = isRefreshing ? 1 : Math.min(pullProgress * 1.4, 1);

  return (
    <div
      className="flex items-center justify-center overflow-visible text-muted-foreground"
      style={{ opacity: reveal }}
      {...(isRefreshing ? { role: 'status' as const, 'aria-label': 'Refreshing' } : { 'aria-hidden': true })}
    >
      <HammerSpin
        size={PTR_HAMMER_SIZE}
        animate={isRefreshing}
        rotation={isRefreshing ? 0 : pullProgress * 360}
      />
    </div>
  );
}
