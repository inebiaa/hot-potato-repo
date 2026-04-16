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
export default function MasonryLaneFeed({
  items,
  columnMinWidthPx = 220,
  gapPx = 24,
  defaultItemHeightPx = 420,
  className = '',
}: MasonryLaneFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laneCount, setLaneCount] = useState(1);
  const [measureTick, setMeasureTick] = useState(0);
  const heightsRef = useRef<Map<string, number>>(new Map());

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

    const updateLanes = () => {
      const w = root.clientWidth;
      const next = Math.max(1, Math.floor((w + gapPx) / (columnMinWidthPx + gapPx)));
      setLaneCount((prev) => (prev !== next ? next : prev));
    };

    updateLanes();
    const ro = new ResizeObserver(updateLanes);
    ro.observe(root);
    return () => ro.disconnect();
  }, [columnMinWidthPx, gapPx]);

  const bumpRef = useRef<() => void>(() => {});
  bumpRef.current = () => setMeasureTick((t) => t + 1);

  const onHeight = useCallback((id: string, height: number) => {
    const prev = heightsRef.current.get(id);
    if (prev !== undefined && Math.abs(prev - height) < 1) return;
    heightsRef.current.set(id, height);
    bumpRef.current();
  }, []);

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
      className={`flex w-full min-w-0 flex-row items-start ${className}`}
      style={{ gap: gapPx }}
    >
      {lanes
        .filter((laneIds) => laneIds.length > 0)
        .map((laneIds) => (
        <div
          key={laneIds.join('\u0001')}
          className="flex min-w-0 flex-1 flex-col"
          style={{ gap: gapPx }}
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

