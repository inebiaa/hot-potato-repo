-- Distinguish fashion shows vs music shows.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS show_type text NOT NULL DEFAULT 'fashion';

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_show_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_show_type_check
  CHECK (show_type IN ('fashion', 'music'));

UPDATE events SET show_type = 'fashion' WHERE show_type IS NULL;
