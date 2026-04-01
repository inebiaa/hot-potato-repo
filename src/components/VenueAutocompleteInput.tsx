import { useEffect, useRef } from 'react';
import { parsePlaceResult } from '../lib/googlePlaces';

export interface VenuePlacePayload {
  location: string;
  formatted_address: string;
  address: string;
  city: string;
  google_place_id: string;
}

interface VenueAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected: (payload: VenuePlacePayload) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: { fields?: string[]; types?: string[] }
          ) => {
            addListener: (event: string, fn: () => void) => void;
            getPlace: () => unknown;
          };
        };
      };
    };
  }
}

/**
 * Venue search with Google Places Autocomplete when VITE_GOOGLE_MAPS_API_KEY is set.
 * Falls back to a plain text input when the key is missing.
 */
export default function VenueAutocompleteInput({
  id = 'venue-location',
  value,
  onChange,
  onPlaceSelected,
  placeholder = 'e.g., Grand Palais, or search for a venue',
  className = '',
  disabled = false,
}: VenueAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  const onChangeRef = useRef(onChange);
  onPlaceSelectedRef.current = onPlaceSelected;
  onChangeRef.current = onChange;
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    let autocomplete: { addListener: (e: string, fn: () => void) => void; getPlace: () => unknown } | null =
      null;
    let cancelled = false;
    const cbName = `__sbInitAc_${Math.random().toString(36).slice(2)}`;

    const init = () => {
      if (cancelled || !inputRef.current || !window.google?.maps?.places) return;
      autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        fields: ['name', 'formatted_address', 'address_components', 'place_id'],
        types: ['establishment', 'geocode'],
      });
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete?.getPlace() as Parameters<typeof parsePlaceResult>[0] | undefined;
        if (!place) return;
        const parsed = parsePlaceResult(place);
        if (parsed.location) onChangeRef.current(parsed.location);
        onPlaceSelectedRef.current(parsed);
      });
    };

    if (window.google?.maps?.places) {
      init();
      return () => {
        cancelled = true;
      };
    }

    (window as unknown as Record<string, () => void>)[cbName] = () => {
      init();
      delete (window as unknown as Record<string, unknown>)[cbName];
    };

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${cbName}`;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      delete (window as unknown as Record<string, unknown>)[cbName];
    };
  }, [apiKey]);

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
