/*
  # Fix infinite recursion in admin_users RLS policy

  1. Changes
    - Drop the existing problematic policy on admin_users
    - Create a new simple policy that allows all authenticated users to read admin_users
    - This prevents infinite recursion while still protecting write operations

  2. Security
    - Authenticated users can read the admin list (needed to check permissions)
    - Only existing admins can insert/update/delete (protected by existing policies)
*/

-- Drop the existing policy that causes infinite recursion
DROP POLICY IF EXISTS "Anyone can check admin status" ON admin_users;

-- Create a simple read policy for authenticated users
CREATE POLICY "Authenticated users can view admin list"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (true);
