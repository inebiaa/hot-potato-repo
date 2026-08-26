import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

/** Typography comes from the title row wrapper (type-headline leading-snug). */
const EVENT_TITLE_CLASS = 'inline min-w-0 text-foreground';
const EVENT_TITLE_INTERACTIVE_CLASS =
  'cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm';

interface EventCardTitleProps {
  name: string;
  eventId: string;
  viewHref?: string;
  onViewClick?: (eventId: string) => void;
}

export default function EventCardTitle({
  name,
  eventId,
  viewHref,
  onViewClick,
}: EventCardTitleProps) {
  if (onViewClick) {
    return (
      <h3
        role="button"
        tabIndex={0}
        onClick={() => onViewClick(eventId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onViewClick(eventId);
          }
        }}
        className={cn(EVENT_TITLE_CLASS, EVENT_TITLE_INTERACTIVE_CLASS)}
      >
        {name}
      </h3>
    );
  }

  if (viewHref) {
    if (viewHref.startsWith('http://') || viewHref.startsWith('https://')) {
      return (
        <a
          href={viewHref}
          className={cn(EVENT_TITLE_CLASS, EVENT_TITLE_INTERACTIVE_CLASS)}
        >
          {name}
        </a>
      );
    }
    return (
      <Link
        to={viewHref}
        className={cn(EVENT_TITLE_CLASS, EVENT_TITLE_INTERACTIVE_CLASS)}
      >
        {name}
      </Link>
    );
  }

  return <h3 className={EVENT_TITLE_CLASS}>{name}</h3>;
}
