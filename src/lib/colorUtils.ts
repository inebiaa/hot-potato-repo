/**
 * Returns a complementary text color for a given background hex.
 * - Dark backgrounds -> light text (#f8fafc)
 * - Light backgrounds -> dark, hue-matched text (same hue, darkened)
 */
export function readableTextForBg(hex: string): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const luminance = 0.299 * (r * 255) / 255 + 0.587 * (g * 255) / 255 + 0.114 * (b * 255) / 255;
  if (luminance < 0.45) return '#f8fafc';

  // RGB -> HSL (standard formula)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }
  h = h * 360;

  // Very low saturation (gray/neutral) -> use neutral dark
  if (s < 0.08) return '#374151';

  // Dark, saturated version of same hue for text
  const textS = Math.max(0.4, Math.min(0.85, s + 0.3));
  const textL = 0.22;

  // HSL -> RGB
  const c = (1 - Math.abs(2 * textL - 1)) * textS;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = textL - c / 2;

  let rr = 0, gg = 0, bb = 0;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];

  const toHex = (v: number) => Math.round(Math.max(0, Math.min(255, (v + m) * 255))).toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}
