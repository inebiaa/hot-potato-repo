import { User } from 'lucide-react';
import { ListCover } from '../ListCoverCollage';
import { useT } from '../../hooks/useCopy';
import type { ProfilePageProps } from './types';

interface ProfileHeaderProps {
  coverUrl: string;
  avatarUrl: string;
  username: string;
  userIdPublic: string;
  isOwnProfile: boolean;
  currentUserFullName?: string;
  currentUserEmailPrefix?: string;
  tagColors?: ProfilePageProps['tagColors'];
}

export default function ProfileHeader({
  coverUrl,
  avatarUrl,
  username,
  userIdPublic,
  isOwnProfile,
  currentUserFullName,
  currentUserEmailPrefix,
  tagColors,
}: ProfileHeaderProps) {
  const t = useT();

  return (
    <header className="mb-10">
      {coverUrl.trim() ? (
        <ListCover
          coverUrl={coverUrl.trim()}
          className="mb-6 h-40 w-full rounded-xl sm:h-52"
        />
      ) : null}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
          {avatarUrl.trim() ? (
            <img src={avatarUrl.trim()} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={28} className="text-neutral-400" strokeWidth={1.5} aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <span
            className="inline-block max-w-full truncate text-sm font-medium px-3 py-1.5 rounded-md"
            style={{
              backgroundColor: tagColors?.optional_tags_bg_color || '#e0e7ff',
              color: tagColors?.optional_tags_text_color || '#3730a3',
            }}
          >
            {username ||
              (isOwnProfile && currentUserFullName) ||
              (isOwnProfile && currentUserEmailPrefix) ||
              t('nav.profile')}
          </span>
          <div className="text-neutral-500 text-sm mt-1 space-y-0.5">
            {userIdPublic && <p className="text-neutral-600">@{userIdPublic}</p>}
          </div>
        </div>
      </div>
    </header>
  );
}
