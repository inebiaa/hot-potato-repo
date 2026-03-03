-- Event collections: group events into named collections (e.g. "NYFW Fall 2024")
CREATE TABLE IF NOT EXISTS event_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE event_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event_collections"
  ON event_collections FOR SELECT
  TO authenticated, anon
  USING (true);

-- Only admins can manage collections (checked in app via admin role)
CREATE POLICY "Authenticated users can insert event_collections"
  ON event_collections FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update event_collections"
  ON event_collections FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete event_collections"
  ON event_collections FOR DELETE
  TO authenticated
  USING (true);

-- Allow events to belong to one collection
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES event_collections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_collection_id ON events(collection_id);
