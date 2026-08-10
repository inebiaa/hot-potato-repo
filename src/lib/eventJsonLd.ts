import type { Event } from './eventTypes';
import { canonicalEventUrl, canonicalEventUrlFromParts, publicSiteOrigin } from './siteBase';
import { normalizeShowType } from './showType';

/**
 * Rich Results / Search: validate the deployed event URL (not a JSON paste). Prerendered HTML from
 * vite `staticSitePlugin` includes this markup in the first response. Prefer future event dates when
 * testing eligibility in Google’s tool.
 *
 * `EventJsonLdPrerender`: when set at build time, canonical/image URLs use explicit origin/base
 * instead of `import.meta` / `window`.
 *
 * @see https://schema.org/Event
 */
export type EventJsonLdPrerender = { siteOrigin: string; viteBase: string };

/** Absolute image URL for JSON-LD, Open Graph, and email cards (same rules everywhere). */
export function eventAbsoluteImageUrl(
  url: string | null | undefined,
  prerender?: EventJsonLdPrerender
): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  const origin = prerender ? prerender.siteOrigin.replace(/\/$/, '') : publicSiteOrigin();
  return `${origin}${u.startsWith('/') ? u : `/${u}`}`;
}

/** ISO-8601 date/datetime from stored event date (YYYY-MM-DD or full ISO). */
export function eventStartDateIso(dateStr: string): string {
  const d = dateStr.trim();
  if (!d) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T12:00:00`;
  try {
    return new Date(d).toISOString();
  } catch {
    return d;
  }
}

/** End of calendar day for date-only strings (Google recommends endDate for Event rich results). */
export function eventEndDateIso(dateStr: string): string {
  const d = dateStr.trim();
  if (!d) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T23:59:59`;
  try {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  } catch {
    /* fall through */
  }
  return `${d}T23:59:59`;
}

function buildPostalAddress(event: Event): Record<string, unknown> {
  const addr: Record<string, unknown> = {
    '@type': 'PostalAddress',
  };
  const line = event.formatted_address?.trim() || '';
  if (line) {
    addr.streetAddress = line.replace(/\r\n/g, '\n');
  }
  if (event.city?.trim()) {
    addr.addressLocality = event.city.trim();
  }
  return addr;
}

function buildPlace(event: Event): Record<string, unknown> {
  const place: Record<string, unknown> = {
    '@type': 'Place',
  };
  if (event.location?.trim()) {
    place.name = event.location.trim();
  }
  const postal = buildPostalAddress(event);
  if (Object.keys(postal).length > 1) {
    place.address = postal;
  }
  return place;
}

function cleanTagList(arr: string[] | null | undefined): string[] {
  if (!arr?.length) return [];
  return arr.map((s) => String(s).trim()).filter(Boolean);
}

/**
 * Producers → organizer. Starring (designers or artists) → performer.
 * Matches app labels "Produced By" and "Starring".
 */
function addOrganizerAndPerformers(event: Event, obj: Record<string, unknown>): void {
  const producers = cleanTagList(event.producers);
  if (producers.length > 0) {
    obj.organizer = {
      '@type': 'Organization',
      name: producers.join(', '),
    };
  }

  const starring =
    normalizeShowType(event.show_type) === 'music'
      ? cleanTagList(event.featured_artists)
      : cleanTagList(event.featured_designers);
  if (starring.length === 0) return;

  const asPerson = (name: string) => ({ '@type': 'Person', name });
  if (starring.length === 1) {
    obj.performer = asPerson(starring[0]);
  } else {
    obj.performer = starring.map(asPerson);
  }
}

/**
 * Schema.org Event as JSON-LD object (Google Event rich results).
 * @see https://schema.org/Event
 */
export function buildEventJsonLd(event: Event, prerender?: EventJsonLdPrerender): Record<string, unknown> {
  const canonical = prerender
    ? canonicalEventUrlFromParts(event.id, prerender.siteOrigin, prerender.viteBase)
    : canonicalEventUrl(event.id);
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: eventStartDateIso(event.date),
    endDate: eventEndDateIso(event.date),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: canonical,
    location: buildPlace(event),
  };

  const img = eventAbsoluteImageUrl(event.image_url, prerender);
  if (img) {
    obj.image = [img];
  }

  const ticket = event.countdown_link?.trim();
  if (ticket && (ticket.startsWith('http://') || ticket.startsWith('https://'))) {
    obj.offers = {
      '@type': 'Offer',
      url: ticket,
      availability: 'https://schema.org/InStock',
    };
  }

  addOrganizerAndPerformers(event, obj);

  return obj;
}

export function eventJsonLdScriptContent(event: Event): string {
  return JSON.stringify(buildEventJsonLd(event));
}

export function eventJsonLdScriptContentPrerender(event: Event, prerender: EventJsonLdPrerender): string {
  return JSON.stringify(buildEventJsonLd(event, prerender));
}
