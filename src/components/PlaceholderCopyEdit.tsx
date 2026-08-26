import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { COPY_CATALOG, type CopyKey } from '../copy';
import { useAuth } from '../contexts/AuthContext';
import { useCopyOverrides } from '../hooks/useCopy';
import { useCopyOverrideEditor } from '../hooks/useCopyOverrideEditor';
import { Input } from './ui';
import type { InputProps } from './ui';
import { cn } from '../lib/utils';

type EmptyFieldPlaceholderOverlayProps = {
  copyKey: CopyKey;
  placeholder: string;
  className?: string;
};

/** Ghost placeholder text; admin hover pencil swaps to inline edit (no popup). */
export function EmptyFieldPlaceholderOverlay({
  copyKey,
  placeholder,
  className,
}: EmptyFieldPlaceholderOverlayProps) {
  const { isAdmin } = useAuth();
  const overrides = useCopyOverrides();
  const { updateCopyOverride, persistCopyOverrides } = useCopyOverrideEditor();
  const defaultValue = COPY_CATALOG[copyKey].default;
  const resolved = overrides[copyKey] ?? defaultValue;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(resolved);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setValue(resolved);
  }, [resolved, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!isAdmin) return null;

  const save = async () => {
    const serialized = updateCopyOverride(copyKey, value);
    setSaving(true);
    try {
      await persistCopyOverrides(serialized);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const cancel = () => {
    setValue(resolved);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        className={cn(
          'absolute inset-y-0 left-0 right-0 flex items-center text-muted-foreground type-callout',
          className,
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={saving}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            updateCopyOverride(copyKey, next);
          }}
          onBlur={() => void save()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          className="min-w-0 w-full border-0 bg-transparent p-0 text-muted-foreground type-callout outline-none focus:ring-0"
          aria-label="Edit field example"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-y-0 left-0 right-0 flex w-full items-center gap-2 text-muted-foreground type-callout',
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setEditing(true);
        }}
        className={cn(
          'pointer-events-auto inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
          'text-muted-foreground opacity-0 transition-opacity',
          'group-hover:opacity-100 hover:bg-muted hover:text-foreground',
          'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="Edit field example"
      >
        <Pencil size={12} aria-hidden />
      </button>
    </div>
  );
}

export function formatCustomTagPlaceholder(template: string, label: string): string {
  return template.replace(/\{label\}/g, label);
}

type AdminPlaceholderInputProps = InputProps & {
  copyKey: CopyKey;
  placeholder: string;
};

/** Input with admin-only in-field placeholder overlay when empty. */
export function AdminPlaceholderInput({
  copyKey,
  placeholder,
  value,
  className,
  ...props
}: AdminPlaceholderInputProps) {
  const { isAdmin } = useAuth();
  const isEmpty = !String(value ?? '').trim();
  const showOverlay = isAdmin && isEmpty;

  return (
    <div className="group relative">
      <Input
        {...props}
        value={value}
        placeholder={showOverlay ? '' : placeholder}
        className={className}
      />
      {showOverlay ? (
        <EmptyFieldPlaceholderOverlay
          copyKey={copyKey}
          placeholder={placeholder}
          className="px-3"
        />
      ) : null}
    </div>
  );
}
