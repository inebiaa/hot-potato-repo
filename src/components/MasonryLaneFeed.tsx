import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const report = () => {
      const h = el.getBoundingClientRect().height;
      if (Number.isFinite(h) && h > 0) onHeight(id, Math.round(h * 4) / 4);
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, onHeight]);

  return (
    <div ref={ref} className="min-w-0 w-full">
      {children}
    </div>
  );
}

/**
 * Packs children into vertical lanes using a shortest-column heuristic so uneven
 * card heights do not leave large empty “row slabs” (unlike row-major CSS Grid).
 * Items are still taken in source order; each step picks the lane with the least
 * accumulated height so the wall grows in a left-to-right waterfall.
 */
/** Ignore sub-pixel / tiny layout noise so we do not reflow the whole masonry wall. */
const HEIGHT_EPSILON_PX = 2;

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
  const [measureTick, setMeasureTick] = useState(0);
  const heightsRef = useRef<Map<string, number>>(new Map());
  const measureFlushRafRef = useRef<number | null>(null);

  const idsFingerprint = useMemo(
    () => items.map((i) => i.id).join('\u0001'),
    [items],
  );
  const orderedIds = useMemo(
    () => (idsFingerprint === '' ? [] : idsFingerprint.split('\u0001')),
    [idsFingerprint],
  );

  useLayoutEffect(() => {
    const allowed = new Set(orderedIds);
    const m = heightsRef.current;
    for (const k of m.keys()) {
      if (!allowed.has(k)) m.delete(k);
    }
  }, [idsFingerprint, orderedIds]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const laneRafRef = { current: null as number | null };

    const updateLanes = () => {
      const w = root.clientWidth;
      const next = Math.max(1, Math.floor((w + gapPx) / (columnMinWidthPx + gapPx)));
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
    return () => {
      ro.disconnect();
      if (laneRafRef.current !== null) {
        cancelAnimationFrame(laneRafRef.current);
        laneRafRef.current = null;
      }
    };
  }, [columnMinWidthPx, gapPx]);

  useLayoutEffect(
    () => () => {
      if (measureFlushRafRef.current !== null) {
        cancelAnimationFrame(measureFlushRafRef.current);
        measureFlushRafRef.current = null;
      }
    },
    [],
  );

  const scheduleMeasureFlush = useCallback(() => {
    if (measureFlushRafRef.current !== null) return;
    measureFlushRafRef.current = requestAnimationFrame(() => {
      measureFlushRafRef.current = null;
      setMeasureTick((t) => t + 1);
    });
  }, []);

  const onHeight = useCallback(
    (id: string, height: number) => {
      const prev = heightsRef.current.get(id);
      if (prev !== undefined && Math.abs(prev - height) < HEIGHT_EPSILON_PX) return;
      heightsRef.current.set(id, height);
      scheduleMeasureFlush();
    },
    [scheduleMeasureFlush],
  );

  const effectiveLaneCount = Math.min(
    Math.max(1, laneCount),
    Math.max(1, orderedIds.length),
  );

  const lanes = useMemo(() => {
    if (orderedIds.length === 0) return [];
    return distributeToLanes(
      orderedIds,
      effectiveLaneCount,
      heightsRef.current,
      gapPx,
      defaultItemHeightPx,
    );
  }, [
    orderedIds,
    effectiveLaneCount,
    gapPx,
    defaultItemHeightPx,
    measureTick,
    idsFingerprint,
  ]);

  const idToChild = useMemo(() => new Map(items.map((i) => [i.id, i.children])), [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`flex w-full min-w-0 flex-row items-start justify-center ${className}`}
      style={{ gap: gapPx }}
    >
      {lanes
        .filter((laneIds) => laneIds.length > 0)
        .map((laneIds, colIndex) => (
        <div
          key={`masonry-col-${colIndex}`}
          className="flex min-w-0 flex-1 flex-col"
          style={{
            gap: gapPx,
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

