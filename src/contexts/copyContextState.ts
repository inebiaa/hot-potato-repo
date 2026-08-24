import { createContext } from 'react';
import { t as resolveT, type CopyKey, type CopyOverrides } from '../copy';

export type CopyContextValue = {
  overrides: CopyOverrides;
  t: (key: CopyKey) => string;
};

export const CopyContext = createContext<CopyContextValue>({
  overrides: {},
  t: (key) => resolveT(key),
});
