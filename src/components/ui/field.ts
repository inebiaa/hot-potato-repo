/** Shared shell for text inputs, textareas, TagInput boxes, and similar controls. */
export const formControlClass =
  'w-full rounded-lg border border-input bg-card text-foreground ' +
  'focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const formControlPaddingClass = 'px-3 py-2';

export const formControlTextClass = 'type-body';

/** Form hints, upload progress, legal footnotes (12px). */
export const formHintClass = 'type-caption text-muted-foreground';

/** Inline validation / submit errors (14px). */
export const formErrorClass = 'type-callout text-destructive';

/** Inline success after submit (14px). */
export const formSuccessClass = 'type-callout text-green-700';

/** Settings subsection title on a tab (14px, semibold). */
export const sectionHeadClass = 'type-callout font-semibold text-foreground';

/** Overflow / option menu row label size (14px). */
export const menuRowClass = 'type-callout';
