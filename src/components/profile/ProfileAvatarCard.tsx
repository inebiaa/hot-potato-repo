import { User } from 'lucide-react';
import RemoteImg from '../RemoteImg';

const profileAvatarCardSizeClass = 'h-24 w-24 sm:h-28 sm:w-28';
const profileAvatarCardPreviewSizeClass = 'h-16 w-16';

type ProfileAvatarCardProps = {
  src?: string;
  priority?: boolean;
  preview?: boolean;
};

/** Mini event-card photo tile (same shape as feed card image). */
export default function ProfileAvatarCard({ src, priority = false, preview = false }: ProfileAvatarCardProps) {
  const sizeClass = preview ? profileAvatarCardPreviewSizeClass : profileAvatarCardSizeClass;
  const image = src?.trim();

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-lg bg-gray-200 shadow-md ring-4 ring-white ${sizeClass}`}
    >
      {image ? (
        <RemoteImg src={image} alt="" className="h-full w-full object-cover" priority={priority} />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <User
            size={preview ? 28 : 36}
            className="text-neutral-400"
            strokeWidth={1.5}
            aria-hidden
          />
        </div>
      )}
    </div>
  );
}