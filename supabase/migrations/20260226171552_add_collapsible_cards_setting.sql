/*
  # Add Collapsible Cards Setting

  1. Changes
    - Add default setting for collapsible_cards_enabled to control whether event cards can be collapsed/expanded
  
  2. Notes
    - This allows admins to toggle the collapsible card feature on or off
    - Default is true (enabled)
*/

-- Insert the collapsible cards setting if it doesn't exist
INSERT INTO app_settings (key, value)
VALUES ('collapsible_cards_enabled', 'true')
ON CONFLICT (key) DO NOTHING;
