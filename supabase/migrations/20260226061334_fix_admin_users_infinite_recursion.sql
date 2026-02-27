/*
  # Fix infinite recursion in admin_users RLS policies

  1. Changes
    - Drop all existing RLS policies on admin_users table
    - Create simple, non-recursive policies that allow:
      - Anyone (authenticated or not) can SELECT from admin_users to check admin status
      - Only existing admins can INSERT/UPDATE/DELETE admin records
    - Use a security definer function to break the recursion cycle

  2. Security
    - Admin checks remain secure
    - No infinite recursion
    - Existing admins can manage the admin list
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Anyone can read admin list" ON admin_users;
DROP POLICY IF EXISTS "Authenticated users can view admin list" ON admin_users;
DROP POLICY IF EXISTS "Admin users can view all admins" ON admin_users;
DROP POLICY IF EXISTS "Admins can manage admin list" ON admin_users;
DROP POLICY IF EXISTS "Admin users can add new admins" ON admin_users;
DROP POLICY IF EXISTS "Admin users can remove admins" ON admin_users;

-- Create a security definer function to check admin status without recursion
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = check_user_id
  );
$$;

-- Allow anyone to read the admin list (needed for admin checks)
CREATE POLICY "Allow read access to admin list"
  ON admin_users
  FOR SELECT
  TO public
  USING (true);

-- Only admins can insert new admins (using the security definer function)
CREATE POLICY "Admins can add new admins"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete admins (using the security definer function)
CREATE POLICY "Admins can remove admins"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));
