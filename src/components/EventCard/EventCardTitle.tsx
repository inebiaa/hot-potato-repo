import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { typeHeadline } from '../ui';

const EVENT_TITLE_CLASS = `inline min-w-0 ${typeHeadline} text-foreground`;
const EVENT_TITLE_INTERACTIVE_CLASS =
  'cursor-pointer text-left hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm';

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
      <button
        type="button"
        onClick={() => onViewClick(eventId)}
        className={cn(EVENT_TITLE_CLASS, EVENT_TITLE_INTERACTIVE_CLASS)}
      >
        {name}
      </button>
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
