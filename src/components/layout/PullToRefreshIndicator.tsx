import { HammerSpin } from '../ui/HammerSpin';
import { PTR_HAMMER_SIZE } from '../../hooks/usePullToRefresh';

type PullToRefreshIndicatorProps = {
  offset: number;
  isRefreshing: boolean;
  pullProgress: number;
};

/** Hammer in the overscroll gap above content. No band chrome: same loader as the rest of the app. */
export default function PullToRefreshIndicator({
  offset,
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) {
  if (offset <= 0) return null;

  const reveal = Math.min(offset / 36, 1);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center overflow-visible text-muted-foreground"
      style={{ height: offset }}
      aria-hidden={!isRefreshing}
      {...(isRefreshing ? { role: 'status' as const, 'aria-label': 'Refreshing' } : {})}
    >
      <div
        className="flex items-center justify-center overflow-visible"
        style={{
          opacity: isRefreshing ? 1 : reveal,
          transform: isRefreshing ? undefined : `scale(${0.85 + pullProgress * 0.15})`,
        }}
      >
        <HammerSpin
          size={PTR_HAMMER_SIZE}
          animate={isRefreshing}
          rotation={pullProgress * 360}
        />
      </div>
    </div>
  );
}
