/**
 * Resolve venue + city to a street address via Photon (OSM, free, no API key).
 * Only returns a value when the top match is high-confidence and unambiguous.
 */

export type VenueGeocodeResult = {
  formatted_address: string;
  name: string;
  confidence: number;
};

type PhotonProps = {
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  locality?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countrycode?: string;
  osm_key?: string;
  osm_value?: string;
};

type PhotonFeature = {
  properties?: PhotonProps;
};

const VENUE_VALUES = new Set([
  'stadium',
  'arena',
  'theatre',
  'theater',
  'arts_centre',
  'community_centre',
  'concert_hall',
  'conference_centre',
  'events_venue',
  'sports_centre',
  'ice_rink',
  'multipurpose',
  'nightclub',
  'music_venue',
]);

/** Minimum score for the top hit. */
const MIN_SCORE = 80;
/** Top must beat runner-up by at least this, unless it is the only strong hit. */
const MIN_GAP = 25;
const STRONG_SOLO = 70;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cityCore(city: string): string {
  // "Oakland, CA" → "oakland"; "Los Angeles, CA" → "los angeles"
  return normalize(city.split(',')[0] || city);
}

function scoreFeature(props: PhotonProps, venue: string, city: string): number {
  const name = normalize(props.name || '');
  const v = normalize(venue);
  if (!name || !v) return 0;

  let score = 0;
  if (name === v) score += 50;
  else if (name.startsWith(v) || v.startsWith(name)) score += 35;
  else if (name.includes(v) || v.includes(name)) score += 20;
  else return 0;

  const wantCity = cityCore(city);
  const gotCity = normalize(props.city || props.locality || '');
  if (wantCity && gotCity) {
    if (gotCity === wantCity || gotCity.includes(wantCity) || wantCity.includes(gotCity)) score += 30;
    else score -= 25;
  }

  const osmVal = (props.osm_value || '').toLowerCase();
  const osmKey = (props.osm_key || '').toLowerCase();
  if (VENUE_VALUES.has(osmVal) || osmKey === 'leisure' || osmVal === 'stadium') score += 20;
  if (osmVal === 'parking' || osmKey === 'parking' || /parking/i.test(props.name || '')) score -= 50;

  if (props.street) score += 10;
  if (props.housenumber && props.street) score += 5;

  return score;
}

function formatAddress(props: PhotonProps): string | null {
  if (!props.street?.trim()) return null;
  const line1 = [props.housenumber, props.street].filter(Boolean).join(' ').trim();
  const locality = props.city || props.locality;
  const region = [locality, props.state].filter(Boolean).join(', ');
  const parts = [line1, region, props.postcode, props.country].filter((p) => p && String(p).trim());
  if (parts.length < 2) return null;
  return parts.join(', ');
}

function isHighConfidence(ranked: { score: number }[]): boolean {
  if (ranked.length === 0) return false;
  const best = ranked[0].score;
  if (best < MIN_SCORE) return false;
  if (ranked.length === 1) return best >= STRONG_SOLO;
  const second = ranked[1].score;
  if (second < STRONG_SOLO) return true;
  return best - second >= MIN_GAP;
}

/**
 * Look up a street address for venue + city. Returns null when ambiguous or low confidence.
 * Failures (network, empty) also return null — save should still succeed without an address.
 */
export async function resolveVenueFormattedAddress(
  venue: string | null | undefined,
  city: string | null | undefined
): Promise<string | null> {
  const v = (venue || '').trim();
  const c = (city || '').trim();
  if (!v || !c) return null;

  const q = `${v}, ${c}`;
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`;

  let features: PhotonFeature[] = [];
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    window.clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    features = Array.isArray(data.features) ? data.features : [];
  } catch {
    return null;
  }

  const ranked = features
    .map((f) => {
      const props = f.properties || {};
      return { props, score: scoreFeature(props, v, c), formatted: formatAddress(props) };
    })
    .filter((r) => r.score > 0 && r.formatted)
    .sort((a, b) => b.score - a.score);

  if (!isHighConfidence(ranked)) return null;
  return ranked[0].formatted;
}
