import type { RefObject } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { splitTagPillLabel } from '../lib/commentTagParsing';
import { splitTagLabelByWidth } from '../lib/splitTagLabelByWidth';

const tagPillSplitContainerBase =
  'inline-flex max-w-full min-w-0 flex-wrap items-center gap-y-0.5 text-left';

/** Outer wrapper when each text chunk is its own mini-pill (`segmentColors` on TagPillSplitLabel). */
export const tagPillSplitSegmentGroupClass = `${tagPillSplitContainerBase} gap-1`;

/** Text-only tag pills (chunks spaced with gap-x-0.5) — use when chunks sit inside a parent that already supplies one pill shell. */
export const tagPillSplitContainerClass = `${tagPillSplitContainerBase} gap-x-0.5`;

/**
 * Icon (or leading control) + `TagPillSplitLabel` on one horizontal row. Uses `flex-nowrap`
 * so the icon never wraps above/below the label; the label still wraps/splits segments internally.
 */
export const tagPillSplitContainerWithIconClass =
  'inline-flex max-w-full min-w-0 flex-nowrap items-center gap-x-1 text-left';

export type TagPillSegmentColors = {
  backgroundColor: string;
  color: string;
};

const FONT_PROBE_CLASS =
  'sr-only text-xs px-2 py-1 max-sm:px-2.5 max-sm:py-2 whitespace-nowrap font-normal tabular-nums';

/** Nearest wrapping flex row width, or a sensible fallback (px). */
function findTagRowBudgetWidth(wrapEl: HTMLElement): number {
  let p: HTMLElement | null = wrapEl.parentElement;
  for (let i = 0; i < 10 && p; i++) {
    const style = getComputedStyle(p);
    const isFlexWrap =
      (style.display === 'flex' || style.display === 'inline-flex') &&
      (style.flexWrap === 'wrap' || style.flexWrap === 'wrap-reverse');
    if (isFlexWrap) {
      return Math.max(1, p.getBoundingClientRect().width);
    }
    p = p.parentElement;
  }
  const fb = wrapEl.parentElement?.getBoundingClientRect().width ?? wrapEl.getBoundingClientRect().width;
  return Math.max(1, fb);
}

type TagPillSplitLabelProps = {
  text: string;
  chunkClassName?: string;
  /**
   * When set, each chunk is its own filled rounded pill so long tags read as separate boxes
   * instead of one large rectangle.
   */
  segmentColors?: TagPillSegmentColors;
  /**
   * When true, splits follow the width of the wrapping tag row (ResizeObserver), not a
   * fixed character budget. Intended for event cards and other width-constrained layouts.
   */
  fitToContainer?: boolean;
  /**
   * When set, line-break budget uses this element’s width (ResizeObserver). Use when the
   * nearest flex-wrap ancestor would be the pill itself (e.g. TagInput chips): put a
   * `flex-1 min-w-0` wrapper ref here and pass the same ref.
   */
  layoutWidthRef?: RefObject<HTMLElement | null>;
};

export default function TagPillSplitLabel({
  text,
  chunkClassName = '',
  segmentColors,
  fitToContainer = false,
  layoutWidthRef,
}: TagPillSplitLabelProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const fontProbeRef = useRef<HTMLSpanElement>(null);
  const useLayoutWidth = Boolean(layoutWidthRef);
  const useWidthSplit = fitToContainer || useLayoutWidth;
  const [chunks, setChunks] = useState<string[]>(() => splitTagPillLabel(text));

  const segmentShell =
    'inline-flex whitespace-nowrap rounded-md px-2 py-1 max-sm:px-2.5 max-sm:py-2 text-xs';

  useLayoutEffect(() => {
    if (!useWidthSplit) {
      setChunks(splitTagPillLabel(text));
      return;
    }

    const wrap = wrapRef.current;
    if (!wrap) return;

    const compute = () => {
      let rowWidth: number;
      if (layoutWidthRef?.current) {
        rowWidth = Math.max(1, layoutWidthRef.current.getBoundingClientRect().width);
      } else {
        rowWidth = findTagRowBudgetWidth(wrap);
      }
      if (rowWidth < 32) {
        setChunks(splitTagPillLabel(text));
        return;
      }
      const font = fontProbeRef.current
        ? getComputedStyle(fontProbeRef.current).font
        : '400 12px ui-sans-serif, system-ui, sans-serif';
      setChunks(splitTagLabelByWidth(text, rowWidth, font));
    };

    compute();
    let observed: Element | null = layoutWidthRef?.current ?? null;
    if (!observed) {
      const row = wrap.parentElement;
      for (let p: HTMLElement | null = wrap.parentElement, i = 0; p && i < 10; p = p.parentElement, i++) {
        const style = getComputedStyle(p);
        const isFlexWrap =
          (style.display === 'flex' || style.display === 'inline-flex') &&
          (style.flexWrap === 'wrap' || style.flexWrap === 'wrap-reverse');
        if (isFlexWrap) {
          observed = p;
          break;
        }
      }
      if (!observed && row) observed = row;
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(compute);
    });
    if (observed) ro.observe(observed);
    else ro.observe(wrap);

    return () => ro.disconnect();
  }, [text, useWidthSplit, layoutWidthRef]);

  const inner = chunks.map((chunk, j) =>
    segmentColors ? (
      <span
        key={j}
        style={{
          backgroundColor: segmentColors.backgroundColor,
          color: segmentColors.color,
        }}
        className={[segmentShell, chunkClassName].filter(Boolean).join(' ')}
      >
        {chunk}
      </span>
    ) : (
      <span key={j} className={['inline-flex whitespace-nowrap', chunkClassName].filter(Boolean).join(' ')}>
        {chunk}
      </span>
    )
  );

  if (!useWidthSplit) {
    return <>{inner}</>;
  }

  /** `w-full` only when filling a measured flex slot (search / tag input); with a sibling icon, it steals the row and wraps the icon alone. */
  const wrapLayoutClass = useLayoutWidth
    ? 'flex w-full min-w-0 max-w-full flex-wrap items-center gap-1'
    : 'inline-flex min-w-0 max-w-full flex-wrap items-center gap-1';

  return (
    <span ref={wrapRef} className={wrapLayoutClass}>
      <span
        ref={fontProbeRef}
        aria-hidden
        className={FONT_PROBE_CLASS}
        style={
          segmentColors
            ? { backgroundColor: segmentColors.backgroundColor, color: segmentColors.color }
            : undefined
        }
      >
        Mg
      </span>
      {inner}
    </span>
  );
}
