import { HammerSpin } from '../ui/HammerSpin';
import { PTR_HAMMER_SIZE } from '../../hooks/usePullToRefresh';

type PullToRefreshIndicatorProps = {
  bandHeight: number;
  isRefreshing: boolean;
  pullProgress: number;
};

export default function PullToRefreshIndicator({
  bandHeight,
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) {
  if (bandHeight <= 0) return null;

  return (
    <div
      className="pointer-events-none sticky top-0 z-10 flex items-center justify-center overflow-visible bg-background text-muted-foreground"
      style={{
        height: bandHeight,
        transition: isRefreshing
          ? 'height 0.15s ease-out'
          : bandHeight > 0
            ? 'none'
            : 'height 0.2s ease-out',
      }}
    >
      <HammerSpin
        size={PTR_HAMMER_SIZE}
        animate={isRefreshing}
        rotation={pullProgress * 360}
      />
    </div>
  );
}
