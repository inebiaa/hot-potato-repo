import { ChevronRight } from 'lucide-react';
import type { Event } from '../../lib/supabase';
import { Input } from '../ui';
import { useT } from '../../hooks/useCopy';

interface AddEventToListModalProps {
  search: string;
  error: string;
  events: Event[];
  onSearchChange: (value: string) => void;
  onAdd: (eventId: string) => void;
  onClose: () => void;
}

export default function AddEventToListModal({
  search,
  error,
  events,
  onSearchChange,
  onAdd,
  onClose,
}: AddEventToListModalProps) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative max-w-lg w-full my-8" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-xl w-full max-h-[80vh] flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold">{t('event.addShow')}</h3>
          </div>
          {error && (
            <p className="px-4 py-2 text-sm text-red-600 bg-red-50">{error}</p>
          )}
          <div className="p-4 border-b">
            <Input
              type="text"
              placeholder="Search shows..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="overflow-y-auto flex-1 p-4 space-y-1">
            {events.slice(0, 50).map((event) => (
              <li key={event.id}>
                <button
                  onClick={() => onAdd(event.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900">{event.name}</span>
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </li>
            ))}
            {events.length === 0 && (
              <li className="text-gray-500 py-4 text-sm">
                No matching shows or all are already in this list.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
