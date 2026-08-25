/**
 * Brand PWA icons: neutral tile with dark rounded mark (maskable-safe padding).
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Image } from 'imagescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const BG = 0xf8fafcff;
const FG = 0x171717ff;

function pointInRoundRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const right = x0 + w - 1;
  const bottom = y0 + h - 1;
  const corners = [
    [x0 + r, y0 + r, x0, y0],
    [right - r, y0 + r, right, y0],
    [x0 + r, bottom - r, x0, bottom],
    [right - r, bottom - r, right, bottom],
  ];
  for (const [cx, cy, cornerX, cornerY] of corners) {
    const inCornerZone =
      (cornerX === x0 && x < x0 + r && y < y0 + r) ||
      (cornerX === right && x > right - r && y < y0 + r) ||
      (cornerX === x0 && x < x0 + r && y > bottom - r) ||
      (cornerX === right && x > right - r && y > bottom - r);
    if (inCornerZone) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) return false;
    }
  }
  return true;
}

function fillRoundRect(img, x0, y0, w, h, r, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (pointInRoundRect(x, y, x0, y0, w, h, r)) {
        img.setPixelAt(x + 1, y + 1, color);
      }
    }
  }
}

function fillRect(img, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      img.setPixelAt(x + 1, y + 1, color);
    }
  }
}

function drawMark(img, size, maskable) {
  const margin = maskable ? Math.round(size * 0.1) : Math.round(size * 0.16);
  const inner = size - margin * 2;
  const radius = Math.max(2, Math.round(inner * 0.16));
  fillRoundRect(img, margin, margin, inner, inner, radius, FG);

  const barW = Math.round(inner * 0.55);
  const barH = Math.max(2, Math.round(inner * 0.08));
  const barX = margin + Math.round((inner - barW) / 2);
  const gap = Math.round(inner * 0.12);
  const centerY = margin + Math.round(inner / 2);
  fillRect(img, barX, centerY - gap - barH, barW, barH, BG);
  fillRect(img, barX, centerY + gap, barW, barH, BG);
}

async function renderIcon(size, maskable = false) {
  const img = new Image(size, size);
  img.fill(BG);
  drawMark(img, size, maskable);
  return await img.encode();
}

const outputs = [
  ['pwa-192x192.png', 192, false],
  ['pwa-512x512.png', 512, false],
  ['pwa-512-maskable.png', 512, true],
  ['apple-touch-icon.png', 180, false],
  ['favicon-32x32.png', 32, false],
] ;

for (const [name, size, maskable] of outputs) {
  const bytes = await renderIcon(size, maskable);
  writeFileSync(resolve(publicDir, name), bytes);
  console.log(`Wrote public/${name}`);
}

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="Secret Blogger">
  <rect width="32" height="32" rx="6" fill="#f8fafc"/>
  <rect x="5" y="5" width="22" height="22" rx="4" fill="#171717"/>
  <rect x="10" y="12" width="12" height="2.5" rx="1.2" fill="#f8fafc"/>
  <rect x="10" y="17.5" width="12" height="2.5" rx="1.2" fill="#f8fafc"/>
</svg>
`;
writeFileSync(resolve(publicDir, 'favicon.svg'), faviconSvg);
console.log('Wrote public/favicon.svg');
