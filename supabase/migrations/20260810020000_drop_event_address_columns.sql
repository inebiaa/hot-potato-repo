-- Drop unused address fields; keep formatted_address for JSON-LD / rich results
-- (auto-filled from venue + city via geocoding — not shown in the UI).
ALTER TABLE events DROP COLUMN IF EXISTS address;
ALTER TABLE events DROP COLUMN IF EXISTS google_place_id;
ALTER TABLE events ADD COLUMN IF NOT EXISTS formatted_address text;
