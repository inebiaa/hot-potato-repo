import { Loader2 } from 'lucide-react';

type LoadingSpinnerProps = {
  className?: string;
  size?: number;
};

/** Circular Lucide spinner (replaces border-only spin rings). */
export default function LoadingSpinner({ className = 'text-gray-400', size = 40 }: LoadingSpinnerProps) {
  return <Loader2 className={`animate-spin ${className}`} size={size} strokeWidth={2} aria-hidden />;
}
