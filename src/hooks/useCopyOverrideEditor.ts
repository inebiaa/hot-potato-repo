import { useCallback } from 'react';
import { type CopyKey } from '../copy';
import { useAuth } from '../contexts/AuthContext';
import { useAppSettings } from './useAppSettings';
import { buildCopyOverridesPatch, saveCopyOverridesToDb } from '../lib/saveCopyOverrides';

export function useCopyOverrideEditor() {
  const { user, isAdmin } = useAuth();
  const { setAppSettings } = useAppSettings();

  const updateCopyOverride = useCallback(
    (key: CopyKey, value: string): string => {
      if (!isAdmin) return '';
      let serialized = '';
      setAppSettings((prev) => {
        if (!prev) return prev;
        serialized = buildCopyOverridesPatch(prev.copy_overrides, key, value);
        return { ...prev, copy_overrides: serialized };
      });
      return serialized;
    },
    [isAdmin, setAppSettings],
  );

  const persistCopyOverrides = useCallback(
    async (serialized: string) => {
      if (!isAdmin || !user) return;
      await saveCopyOverridesToDb(user.id, serialized);
    },
    [isAdmin, user],
  );

  return { isAdmin, updateCopyOverride, persistCopyOverrides };
}
