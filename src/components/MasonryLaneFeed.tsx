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
 * Packs children into vertical lanes. Lane assignments stay stable when new items
 * are appended or heights update — only a column-count change or a non-append
 * list change reflows existing cards (avoids scroll jump / empty flashes).
 */
const HEIGHT_EPSILON_PX = 2;

function isPrefixAppend(prev: string[], next: string[]): boolean {
  if (next.length < prev.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
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
  const heightsRef = useRef<Map<string, number>>(new Map());
  const assignmentsRef = useRef<Map<string, number>>(new Map());
  const prevIdsRef = useRef<string[]>([]);
  const prevLaneCountRef = useRef(1);
  const [lanes, setLanes] = useState<string[][]>([]);

  const orderedIds = useMemo(() => items.map((i) => i.id), [items]);

  const rebuildLanesFromAssignments = useCallback((ids: string[], n: number) => {
    const nextLanes: string[][] = Array.from({ length: n }, () => []);
    for (const id of ids) {
      const lane = Math.min(Math.max(0, assignmentsRef.current.get(id) ?? 0), n - 1);
      assignmentsRef.current.set(id, lane);
      nextLanes[lane].push(id);
    }
    return nextLanes;
  }, []);

  const fullDistribute = useCallback(
    (ids: string[], n: number) => {
      const nextLanes: string[][] = Array.from({ length: n }, () => []);
      const bottoms = Array(n).fill(0);
      const nextAssign = new Map<string, number>();
      for (const id of ids) {
        let best = 0;
        for (let i = 1; i < n; i++) {
          if (bottoms[i] < bottoms[best]) best = i;
        }
        nextLanes[best].push(id);
        nextAssign.set(id, best);
        const h = heightsRef.current.get(id) ?? defaultItemHeightPx;
        const gap = nextLanes[best].length > 1 ? gapPx : 0;
        bottoms[best] += gap + h;
      }
      assignmentsRef.current = nextAssign;
      return nextLanes;
    },
    [defaultItemHeightPx, gapPx],
  );

  const appendNewIds = useCallback(
    (prevIds: string[], allIds: string[], n: number) => {
      const nextLanes = rebuildLanesFromAssignments(prevIds, n);
      const bottoms = nextLanes.map((laneIds) => {
        let total = 0;
        laneIds.forEach((id, i) => {
          const h = heightsRef.current.get(id) ?? defaultItemHeightPx;
          total += h + (i > 0 ? gapPx : 0);
        });
        return total;
      });
      for (const id of allIds.slice(prevIds.length)) {
        let best = 0;
        for (let i = 1; i < n; i++) {
          if (bottoms[i] < bottoms[best]) best = i;
        }
        assignmentsRef.current.set(id, best);
        nextLanes[best].push(id);
        const h = heightsRef.current.get(id) ?? defaultItemHeightPx;
        const gap = nextLanes[best].length > 1 ? gapPx : 0;
        bottoms[best] += gap + h;
      }
      return nextLanes;
    },
    [defaultItemHeightPx, gapPx, rebuildLanesFromAssignments],
  );

  useLayoutEffect(() => {
    const allowed = new Set(orderedIds);
    for (const k of heightsRef.current.keys()) {
      if (!allowed.has(k)) heightsRef.current.delete(k);
    }
    for (const k of assignmentsRef.current.keys()) {
      if (!allowed.has(k)) assignmentsRef.current.delete(k);
    }
  }, [orderedIds]);

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

  useLayoutEffect(() => {
    if (orderedIds.length === 0) {
      prevIdsRef.current = [];
      assignmentsRef.current = new Map();
      prevLaneCountRef.current = laneCount;
      setLanes([]);
      return;
    }

    const n = Math.min(Math.max(1, laneCount), orderedIds.length);
    const prevIds = prevIdsRef.current;
    const laneCountChanged = prevLaneCountRef.current !== n;
    const canAppend = !laneCountChanged && isPrefixAppend(prevIds, orderedIds);

    const nextLanes = canAppend && prevIds.length > 0
      ? appendNewIds(prevIds, orderedIds, n)
      : fullDistribute(orderedIds, n);

    prevIdsRef.current = orderedIds;
    prevLaneCountRef.current = n;
    setLanes(nextLanes);
  }, [orderedIds, laneCount, appendNewIds, fullDistribute]);

  // Heights update packing math for future appends only — do not move existing cards.
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
