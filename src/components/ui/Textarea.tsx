import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { formControlClass, formControlPaddingClass, formControlTextClass } from './field';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      formControlClass,
      formControlPaddingClass,
      formControlTextClass,
      'placeholder:text-muted-foreground',
      className,
    )}
    {...props}
  />
));

Textarea.displayName = 'Textarea';

export default Textarea;
