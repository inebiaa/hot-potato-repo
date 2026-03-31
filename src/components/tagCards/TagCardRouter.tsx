import TagCardContent from './TagCardContent';
import { getRoleLabelForTagType } from './labels';
import type { TagEntityCardSharedProps } from './types';

export type TagCardRouterProps = { tagType: string } & TagEntityCardSharedProps;

/** Renders the entity card for the given tag type using shared layout and role label from labels. */
export default function TagCardRouter({ tagType, ...shared }: TagCardRouterProps) {
  return (
    <TagCardContent
      {...shared}
      roleLabel={getRoleLabelForTagType(tagType)}
      tagType={tagType}
    />
  );
}
