import type { LucideIcon } from 'lucide-react';
import { Clapperboard } from 'lucide-react';
import { getIcon } from '../../lib/eventCardIcons';
import type { TagColorsForPills } from './types';

/** Same icon family as EventCard section headers for each tag kind. */
export function getTagSectionIcon(tagType: string, tagColors?: TagColorsForPills): LucideIcon {
  const c = tagColors;
  switch (tagType) {
    case 'producer':
      return getIcon(c?.producer_icon, 'producer_icon');
    case 'designer':
      return getIcon(c?.designer_icon, 'designer_icon');
    case 'model':
      return getIcon(c?.model_icon, 'model_icon');
    case 'hair_makeup':
      return getIcon(c?.hair_makeup_icon, 'hair_makeup_icon');
    case 'city':
      return getIcon(c?.city_icon, 'city_icon');
    case 'season':
      return getIcon(c?.season_icon, 'season_icon');
    case 'header_tags':
      return getIcon(c?.header_tags_icon, 'header_tags_icon');
    case 'footer_tags':
      return getIcon(c?.footer_tags_icon, 'footer_tags_icon');
    default:
      return Clapperboard;
  }
}
