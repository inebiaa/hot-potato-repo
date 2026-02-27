/*
  # Make Description Field Optional

  1. Schema Changes
    - Make `description` column in `events` table nullable
  
  2. Notes
    - Description is now optional when creating or editing events
    - Existing events with empty descriptions will be set to NULL
*/

DO $$
BEGIN
  ALTER TABLE events ALTER COLUMN description DROP NOT NULL;
END $$;

-- Update empty descriptions to NULL
UPDATE events SET description = NULL WHERE description = '';
