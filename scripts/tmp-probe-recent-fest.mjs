/**
 * Probe recent festival photos; emit SQL updates.
 * Rule: from the actual fest, preferably ≤ ~2 years old (2024–2026).
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
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const tag = buf.toString('ascii', 12, 16);
    if (tag === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    if (tag === 'VP8 ') return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
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
      Accept: 'image/*,*/*;q=0.8',
    },
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 8000) throw new Error('too small ' + buf.length);
  const d = dims(buf);
  if (!d) throw new Error('no dims');
  const [w, h] = d;
  if (w < h * 1.25) throw new Error(`portrait ${w}x${h}`);
  if (w < 800) throw new Error(`narrow ${w}`);
  return {
    url: clean.split('&')[0].includes('?w=') ? clean.split('?')[0] : clean,
    storeUrl: clean.includes('pressenterprise') ? clean.split('?')[0] : clean,
    w,
    h,
    hash: createHash('sha1').update(buf).digest('hex').slice(0, 12),
  };
}

// event id -> candidate URLs (recent, from that fest)
const PLAN = {
  // Coachella 2026 PE + official 2025 gallery tiles
  '0b89e992-a935-490b-92fc-eb341f629330': [
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D1-0411-39-WP_4ba975-2.jpg',
    'https://media.coachella.com/content/tile_images/795/yp6nKunK2h09xA8xsaZdMCrgl7jYvG6tSrmiUiJp.jpg',
  ],
  'b0ba8a8c-7343-46d4-b913-0117dbffa69c': [
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D2-0412-04-WP-5.jpg',
    'https://media.coachella.com/content/tile_images/795/0M4dKkaTRVJR9cJIl6er1jJpu41oYa1YXYRqzgQA.jpg',
  ],
  '5519a744-2516-47ec-9da1-87086be12cf7': [
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D3-0413-13-WP-2.jpg',
    'https://media.coachella.com/content/tile_images/795/7KY4yBwMwuXB6KyEgttzH22CaPGH8m7YryeTa9mj.jpg',
  ],
  '6d57271b-f867-41a4-8e3c-33105aa7589a': [
    'https://media.coachella.com/content/tile_images/795/XeTnTqLwm178HosZP7ODdKNlZG8ex3XdKmpBAXpp.jpg',
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D1-0411-05-WP-2.jpg',
  ],
  '778c9bb8-cc8b-432f-8ffa-8c37407080cf': [
    'https://media.coachella.com/content/tile_images/795/hVaVFmIagdskazYIzF0O8bcIz3bLvqxnqMra44qP.jpg',
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D2-0412-11-WP-2.jpg',
  ],
  '46267ac8-783b-403f-bfeb-fd0cbd1ac1f0': [
    'https://media.coachella.com/content/tile_images/795/Yfj51MslGq71MkGggW8dJvrcIWYCabpDKrJ4RpC0.jpg',
    'https://www.pressenterprise.com/wp-content/uploads/2026/04/RPE-L-CF-PHOTO-W1-D3-0413-08-WP_3c9fa9-2.jpg',
  ],

  // Primavera — FLOOD 2024 atmosphere + Dazed 2025
  '1bc038ef-d9b9-4223-9c90-087934897eec': [
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02907.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02907-960x640.jpg',
  ],
  '062c0ebc-4595-4392-a1ce-dd9852e322ad': [
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02908.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02908-960x640.jpg',
  ],
  '21260c55-8b10-4ef5-b0f1-76c7607c8c77': [
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02968.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02968-960x640.jpg',
  ],
  '24dc9b77-6f2a-41e5-a475-8a15044ce0d6': [
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02778.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02778-960x640.jpg',
    'https://images-prod.dazeddigital.com/1280/azure/dazed-prod/1410/3/1413280.jpg',
  ],
  '279de993-fafe-4118-9692-20b32fcdce28': [
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02861.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/DSC02861-960x640.jpg',
    'https://api.floodmagazine.com/wp-content/uploads/2024/06/Created-in-Barcelona-Primavera-credit-Kenn-Box.jpg',
  ],

  // Open'er — keep 2025 commons shot for one day; need other recent
  'bab3b030-52a3-4dea-b715-daddf0299286': [
    'https://upload.wikimedia.org/wikipedia/commons/d/d4/20250702_Opener_Festival.jpg',
  ],

  // We Love Green — Maze 2023 reportage (same fest, recent enough vs 2014)
  '8811b3fb-c408-4080-9d86-d379b8dd72be': [
    'https://i0.wp.com/maze.fr/wp-content/uploads/2023/07/P1140867-scaled.jpg?fit=1600%2C1067&ssl=1',
    'https://maze.fr/wp-content/uploads/2023/07/P1140867-scaled.jpg',
  ],
  '1341276b-2c57-4e70-80ca-f3c6b8a134b7': [
    'https://i0.wp.com/maze.fr/wp-content/uploads/2023/07/canopee-1.jpeg?fit=1600%2C1067&ssl=1',
    'https://maze.fr/wp-content/uploads/2023/07/canopee-1.jpeg',
    'https://i0.wp.com/maze.fr/wp-content/uploads/2023/07/nuit.jpeg?fit=1600%2C1067&ssl=1',
  ],
};

const used = new Set();
const updates = [];
const fails = [];

for (const [id, urls] of Object.entries(PLAN)) {
  let ok = false;
  for (const u of urls) {
    try {
      await sleep(400);
      const info = await probe(u);
      if (used.has(info.hash)) continue;
      used.add(info.hash);
      const store = info.storeUrl || info.url;
      updates.push({ id, url: store, w: info.w, h: info.h, hash: info.hash });
      console.log('OK', id.slice(0, 8), `${info.w}x${info.h}`, store.slice(0, 100));
      ok = true;
      break;
    } catch (e) {
      console.log('miss', id.slice(0, 8), e.message, u.slice(0, 70));
    }
  }
  if (!ok) fails.push(id);
}

writeFileSync(new URL('./tmp-recent-fest-updates.json', import.meta.url), JSON.stringify({ updates, fails }, null, 2));
writeFileSync(
  new URL('./tmp-recent-fest-updates.sql', import.meta.url),
  updates.map((u) => `UPDATE events SET image_url = '${u.url.replace(/'/g, "''")}' WHERE id = '${u.id}';`).join('\n'),
);
console.log('updates', updates.length, 'fails', fails.length);
