import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useHomeCatalogOptional } from '../contexts/HomeCatalogContext';
import { fetchEventWithStats, type EventWithStats } from '../lib/eventsFeed';

/** One event for rate / view-ratings / edit sheets (home cache first, then fetch). */
export function usePanelEvent(eventId: string | undefined) {
 const { user } = useAuth();
 const catalog = useHomeCatalogOptional();
 const cached =
 eventId
 ? catalog?.events.find((e) => e.id === eventId) ??
 catalog?.filteredEvents.find((e) => e.id === eventId) ??
 null
 : null;
 const [fetched, setFetched] = useState<EventWithStats | null>(null);

 useEffect(() => {
 if (!eventId) {
 setFetched(null);
 return;
 }
 if (cached) {
 setFetched(null);
 return;
 }
 let cancelled = false;
 void fetchEventWithStats(eventId, user?.id).then(({ data }) => {
 if (!cancelled) setFetched(data ?? null);
 });
 return () => {
 cancelled = true;
 };
 }, [eventId, cached, user?.id]);

 return cached ?? fetched;
}
