import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { formControlClass, formControlPaddingClass, formControlTextClass } from './field';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
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

Input.displayName = 'Input';

export default Input;
