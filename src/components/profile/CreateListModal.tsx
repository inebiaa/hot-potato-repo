import { Button, Input, Label, Modal, formErrorClass, menuRowClass } from "../ui";
import { useT } from "../../hooks/useCopy";

interface CreateListModalProps {
  name: string;
  description: string;
  isPrivate: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPrivateChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

export default function CreateListModal({
  name,
  description,
  isPrivate,
  error,
  onNameChange,
  onDescriptionChange,
  onPrivateChange,
  onSubmit,
  onClose,
}: CreateListModalProps) {
  const t = useT();

  return (
    <Modal
      onClose={onClose}
      title={t("event.createList")}
      panelClassName="max-w-md sm:rounded-lg"
    >
      <form onSubmit={onSubmit} className="space-y-4 p-4 sm:p-6">
        <div>
          <Label htmlFor="new-list-name">Name</Label>
          <Input
            id="new-list-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Greatest shows of all time"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="new-list-description">Description</Label>
          <Input
            id="new-list-description"
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="e.g. My personal top 10"
          />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => onPrivateChange(!isPrivate)}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 ${menuRowClass} text-foreground hover:bg-muted`}
        >
          <span>{t("event.listPrivate")}</span>
          <span
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
              isPrivate ? "bg-primary" : "bg-muted-foreground/40"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-card transition-transform ${
                isPrivate ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </span>
        </button>
        {error ? <p className={formErrorClass}>{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit">{t("event.createList")}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
