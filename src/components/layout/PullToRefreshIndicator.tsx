import LoadingSpinner from '../ui/LoadingSpinner';
import { HammerSpin } from '../ui/HammerSpin';
import { PTR_HAMMER_SIZE } from '../../hooks/usePullToRefresh';

type PullToRefreshIndicatorProps = {
  offset: number;
  isRefreshing: boolean;
  pullProgress: number;
};

/**
 * In-flow slot at the top of page content (scrolls away with the feed).
 * Sits in padding space only; never pinned over the viewport.
 */
export default function PullToRefreshIndicator({
  offset,
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) {
  if (offset <= 0) return null;

  const reveal = Math.min(offset / 36, 1);

  return (
    <div
      className="pointer-events-none flex items-center justify-center overflow-visible text-muted-foreground"
      style={{
        height: offset,
        marginTop: -offset,
      }}
      {...(isRefreshing ? { role: 'status' as const, 'aria-label': 'Refreshing' } : { 'aria-hidden': true })}
    >
      <div
        className="flex items-center justify-center overflow-visible"
        style={{
          opacity: isRefreshing ? 1 : reveal,
          transform: isRefreshing ? undefined : `scale(${0.85 + pullProgress * 0.15})`,
        }}
      >
        {isRefreshing ? (
          <LoadingSpinner />
        ) : (
          <HammerSpin size={PTR_HAMMER_SIZE} rotation={pullProgress * 360} />
        )}
      </div>
    </div>
  );
}
