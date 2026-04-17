import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { Star, SlidersHorizontal } from 'lucide-react';
import type { Event, Rating } from '../lib/supabase';
import { useTagDisplayMap } from '../contexts/TagDisplayContext';
import { tagResolutionKey, type TagResolutionMap } from '../lib/tagDisplayResolution';
import { formatEventDateDisplay } from '../lib/formatEventDate';
import { getSeasonFromDate } from '../lib/season';
import { shortenEventNameUsingFooterTags } from '../lib/collectionTagDisplay';

/** One row from the profile “My reviews” list (list layout). */
export interface ProfileReviewPlaylistRow {
  rating: Rating;
  event: Event;
  eventName: string;
  averageRating: number;
  ratingCount: number;
}

const VISIBILITY_KEY = 'profile_reviews_list_column_visibility';

export type PlaylistOptionalColumnId =
  | 'season'
  | 'city'
  | 'venue'
  | 'producers'
  | 'designers'
  | 'you'
  | 'avg'
  | 'date';

const OPTIONAL_COLUMN_META: { id: PlaylistOptionalColumnId; menuLabel: string }[] = [
  { id: 'season', menuLabel: 'Season in details' },
  { id: 'city', menuLabel: 'City in details' },
  { id: 'venue', menuLabel: 'Venue in details' },
  { id: 'producers', menuLabel: 'Producers in details' },
  { id: 'designers', menuLabel: 'Designers in details' },
  { id: 'you', menuLabel: 'Your rating' },
  { id: 'avg', menuLabel: 'Community average' },
  { id: 'date', menuLabel: 'Date after Avg' },
];

/** #, You, and Avg share one fixed width; not resizable. */
const NARROW_COL = '4.5rem';
const NARROW_COL_MOBILE = '2.625rem';

type ColResizeKey = 'title' | 'details' | 'date';

const COL_WIDTH: Record<
  ColResizeKey,
  { storageKey: string; def: number; min: number; max: number; maxVw: number }
> = {
  title: { storageKey: 'profile_reviews_list_w_title', def: 200, min: 100, max: 560, maxVw: 0.45 },
  details: { storageKey: 'profile_reviews_list_w_details', def: 200, min: 80, max: 480, maxVw: 0.4 },
  date: { storageKey: 'profile_reviews_list_w_date', def: 152, min: 96, max: 240, maxVw: 0.2 },
};

function gridTrackPx(px: number): string {
  return `minmax(0,${Math.round(px)}px)`;
}

/** Fills remaining row width so there is no empty strip after the last column. */
function gridFrMinTrack(px: number, minPx: number): string {
  const w = Math.max(minPx, Math.round(px));
  return `minmax(${w}px,1fr)`;
}

/** Keep total grid min under viewport so the list scrolls horizontally instead of breaking layout. */
function mobileColumnBudget(
  viewportW: number,
  col: Record<ColResizeKey, number>,
  visible: Record<PlaylistOptionalColumnId, boolean>,
  showDetailsCol: boolean
): { title: number; details: number; date: number; narrowTrack: string } {
  const margin = 28;
  const avail = Math.max(260, viewportW - margin);
  const narrowCount = 1 + (visible.you ? 1 : 0) + (visible.avg ? 1 : 0);
  const narrowPx = 42 * narrowCount;
  const dataBudget = Math.max(120, avail - narrowPx);

  if (!visible.date) {
    let title = Math.min(col.title, Math.max(72, Math.floor(dataBudget * 0.55)));
    let details = col.details;
    if (showDetailsCol) {
      details = Math.min(col.details, Math.max(56, dataBudget - title));
      title = Math.min(title, Math.max(72, dataBudget - details));
    } else {
      title = Math.min(title, Math.max(72, dataBudget));
    }
    return { title, details, date: col.date, narrowTrack: NARROW_COL_MOBILE };
  }

  let title = Math.min(col.title, Math.floor(dataBudget * 0.4));
  let details = showDetailsCol ? Math.min(col.details, Math.floor(dataBudget * 0.28)) : col.details;
  let date = Math.min(col.date, Math.floor(dataBudget * 0.22));
  if (showDetailsCol) {
    const sum = title + details + date;
    if (sum > dataBudget) {
      const s = dataBudget / sum;
      title = Math.max(56, Math.floor(title * s));
      details = Math.max(48, Math.floor(details * s));
      date = Math.max(52, Math.floor(date * s));
    }
  } else {
    const sum = title + date;
    if (sum > dataBudget) {
      const s = dataBudget / sum;
      title = Math.max(56, Math.floor(title * s));
      date = Math.max(52, Math.floor(date * s));
    }
  }
  return { title, details, date, narrowTrack: NARROW_COL_MOBILE };
}

function readWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n)) return Math.min(max, Math.max(min, n));
  } catch {
    /* ignore */
  }
  return fallback;
}

function loadColWidths(): Record<ColResizeKey, number> {
  const o = {} as Record<ColResizeKey, number>;
  (Object.keys(COL_WIDTH) as ColResizeKey[]).forEach((k) => {
    const c = COL_WIDTH[k];
    o[k] = readWidth(c.storageKey, c.def, c.min, c.max);
  });
  return o;
}

function attachColumnResize(
  e: React.PointerEvent,
  startW: number,
  setWidth: (w: number) => void,
  min: number,
  maxFixed: number,
  maxViewportFrac: number,
  /** Leading-edge grip: drag right narrows the column. */
  invertDelta = false
) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const clampW = (w: number) => {
    const max = Math.min(maxFixed, Math.floor(window.innerWidth * maxViewportFrac));
    return Math.max(min, Math.min(max, w));
  };
  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    setWidth(clampW(invertDelta ? startW - dx : startW + dx));
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
}

const GRIP_TRAILING =
  'absolute right-0 top-0 z-10 flex h-full w-3 -translate-x-px touch-none items-center justify-center cursor-col-resize rounded-sm hover:bg-stone-300/40 active:bg-stone-400/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400';
const GRIP_LEADING =
  'absolute left-0 top-0 z-10 flex h-full w-3 translate-x-px touch-none items-center justify-center cursor-col-resize rounded-sm hover:bg-stone-300/40 active:bg-stone-400/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400';

const HDR = 'text-[10px] font-semibold uppercase tracking-wider text-stone-400';
const CELL_BORDER = 'border-r border-stone-200/80';
const CELL_BORDER_BODY = 'border-r border-stone-100 group-hover:border-stone-200/50';

function defaultVisibility(): Record<PlaylistOptionalColumnId, boolean> {
  return {
    season: true,
    city: true,
    venue: true,
    producers: true,
    designers: true,
    you: true,
    avg: true,
    date: true,
  };
}

