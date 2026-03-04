-- Add custom_tags JSONB column for optional performer/category tags
-- e.g. Hosted By, Music By, Intermission Dance Group, etc.
-- Structure: { "slug": ["value1", "value2"] }
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_tags jsonb DEFAULT '{}';
