-- Add custom_tag_meta to store per-slug icon for optional tags
-- Structure: { "slug": { "icon": "Music" } }
-- Users pick icon when adding optional tag; admin only sets shared colors
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_tag_meta jsonb DEFAULT '{}';