function loadVisibility(): Record<PlaylistOptionalColumnId, boolean> {
  const base = defaultVisibility();
  try {
    const raw = window.localStorage.getItem(VISIBILITY_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    (Object.keys(base) as PlaylistOptionalColumnId[]).forEach((k) => {
      if (typeof parsed[k] === 'boolean') base[k] = parsed[k] as boolean;
    });
    return base;
  } catch {
    return base;
  }
}

function displayTagLabel(map: TagResolutionMap | null, tagType: string, raw: string): string {
  return map?.get(tagResolutionKey(tagType, raw))?.display?.trim() || raw;
}

function seasonOnly(event: Event): string {
  const d = event.date?.trim();
  return (event.season && event.season.trim()) || (d ? getSeasonFromDate(d) : '') || '';
}

function cityOnly(event: Event): string {
  return event.city?.trim() || '';
}

function venueLine(event: Event): string {
  const parts: string[] = [];
  if (event.location?.trim()) parts.push(event.location.trim());
  const addr = (event.formatted_address?.trim() || event.address?.trim() || '').replace(/\s+/g, ' ');
  if (addr) parts.push(addr);
  return parts.join(' · ') || '';
}

function producersLine(event: Event, map: TagResolutionMap | null): string {
  const arr = [...new Set((event.producers || []).map((v) => v?.trim()).filter(Boolean) as string[])];
  if (arr.length === 0) return '';
  return arr.map((v) => displayTagLabel(map, 'producer', v)).join(', ');
}

function designersLine(event: Event, map: TagResolutionMap | null): string {
  const arr = [...new Set((event.featured_designers || []).map((v) => v?.trim()).filter(Boolean) as string[])];
  if (arr.length === 0) return '';
  return arr.map((v) => displayTagLabel(map, 'designer', v)).join(', ');
}

function buildDetailsSegment(
  event: Event,
  map: TagResolutionMap | null,
  visible: Record<PlaylistOptionalColumnId, boolean>
): string {
  const parts: string[] = [];
  if (visible.season) {
    const s = seasonOnly(event);
    if (s) parts.push(s);
  }
  if (visible.city) {
    const c = cityOnly(event);
    if (c) parts.push(c);
  }
  if (visible.venue) {
    const v = venueLine(event);
    if (v) parts.push(v);
  }
  if (visible.producers) {
    const p = producersLine(event, map);
    if (p) parts.push(p);
  }
  if (visible.designers) {
    const d = designersLine(event, map);
    if (d) parts.push(d);
  }
  return parts.join(' · ');
}

function ResizeGrip({
  label,
  valueNow,
  valueMin,
  valueMax,
  onPointerDown,
  onNudge,
  edge = 'trailing',
}: {
  label: string;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onNudge: (delta: number) => void;
  edge?: 'leading' | 'trailing';
}) {
  const gripClass = edge === 'leading' ? GRIP_LEADING : GRIP_TRAILING;
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label}`}
      aria-valuenow={Math.round(valueNow)}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      title="Drag or arrow keys to resize"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(e) => {
        const left = edge === 'leading' ? 6 : -6;
        const right = edge === 'leading' ? -6 : 6;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNudge(left);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNudge(right);
        }
      }}
      className={gripClass}
    >
      <span className="h-4 w-px shrink-0 rounded-full bg-stone-400" aria-hidden />
    </div>
  );
}

function PlaylistTitle({
  fullName,
  footerTags,
}: {
  fullName: string;
  footerTags: string[] | null | undefined;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [useAbbr, setUseAbbr] = useState(false);
  const abbreviated = shortenEventNameUsingFooterTags(fullName, footerTags);
  const canAbbreviate = abbreviated !== fullName && abbreviated.length > 0;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = spanRef.current;
    if (!wrap || !el || !canAbbreviate) {
      setUseAbbr(false);
      return;
    }
    const measure = () => {
      const cs = getComputedStyle(el);
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) return;
      ctx.font = font;
      const w = wrap.clientWidth - 4;
      if (w <= 0) return;
      setUseAbbr(ctx.measureText(fullName).width > w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [fullName, abbreviated, canAbbreviate]);

  return (
    <div ref={wrapRef} className="min-w-0 w-full max-w-full px-2 text-left">
      <span
        ref={spanRef}
        className="block truncate text-left text-[15px] font-medium leading-snug tracking-tight text-stone-900"
        title={fullName}
      >
        {useAbbr ? abbreviated : fullName}
      </span>
    </div>
  );
}

interface ProfileReviewsPlaylistProps {
  rows: ProfileReviewPlaylistRow[];
  onOpenEvent?: (
    eventId: string,
    openWithWiggle?: boolean,
    suggestSection?: keyof {
      producers: string[];
      featured_designers: string[];
      models: string[];
      hair_makeup: string[];
      header_tags: string[];
      footer_tags: string[];
    } | 'custom',
    suggestCustomSlug?: string
  ) => void;
}

export default function ProfileReviewsPlaylist({ rows, onOpenEvent }: ProfileReviewsPlaylistProps) {
  const tagDisplayMap = useTagDisplayMap();
  const [visible, setVisible] = useState<Record<PlaylistOptionalColumnId, boolean>>(loadVisibility);
  const [colWidths, setColWidths] = useState<Record<ColResizeKey, number>>(loadColWidths);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showDetailsCol = useMemo(
    () =>
      visible.season || visible.city || visible.venue || visible.producers || visible.designers,
    [visible.season, visible.city, visible.venue, visible.producers, visible.designers]
  );

  const [viewportW, setViewportW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  useEffect(() => {
    const upd = () => setViewportW(window.innerWidth);
    upd();
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', upd);
    return () => {
      window.removeEventListener('resize', upd);
      window.removeEventListener('orientationchange', upd);
    };
  }, []);

  const isNarrow = viewportW < 640;
  const gridColCaps = useMemo(
    () =>
      isNarrow
        ? mobileColumnBudget(viewportW, colWidths, visible, showDetailsCol)
        : {
            title: colWidths.title,
            details: colWidths.details,
            date: colWidths.date,
            narrowTrack: NARROW_COL,
          },
    [isNarrow, viewportW, colWidths, visible, showDetailsCol]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visible));
    } catch {
      /* ignore */
    }
  }, [visible]);

  useEffect(() => {
    (Object.keys(COL_WIDTH) as ColResizeKey[]).forEach((k) => {
      try {
        window.localStorage.setItem(COL_WIDTH[k].storageKey, String(colWidths[k]));
      } catch {
        /* ignore */
      }
    });
  }, [colWidths]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const widthRef = useRef(colWidths);
  widthRef.current = colWidths;

  const clampCol = useCallback((key: ColResizeKey, w: number) => {
    const c = COL_WIDTH[key];
    const max = Math.min(c.max, Math.floor(window.innerWidth * c.maxVw));
    return Math.max(c.min, Math.min(max, w));
  }, []);

  const setCol = useCallback(
    (key: ColResizeKey, w: number) => {
      setColWidths((prev) => ({ ...prev, [key]: clampCol(key, w) }));
    },
    [clampCol]
  );

  const onResizePointer = useCallback(
    (key: ColResizeKey, opts?: { invertDelta?: boolean }) =>
      (e: React.PointerEvent) => {
        const c = COL_WIDTH[key];
        attachColumnResize(
          e,
          widthRef.current[key],
          (w) => setCol(key, w),
          c.min,
          c.max,
          c.maxVw,
          opts?.invertDelta ?? false
        );
      },
    [setCol]
  );

  const onNudge = useCallback(
    (key: ColResizeKey) => (delta: number) => {
      setCol(key, widthRef.current[key] + delta);
    },
    [setCol]
  );

  const gridTemplateColumns = useMemo(() => {
    const nc = gridColCaps.narrowTrack;
    const parts: string[] = [nc];
    if (visible.date) {
      parts.push(gridTrackPx(gridColCaps.title));
      if (showDetailsCol) parts.push(gridTrackPx(gridColCaps.details));
      if (visible.you) parts.push(nc);
      if (visible.avg) parts.push(nc);
      parts.push(gridFrMinTrack(gridColCaps.date, COL_WIDTH.date.min));
    } else {
      parts.push(gridFrMinTrack(gridColCaps.title, COL_WIDTH.title.min));
      if (showDetailsCol) parts.push(gridTrackPx(gridColCaps.details));
      if (visible.you) parts.push(nc);
      if (visible.avg) parts.push(nc);
    }
    return parts.join(' ');
  }, [gridColCaps, showDetailsCol, visible.you, visible.avg, visible.date]);

  const toggle = (id: PlaylistOptionalColumnId) => {
    setVisible((v) => ({ ...v, [id]: !v[id] }));
  };

  /** Date uses a leading grip only; omit the predecessor’s trailing grip so the boundary isn’t doubled. */
  const hideDetailsTrailingForDate = visible.date && !visible.avg && !visible.you && showDetailsCol;
  const hideTitleTrailingForDate =
    visible.date && !visible.avg && !visible.you && !showDetailsCol;
  /** No grip between fixed narrow columns You/Avg and Date. */
  const showDateLeadingGrip = visible.date && !visible.avg && !visible.you;

  const headerStickyClass =
    'sticky top-0 z-10 border-b border-stone-200/90 bg-stone-100/95 backdrop-blur-sm';
  const headerGridClass = 'grid w-full min-w-0 items-stretch text-left';
  const bodyRowClass =
    'grid w-full min-w-0 max-w-full touch-manipulation items-center border-b border-stone-100 text-left transition-colors hover:bg-stone-50 active:bg-stone-100/70 odd:bg-white even:bg-stone-50/40 group';

  return (
    <div className="mx-auto w-full min-w-0 max-w-full sm:max-w-5xl">
      <div className="mb-1 flex justify-end">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className={`rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100/90 hover:text-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/80 focus-visible:ring-offset-1 focus-visible:ring-offset-white ${menuOpen ? 'bg-stone-100/80 text-stone-700' : ''}`}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            aria-controls="playlist-display-menu"
            aria-label="Row layout"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          {menuOpen && (
            <div
              id="playlist-display-menu"
              role="dialog"
              className="absolute right-0 top-full z-40 mt-1 w-[min(17rem,calc(100vw-1.5rem))] rounded-xl border border-stone-200/90 bg-white py-1 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)]"
            >
              <p className="border-b border-stone-100 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Row layout
              </p>
              <ul className="max-h-72 overflow-y-auto py-0.5 [scrollbar-width:thin]">
                {OPTIONAL_COLUMN_META.map(({ id, menuLabel }) => (
                  <li key={id}>
                    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50/90">
                      <input
                        type="checkbox"
                        className="shrink-0 rounded border-stone-300 text-stone-700 focus:ring-stone-400"
                        checked={visible[id]}
                        onChange={() => toggle(id)}
                      />
                      <span className="min-w-0 leading-snug">{menuLabel}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="profile-reviews-playlist-scroll max-h-[min(70vh,36rem)] min-w-0 touch-manipulation overflow-x-auto overflow-y-auto overscroll-x-contain">
          <div className="mx-auto w-full min-w-full max-w-full">
            <div className={`${headerStickyClass} w-full min-w-full`}>
              <div className={headerGridClass} style={{ gridTemplateColumns }} role="row">
                <div className={`relative flex min-h-9 min-w-0 items-center justify-center ${CELL_BORDER}`}>
                  <span className={`${HDR} select-none tabular-nums`}>#</span>
                </div>

                <div className={`relative flex min-h-9 min-w-0 items-center justify-start ${CELL_BORDER}`}>
                  {!isNarrow && (hideTitleTrailingForDate || hideDetailsTrailingForDate) && (
                    <ResizeGrip
                      edge="leading"
                      label="Title column"
                      valueNow={colWidths.title}
                      valueMin={COL_WIDTH.title.min}
                      valueMax={COL_WIDTH.title.max}
                      onPointerDown={onResizePointer('title', { invertDelta: true })}
                      onNudge={onNudge('title')}
                    />
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate px-2 text-left ${HDR} ${hideTitleTrailingForDate || hideDetailsTrailingForDate ? 'pl-3' : ''}`}
                  >
                    Title
                  </span>
                  {!isNarrow && !hideTitleTrailingForDate && !hideDetailsTrailingForDate && (
                    <ResizeGrip
                      label="Title column"
                      valueNow={colWidths.title}
                      valueMin={COL_WIDTH.title.min}
                      valueMax={COL_WIDTH.title.max}
                      onPointerDown={onResizePointer('title')}
                      onNudge={onNudge('title')}
                    />
                  )}
                </div>

                {showDetailsCol && (
                  <div className={`relative flex min-h-9 min-w-0 items-center justify-start ${CELL_BORDER}`}>
                    {!isNarrow && hideDetailsTrailingForDate && (
                      <ResizeGrip
                        edge="leading"
                        label="Details column"
                        valueNow={colWidths.details}
                        valueMin={COL_WIDTH.details.min}
                        valueMax={COL_WIDTH.details.max}
                        onPointerDown={onResizePointer('details', { invertDelta: true })}
                        onNudge={onNudge('details')}
                      />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate px-2 text-left ${HDR} ${hideDetailsTrailingForDate ? 'pl-3' : ''}`}
                    >
                      Details
                    </span>
                    {!isNarrow && !hideDetailsTrailingForDate && (
                      <ResizeGrip
                        label="Details column"
                        valueNow={colWidths.details}
                        valueMin={COL_WIDTH.details.min}
                        valueMax={COL_WIDTH.details.max}
                        onPointerDown={onResizePointer('details')}
                        onNudge={onNudge('details')}
                      />
                    )}
                  </div>
                )}

                {visible.you && (
                  <div className={`relative flex min-h-9 min-w-0 items-center justify-start px-2 ${CELL_BORDER}`}>
                    <span className={`${HDR}`}>You</span>
                  </div>
                )}

                {visible.avg && (
                  <div className={`relative flex min-h-9 min-w-0 items-center justify-start px-2 ${CELL_BORDER}`}>
                    <span className={`${HDR}`}>Avg</span>
                  </div>
                )}

                {visible.date && (
                  <div className={`relative flex min-h-9 min-w-0 items-center justify-start ${CELL_BORDER}`}>
                    {!isNarrow && showDateLeadingGrip && (
                      <ResizeGrip
                        edge="leading"
                        label="Date column"
                        valueNow={colWidths.date}
                        valueMin={COL_WIDTH.date.min}
                        valueMax={COL_WIDTH.date.max}
                        onPointerDown={onResizePointer('date', { invertDelta: true })}
                        onNudge={onNudge('date')}
                      />
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate px-2 text-left ${HDR} ${showDateLeadingGrip ? 'pl-3' : ''}`}
                    >
                      Date
                    </span>
                  </div>
                )}
              </div>
            </div>

            <ul role="list" className="min-w-0">
            {rows.map(({ rating, eventName, event, averageRating, ratingCount }, index) => {
              const details = buildDetailsSegment(event, tagDisplayMap, visible);
              const dt = event.date?.trim() ? formatEventDateDisplay(event.date.trim()) : '—';
              return (
                <li key={rating.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenEvent?.(event.id)}
                    className={bodyRowClass}
                    style={{ gridTemplateColumns }}
                  >
                    <div
                      className={`flex min-h-[44px] min-w-0 items-center justify-start pl-2 text-xs tabular-nums text-stone-400 ${CELL_BORDER_BODY}`}
                    >
                      {index + 1}
                    </div>
                    <div
                      className={`flex min-h-[44px] min-w-0 items-center justify-start ${CELL_BORDER_BODY}`}
                    >
                      <PlaylistTitle fullName={eventName} footerTags={event.footer_tags} />
                    </div>
                    {showDetailsCol && (
                      <div
                        className={`flex min-h-[44px] min-w-0 items-center justify-start px-2 text-left ${CELL_BORDER_BODY}`}
                        title={details || undefined}
                      >
                        <span className="truncate text-left text-xs text-stone-500">{details || '—'}</span>
                      </div>
                    )}
                    {visible.you && (
                      <div
                        className={`flex min-h-[44px] min-w-0 items-center justify-center gap-0.5 ${CELL_BORDER_BODY}`}
                        title="Your rating"
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            className={
                              star <= rating.rating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-stone-200'
                            }
                          />
                        ))}
                      </div>
                    )}
                    {visible.avg && (
                      <div
                        className={`flex min-h-[44px] min-w-0 items-center justify-start px-2 text-left text-xs tabular-nums text-stone-600 ${CELL_BORDER_BODY}`}
                        title="Community average"
                      >
                        {ratingCount > 0 ? (
                          <span className="min-w-0 max-w-full truncate text-left">
                            <span className="font-semibold text-stone-800">{averageRating.toFixed(1)}</span>
                            <span className="text-stone-400"> · {ratingCount}</span>
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </div>
                    )}
                    {visible.date && (
                      <div
                        className={`flex min-h-[44px] min-w-0 items-center justify-start px-2 text-left text-xs tabular-nums text-stone-600 ${CELL_BORDER_BODY}`}
                        title={dt}
                      >
                        <span className="min-w-0 max-w-full truncate">{dt}</span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
