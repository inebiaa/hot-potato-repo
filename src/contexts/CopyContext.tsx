import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  overridesFromSettings,
  t as resolveT,
  type CopyKey,
  type CopyOverrides,
} from '../copy';
import type { AppSettings } from '../types/appSettings';

type CopyContextValue = {
  overrides: CopyOverrides;
  t: (key: CopyKey) => string;
};

const CopyContext = createContext<CopyContextValue>({
  overrides: {},
  t: (key) => resolveT(key),
});

export function CopyProvider({
  settings,
  children,
}: {
  settings: AppSettings | null | undefined;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const overrides = overridesFromSettings(settings);
    return {
      overrides,
      t: (key: CopyKey) => resolveT(key, overrides),
    };
  }, [settings?.copy_overrides]);

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}

export function useT(): (key: CopyKey) => string {
  return useContext(CopyContext).t;
}

export function useCopyOverrides(): CopyOverrides {
  return useContext(CopyContext).overrides;
}
