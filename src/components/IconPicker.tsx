import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { EVENT_CARD_ICONS, getIcon } from '../lib/eventCardIcons';

interface IconPickerProps {
  label: string;
  value: string;
  onChange: (iconName: string) => void;
}

const ICON_NAMES = ['Tag', 'Star', 'Users', 'Scissors', 'MapPin', 'Calendar', 'Sparkles', 'Palette'];

export default function IconPicker({ label, value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const IconComponent = getIcon(value, 'producer_icon');

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-center gap-1 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title={value || 'Tag'}
          aria-label={label || `Icon: ${value || 'Tag'}`}
        >
          <IconComponent size={20} className="text-gray-700 shrink-0" />
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
            <div className="absolute left-0 z-20 mt-1 min-w-[220px] w-max max-w-[min(100vw,320px)] max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1">
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
                    className={`p-2 rounded-md hover:bg-gray-100 flex items-center justify-center ${value === name ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
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
