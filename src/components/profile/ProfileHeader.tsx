import { ListCover } from '../ListCoverCollage';
import { useT } from '../../hooks/useCopy';
import type { ProfilePageProps } from './types';
import ProfileAvatarCard from './ProfileAvatarCard';

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

  const displayName =
    username.trim() ||
    (isOwnProfile && currentUserFullName?.trim()) ||
    (isOwnProfile && currentUserEmailPrefix?.trim()) ||
    t('nav.profile');

  const cover = coverUrl.trim();
  const pillBg = tagColors?.optional_tags_bg_color || '#e0e7ff';
  const pillText = tagColors?.optional_tags_text_color || '#3730a3';

  return (
    <header className="mb-10">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="h-40 bg-neutral-100 sm:h-52 lg:h-56">
          {cover ? (
            <ListCover coverUrl={cover} className="h-full w-full" />
          ) : (
            <div
              className="h-full w-full bg-gradient-to-br from-neutral-100 via-neutral-50 to-neutral-200/80"
              aria-hidden
            />
          )}
        </div>

        <div className="relative border-t border-neutral-100 bg-white px-4 sm:px-6">
          <div className="absolute left-4 top-0 z-10 -translate-y-[38%] sm:left-6">
            <ProfileAvatarCard src={avatarUrl} priority />
          </div>

          <div className="flex min-h-20 items-center py-4 sm:min-h-24 sm:py-5">
            <div className="flex min-w-0 items-center gap-2.5 pl-[7.5rem] sm:gap-3 sm:pl-[9rem]">
              <h1 className="min-w-0 max-w-full">
                <span
                  className="inline-block max-w-full truncate rounded-md px-3 py-1.5 text-sm font-medium"
                  style={{ backgroundColor: pillBg, color: pillText }}
                >
                  {displayName}
                </span>
              </h1>
              {userIdPublic ? (
                <p className="shrink-0 text-sm text-neutral-500">@{userIdPublic}</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
