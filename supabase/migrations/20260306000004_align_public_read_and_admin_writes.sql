/*
  Align RLS with product model:
  - Public content is readable by anon + authenticated users
  - Mutations require authenticated users
  - Sensitive configuration tables are admin-only for writes
*/

-- Public can read comments content
DROP POLICY IF EXISTS "Anyone can view event comments" ON event_comments;
CREATE POLICY "Anyone can view event comments"
  ON event_comments
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Public can read profile display info used to render usernames in ratings/comments
DROP POLICY IF EXISTS "Anyone can view user profiles" ON user_profiles;
CREATE POLICY "Anyone can view user profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Keep event collections public-read, but admin-only write operations
DROP POLICY IF EXISTS "Authenticated users can insert event_collections" ON event_collections;
DROP POLICY IF EXISTS "Authenticated users can update event_collections" ON event_collections;
DROP POLICY IF EXISTS "Authenticated users can delete event_collections" ON event_collections;

CREATE POLICY "Only admins can insert event_collections"
  ON event_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can update event_collections"
  ON event_collections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Only admins can delete event_collections"
  ON event_collections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );
