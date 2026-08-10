import type { AppSettings } from '../../types/appSettings';
import {
  COPY_CATALOG,
  COPY_GROUP_LABELS,
  COPY_SETTINGS_KEYS,
  parseCopyOverrides,
  serializeCopyOverrides,
  type CopyGroup,
  type CopyKey,
  type CopyOverrides,
} from '../../copy';
import { Input, Label, Textarea } from '../ui';

type CopyTabProps = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

const GROUP_ORDER: CopyGroup[] = ['search', 'form'];

function isLongField(key: CopyKey): boolean {
  return key.includes('placeholder');
}

export default function CopyTab({ settings, onChange }: CopyTabProps) {
  const overrides = parseCopyOverrides(settings.copy_overrides);

  const setValue = (key: CopyKey, value: string) => {
    const next: CopyOverrides = { ...overrides };
    if (value === COPY_CATALOG[key].default) delete next[key];
    else next[key] = value;
    onChange({ copy_overrides: serializeCopyOverrides(next) });
  };

  const byGroup = GROUP_ORDER.map((group) => ({
    group,
    keys: COPY_SETTINGS_KEYS.filter((key) => COPY_CATALOG[key].group === group),
  })).filter((g) => g.keys.length > 0);

  return (
    <div className="space-y-6">
      {byGroup.map(({ group, keys }) => (
        <section key={group} className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-800 border-b border-neutral-200 pb-1">
            {COPY_GROUP_LABELS[group]}
          </h3>
          {keys.map((key) => {
            const entry = COPY_CATALOG[key];
            const value = overrides[key] ?? entry.default;
            const id = `copy-${key}`;
            return (
              <div key={key}>
                <Label htmlFor={id}>{entry.label}</Label>
                {isLongField(key) ? (
                  <Textarea
                    id={id}
                    rows={2}
                    value={value}
                    onChange={(e) => setValue(key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={id}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(key, e.target.value)}
                  />
                )}
                <p className="mt-0.5 text-[11px] text-neutral-400 font-mono">{key}</p>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
