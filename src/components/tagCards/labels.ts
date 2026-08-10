/** Role line under the entity name for unknown or future tag types. */
export function getRoleLabelForTagType(tagType: string): string {
  switch (tagType) {
    case 'producer':
      return 'Producer';
    case 'designer':
      return 'Designer';
    case 'artist':
      return 'Artist';
    case 'model':
      return 'Model';
    case 'hair_makeup':
      return 'Hair & Makeup Artist';
    case 'city':
      return 'City';
    case 'venue':
      return 'Venue';
    case 'season':
      return 'Season';
    case 'show_type':
      return 'Show type';
    case 'header_tags':
      return 'Genre';
    case 'footer_tags':
      return 'Collection';
    default:
      return 'Tag';
  }
}
