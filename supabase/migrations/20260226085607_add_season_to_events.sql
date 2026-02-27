/*
  # Add Season Field to Events

  1. Changes
    - Add `season` column (text) to events table
    - This field stores the season for the event (e.g., "Spring 2024", "Fall 2023")
    
  2. Color Settings
    - Add season_bg_color and season_text_color to app_settings
    - Default colors: orange/amber tones
    
  3. Notes
    - Season is optional and displays with a calendar icon
*/

-- Add season column to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'season'
  ) THEN
    ALTER TABLE events ADD COLUMN season text;
  END IF;
END $$;

-- Insert default color settings for season tags
INSERT INTO app_settings (key, value)
VALUES 
  ('season_bg_color', '#ffedd5'),
  ('season_text_color', '#c2410c')
ON CONFLICT (key) DO NOTHING;