import { useMemo, type ReactNode } from 'react';
import { parseCopyOverrides, t as resolveT, type CopyKey } from '../copy';
import type { AppSettings } from '../types/appSettings';
import { CopyContext } from './copyContextState';

export function CopyProvider({
  settings,
  children,
}: {
  settings: AppSettings | null | undefined;
  children: ReactNode;
}) {
  const copyOverridesRaw = settings?.copy_overrides;

  const value = useMemo(() => {
    const overrides = parseCopyOverrides(copyOverridesRaw);
    return {
      overrides,
      t: (key: CopyKey) => resolveT(key, overrides),
    };
  }, [copyOverridesRaw]);

  return <CopyContext.Provider value={value}>{children}</CopyContext.Provider>;
}
