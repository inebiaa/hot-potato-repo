import {
  COPY_OVERRIDES_SETTING_KEY,
  serializeCopyOverrides,
  patchCopyOverride,
  parseCopyOverrides,
  type CopyKey,
} from '../copy';
import { supabase } from './supabase';

export function buildCopyOverridesPatch(
  rawOverrides: string | null | undefined,
  key: CopyKey,
  value: string
): string {
  const current = parseCopyOverrides(rawOverrides);
  return serializeCopyOverrides(patchCopyOverride(current, key, value));
}

export async function saveCopyOverridesToDb(userId: string, serialized: string): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(
    {
      key: COPY_OVERRIDES_SETTING_KEY,
      value: serialized,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' },
  );
  if (error) throw error;
}
