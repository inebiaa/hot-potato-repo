-- Remove event descriptions entirely (column unused in forms; was only showing leftover data).
ALTER TABLE events DROP COLUMN IF EXISTS description;
