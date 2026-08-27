import LoadingSpinner from '../ui/LoadingSpinner';

type PullToRefreshIndicatorProps = {
  isRefreshing: boolean;
  pullProgress: number;
};

/** Pull-to-refresh uses the same LoadingSpinner as the rest of the app. */
export default function PullToRefreshIndicator({
  isRefreshing,
  pullProgress,
}: PullToRefreshIndicatorProps) {
  const reveal = isRefreshing ? 1 : Math.min(pullProgress * 1.4, 1);

  return (
    <div
      className="flex items-center justify-center overflow-visible"
      style={{ opacity: reveal }}
    >
      <LoadingSpinner
        animate={isRefreshing}
        rotation={pullProgress * 360}
        label={isRefreshing ? 'Refreshing' : false}
      />
    </div>
  );
}
