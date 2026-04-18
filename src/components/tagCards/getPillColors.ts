import type { TagColorsForPills } from './types';

/** Resolves pill background/text from app tag colors; unknown types use optional tag colors. */
export function getPillColors(tagType: string, tagColors?: TagColorsForPills): { bg: string; text: string } {
  const c = tagColors || {};
  switch (tagType) {
    case 'producer':
      return { bg: c.producer_bg_color || '#f3f4f6', text: c.producer_text_color || '#374151' };
    case 'designer':
      return { bg: c.designer_bg_color || '#fef3c7', text: c.designer_text_color || '#b45309' };
    case 'model':
      return { bg: c.model_bg_color || '#fce7f3', text: c.model_text_color || '#be185d' };
    case 'hair_makeup':
      return { bg: c.hair_makeup_bg_color || '#f3e8ff', text: c.hair_makeup_text_color || '#7c3aed' };
    case 'city':
      return { bg: c.city_bg_color || '#dbeafe', text: c.city_text_color || '#1e40af' };
    case 'venue':
      return { bg: c.city_bg_color || '#dbeafe', text: c.city_text_color || '#1e40af' };
    case 'season':
    case 'year':
      return { bg: c.season_bg_color || '#ffedd5', text: c.season_text_color || '#c2410c' };
    case 'header_tags':
      return { bg: c.header_tags_bg_color || '#ccfbf1', text: c.header_tags_text_color || '#0f766e' };
    case 'footer_tags':
      return { bg: c.footer_tags_bg_color || '#d1fae5', text: c.footer_tags_text_color || '#065f46' };
    case 'custom_performer':
    default:
      return { bg: c.optional_tags_bg_color || '#e0e7ff', text: c.optional_tags_text_color || '#3730a3' };
  }
}
