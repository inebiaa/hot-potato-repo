import { useContext } from 'react';
import type { CopyKey, CopyOverrides } from '../copy';
import { CopyContext } from '../contexts/copyContextState';

export function useT(): (key: CopyKey) => string {
  return useContext(CopyContext).t;
}

export function useCopyOverrides(): CopyOverrides {
  return useContext(CopyContext).overrides;
}
