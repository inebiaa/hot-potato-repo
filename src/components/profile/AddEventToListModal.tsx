import { ChevronRight } from "lucide-react";
import type { Event } from "../../lib/supabase";
import { Button, Input, Label, Modal, formErrorClass, typeCallout } from "../ui";
import { useT } from "../../hooks/useCopy";

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
    <Modal
      onClose={onClose}
      title={t("event.addShow")}
      panelClassName="max-w-lg sm:rounded-lg"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      {error && (
        <p className={`px-4 py-2 ${formErrorClass} bg-red-50`}>{error}</p>
      )}
      <div className="shrink-0 border-b p-4">
        <Input
          type="text"
          placeholder="Search shows..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          autoFocus
        />
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-4">
        {events.slice(0, 50).map((event) => (
          <li key={event.id}>
            <button
              onClick={() => onAdd(event.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-muted"
            >
              <span className="font-medium text-foreground">{event.name}</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </li>
        ))}
        {events.length === 0 ? (
          <li className={`py-4 ${typeCallout} text-muted-foreground`}>
            No matching shows or all are already in this list.
          </li>
        ) : null}
      </ul>
    </Modal>
  );
}
