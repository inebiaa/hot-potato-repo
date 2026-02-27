/*
  # Add Address Field and Edit Suggestions System

  1. New Columns
    - Add `address` (text) to events table for two-line address display under venue
  
  2. New Tables
    - `edit_suggestions`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `suggested_by` (uuid, foreign key to auth.users)
      - `suggestion_data` (jsonb) - stores the suggested changes
      - `reason` (text) - explanation for the suggestion
      - `status` (text) - pending, approved, rejected
      - `reviewed_by` (uuid, nullable, foreign key to auth.users)
      - `reviewed_at` (timestamptz, nullable)
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on edit_suggestions table
    - Users can create their own suggestions
    - Users can view their own suggestions
    - Admins can view all suggestions and update their status
    
  4. Notes
    - Address displays below venue in smaller text
    - Edit suggestions allow anyone to suggest changes to any event
    - Admins must approve suggestions before they're applied
*/

-- Add address column to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'address'
  ) THEN
    ALTER TABLE events ADD COLUMN address text;
  END IF;
END $$;

-- Create edit_suggestions table
CREATE TABLE IF NOT EXISTS edit_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  suggested_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  suggestion_data jsonb NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE edit_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can create suggestions
CREATE POLICY "Users can create edit suggestions"
  ON edit_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

-- Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON edit_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = suggested_by);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
  ON edit_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Admins can update suggestions
CREATE POLICY "Admins can update suggestions"
  ON edit_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.user_id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_edit_suggestions_event_id ON edit_suggestions(event_id);
CREATE INDEX IF NOT EXISTS idx_edit_suggestions_status ON edit_suggestions(status);