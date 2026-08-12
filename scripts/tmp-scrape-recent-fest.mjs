/** Scrape recent festival press pages for landscape image URLs. */
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

const pages = [
  ['coachella', 'https://coachella.com/photo-gallery'],
  ['pe', 'https://www.pressenterprise.com/2026/04/13/coachella-2026-our-30-best-photos-from-weekend-1-of-music-festival/'],
  ['latimes', 'https://www.latimes.com/entertainment-arts/music/story/2026-04-11/coachella-2026-best-photos-from-25th-anniversary-weekend'],
  ['flood-ps', 'https://floodmagazine.com/163976/primavera-sound-2024-atmosphere-photos/'],
  ['dazed-ps', 'https://www.dazeddigital.com/art-photography/article/66981/1/primavera-sound-2025-festival-barcelona-charli-xcx-chappell-roan-photos'],
  ['monster', 'https://www.monsterchildren.com/articles/look-behind-you-our-time-at-primavera-sound-2025'],
  ['elnac', 'https://www.elnacional.cat/en/culture/primavera-sound-barcelona-2024-in-photos-furor-for-stella-maris-and-lana-rey_1226850_102.html'],
  ['opener', 'https://opener.pl/en/'],
  ['roskilde-press', 'https://www.roskilde-festival.dk/presse/mediebibliotek'],
  ['jens', 'https://jenspanduro.dk/roskilde-festival-2026-billeder-fra-fredag/'],
  ['billboard-ar', 'https://billboard.ar/imagenes/lollapalooza-argentina-las-mejores-fotos-del-domingo/'],
  ['g1-br', 'https://g1.globo.com/pop-arte/musica/noticia/2026/03/22/lollapalooza-2026-veja-fotos-do-3o-dia-de-festival.ghtml'],
  ['infobae', 'https://www.infobae.com/tendencias/2026/03/15/las-mejores-fotos-de-la-segunda-jornada-de-lollapalooza-2026/'],
  ['maze-wlg', 'https://maze.fr/2023/07/report-photo-we-love-green/'],
  ['shock-fep', 'https://www.shock.co/festival-estereo-picnic/2023/estereo-picnic-2023-las-mejores-40-fotos-que-nos-dejo-el-primer-dia-del-festival-so35'],
];

for (const [name, url] of pages) {
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
    const t = await r.text();
    const imgs = [
      ...t.matchAll(/(?:src|content|data-src|data-lazy-src)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|webp|png)(?:\?[^"']*)?)/gi),
      ...t.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|webp)(?:\?[^"'\\\s>]*)?/gi),
    ]
      .map((m) => m[1] || m[0])
      .filter((x) => !/logo|icon|avatar|sprite|emoji|favicon|1x1|pixel|badge|button|svg/i.test(x))
      .filter((x) => !/wikimedia|unsplash/i.test(x));
    const uniq = [...new Set(imgs)].slice(0, 20);
    console.log('\n###', name, r.status, 'n=', uniq.length);
    for (const i of uniq) console.log(' ', i.slice(0, 160));
  } catch (e) {
    console.log(name, e.message);
  }
}
