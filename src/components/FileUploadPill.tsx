import { useRef, type ReactNode } from 'react';
import { TAG_INPUT_EDIT_PILL_COLORS, tagPillSegmentShellClass } from './tagPillShell';
import { cn } from '../lib/utils';

type FileUploadPillProps = {
  id: string;
  accept?: string;
  disabled?: boolean;
  onFile: (file: File | null) => void;
  children: ReactNode;
  className?: string;
};

/** Hidden file input triggered by a neutral tag pill (same as TagInput / search chips). */
export default function FileUploadPill({
  id,
  accept,
  disabled,
  onFile,
  children,
  className,
}: FileUploadPillProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { backgroundColor: bg, color: text } = TAG_INPUT_EDIT_PILL_COLORS;

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          tagPillSegmentShellClass,
          'cursor-pointer select-none transition-opacity hover:opacity-80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        style={{ backgroundColor: bg, color: text }}
      >
        {children}
      </button>
    </>
  );
}
