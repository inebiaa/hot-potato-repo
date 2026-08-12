// SQL to create user_lists, user_list_events, and add custom_tags to events.
// Copied into clipboard when user clicks "Enable lists" in profile.

export const USER_LISTS_SETUP_SQL = `-- Run this in Supabase SQL Editor (Profile > Enable lists, or if you see schema errors)
-- Creates user_lists, user_list_events, Liked/Ratings system columns, and adds custom_tags to events

CREATE TABLE IF NOT EXISTS user_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_liked_list boolean NOT NULL DEFAULT false,
  is_rated_list boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_lists
  ADD COLUMN IF NOT EXISTS is_liked_list boolean NOT NULL DEFAULT false;

ALTER TABLE user_lists
  ADD COLUMN IF NOT EXISTS is_rated_list boolean NOT NULL DEFAULT false;

ALTER TABLE user_lists
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS user_lists_one_liked_per_user
  ON user_lists (user_id)
  WHERE is_liked_list = true;

CREATE UNIQUE INDEX IF NOT EXISTS user_lists_one_rated_per_user
  ON user_lists (user_id)
  WHERE is_rated_list = true;

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
  USING (auth.uid() = user_id AND is_liked_list = false AND is_rated_list = false);

DROP POLICY IF EXISTS "Anyone can view public lists" ON user_lists;
CREATE POLICY "Anyone can view public lists"
  ON user_lists FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

DROP POLICY IF EXISTS "Users can view own list events" ON user_list_events;
CREATE POLICY "Users can view own list events"
  ON user_list_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_lists WHERE id = list_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view events on public lists" ON user_list_events;
CREATE POLICY "Anyone can view events on public lists"
  ON user_list_events FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_lists ul
      WHERE ul.id = list_id AND ul.is_public = true
    )
  );

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

ALTER TABLE events ADD COLUMN IF NOT EXISTS custom_tags jsonb DEFAULT '{}';`;

export function getSupabaseSqlEditorUrl(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/^https?:\/\/([^.]+)\.supabase\.co/);
  if (!match) return null;
  return `https://supabase.com/dashboard/project/${match[1]}/sql/new`;
}
