/** Padding + gap budget so segment pills don’t kiss the row edge (px). */
const WIDTH_FUDGE_PX = 8;

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(fontCss: string): CanvasRenderingContext2D | null {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  if (!measureCtx) measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return null;
  measureCtx.font = fontCss;
  return measureCtx;
}

export function measureTextWidthPx(text: string, fontCss: string): number {
  const ctx = getMeasureContext(fontCss);
  if (!ctx) return text.length * 7;
  return ctx.measureText(text).width;
}

/**
 * Split label into segments that each fit within `maxWidthPx` (measured with `fontCss`).
 * Greedy word wrap; only hard-splits inside a word when a single word is wider than the budget.
 */
export function splitTagLabelByWidth(text: string, maxWidthPx: number, fontCss: string): string[] {
  const t = text.trim();
  if (!t) return [];
  if (maxWidthPx <= WIDTH_FUDGE_PX) return [t];

  const budget = Math.max(24, maxWidthPx - WIDTH_FUDGE_PX);
  const words = t.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';

  const lineFits = (s: string) => measureTextWidthPx(s, fontCss) <= budget;

  const pushHardBreakWord = (word: string) => {
    let rest = word;
    while (rest.length > 0) {
      if (lineFits(rest)) {
        out.push(rest);
        rest = '';
        break;
      }
      let lo = 1;
      let hi = rest.length;
      let best = 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const prefix = rest.slice(0, mid);
        if (lineFits(prefix)) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (best < 1) best = 1;
      out.push(rest.slice(0, best));
      rest = rest.slice(best);
    }
  };

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (lineFits(trial)) {
      line = trial;
    } else {
      if (line) out.push(line);
      if (lineFits(word)) {
        line = word;
      } else {
        line = '';
        pushHardBreakWord(word);
      }
    }
  }
  if (line) out.push(line);
  return out.length ? out : [t];
}
