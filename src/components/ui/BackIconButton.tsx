import { ArrowLeft } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const shellClass =
  'inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-card';

type BackIconButtonProps = {
  label: string;
  size?: 'sm' | 'md';
  className?: string;
  href?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export default function BackIconButton({
  label,
  size = 'md',
  className,
  href,
  type = 'button',
  ...props
}: BackIconButtonProps) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 18 : 20;
  const classes = cn(shellClass, dim, className);
  const icon = <ArrowLeft size={iconSize} strokeWidth={2} aria-hidden />;

  if (href) {
    return (
      <a href={href} aria-label={label} title={label} className={classes}>
        {icon}
      </a>
    );
  }

  return (
    <button type={type} aria-label={label} title={label} className={classes} {...props}>
      {icon}
    </button>
  );
}
