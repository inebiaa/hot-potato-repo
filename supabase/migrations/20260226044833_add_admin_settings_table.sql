/*
  # Add Admin Settings Table

  1. New Tables
    - `app_settings`
      - `id` (uuid, primary key) - Unique identifier
      - `key` (text, unique) - Setting key name
      - `value` (text) - Setting value (URLs, text, etc.)
      - `updated_at` (timestamptz) - Last update timestamp
      - `updated_by` (uuid) - User who last updated

  2. Initial Settings
    - app_name: Application name
    - app_icon_url: URL for app icon
    - app_logo_url: URL for app logo/header
    - tagline: App tagline/description

  3. Security
    - Enable RLS
    - Anyone can read settings
    - Only authenticated users can update settings (for simplicity, all authenticated users are admins)

  4. Notes
    - Using simple key-value store for flexibility
    - All authenticated users have admin capabilities for this demo
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
  ON app_settings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO app_settings (key, value) VALUES
  ('app_name', 'Runway Rate'),
  ('app_icon_url', ''),
  ('app_logo_url', ''),
  ('tagline', 'Fashion Show Reviews')
ON CONFLICT (key) DO NOTHING;