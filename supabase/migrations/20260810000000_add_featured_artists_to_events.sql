-- Music show artists live in their own column (not featured_designers).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS featured_artists text[];
