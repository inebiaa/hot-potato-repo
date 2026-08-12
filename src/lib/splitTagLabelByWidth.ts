/** Padding + gap budget so segment pills don’t kiss the row edge (px). */
const WIDTH_FUDGE_PX = 4;

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
 * Greedy word wrap — keeps whole words; never mid-word chops (a long word may exceed the budget).
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

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (lineFits(trial)) {
      line = trial;
    } else {
      if (line) out.push(line);
      // Keep the whole word even if it is wider than the budget.
      line = word;
      if (!lineFits(word)) {
        out.push(word);
        line = '';
      }
    }
  }
  if (line) out.push(line);
  return out.length ? out : [t];
}
