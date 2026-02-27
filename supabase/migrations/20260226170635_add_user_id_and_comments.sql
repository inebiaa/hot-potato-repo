/*
  # Add User ID and Comments System

  1. Schema Changes
    - Add `user_id` column to `user_profiles` table
      - `user_id` (text, unique) - A unique identifier for sign-in purposes
    
  2. New Tables
    - `event_comments`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events)
      - `user_id` (uuid, foreign key to auth.users)
      - `comment` (text, required)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  3. Security
    - Enable RLS on `event_comments` table
    - Anyone authenticated can view comments
    - Users can insert their own comments
    - Users can update/delete their own comments
  
  4. Notes
    - User ID allows users to sign in with a unique ID instead of email
    - Comments are linked to both events and users
    - Comments display the username from user_profiles
*/

-- Add user_id to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'user_id_public'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN user_id_public text UNIQUE;
  END IF;
END $$;

-- Create event_comments table
CREATE TABLE IF NOT EXISTS event_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event comments"
  ON event_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
  ON event_comments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON event_comments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_event_comments_event_id ON event_comments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_user_id ON event_comments(user_id);
