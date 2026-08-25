import { Link } from 'react-router-dom';

const EVENT_TITLE_CLASS =
  'inline min-w-0 text-lg sm:text-xl font-bold leading-snug text-gray-900';

interface EventCardTitleProps {
  name: string;
  viewHref?: string;
  /** When set, title is plain text (card click / overlay handles navigation). */
  onViewClick?: (eventId: string) => void;
}

export default function EventCardTitle({ name, viewHref, onViewClick }: EventCardTitleProps) {
  if (viewHref && !onViewClick) {
    if (viewHref.startsWith('http://') || viewHref.startsWith('https://')) {
      return (
        <a href={viewHref} className={EVENT_TITLE_CLASS}>
          {name}
        </a>
      );
    }
    return (
      <Link to={viewHref} className={EVENT_TITLE_CLASS}>
        {name}
      </Link>
    );
  }
  return <h3 className={EVENT_TITLE_CLASS}>{name}</h3>;
}
