import type { AppSettings } from '../../types/appSettings';
import {
  COPY_CATALOG,
  parseCopyOverrides,
  serializeCopyOverrides,
  type CopyKey,
  type CopyOverrides,
} from '../../copy';
import { Input, Label, Textarea } from '../ui';

type BrandingTabProps = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

const HOME_COPY_KEYS: { key: CopyKey; label: string; long?: boolean }[] = [
  { key: 'home.title', label: 'Home title' },
  { key: 'home.subtitleSignedIn', label: 'Home subtitle (signed in)', long: true },
  { key: 'home.subtitleSignedOut', label: 'Home subtitle (signed out)', long: true },
];

/** Admin branding fields — uses shared form controls. */
export default function BrandingTab({ settings, onChange }: BrandingTabProps) {
  const overrides = parseCopyOverrides(settings.copy_overrides);

  const setHomeCopy = (key: CopyKey, value: string) => {
    const next: CopyOverrides = { ...overrides };
    if (value === COPY_CATALOG[key].default) delete next[key];
    else next[key] = value;
    onChange({ copy_overrides: serializeCopyOverrides(next) });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800 border-b border-neutral-200 pb-1">Name</h3>
        <div>
          <Label htmlFor="settings-app-name" required>
            App Name
          </Label>
          <Input
            id="settings-app-name"
            type="text"
            value={settings.app_name}
            onChange={(e) => onChange({ app_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="settings-tagline">Tagline</Label>
          <Input
            id="settings-tagline"
            type="text"
            value={settings.tagline}
            onChange={(e) => onChange({ tagline: e.target.value })}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800 border-b border-neutral-200 pb-1">Home</h3>
        {HOME_COPY_KEYS.map(({ key, label, long }) => {
          const id = `settings-${key}`;
          const value = overrides[key] ?? COPY_CATALOG[key].default;
          return (
            <div key={key}>
              <Label htmlFor={id}>{label}</Label>
              {long ? (
                <Textarea
                  id={id}
                  rows={2}
                  value={value}
                  onChange={(e) => setHomeCopy(key, e.target.value)}
                />
              ) : (
                <Input
                  id={id}
                  type="text"
                  value={value}
                  onChange={(e) => setHomeCopy(key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-800 border-b border-neutral-200 pb-1">Images</h3>
        <div>
          <Label htmlFor="settings-app-icon">App Icon URL</Label>
          <Input
            id="settings-app-icon"
            type="url"
            value={settings.app_icon_url}
            onChange={(e) => onChange({ app_icon_url: e.target.value })}
          />
          {settings.app_icon_url ? (
            <img src={settings.app_icon_url} alt="" className="mt-2 h-12 w-12 rounded-lg border object-cover" />
          ) : null}
        </div>
        <div>
          <Label htmlFor="settings-app-logo">App Logo URL</Label>
          <Input
            id="settings-app-logo"
            type="url"
            value={settings.app_logo_url}
            onChange={(e) => onChange({ app_logo_url: e.target.value })}
          />
          {settings.app_logo_url ? (
            <img src={settings.app_logo_url} alt="" className="mt-2 h-10 object-contain" />
          ) : null}
        </div>
        <div>
          <Label htmlFor="settings-app-favicon">App Favicon URL</Label>
          <Input
            id="settings-app-favicon"
            type="url"
            value={settings.app_favicon_url}
            onChange={(e) => onChange({ app_favicon_url: e.target.value })}
          />
          {settings.app_favicon_url ? (
            <img src={settings.app_favicon_url} alt="" className="mt-2 h-8 w-8 rounded-lg border object-cover" />
          ) : null}
        </div>
      </section>
    </div>
  );
}
