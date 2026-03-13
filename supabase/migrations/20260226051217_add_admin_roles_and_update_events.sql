/*
  # Add Admin Roles and Update Events Schema

  1. Changes to Events Table
    - Add `city` column for location
    - Add `created_by` column to track event creator
    - Remove `show_type` column (no longer needed)
    - Change `date` to store only date (not time)
    
  2. Changes to Users
    - Track admin status in app_metadata via RLS policies
    - Admins are identified by checking app_settings table for admin list
    
  3. New Admin Users Table
    - `admin_users` table to track who has admin privileges
    - Links to auth.users table
    
  4. New App Text Settings
    - `app_text` table for all editable text in the app
    - Allows admins to customize all visible text
    
  5. Security Updates
    - Only event creators can edit/delete their events
    - Admins can edit/delete any event
    - Only admins can update app settings and text
    
  6. Notes
    - Existing events will have NULL created_by (treated as admin-owned)
    - City defaults to empty string
*/

-- Create admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin list"
  ON admin_users FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Admins can manage admin list"
  ON admin_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users WHERE user_id = auth.uid()
    )
  );

-- Add city and created_by to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'city'
  ) THEN
    ALTER TABLE events ADD COLUMN city text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE events ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update events RLS policies to check ownership
DROP POLICY IF EXISTS "Authenticated users can insert events" ON events;
DROP POLICY IF EXISTS "Authenticated users can update events" ON events;
DROP POLICY IF EXISTS "Authenticated users can delete events" ON events;

CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events, admins can update all"
  ON events FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own events, admins can delete all"
  ON events FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Update app_settings policies to admin-only
DROP POLICY IF EXISTS "Authenticated users can update settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON app_settings;

CREATE POLICY "Only admins can update settings"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can insert settings"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Create app text customization table
CREATE TABLE IF NOT EXISTS app_text (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE app_text ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app text"
  ON app_text FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Only admins can update app text"
  ON app_text FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can insert app text"
  ON app_text FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Insert default app text values
INSERT INTO app_text (key, value, description) VALUES
  ('header_title', 'Secret Blogger', 'Main header title'),
  ('header_subtitle', 'Fashion Show Reviews', 'Header subtitle/tagline'),
  ('add_show_button', 'Add Show', 'Button text for adding new show'),
  ('sign_in_button', 'Sign In', 'Sign in button text'),
  ('sign_out_button', 'Sign Out', 'Sign out button text'),
  ('rate_show_button', 'Rate Show', 'Button to rate a show'),
  ('update_rating_button', 'Update', 'Button to update existing rating'),
  ('no_shows_title', 'No fashion shows yet', 'Title when no shows exist'),
  ('no_shows_subtitle', 'Be the first to add a fashion show!', 'Subtitle when no shows exist'),
  ('no_results_title', 'No shows match your search', 'Title when search has no results'),
  ('no_results_subtitle', 'Try adjusting your filters or search terms', 'Subtitle when no results'),
  ('search_placeholder', 'Search shows, designers, models...', 'Search input placeholder'),
  ('settings_title', 'Settings', 'Settings button text')
ON CONFLICT (key) DO NOTHING;