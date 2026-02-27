/*
  # Add UI Color Settings
  
  1. New Settings
    - Add primary_button_bg_color (default: black #000000)
    - Add primary_button_text_color (default: yellow #facc15)
    - Add accent_color (default: yellow #facc15)
    - Add link_color (default: yellow #ca8a04)
  
  2. Purpose
    - Allow admins to customize button colors and accent colors throughout the app
    - Provide centralized color management for the UI theme
*/

-- Insert default UI color settings if they don't exist
INSERT INTO app_settings (key, value)
VALUES 
  ('primary_button_bg_color', '#000000'),
  ('primary_button_text_color', '#facc15'),
  ('accent_color', '#facc15'),
  ('link_color', '#ca8a04')
ON CONFLICT (key) DO NOTHING;