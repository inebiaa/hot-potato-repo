-- Remove event_collections table and collection_id from events
ALTER TABLE events DROP COLUMN IF EXISTS collection_id;
DROP TABLE IF EXISTS event_collections;
