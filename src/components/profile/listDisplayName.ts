import type { ListWithCount } from './types';

type Translate = (key: string) => string;

export function listDisplayName(
  list: ListWithCount | undefined,
  opts: { isOwnProfile: boolean; username: string; t: Translate },
): string {
  if (!list) return '';
  const { isOwnProfile, username, t } = opts;
  if (list.is_rated_list) {
    if (isOwnProfile) return t('event.ratedListName');
    const name = username.trim() || t('nav.profile');
    return t('event.ratedListNameForUser').replace('{name}', name);
  }
  if (list.is_liked_list) {
    if (isOwnProfile) return t('event.likedListName');
    const name = username.trim() || t('nav.profile');
    return t('event.likedListNameForUser').replace('{name}', name);
  }
  return list.name;
}
