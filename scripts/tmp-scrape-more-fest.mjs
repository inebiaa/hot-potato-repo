/** Scrape more recent fest galleries (file-based to avoid PowerShell). */
const pages = [
  ['rockaxis', 'https://www.rockaxis.com/chile/galeria/46102/lollapalooza-chile-2025-dia-1/'],
  ['agenda', 'https://www.agendamusical.cl/fotos-primer-dia-de-lollapalooza-chile-2025-el-pop-en-la-vida/'],
  ['clarin', 'https://www.clarin.com/fotogalerias/lollapalooza-argentina-2025-fotos-decima-edicion-megafestival-importante-ano_5_N0qJPmLg9D.html'],
  ['billboard', 'https://billboard.ar/imagenes/lollapalooza-argentina-las-mejores-fotos-del-domingo/'],
  ['g1', 'https://g1.globo.com/pop-arte/musica/noticia/2026/03/22/lollapalooza-2026-veja-fotos-do-3o-dia-de-festival.ghtml'],
  ['pe-more', 'https://www.ocregister.com/2026/04/13/coachella-2026-our-30-best-photos-from-weekend-1-of-music-festival/'],
  ['opener', 'https://opener.pl/en/'],
  ['flemming', 'https://flemmingbojensen.com/2016/08/05/photographing-roskilde-festival-2016/'],
];

for (const [name, url] of pages) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
    });
    const t = await r.text();
    const imgs = [...t.matchAll(/https?:\/\/[^"'\\\s>]+\.(?:jpg|jpeg|webp)(?:\?[^"'\\\s>]*)?/gi)]
      .map((m) => m[0])
      .filter((x) => !/logo|icon|avatar|1x1|sprite|favicon|emoji/i.test(x));
    const uniq = [...new Set(imgs)].slice(0, 18);
    console.log('\n###', name, r.status, uniq.length);
    for (const i of uniq) console.log(' ', i.slice(0, 155));
  } catch (e) {
    console.log(name, e.message);
  }
}
