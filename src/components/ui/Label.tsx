import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
};

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('mb-1 block text-sm font-medium text-foreground', className)}
      {...props}
    >
      {children}
      {required ? <span className="text-muted-foreground"> *</span> : null}
    </label>
  ),
);

Label.displayName = 'Label';

export default Label;
