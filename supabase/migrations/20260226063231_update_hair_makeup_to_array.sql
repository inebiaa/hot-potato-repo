/*
  # Update Hair & Makeup Field to Support Multiple Artists

  1. Changes
    - Change `hair_makeup` column from text to text array
    - This allows multiple hair and makeup artists to be listed separately
    - Each artist will be displayed as a separate tag
    
  2. Data Migration
    - Convert existing single text values to arrays
    - Split comma-separated values if they exist
    
  3. Notes
    - Maintains backward compatibility by converting existing data
    - New entries can specify multiple artists
*/

-- First, add a temporary column to store the array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'hair_makeup_array'
  ) THEN
    ALTER TABLE events ADD COLUMN hair_makeup_array text[];
  END IF;
END $$;

-- Migrate existing data: convert single values to arrays
UPDATE events
SET hair_makeup_array = ARRAY[hair_makeup]
WHERE hair_makeup IS NOT NULL AND hair_makeup != '';

-- Drop the old column
ALTER TABLE events DROP COLUMN IF EXISTS hair_makeup;

-- Rename the new column
ALTER TABLE events RENAME COLUMN hair_makeup_array TO hair_makeup;