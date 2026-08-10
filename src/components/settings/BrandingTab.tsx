import type { AppSettings } from '../../types/appSettings';
import { Input, Label } from '../ui';

type BrandingTabProps = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

/** Admin branding fields — uses shared form controls. */
export default function BrandingTab({ settings, onChange }: BrandingTabProps) {
  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-neutral-100 p-3 text-sm text-neutral-800">
        <strong>Images:</strong> Upload to{' '}
        <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" className="underline">
          Imgur
        </a>{' '}
        or{' '}
        <a href="https://postimages.org" target="_blank" rel="noopener noreferrer" className="underline">
          PostImages
        </a>
        , then paste the direct URL.
      </div>

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

      <div>
        <Label htmlFor="settings-app-icon">App Icon URL</Label>
        <Input
          id="settings-app-icon"
          type="url"
          value={settings.app_icon_url}
          onChange={(e) => onChange({ app_icon_url: e.target.value })}
          placeholder="https://..."
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
          placeholder="https://..."
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
          placeholder="https://..."
        />
        {settings.app_favicon_url ? (
          <img src={settings.app_favicon_url} alt="" className="mt-2 h-8 w-8 rounded-lg border object-cover" />
        ) : null}
      </div>
    </>
  );
}
