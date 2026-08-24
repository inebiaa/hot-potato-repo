/** Up to four distinct event image URLs for a temporary board cover collage. */
export function pickListCollageUrls(
  imageUrls: Array<string | null | undefined>,
  limit = 4,
): string[] {
  const out: string[] = [];
  for (const raw of imageUrls) {
    const url = (raw || '').trim();
    if (!url || out.includes(url)) continue;
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}
