/*
  # Create Events and Ratings System

  1. New Tables
    - `events`
      - `id` (uuid, primary key) - Unique identifier for each event
      - `name` (text) - Name of the event
      - `description` (text) - Detailed description of the event
      - `date` (timestamptz) - When the event takes place
      - `location` (text, optional) - Where the event takes place
      - `created_by` (uuid) - User who created the event
      - `created_at` (timestamptz) - When the event was created
      - `image_url` (text, optional) - Optional image for the event
    
    - `ratings`
      - `id` (uuid, primary key) - Unique identifier for each rating
      - `event_id` (uuid) - Reference to the event being rated
      - `user_id` (uuid) - User who submitted the rating
      - `rating` (integer) - Rating value (1-5)
      - `comment` (text, optional) - Optional comment with the rating
      - `created_at` (timestamptz) - When the rating was submitted
      - UNIQUE constraint on (event_id, user_id) to prevent duplicate ratings

  2. Security
    - Enable RLS on both tables
    - Events policies:
      - Anyone can view events
      - Authenticated users can create events
      - Users can update/delete their own events
    - Ratings policies:
      - Anyone can view ratings
      - Authenticated users can create ratings
      - Users can update/delete their own ratings
      - Enforce one rating per user per event

  3. Indexes
    - Index on event_id in ratings table for efficient lookups
    - Index on user_id in ratings table for user rating queries
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  date timestamptz NOT NULL,
  location text,
  image_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_event_id ON ratings(event_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Anyone can view ratings"
  ON ratings FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated users can create ratings"
  ON ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ratings"
  ON ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);