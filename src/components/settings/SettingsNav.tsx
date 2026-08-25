import type { TabId } from './settingsConstants';

export type SettingsNavItem = { id: TabId; label: string };

export function settingsNavItems(isAdmin: boolean): SettingsNavItem[] {
  if (!isAdmin) {
    return [{ id: 'account', label: 'Account' }];
  }
  return [
    { id: 'account', label: 'Account' },
    { id: 'branding', label: 'Branding' },
    { id: 'copy', label: 'Copy' },
    { id: 'tags', label: 'Tags' },
    { id: 'legal', label: 'Legal' },
    { id: 'moderation', label: 'Moderation' },
    { id: 'admins', label: 'Admins' },
  ];
}

type SettingsNavProps = {
  items: SettingsNavItem[];
  activeTab: TabId;
  onChange: (id: TabId) => void;
};

/** Flat settings nav: wrap chips on phone, sticky sidebar on desktop. */
export default function SettingsNav({ items, activeTab, onChange }: SettingsNavProps) {
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Settings" className="md:sticky md:top-4 md:self-start">
      <ul className="flex flex-wrap gap-2 md:flex-col md:flex-nowrap">
        {items.map((item) => {
          const active = item.id === activeTab;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChange(item.id)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors md:w-full md:text-left ${
                  active
                    ? 'bg-neutral-200 font-medium text-neutral-900'
                    : 'bg-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
