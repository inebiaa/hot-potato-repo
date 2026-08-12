/**
 * Probe LatAm / Open'er / Roskilde recent fest photos; write SQL.
 */
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
  const clean = url.replace(/&#038;/g, '&').replace(/&amp;/g, '&');
  const r = await fetch(clean, {
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 10000) throw new Error('tiny ' + buf.length);
  const d = dims(buf);
  if (!d) throw new Error('no dims');
  const [w, h] = d;
  if (w < h * 1.25) throw new Error(`V ${w}x${h}`);
  if (w < 900) throw new Error('narrow ' + w);
  return {
    url: clean.includes('?') && clean.includes('clarin') ? clean : clean.split('?')[0] === clean ? clean : clean,
    store: clean.includes('billboard') || clean.includes('clarin') || clean.includes('agendamusical') || clean.includes('glbimg') || clean.includes('opener') || clean.includes('pressenterprise') || clean.includes('ocregister')
      ? (clean.includes('glbimg') ? clean : clean.split('?')[0] || clean)
      : clean,
    w,
    h,
    hash: createHash('sha1').update(buf).digest('hex').slice(0, 12),
  };
}

const PLAN = {
  // Lolla Argentina days — Clarín / Billboard 2025
  'e3c8b244-90fa-4c35-9005-0d7733818eed': [
    'https://billboard.ar/wp-content/uploads/2025/03/IMG_9945-scaled.jpg',
    'https://www.clarin.com/img/2025/03/24/XEd47cnGc_1200x630__1.jpg',
  ],
  'd0e33547-a787-4ef3-82ac-a86a4ec5a920': [
    'https://www.clarin.com/img/2025/03/23/wv34ftomd_0x750__1.jpg',
    'https://www.clarin.com/img/2025/03/24/FXuxzHDvU_0x750__1.jpg',
  ],
  '6ec11c69-16fb-4c80-bd23-3fe525d248a8': [
    'https://www.clarin.com/img/2025/03/23/ou-G5sy40_0x750__1.jpg',
    'https://www.clarin.com/img/2025/03/24/j6CFQEy8T_0x750__1.jpg',
  ],

  // Lolla Chile — agenda 2025 full (strip size suffix)
  'c450adad-46db-447a-992e-c529d3942bd7': [
    'https://www.agendamusical.cl/wp-content/uploads/2025/03/30A70141.jpg',
    'https://www.rockaxis.com/img/newsList/3433251.JPG',
  ],
  '3be12a09-7062-4f61-8500-bfe41e5919a4': [
    'https://www.agendamusical.cl/wp-content/uploads/2025/03/wen-bros-1.jpg',
  ],
  'da1174de-3b36-48dd-bd0d-5d2af0951c7c': [
    'https://www.agendamusical.cl/wp-content/uploads/2025/05/30A8887.jpg',
  ],

  // Lolla Brasil — G1 2026 (use full CDN paths from scrape)
  'b70488b7-1b43-49b3-824f-6fb37eb64ee4': [
    'https://s2-g1.glbimg.com/buOMsLuogYrehZ3DLVj_ef_YQX0=/0x0:2000x1333/1000x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/x/L/ollaDay3a/lollapalooza-2026-publico.jpg',
  ],
  '4304e3a1-690e-4daa-9bde-f55c2dc27c49': [
    'https://s2-g1.glbimg.com/C_blUm4logCriyQHThX88ZQlHV4=/0x0:1920x1280/1000x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/x/L/ollaDay3b/lollapalooza-2026.jpg',
  ],
  '81349b44-fab8-4012-a6b7-3b59ed8ca463': [
    'https://s2-g1.glbimg.com/3GJM54sOnIc53DN0rnsQTAvfTQk=/0x0:1920x1280/1000x0/smart/filters:strip_icc()/i.s3.glbimg.com/v1/AUTH_59edd422c0c84a879bd37670ae4f538a/internal_photos/bs/2026/x/L/ollaDay3c/lollapalooza.jpg',
  ],

  // Open'er — official static + more PE-style; day1 try opener media
  'bab3b030-52a3-4dea-b715-daddf0299286': [
    'https://static.opener.pl/media/images/2026/07-23/fdae828e-adf_vertical.jpg',
  ],
  'a58020f5-48fe-40ee-af65-6946e85a228b': [
    'https://static.opener.pl/media/images/2026/08-05/71fe41ca-ccd_vertical.jpg',
  ],
};

// Fix: fetch real G1 URLs by re-scraping page HTML for complete paths
async function g1Urls() {
  const r = await fetch(
    'https://g1.globo.com/pop-arte/musica/noticia/2026/03/22/lollapalooza-2026-veja-fotos-do-3o-dia-de-festival.ghtml',
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
  );
  const t = await r.text();
  const imgs = [...t.matchAll(/https:\/\/s2-g1\.glbimg\.com\/[^"'\\\s]+/g)].map((m) => m[0]);
  return [...new Set(imgs)].filter((u) => /1920x1280|2000x1333|1828x1218/.test(u)).slice(0, 12);
}

const g1 = await g1Urls();
console.log('g1 candidates', g1.length);
g1.slice(0, 6).forEach((u) => console.log(' ', u.slice(0, 120)));

const brIds = [
  'b70488b7-1b43-49b3-824f-6fb37eb64ee4',
  '4304e3a1-690e-4daa-9bde-f55c2dc27c49',
  '81349b44-fab8-4012-a6b7-3b59ed8ca463',
];
brIds.forEach((id, i) => {
  PLAN[id] = g1.filter((_, idx) => idx % 3 === i).slice(0, 3);
  if (!PLAN[id].length) PLAN[id] = g1.slice(i * 2, i * 2 + 2);
});

const used = new Set();
const updates = [];

for (const [id, urls] of Object.entries(PLAN)) {
  let ok = false;
  for (const u of urls) {
    try {
      await sleep(350);
      const info = await probe(u);
      if (used.has(info.hash)) continue;
      used.add(info.hash);
      updates.push({ id, url: info.store || info.url, w: info.w, h: info.h, hash: info.hash });
      console.log('OK', id.slice(0, 8), `${info.w}x${info.h}`, (info.store || info.url).slice(0, 100));
      ok = true;
      break;
    } catch (e) {
      console.log('miss', id.slice(0, 8), e.message);
    }
  }
  if (!ok) console.log('FAIL', id.slice(0, 8));
}

writeFileSync(new URL('./tmp-latam-recent.json', import.meta.url), JSON.stringify(updates, null, 2));
writeFileSync(
  new URL('./tmp-latam-recent.sql', import.meta.url),
  updates.map((u) => `UPDATE events SET image_url = '${u.url.replace(/'/g, "''")}' WHERE id = '${u.id}';`).join('\n'),
);
console.log('n', updates.length);
