/*
  # Add Tag Color Settings to App Settings

  1. Changes
    - Add color settings to `app_settings` table for customizing tag colors
    - Each tag type (producer, designer, model, hair_makeup, city) gets bg and text color settings
    - Colors stored as Tailwind CSS class names for easy application
    
  2. Default Colors
    - Producers: gray background, gray text
    - Designers: amber background, amber text
    - Models: pink background, pink text
    - Hair & Makeup: purple background, purple text
    - City: blue background, blue text
    
  3. Notes
    - Colors can be updated by admins through the settings modal
    - Uses Tailwind CSS color classes for consistency
*/

-- Insert default color settings if they don't exist
INSERT INTO app_settings (key, value)
VALUES 
  ('producer_bg_color', 'bg-gray-100'),
  ('producer_text_color', 'text-gray-700'),
  ('designer_bg_color', 'bg-amber-100'),
  ('designer_text_color', 'text-amber-700'),
  ('model_bg_color', 'bg-pink-100'),
  ('model_text_color', 'text-pink-700'),
  ('hair_makeup_bg_color', 'bg-purple-100'),
  ('hair_makeup_text_color', 'text-purple-700'),
  ('city_bg_color', 'bg-blue-100'),
  ('city_text_color', 'text-blue-700')
ON CONFLICT (key) DO NOTHING;