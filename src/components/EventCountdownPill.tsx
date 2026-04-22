import { memo, useLayoutEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { getCountdownTargetDate, isEventUpcoming } from '../lib/eventDates';

export type EventCountdownPillProps = {
  eventDate: string;
  eventName: string;
  countdownOpenUrl: string | null;
  countdownBg?: string;
  countdownText?: string;
  showWiggle: boolean;
  /** Called once when the countdown reaches zero so the feed can refresh. */
  onExpired: () => void;
  onButtonClick: (e: React.MouseEvent) => void;
  onMouseDown: () => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: () => void;
  onTouchEnd: (e: React.TouchEvent) => void;
};

function EventCountdownPillInner({
  eventDate,
  eventName,
  countdownOpenUrl,
  countdownBg,
  countdownText,
  showWiggle,
  onExpired,
  onButtonClick,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
}: EventCountdownPillProps) {
  const [text, setText] = useState('');
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const wasLiveRef = useRef(false);

  useLayoutEffect(() => {
    wasLiveRef.current = false;
    if (!eventDate || !isEventUpcoming(eventDate)) {
      setText('');
      return;
    }
    const target = getCountdownTargetDate(eventDate);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    const tick = () => {
      if (!isEventUpcoming(eventDate)) {
        if (wasLiveRef.current) onExpiredRef.current();
        wasLiveRef.current = false;
        setText('');
        return;
      }
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        if (wasLiveRef.current) onExpiredRef.current();
        wasLiveRef.current = false;
        setText('');
        return;
      }
      const totalSecs = Math.floor(diff / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      setText(`${pad(hours)}:${pad(mins)}:${pad(secs)}`);
      wasLiveRef.current = true;
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [eventDate]);

  if (!text) return null;

  return (
    <button
      type="button"
      data-tag-pill
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors hover:opacity-80 tabular-nums whitespace-nowrap ${countdownOpenUrl ? 'cursor-pointer' : ''} ${showWiggle ? 'pill-wiggle' : ''}`}
      style={{
        backgroundColor: countdownBg || '#fef3c7',
        color: countdownText || '#92400e',
      }}
      aria-label={countdownOpenUrl ? `Open official ticket link for ${eventName}` : undefined}
      title={countdownOpenUrl || undefined}
      onClick={onButtonClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <Clock size={12} className="shrink-0" />
      {text}
    </button>
  );
}

export default memo(EventCountdownPillInner);
