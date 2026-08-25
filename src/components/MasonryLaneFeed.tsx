import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Shortest-column masonry for the home feed.
 * Each card mounts a ResizeObserver; fine for typical catalogs.
 * Past ~800–1000 visible cards, prefer virtualizing past shows or server search.
 */
export type MasonryLaneItem = { id: string; children: ReactNode };

type MasonryLaneFeedProps = {
  items: MasonryLaneItem[];
  /** Desired minimum width per lane; actual count = floor((container + gap) / (min + gap)). */
  columnMinWidthPx?: number;
  /** Max width per lane so cards do not stretch on wide screens when few columns fit. */
  columnMaxWidthPx?: number;
  gapPx?: number;
  /** Fallback height per item before first measure (px). */
  defaultItemHeightPx?: number;
  className?: string;
};

function distributeToLanes(
  orderedIds: string[],
  laneCount: number,
  heights: ReadonlyMap<string, number>,
  gapPx: number,
  defaultHeightPx: number,
): string[][] {
  const n = Math.max(1, laneCount);
  const lanes: string[][] = Array.from({ length: n }, () => []);
  const laneBottom = Array(n).fill(0);

  for (const id of orderedIds) {
    let best = 0;
    for (let i = 1; i < n; i++) {
      if (laneBottom[i] < laneBottom[best]) best = i;
    }
    lanes[best].push(id);
    const h = heights.get(id) ?? defaultHeightPx;
    const gap = lanes[best].length > 1 ? gapPx : 0;
    laneBottom[best] += gap + h;
  }
  return lanes;
}

const HEIGHT_EPSILON_PX = 2;

/**
 * Packs children into vertical lanes using a shortest-column heuristic so uneven
 * card heights do not leave large empty row slabs.
 * Items are taken in source order; each step picks the shortest lane.
 * Height updates alone do not reshuffle (avoids mid-scroll column jumping).
 */
function ItemMeasure({
  id,
  onHeight,
  children,
}: {
  id: string;
  onHeight: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lastReportedRef = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const report = () => {
      const h = el.getBoundingClientRect().height;
      if (!Number.isFinite(h) || h <= 0) return;
      const rounded = Math.round(h * 4) / 4;
      if (Math.abs(rounded - lastReportedRef.current) < HEIGHT_EPSILON_PX) return;
      lastReportedRef.current = rounded;
      onHeight(id, rounded);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        report();
      });
    };

    report();
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [id, onHeight]);

  return (
    <div ref={ref} className="min-w-0 w-full">
      {children}
    </div>
  );
}

export default function MasonryLaneFeed({
  items,
  columnMinWidthPx = 220,
  columnMaxWidthPx = 448,
  gapPx = 24,
  defaultItemHeightPx = 420,
  className = '',
}: MasonryLaneFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laneCount, setLaneCount] = useState(1);
  const [layoutGapPx, setLayoutGapPx] = useState(gapPx);
  const heightsRef = useRef<Map<string, number>>(new Map());
  const [lanes, setLanes] = useState<string[][]>([]);

  const orderedIds = useMemo(() => items.map((i) => i.id), [items]);

  useLayoutEffect(() => {
    const allowed = new Set(orderedIds);
    for (const k of heightsRef.current.keys()) {
      if (!allowed.has(k)) heightsRef.current.delete(k);
    }
  }, [orderedIds]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const laneRafRef = { current: null as number | null };
    const mq = window.matchMedia('(max-width: 639px)');

    const updateLanes = () => {
      const w = root.clientWidth;
      // Mobile only: shrink the floor so two cards fit; desktop keeps props as-is.
      const mobile = mq.matches;
      const minW = mobile ? Math.min(columnMinWidthPx, 140) : columnMinWidthPx;
      const gap = mobile ? Math.min(gapPx, 12) : gapPx;
      const next = Math.max(1, Math.floor((w + gap) / (minW + gap)));
      setLayoutGapPx((prev) => (prev !== gap ? gap : prev));
      setLaneCount((prev) => (prev !== next ? next : prev));
    };

    const scheduleLaneUpdate = () => {
      if (laneRafRef.current !== null) return;
      laneRafRef.current = requestAnimationFrame(() => {
        laneRafRef.current = null;
        updateLanes();
      });
    };

    updateLanes();
    const ro = new ResizeObserver(scheduleLaneUpdate);
    ro.observe(root);
    mq.addEventListener('change', scheduleLaneUpdate);
    return () => {
      ro.disconnect();
      mq.removeEventListener('change', scheduleLaneUpdate);
      if (laneRafRef.current !== null) {
        cancelAnimationFrame(laneRafRef.current);
        laneRafRef.current = null;
      }
    };
  }, [columnMinWidthPx, gapPx]);

  // Redistribute whenever the item list or column count changes so paging keeps
  // chronological packing. Do not reshuffle on height-only updates.
  useLayoutEffect(() => {
    if (orderedIds.length === 0) {
      setLanes([]);
      return;
    }
    const n = Math.min(Math.max(1, laneCount), orderedIds.length);
    setLanes(
      distributeToLanes(
        orderedIds,
        n,
        heightsRef.current,
        layoutGapPx,
        defaultItemHeightPx,
      ),
    );
  }, [orderedIds, laneCount, layoutGapPx, defaultItemHeightPx]);

  const onHeight = useCallback((id: string, height: number) => {
    const prev = heightsRef.current.get(id);
    if (prev !== undefined && Math.abs(prev - height) < HEIGHT_EPSILON_PX) return;
    heightsRef.current.set(id, height);
  }, []);

  const idToChild = useMemo(() => new Map(items.map((i) => [i.id, i.children])), [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`flex w-full min-w-0 flex-row items-start justify-center ${className}`}
      style={{ gap: layoutGapPx }}
    >
      {lanes
        .filter((laneIds) => laneIds.length > 0)
        .map((laneIds, colIndex) => (
          <div
            key={`masonry-col-${colIndex}`}
            className="flex min-w-0 flex-1 flex-col"
            style={{
              gap: layoutGapPx,
              maxWidth: columnMaxWidthPx > 0 ? `${columnMaxWidthPx}px` : undefined,
            }}
          >
            {laneIds.map((id) => (
              <ItemMeasure key={id} id={id} onHeight={onHeight}>
                {idToChild.get(id)}
              </ItemMeasure>
            ))}
          </div>
        ))}
    </div>
  );
}
