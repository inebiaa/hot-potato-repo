import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = {
  primary:
    'bg-primary text-primary-foreground hover:bg-neutral-800 disabled:bg-neutral-400 disabled:text-white',
  secondary:
    'bg-secondary text-secondary-foreground border border-border hover:bg-neutral-200 disabled:opacity-50',
  ghost: 'bg-transparent text-foreground hover:bg-accent disabled:opacity-50',
  danger:
    'bg-destructive text-destructive-foreground hover:bg-red-800 disabled:opacity-50',
} as const;

const sizes = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-10 px-4 py-2 text-sm',
  lg: 'min-h-11 px-6 py-3 text-base',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

export default Button;
