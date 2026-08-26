import { eventCardImageUrl } from "../lib/eventCardImageUrl";
import { pickListCollageUrls } from "../lib/listCoverCollage";
import RemoteImg from "./RemoteImg";

type ListCoverCollageProps = {
  urls: string[];
  className?: string;
};

export default function ListCoverCollage({
  urls,
  className = "",
}: ListCoverCollageProps) {
  const pics = pickListCollageUrls(urls)
    .map((u) => eventCardImageUrl(u) || u)
    .filter(Boolean);
  if (pics.length === 0) return null;

  if (pics.length === 1) {
    return (
      <div className={`overflow-hidden bg-muted ${className}`.trim()}>
        <RemoteImg
          src={pics[0]}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (pics.length === 2) {
    return (
      <div
        className={`grid grid-cols-2 gap-px overflow-hidden bg-muted ${className}`.trim()}
      >
        {pics.map((src) => (
          <RemoteImg
            key={src}
            src={src}
            alt=""
            className="h-full w-full min-h-0 min-w-0 object-cover"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 grid-rows-2 gap-px overflow-hidden bg-muted ${className}`.trim()}
    >
      {pics.slice(0, 4).map((src) => (
        <RemoteImg
          key={src}
          src={src}
          alt=""
          className="h-full w-full min-h-0 min-w-0 object-cover"
        />
      ))}
      {pics.length === 3 ? <div className="bg-muted" aria-hidden /> : null}
    </div>
  );
}

type ListCoverProps = {
  coverUrl?: string | null;
  collageUrls?: string[];
  className?: string;
};

/** Custom cover when set; otherwise a temporary collage from board event photos. */
export function ListCover({
  coverUrl,
  collageUrls = [],
  className = "",
}: ListCoverProps) {
  const custom = (coverUrl || "").trim();
  if (custom) {
    return (
      <div className={`overflow-hidden bg-muted ${className}`.trim()}>
        <RemoteImg src={custom} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  if (pickListCollageUrls(collageUrls).length > 0) {
    return <ListCoverCollage urls={collageUrls} className={className} />;
  }
  return <div className={`bg-muted ${className}`.trim()} aria-hidden />;
}
