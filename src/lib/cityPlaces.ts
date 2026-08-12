/**
 * Real-city lookup via Photon (OSM, free). Labels are "City, ST" (US/CA) or "City, CC".
 */

const US_STATE_ABBREV: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO',
  montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'district of columbia': 'DC',
};

const CA_PROVINCE_ABBREV: Record<string, string> = {
  alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
  'newfoundland and labrador': 'NL', 'northwest territories': 'NT', 'nova scotia': 'NS',
  nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC', québec: 'QC',
  saskatchewan: 'SK', yukon: 'YT',
};

type PhotonProps = {
  name?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  osm_value?: string;
  type?: string;
};

type PhotonFeature = { properties?: PhotonProps };

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function regionCode(props: PhotonProps): string | null {
  const cc = (props.countrycode || '').toUpperCase();
  const state = (props.state || '').trim();
  if (!state && !cc) return null;

  if (cc === 'US') {
    if (/^[A-Z]{2}$/.test(state)) return state;
    return US_STATE_ABBREV[normalizeKey(state)] || null;
  }
  if (cc === 'CA') {
    if (/^[A-Z]{2}$/.test(state)) return state;
    return CA_PROVINCE_ABBREV[normalizeKey(state)] || null;
  }
  // Prefer ISO country code for everywhere else (London → UK, Paris → FR)
  if (cc === 'GB') return 'UK';
  if (cc) return cc;
  return null;
}

/** Format a Photon place as "City, ST" / "City, CC". Returns null if incomplete. */
export function formatCityLabel(props: PhotonProps): string | null {
  const name = (props.name || '').trim();
  if (!name) return null;
  const region = regionCode(props);
  if (!region) return null;
  return `${name}, ${region}`;
}

function isCityPlace(props: PhotonProps): boolean {
  const v = (props.osm_value || props.type || '').toLowerCase();
  return v === 'city' || v === 'town' || v === 'municipality' || v === 'borough';
}

/**
 * Search real cities. Returns unique "City, ST" labels (max `limit`).
 */
export async function searchCities(query: string, limit = 8): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=${Math.max(limit * 3, 12)}` +
    `&osm_tag=place:city&osm_tag=place:town&osm_tag=place:municipality`;

  let features: PhotonFeature[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: PhotonFeature[] };
    features = Array.isArray(data.features) ? data.features : [];
  } catch {
    return [];
  }

  const qn = normalizeKey(q);
  const scored: { label: string; score: number }[] = [];
  const seen = new Set<string>();

  for (const f of features) {
    const props = f.properties || {};
    if (!isCityPlace(props) && props.osm_value && props.osm_value !== 'borough') continue;
    const label = formatCityLabel(props);
    if (!label) continue;
    const key = normalizeKey(label);
    if (seen.has(key)) continue;
    seen.add(key);

    const nameN = normalizeKey(props.name || '');
    let score = 0;
    if (nameN === qn) score += 100;
    else if (nameN.startsWith(qn)) score += 70;
    else if (nameN.includes(qn)) score += 40;
    else if (key.includes(qn)) score += 20;
    else score += 5;
    if ((props.osm_value || '') === 'city') score += 10;
    if ((props.countrycode || '').toUpperCase() === 'US') score += 3;
    scored.push({ label, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((s) => s.label);
}

/**
 * Resolve a free-text city to a canonical "City, ST" label, or null if ambiguous / not found.
 */
export async function canonicalizeCity(raw: string): Promise<string | null> {
  const input = raw.trim();
  if (!input) return null;

  // Already looks canonical and matches a real hit
  const results = await searchCities(input, 8);
  if (results.length === 0) return null;

  const inputN = normalizeKey(input);
  const exact = results.find((r) => normalizeKey(r) === inputN);
  if (exact) return exact;

  // "Denver" → prefer exact city name match with one clear winner
  const nameOnly = input.split(',')[0].trim();
  const nameN = normalizeKey(nameOnly);
  const nameMatches = results.filter((r) => normalizeKey(r.split(',')[0] || '') === nameN);
  if (nameMatches.length === 1) return nameMatches[0];
  if (nameMatches.length > 1) {
    // Prefer US when input had no country/state and multiple countries
    const us = nameMatches.filter((r) => /,\s*[A-Z]{2}$/.test(r) && !/, (UK|FR|IT|GB)$/.test(r));
    // If input already had , CA etc., try match region
    const regionPart = input.includes(',') ? normalizeKey(input.split(',').slice(1).join(',')) : '';
    if (regionPart) {
      const regionHit = nameMatches.find((r) => normalizeKey(r).includes(regionPart) || normalizeKey(r.split(',')[1] || '') === regionPart);
      if (regionHit) return regionHit;
    }
    if (us.length === 1) return us[0];
    // Ambiguous (Springfield, etc.)
    return null;
  }

  // Single overall result
  if (results.length === 1) return results[0];
  return null;
}

/** True when label looks like "City, ST" / "City, CC" / "City, VIC" (2–3 letter region). */
export function isCanonicalCityLabel(value: string): boolean {
  return /^[^,]+,\s*[A-Za-z]{2,3}$/.test(value.trim());
}

function titleCaseRegionName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function invertAbbrevToDisplay(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, code] of Object.entries(map)) {
    const n = normalizeKey(name);
    // Prefer ASCII spellings (quebec over québec).
    if (out[code] && /[^a-z0-9 ]/i.test(name)) continue;
    if (!out[code] || n.length >= normalizeKey(out[code]).length) {
      out[code] = titleCaseRegionName(n);
    }
  }
  return out;
}

const US_STATE_DISPLAY = invertAbbrevToDisplay(US_STATE_ABBREV);
const CA_PROVINCE_DISPLAY = invertAbbrevToDisplay(CA_PROVINCE_ABBREV);

/** Common ISO / tour-market country codes → English display names for comment pills. */
const COUNTRY_DISPLAY: Record<string, string> = {
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  US: 'United States',
  CA: 'Canada',
  FR: 'France',
  IT: 'Italy',
  DE: 'Germany',
  ES: 'Spain',
  PT: 'Portugal',
  NL: 'Netherlands',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  IE: 'Ireland',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czechia',
  AU: 'Australia',
  NZ: 'New Zealand',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  SG: 'Singapore',
  IN: 'India',
  BR: 'Brazil',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  AE: 'United Arab Emirates',
  IL: 'Israel',
  ZA: 'South Africa',
};

/** Spelled-out region/country for a 2–3 letter code (falls back to the code). */
export function regionDisplayNameFromCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return code.trim();
  return (
    US_STATE_DISPLAY[c] ||
    CA_PROVINCE_DISPLAY[c] ||
    COUNTRY_DISPLAY[c] ||
    c
  );
}

export type CityTagParts = {
  cityName: string;
  regionCode: string;
  /** Spelled-out state/province/country for display pills. */
  regionDisplayName: string;
};

/** Split canonical `City, XX` into city + spelled-out region parts for comment pills. */
export function splitCanonicalCityLabel(label: string): CityTagParts | null {
  const t = label.trim();
  if (!isCanonicalCityLabel(t)) return null;
  const i = t.lastIndexOf(',');
  const cityName = t.slice(0, i).trim();
  const regionCode = t.slice(i + 1).trim().toUpperCase();
  if (!cityName || !regionCode) return null;
  return {
    cityName,
    regionCode,
    regionDisplayName: regionDisplayNameFromCode(regionCode),
  };
}

/** Alternate comment match string using spelled-out region (`Denver, Colorado`). */
export function cityTagSpelledLabel(label: string): string | null {
  const parts = splitCanonicalCityLabel(label);
  if (!parts) return null;
  if (parts.regionDisplayName.toUpperCase() === parts.regionCode) return null;
  return `${parts.cityName}, ${parts.regionDisplayName}`;
}
