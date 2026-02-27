/*
  # Add Header and Footer Tag Fields to Events

  1. Changes
    - Add `header_tags` column (text array) to events table
    - Add `footer_tags` column (text array) to events table
    - These fields allow additional tag boxes at the top and bottom of event cards
    - Tags match the same properties as existing tags (producers, designers, models, hair_makeup, city)
    
  2. Color Settings
    - Add header_tags_bg_color and header_tags_text_color to app_settings
    - Add footer_tags_bg_color and footer_tags_text_color to app_settings
    - Default colors: header tags use teal, footer tags use emerald
    
  3. Notes
    - Header tags appear at the top of the event card near the title
    - Footer tags appear at the bottom of the event card
    - Both are optional and can contain multiple tags
*/

-- Add header_tags and footer_tags columns to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'header_tags'
  ) THEN
    ALTER TABLE events ADD COLUMN header_tags text[];
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'footer_tags'
  ) THEN
    ALTER TABLE events ADD COLUMN footer_tags text[];
  END IF;
END $$;

-- Insert default color settings for header and footer tags
INSERT INTO app_settings (key, value)
VALUES 
  ('header_tags_bg_color', 'bg-teal-100'),
  ('header_tags_text_color', 'text-teal-700'),
  ('footer_tags_bg_color', 'bg-emerald-100'),
  ('footer_tags_text_color', 'text-emerald-700')
ON CONFLICT (key) DO NOTHING;