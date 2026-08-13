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

/**
 * Synthetic country filter values for markets that store state/province codes on
 * cities (not `City, US` / `City, CA`). `CANADA` avoids clashing with California `CA`.
 */
export const COUNTRY_FILTER_US = 'US';
export const COUNTRY_FILTER_CANADA = 'CANADA';
export const COUNTRY_FILTER_AU = 'AU';

/** Australian state/territory suffixes used on some fest cities (`Barunah Plains, VIC`). */
const AU_STATE_CODES = new Set(['VIC', 'NSW', 'QLD', 'SA', 'TAS', 'ACT', 'NT']);
/** Cities billed `City, WA` that mean Western Australia, not Washington state. */
const AU_WA_CITY_NAMES = new Set(['perth', 'fremantle']);

/**
 * CA province codes that collide with ISO country codes in this catalog.
 * `NL` is Netherlands (Amsterdam), not Newfoundland and Labrador.
 */
const CA_PROVINCE_CODES_AS_COUNTRY = new Set(['NL']);
/**
 * US state codes that collide with ISO country codes in this catalog.
 * `AR` is Argentina (San Isidro), not Arkansas.
 */
const US_STATE_CODES_AS_COUNTRY = new Set(['AR']);

const US_COUNTRY_QUERY_ALIASES = new Set([
  'us',
  'usa',
  'united states',
  'united states of america',
  'america',
]);
/** Do not include bare `ca` (that is California). */
const CANADA_COUNTRY_QUERY_ALIASES = new Set(['canada', 'can']);
const AU_COUNTRY_QUERY_ALIASES = new Set(['au', 'australia', 'aussie']);

export function isUsStateCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (US_STATE_CODES_AS_COUNTRY.has(c)) return false;
  return Boolean(US_STATE_DISPLAY[c]);
}

export function isCaProvinceCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  if (CA_PROVINCE_CODES_AS_COUNTRY.has(c)) return false;
  return Boolean(CA_PROVINCE_DISPLAY[c]);
}

export function isAuStateCode(code: string): boolean {
  return AU_STATE_CODES.has(code.trim().toUpperCase());
}

/** Spelled-out region/country for a 2–3 letter code (falls back to the code). */
export function regionDisplayNameFromCode(code: string): string {
  const c = code.trim().toUpperCase();
  if (!c) return code.trim();
  if (c === COUNTRY_FILTER_CANADA) return 'Canada';
  // Prefer country names for known tour-market collisions before US/CA abbrev maps.
  if (CA_PROVINCE_CODES_AS_COUNTRY.has(c) || US_STATE_CODES_AS_COUNTRY.has(c)) {
    return COUNTRY_DISPLAY[c] || c;
  }
  if (AU_STATE_CODES.has(c)) return 'Australia';
  return (
    US_STATE_DISPLAY[c] ||
    CA_PROVINCE_DISPLAY[c] ||
    COUNTRY_DISPLAY[c] ||
    c
  );
}

export type RegionKind = 'state' | 'province' | 'country';

export type ResolvedCityRegion = {
  /** Filter chip value (may fold AU states into `AU`). */
  filterCode: string;
  label: string;
  kind: RegionKind;
  /** Raw suffix from `City, XX`. */
  rawCode: string;
};

/** Resolve a city label to the region/country chip it should use in search. */
export function resolveRegionFromCity(city: string): ResolvedCityRegion | null {
  const parts = splitCanonicalCityLabel(city);
  if (!parts) return null;
  const rawCode = parts.regionCode;
  const cityKey = normalizeKey(parts.cityName);

  if (rawCode === 'NL') {
    return { filterCode: 'NL', label: 'Netherlands', kind: 'country', rawCode };
  }
  if (rawCode === 'AR') {
    return { filterCode: 'AR', label: 'Argentina', kind: 'country', rawCode };
  }
  if (rawCode === 'WA' && AU_WA_CITY_NAMES.has(cityKey)) {
    return {
      filterCode: COUNTRY_FILTER_AU,
      label: 'Australia',
      kind: 'country',
      rawCode,
    };
  }
  if (isAuStateCode(rawCode) || rawCode === COUNTRY_FILTER_AU) {
    return {
      filterCode: COUNTRY_FILTER_AU,
      label: 'Australia',
      kind: 'country',
      rawCode,
    };
  }
  if (isUsStateCode(rawCode)) {
    return {
      filterCode: rawCode,
      label: regionDisplayNameFromCode(rawCode),
      kind: 'state',
      rawCode,
    };
  }
  if (isCaProvinceCode(rawCode)) {
    return {
      filterCode: rawCode,
      label: regionDisplayNameFromCode(rawCode),
      kind: 'province',
      rawCode,
    };
  }
  return {
    filterCode: rawCode,
    label: regionDisplayNameFromCode(rawCode),
    kind: 'country',
    rawCode,
  };
}

