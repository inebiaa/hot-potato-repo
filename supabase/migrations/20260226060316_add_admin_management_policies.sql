/*
  # Add Admin Management Policies

  1. Changes
    - Add policy for admins to insert new admin users
    - Add policy for admins to delete admin users
    - Add policy for admins to view all admin users

  2. Security
    - Only existing admins can add new admins
    - Only existing admins can remove admins
    - Only existing admins can view the list of admins
*/

-- Allow admins to view all admin users
DROP POLICY IF EXISTS "Admin users can view all admins" ON admin_users;
CREATE POLICY "Admin users can view all admins"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Allow admins to insert new admin users
DROP POLICY IF EXISTS "Admin users can add new admins" ON admin_users;
CREATE POLICY "Admin users can add new admins"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Allow admins to delete admin users
DROP POLICY IF EXISTS "Admin users can remove admins" ON admin_users;
CREATE POLICY "Admin users can remove admins"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );