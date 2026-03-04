-- RLS policies for tag identity and pending suggestions tables

ALTER TABLE tag_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tag_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_tag_suggestions ENABLE ROW LEVEL SECURITY;

-- tag_identities: anyone can read, authenticated can insert
CREATE POLICY "Anyone can read tag_identities"
  ON tag_identities FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated can insert tag_identities"
  ON tag_identities FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- tag_aliases: anyone can read, authenticated can insert
CREATE POLICY "Anyone can read tag_aliases"
  ON tag_aliases FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Authenticated can insert tag_aliases"
  ON tag_aliases FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- user_tag_credits: users manage their own
CREATE POLICY "Users can read own credits"
  ON user_tag_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits"
  ON user_tag_credits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON user_tag_credits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own credits"
  ON user_tag_credits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- pending_tag_suggestions: read for approvers + suggesters, insert own, update for approvers
CREATE POLICY "Anyone can read pending_tag_suggestions"
  ON pending_tag_suggestions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert own suggestions"
  ON pending_tag_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = suggested_by);

CREATE POLICY "Event owner or admin can update pending suggestions"
  ON pending_tag_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = pending_tag_suggestions.event_id AND e.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.user_id = auth.uid()
    )
  );
