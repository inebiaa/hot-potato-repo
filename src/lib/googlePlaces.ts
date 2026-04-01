/** Minimal shape of Google Places PlaceResult (avoids @types/google.maps dependency). */
export interface PlaceResultLike {
  name?: string;
  formatted_address?: string;
  address_components?: { long_name: string; short_name: string; types: string[] }[];
  place_id?: string;
}

/** Parse address_components into primary city/locality string. */
export function localityFromComponents(
  components: PlaceResultLike['address_components'] | undefined
): string {
  if (!components?.length) return '';
  const locality =
    components.find((c) => c.types.includes('locality'))?.long_name ||
    components.find((c) => c.types.includes('postal_town'))?.long_name ||
    components.find((c) => c.types.includes('administrative_area_level_2'))?.long_name ||
    '';
  return locality;
}

export interface PlaceSelection {
  location: string;
  formatted_address: string;
  address: string;
  city: string;
  google_place_id: string;
}

export function parsePlaceResult(place: PlaceResultLike): PlaceSelection {
  const name = place.name?.trim() || '';
  const formatted = place.formatted_address?.trim() || '';
  const city = localityFromComponents(place.address_components);
  const id = place.place_id?.trim() || '';
  return {
    location: name,
    formatted_address: formatted,
    address: formatted,
    city,
    google_place_id: id,
  };
}
