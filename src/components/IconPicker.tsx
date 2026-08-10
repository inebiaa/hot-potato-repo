import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EVENT_CARD_ICONS, getIcon } from '../lib/eventCardIcons';
import { formControlClass, formControlPaddingClass } from './ui/field';
import { cn } from '../lib/utils';

interface IconPickerProps {
  label: string;
  value: string;
  onChange: (iconName: string) => void;
}

const ICON_NAMES = ['Tag', 'Star', 'Users', 'Scissors', 'MapPin', 'Calendar', 'Sparkles', 'Palette'];

export default function IconPicker({ label, value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const IconComponent = getIcon(value, 'producer_icon');
  const hasSelection = !!value;

  return (
    <div>
      {label && <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            formControlClass,
            formControlPaddingClass,
            'flex min-h-10 items-center justify-center gap-2 hover:bg-muted',
          )}
          title={hasSelection ? value : 'None'}
          aria-label={label || `Icon: ${hasSelection ? value : 'None'}`}
        >
          {hasSelection ? (
            <IconComponent size={20} className="text-gray-700 shrink-0" />
          ) : (
            <span className="text-xs text-gray-500 shrink-0">None</span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
            <div className="absolute left-0 z-20 mt-1 min-w-[220px] w-max max-w-[min(100vw,320px)] max-h-64 overflow-y-auto overscroll-y-contain bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 sm:grid-cols-6 gap-1">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className={`col-span-full min-h-11 px-3 text-sm sm:text-xs rounded-md border text-left ${!hasSelection ? 'bg-neutral-100 border-neutral-300 text-neutral-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                title="No icon"
              >
                No icon
              </button>
              {ICON_NAMES.map((name) => {
                const Icon = EVENT_CARD_ICONS[name];
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      onChange(name);
                      setIsOpen(false);
                    }}
                    className={`min-h-11 min-w-11 rounded-md hover:bg-gray-100 flex items-center justify-center ${value === name ? 'bg-neutral-100 ring-1 ring-neutral-300' : ''}`}
                    title={name}
                  >
                    <Icon size={20} className="text-gray-700" />
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
