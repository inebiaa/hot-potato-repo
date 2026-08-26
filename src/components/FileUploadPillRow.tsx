import FileUploadPill from './FileUploadPill';
import { TAG_INPUT_EDIT_PILL_COLORS, TAG_PILL_ROW_CLASS, tagPillSegmentShellClass } from './tagPillShell';
import { formControlClass, formControlPaddingClass } from './ui/field';
import { cn } from '../lib/utils';

type FileUploadPillRowProps = {
  fileInputId: string;
  accept?: string;
  disabled?: boolean;
  chooseLabel: string;
  onFile: (file: File | null) => void;
  removeLabel?: string;
  onRemove?: () => void;
  showRemove?: boolean;
  className?: string;
};

const pillButtonClass = cn(
  tagPillSegmentShellClass,
  'cursor-pointer select-none transition-opacity hover:opacity-80',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

/** Choose file (+ optional remove) in a compact bordered shell sized to its pills. */
export default function FileUploadPillRow({
  fileInputId,
  accept,
  disabled,
  chooseLabel,
  onFile,
  removeLabel,
  onRemove,
  showRemove = false,
  className,
}: FileUploadPillRowProps) {
  const canRemove = showRemove && onRemove && removeLabel;
  const { backgroundColor, color } = TAG_INPUT_EDIT_PILL_COLORS;

  return (
    <div
      className={cn(
        formControlClass,
        formControlPaddingClass,
        TAG_PILL_ROW_CLASS,
        'inline-flex w-fit min-h-10',
        className,
      )}
    >
      <FileUploadPill
        id={fileInputId}
        accept={accept}
        disabled={disabled}
        onFile={onFile}
      >
        {chooseLabel}
      </FileUploadPill>
      {canRemove ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          className={pillButtonClass}
          style={{ backgroundColor, color }}
        >
          {removeLabel}
        </button>
      ) : null}
    </div>
  );
}
