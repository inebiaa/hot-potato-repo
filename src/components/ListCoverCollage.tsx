import { eventCardImageUrl } from '../lib/eventCardImageUrl';

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

type ListCoverCollageProps = {
  urls: string[];
  className?: string;
};

export default function ListCoverCollage({ urls, className = '' }: ListCoverCollageProps) {
  const pics = pickListCollageUrls(urls)
    .map((u) => eventCardImageUrl(u) || u)
    .filter(Boolean);
  if (pics.length === 0) return null;

  if (pics.length === 1) {
    return (
      <div className={`overflow-hidden bg-neutral-100 ${className}`.trim()}>
        <img src={pics[0]} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (pics.length === 2) {
    return (
      <div className={`grid grid-cols-2 gap-px overflow-hidden bg-neutral-200 ${className}`.trim()}>
        {pics.map((src) => (
          <img key={src} src={src} alt="" className="h-full w-full min-h-0 min-w-0 object-cover" />
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-neutral-200 ${className}`.trim()}>
      {pics.slice(0, 4).map((src) => (
        <img key={src} src={src} alt="" className="h-full w-full min-h-0 min-w-0 object-cover" />
      ))}
      {pics.length === 3 ? <div className="bg-neutral-100" aria-hidden /> : null}
    </div>
  );
}

type ListCoverProps = {
  coverUrl?: string | null;
  collageUrls?: string[];
  className?: string;
};

/** Custom cover when set; otherwise a temporary collage from board event photos. */
export function ListCover({ coverUrl, collageUrls = [], className = '' }: ListCoverProps) {
  const custom = (coverUrl || '').trim();
  if (custom) {
    return (
      <div className={`overflow-hidden bg-neutral-100 ${className}`.trim()}>
        <img src={custom} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  if (pickListCollageUrls(collageUrls).length > 0) {
    return <ListCoverCollage urls={collageUrls} className={className} />;
  }
  return <div className={`bg-neutral-100 ${className}`.trim()} aria-hidden />;
}
