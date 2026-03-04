-- Run this in Supabase SQL Editor (Profile > Enable lists, or if you see schema errors)
-- Creates user_lists, user_list_events, and adds custom_tags to events

CREATE TABLE IF NOT EXISTS user_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_list_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES user_lists(id) ON DELETE CASCADE NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(list_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON user_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_list_events_list_id ON user_list_events(list_id);
CREATE INDEX IF NOT EXISTS idx_user_list_events_event_id ON user_list_events(event_id);

ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_list_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own lists" ON user_lists;
CREATE POLICY "Users can view own lists"
  ON user_lists FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own lists" ON user_lists;
CREATE POLICY "Users can insert own lists"
  ON user_lists FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own lists" ON user_lists;
CREATE POLICY "Users can update own lists"
  ON user_lists FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own lists" ON user_lists;
CREATE POLICY "Users can delete own lists"
  ON user_lists FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own list events" ON user_list_events;
CREATE POLICY "Users can view own list events"
  ON user_list_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert into own lists" ON user_list_events;
CREATE POLICY "Users can insert into own lists"
  ON user_list_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete from own lists" ON user_list_events;
CREATE POLICY "Users can delete from own lists"
  ON user_list_events FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own list events" ON user_list_events;
CREATE POLICY "Users can update own list events"
  ON user_list_events FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()));

-- Add custom_tags column for optional performer tags (Hosted By, Music By, etc.)
ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_tags jsonb DEFAULT '{}';
