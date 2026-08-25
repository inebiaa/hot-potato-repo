import { Button, Input, Label } from '../ui';
import { useT } from '../../hooks/useCopy';

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
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-foreground">{t('event.createList')}</h3>
        <form onSubmit={onSubmit} className="space-y-4">
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
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-sm text-neutral-800 hover:bg-neutral-50"
          >
            <span>{t('event.listPrivate')}</span>
            <span
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                isPrivate ? 'bg-neutral-900' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  isPrivate ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit">{t('event.createList')}</Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