/** US state vs CA province vs country/other for search chip labels. */
export function regionKindFromCode(code: string): RegionKind {
  const c = code.trim().toUpperCase();
  if (
    c === COUNTRY_FILTER_US ||
    c === COUNTRY_FILTER_CANADA ||
    c === COUNTRY_FILTER_AU ||
    CA_PROVINCE_CODES_AS_COUNTRY.has(c) ||
    US_STATE_CODES_AS_COUNTRY.has(c)
  ) {
    return 'country';
  }
  if (AU_STATE_CODES.has(c)) return 'country';
  if (isUsStateCode(c)) return 'state';
  if (isCaProvinceCode(c)) return 'province';
  return 'country';
}

/** True when `city` matches the given region/country filter code. */
export function cityMatchesRegionCode(
  city: string | null | undefined,
  regionCode: string,
): boolean {
  const resolved = resolveRegionFromCity(city || '');
  if (!resolved) return false;
  const code = regionCode.trim().toUpperCase();
  if (code === COUNTRY_FILTER_US) return resolved.kind === 'state';
  if (code === COUNTRY_FILTER_CANADA) return resolved.kind === 'province';
  if (code === COUNTRY_FILTER_AU) {
    return resolved.filterCode === COUNTRY_FILTER_AU || resolved.rawCode === COUNTRY_FILTER_AU;
  }
  return resolved.filterCode === code || resolved.rawCode === code;
}

/**
 * Free-text / typeahead match against a city's region code or spelled-out name
 * (`CO`, `Colorado`, `UK`, `Netherlands`, `USA`, `Canada`). `queryNorm` should
 * already be search-normalized (lowercase, accents stripped).
 */
export function cityMatchesRegionQuery(
  city: string | null | undefined,
  queryNorm: string,
): boolean {
  if (!queryNorm) return false;
  const resolved = resolveRegionFromCity(city || '');
  if (!resolved) return false;
  if (US_COUNTRY_QUERY_ALIASES.has(queryNorm) && resolved.kind === 'state') return true;
  if (CANADA_COUNTRY_QUERY_ALIASES.has(queryNorm) && resolved.kind === 'province') return true;
  if (
    AU_COUNTRY_QUERY_ALIASES.has(queryNorm) &&
    (resolved.filterCode === COUNTRY_FILTER_AU || resolved.rawCode === COUNTRY_FILTER_AU)
  ) {
    return true;
  }
  const filterNorm = normalizeKey(resolved.filterCode);
  const rawNorm = normalizeKey(resolved.rawCode);
  const nameNorm = normalizeKey(resolved.label);
  if (filterNorm === queryNorm || filterNorm.startsWith(queryNorm)) return true;
  if (rawNorm === queryNorm || rawNorm.startsWith(queryNorm)) return true;
  if (nameNorm.includes(queryNorm)) return true;
  return false;
}

/** True when a region suggestion (code + display name) matches the query. */
export function regionSuggestionMatchesQuery(
  regionCode: string,
  displayName: string,
  queryNorm: string,
): boolean {
  if (!queryNorm) return false;
  const code = regionCode.trim().toUpperCase();
  if (code === COUNTRY_FILTER_US && US_COUNTRY_QUERY_ALIASES.has(queryNorm)) return true;
  if (code === COUNTRY_FILTER_CANADA && CANADA_COUNTRY_QUERY_ALIASES.has(queryNorm)) return true;
  if (code === COUNTRY_FILTER_AU && AU_COUNTRY_QUERY_ALIASES.has(queryNorm)) return true;
  const codeNorm = normalizeKey(regionCode);
  const nameNorm = normalizeKey(displayName);
  if (codeNorm === queryNorm || codeNorm.startsWith(queryNorm)) return true;
  if (nameNorm.includes(queryNorm)) return true;
  return false;
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
