import { createContext, useContext, type ReactNode } from 'react';
import type { TagResolutionMap } from '../lib/tagDisplayResolution';

export const TagDisplayContext = createContext<TagResolutionMap | null>(null);

export function TagDisplayProvider({
  map,
  children,
}: {
  map: TagResolutionMap | null;
  children: ReactNode;
}) {
  return <TagDisplayContext.Provider value={map}>{children}</TagDisplayContext.Provider>;
}

export function useTagDisplayMap(): TagResolutionMap | null {
  return useContext(TagDisplayContext);
}
