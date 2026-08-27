import { HammerSpin } from '../ui/HammerSpin';

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
  const bandHeight = refreshing ? 40 : pull;
  const progress = Math.min(pull / pullThreshold, 1);

  return (
    <div className="pointer-events-none sticky top-0 z-10 h-0 overflow-visible">
      <div
        aria-hidden={!visible}
        className="flex items-end justify-center overflow-hidden bg-background text-muted-foreground"
        style={{
          height: bandHeight,
          opacity: visible ? Math.max(0.35, refreshing ? 1 : progress) : 0,
          transition: refreshing
            ? 'height 0.15s ease-out, opacity 0.15s ease-out'
            : pull > 0
              ? 'none'
              : 'height 0.2s ease-out, opacity 0.2s ease-out',
        }}
      >
        <HammerSpin
          size={24}
          animate={refreshing}
          rotation={progress * 360}
        />
      </div>
    </div>
  );
}
