-- Optional fields populated by Google Places for richer Event JSON-LD / deduplication
ALTER TABLE events ADD COLUMN IF NOT EXISTS formatted_address text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS google_place_id text;
