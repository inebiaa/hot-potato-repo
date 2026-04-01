import type { Event } from './supabase';
import { canonicalEventUrl, publicSiteOrigin } from './siteBase';

function absoluteImageUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  return `${publicSiteOrigin()}${u.startsWith('/') ? u : `/${u}`}`;
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

function buildPostalAddress(event: Event): Record<string, unknown> {
  const addr: Record<string, unknown> = {
    '@type': 'PostalAddress',
  };
  const line =
    (event.formatted_address && event.formatted_address.trim()) ||
    (event.address && event.address.trim()) ||
    '';
  if (line) {
    addr.streetAddress = line;
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

/**
 * Schema.org Event as JSON-LD object (Google Event rich results).
 * @see https://developers.google.com/search/docs/appearance/structured-data/event
 */
export function buildEventJsonLd(event: Event): Record<string, unknown> {
  const canonical = canonicalEventUrl(event.id);
  const obj: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    startDate: eventStartDateIso(event.date),
    eventStatus: 'https://schema.org/EventScheduled',
    url: canonical,
    location: buildPlace(event),
  };

  if (event.description?.trim()) {
    obj.description = event.description.trim();
  }

  const img = absoluteImageUrl(event.image_url);
  if (img) {
    obj.image = [img];
  }

  const ticket = event.countdown_link?.trim();
  if (ticket && (ticket.startsWith('http://') || ticket.startsWith('https://'))) {
    obj.offers = {
      '@type': 'Offer',
      url: ticket,
    };
  }

  return obj;
}

export function eventJsonLdScriptContent(event: Event): string {
  return JSON.stringify(buildEventJsonLd(event));
}
