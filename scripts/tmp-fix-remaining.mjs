/** Fix Chile d2/d3, Brasil uniqueness, Open'er, Estereo/Asuncionico. */
import { createHash } from 'crypto';
import { writeFileSync } from 'fs';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function dims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const m = buf[i + 1];
      if (m === 0xd9 || m === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}
async function probe(url) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  const d = dims(buf);
  if (!d) throw new Error('nodims');
  const [w, h] = d;
  if (w < h * 1.25 || w < 900) throw new Error(`${w}x${h}`);
  return { url, w, h, hash: createHash('sha1').update(buf).digest('hex').slice(0, 12) };
}

async function scrape(page) {
  const r = await fetch(page, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const t = await r.text();
  return [...new Set([...t.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|webp)/gi)].map((m) => m[0]))].filter(
    (x) => !/logo|icon|avatar|150x|200x|300x|1x1|sprite/i.test(x),
  );
}

const pages = [
  'https://www.rockaxis.com/chile/galeria/46102/lollapalooza-chile-2025-dia-1/',
  'https://www.clarin.com/fotogalerias/lollapalooza-argentina-2025-fotos-decima-edicion-megafestival-importante-ano_5_N0qJPmLg9D.html',
  'https://g1.globo.com/pop-arte/musica/noticia/2026/03/22/lollapalooza-2026-veja-fotos-do-3o-dia-de-festival.ghtml',
  'https://billboard.ar/imagenes/lollapalooza-argentina-las-mejores-fotos-del-domingo/',
];

const pool = [];
for (const p of pages) {
  try {
    const imgs = await scrape(p);
    console.log(p.slice(0, 50), imgs.length);
    pool.push(...imgs);
  } catch (e) {
    console.log('scrape fail', e.message);
  }
}

// Prefer clarin 2025, billboard landscape, g1 1000w+, rockaxis
const prefer = [...new Set(pool)].filter(
  (u) =>
    (/clarin\.com\/img\/2025/.test(u) && !/300x168/.test(u)) ||
    (/billboard\.ar.*2025\/03/.test(u) && /scaled|2048|1536|1024/.test(u) && !/819x1024|240x300/.test(u)) ||
    (/glbimg\.com/.test(u) && /1000x0|984x0|1920x1280|2000x1333/.test(u)) ||
    /rockaxis\.com\/img/.test(u),
);

console.log('prefer', prefer.length);
const used = new Set();
const ok = [];
for (const u of prefer) {
  try {
    await sleep(200);
    const info = await probe(u);
    if (used.has(info.hash)) continue;
    used.add(info.hash);
    ok.push(info);
    console.log('H', info.w + 'x' + info.h, info.hash, u.slice(0, 100));
    if (ok.length >= 15) break;
  } catch {}
}

// Also probe existing storage for Chile/Estereo/Asuncionico/Open'er day1s
const storage = [
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/3be12a09-7062-4f61-8500-bfe41e5919a4.jpg',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/da1174de-3b36-48dd-bd0d-5d2af0951c7c.jpg',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/17d5e0bb-2ff3-4b2f-9f58-c3c66220a536.webp',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/9fc6d766-936e-48cf-bc0e-e0178cfcf05a.jpg',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/bab3b030-52a3-4dea-b715-daddf0299286.jpg',
  'https://flemmingbojensen.com/wp-content/uploads/2018/01/FlemmingBoJensen-blog-OrangeScene-2432.jpg',
  'https://flemmingbojensen.com/wp-content/uploads/2018/01/FlemmingBoJensen-blog-OrangeScene-3564.jpg',
];
for (const u of storage) {
  try {
    const info = await probe(u);
    console.log('STOR', info.w + 'x' + info.h, info.hash, u.slice(-60));
  } catch (e) {
    console.log('STOR fail', e.message, u.slice(-40));
  }
}

writeFileSync(new URL('./tmp-pool-recent.json', import.meta.url), JSON.stringify(ok, null, 2));
