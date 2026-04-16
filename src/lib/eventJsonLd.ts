import type { Event } from './eventTypes';
import { canonicalEventUrl, canonicalEventUrlFromParts, publicSiteOrigin } from './siteBase';

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
  /** Same source as the card: formatted line preferred, else user-entered address (multiline OK for schema.org Text). */
  const line =
    (event.formatted_address && event.formatted_address.trim()) ||
    (event.address && event.address.trim()) ||
    '';
  if (line) {
    addr.streetAddress = line.replace(/\r\n/g, '\n').trim();
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
 * Producers → organizer (host/production). Designers → performer (show talent).
 * Matches app labels "Produced By" and "Featured Designers".
 */
function addOrganizerAndPerformers(event: Event, obj: Record<string, unknown>): void {
  const producers = cleanTagList(event.producers);
  if (producers.length > 0) {
    obj.organizer = {
      '@type': 'Organization',
      name: producers.join(', '),
    };
  }

  const designers = cleanTagList(event.featured_designers);
  if (designers.length === 0) return;

  const asPerson = (name: string) => ({ '@type': 'Person', name });
  if (designers.length === 1) {
    obj.performer = asPerson(designers[0]);
  } else {
    obj.performer = designers.map(asPerson);
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

  if (event.description?.trim()) {
    obj.description = event.description.trim();
  }

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
