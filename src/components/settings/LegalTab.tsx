import { Input, Label } from '../ui';
import { Link } from 'react-router-dom';
import type { AppSettings } from '../../types/appSettings';

export type LegalTabProps = {
  settings: AppSettings;
  onChange: (patch: Partial<AppSettings>) => void;
};

export default function LegalTab({ settings, onChange }: LegalTabProps) {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="border-b border-border pb-1 text-sm font-semibold text-foreground">Contact</h3>
        <div>
          <Label htmlFor="settings-support-email">Support email</Label>
          <Input
            id="settings-support-email"
            type="email"
            value={settings.support_email || ''}
            onChange={(e) => onChange({ support_email: e.target.value })}
            placeholder="support@example.com"
            autoComplete="email"
          />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="border-b border-border pb-1 text-sm font-semibold text-foreground">Policies</h3>
        <div>
          <Label htmlFor="settings-privacy-url">Privacy policy URL</Label>
          <Input
            id="settings-privacy-url"
            type="url"
            value={settings.privacy_policy_url || ''}
            onChange={(e) => onChange({ privacy_policy_url: e.target.value })}
            placeholder="https://www.example.com/privacy"
          />
        </div>
        <div>
          <Label htmlFor="settings-terms-url">Terms of Service URL</Label>
          <Input
            id="settings-terms-url"
            type="url"
            value={settings.terms_of_service_url || ''}
            onChange={(e) => onChange({ terms_of_service_url: e.target.value })}
            placeholder="https://www.example.com/terms"
          />
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="border-b border-border pb-1 text-sm font-semibold text-foreground">Account deletion</h3>
        <p className="text-sm text-muted-foreground">
          Public web page for store listings:{' '}
          <Link to="/account-deletion" className="underline underline-offset-2">
            /account-deletion
          </Link>
        </p>
      </section>
    </div>
  );
}
