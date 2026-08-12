/** Find Roskilde + Open'er recent landscape photos. */
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
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/120' },
    redirect: 'follow',
  });
  if (!r.ok) return { url, err: 'HTTP ' + r.status };
  const buf = Buffer.from(await r.arrayBuffer());
  const d = dims(buf);
  if (!d) return { url, err: 'nodims ' + buf.length };
  const [w, h] = d;
  return { url, w, h, orient: w >= h * 1.25 ? 'H' : 'V', kb: Math.round(buf.length / 1024) };
}

const pages = [
  'https://flemmingbojensen.com/2018/01/11/capturing-orange-feeling/',
  'https://flemmingbojensen.com/2016/08/05/photographing-roskilde-festival-2016/',
  'https://www.visitfjordlandet.com/fjordlandet/whats-on/roskilde-festival-northern-europes-largest-gdk619631',
];

const candidates = [];
for (const page of pages) {
  const r = await fetch(page, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const t = await r.text();
  const imgs = [...t.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|webp)/gi)]
    .map((m) => m[0])
    .filter((x) => !/logo|icon|avatar|100x|150x|200x|300x/i.test(x));
  for (const u of [...new Set(imgs)].slice(0, 25)) candidates.push(u);
}

// also try opener non-square
candidates.push(
  'https://static.opener.pl/media/CACHE/images/images/2026/04-02/84796036-9dc_square_mPBhnum/e87e76a8f5b6cb1227831b7fcb925e71.jpg',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/d5cdefa6-3c0f-442a-a633-3d4429c6e75d.jpg',
  'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/9ab4f944-acce-463b-8f0d-a1a12b52a24c/bab3b030-52a3-4dea-b715-daddf0299286.jpg',
);

const uniq = [...new Set(candidates)];
console.log('probing', uniq.length);
for (const u of uniq.slice(0, 40)) {
  const info = await probe(u);
  if (info.err) console.log('ERR', info.err, u.slice(0, 90));
  else if (info.orient === 'H' && info.w >= 900)
    console.log('H', info.w + 'x' + info.h, info.kb + 'kb', u.slice(0, 110));
}
