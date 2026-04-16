import { Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { shortenEventNameUsingFooterTags } from '../../lib/collectionTagDisplay';
import { fetchAliasStringsForTag } from '../../lib/tagIdentity';
import { getPillColors } from './getPillColors';
import { getTagSectionIcon } from './tagSectionIcon';
import type { TagEntityCardSharedProps } from './types';

export interface TagCardContentProps extends TagEntityCardSharedProps {
  /** Shown under the entity name (e.g. Designer, Collection). */
  roleLabel: string;
  /** Used for pill colors (designer, producer, header_tags, …). */
  tagType: string;
}

export default function TagCardContent({
  tagValue,
  roleLabel,
  tagType,
  eventRatings,
  totalShows,
  overallAverage,
  totalRatings,
  onEventClick,
  tagColors,
}: TagCardContentProps) {
  /** Match EventCard tag sections (~2 lines then +N); pills row has no inner scroll. */
  const TAG_LIMIT = 8;
  const [pillsExpanded, setPillsExpanded] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [aliasPills, setAliasPills] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setAliasPills([]);
    (async () => {
      const list = await fetchAliasStringsForTag(tagType, tagValue);
      if (!cancelled) setAliasPills(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [tagType, tagValue]);

  const pillColors = getPillColors(tagType, tagColors);
  const SectionIcon = getTagSectionIcon(tagType, tagColors);

  const handleEventClick = (eventId: string) => {
    onEventClick?.(eventId);
  };

  const sortedEventRatings = useMemo(() => {
    return [...eventRatings].sort((a, b) => {
      const dateA = a.event?.date || '';
      const dateB = b.event?.date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return a.event_name.localeCompare(b.event_name);
    });
  }, [eventRatings]);

  const showPillLabel = (row: (typeof eventRatings)[0]) =>
    row.event?.footer_tags?.length
      ? shortenEventNameUsingFooterTags(row.event_name, row.event.footer_tags)
      : row.event_name;

  const pillClass =
    'inline-flex items-center gap-1 text-xs px-2 py-1 max-sm:px-2.5 max-sm:py-2 rounded-md transition-colors hover:opacity-80 break-words max-w-full text-left';

  const aliasPillClass =
    'inline-flex items-center gap-1 text-xs px-2 py-1 max-sm:px-2.5 max-sm:py-2 rounded-md break-words max-w-full text-left';

  const visiblePills =
    !pillsExpanded && sortedEventRatings.length > TAG_LIMIT
      ? sortedEventRatings.slice(0, TAG_LIMIT)
      : sortedEventRatings;

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate">{tagValue}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{roleLabel}</p>
        </div>
      </div>

      {aliasPills.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-700 mb-1">Also known as</div>
          <div className="flex flex-wrap gap-1 items-center">
            {aliasPills.map((alias) => (
              <span
                key={alias}
                className={aliasPillClass}
                style={{ backgroundColor: pillColors.bg, color: pillColors.text }}
              >
                {alias}
              </span>
            ))}
          </div>
        </div>
      )}

      {sortedEventRatings.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
            <div className="flex items-center min-w-0">
              <SectionIcon size={14} className="mr-1 shrink-0" />
              Shows
            </div>
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            {visiblePills.map((row) =>
              onEventClick ? (
                <button
                  key={row.event_id}
                  type="button"
                  onClick={() => handleEventClick(row.event_id)}
                  className={`${pillClass} cursor-pointer`}
                  style={{ backgroundColor: pillColors.bg, color: pillColors.text }}
                >
                  {showPillLabel(row)}
                </button>
              ) : (
                <span
                  key={row.event_id}
                  className={pillClass}
                  style={{ backgroundColor: pillColors.bg, color: pillColors.text }}
                >
                  {showPillLabel(row)}
                </span>
              )
            )}
            {sortedEventRatings.length > TAG_LIMIT && (
              <button
                type="button"
                onClick={() => setPillsExpanded((x) => !x)}
                className="text-xs text-gray-400 hover:text-gray-600 inline-flex shrink-0 items-center justify-center px-2 py-1 max-sm:px-2.5 max-sm:py-2 rounded-md"
                title={pillsExpanded ? 'Show less' : 'View more shows'}
              >
                {pillsExpanded ? '−' : `+${sortedEventRatings.length - TAG_LIMIT}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Match EventCard rating row height (invisible Rate Show spacer); non-interactive — no hover/focus affordances. */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center min-w-0 p-2 -ml-2">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={18}
                className={star <= overallAverage ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
              />
            ))}
          </div>
          <span className="ml-2 text-gray-600 text-sm">
            {overallAverage > 0 ? overallAverage.toFixed(1) : 'No ratings'} ({totalRatings})
            <span className="text-gray-400">
              {' '}
              · {totalShows} show{totalShows === 1 ? '' : 's'}
            </span>
          </span>
        </div>
        <span
          className="px-4 py-2 rounded-md text-sm font-medium invisible select-none shrink-0"
          aria-hidden="true"
        >
          Rate Show
        </span>
      </div>

      {sortedEventRatings.length > 0 ? (
        <div className="mt-3 pt-3 border-t">
          <button
            type="button"
            onClick={() => setIsListExpanded((x) => !x)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
          >
            <span className="text-sm font-medium text-gray-700">
              {isListExpanded ? 'Hide' : 'View'} shows
            </span>
            <span className="text-xs text-gray-500">{sortedEventRatings.length} total</span>
          </button>
          {isListExpanded && (
            <ul className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-100 min-h-[14rem]">
              {sortedEventRatings.map((eventRating) => (
                <li
                  key={eventRating.event_id}
                  role={onEventClick ? 'button' : undefined}
                  tabIndex={onEventClick ? 0 : undefined}
                  onClick={onEventClick ? () => handleEventClick(eventRating.event_id) : undefined}
                  onKeyDown={
                    onEventClick
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') handleEventClick(eventRating.event_id);
                        }
                      : undefined
                  }
                  className={`flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 last:border-0 ${
                    onEventClick
                      ? 'hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-inset'
                      : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate block">{showPillLabel(eventRating)}</span>
                    {eventRating.event?.date && (
                      <span className="text-xs text-gray-500">
                        {new Date(eventRating.event.date).toLocaleDateString(undefined, {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          className={s <= eventRating.avg_rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-6">
                      {eventRating.avg_rating > 0 ? eventRating.avg_rating.toFixed(1) : '—'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t">
          <p className="text-center text-sm text-gray-500 py-2">
            No rated shows yet. {totalShows > 0 ? `${totalShows} show${totalShows === 1 ? '' : 's'} with this tag.` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
