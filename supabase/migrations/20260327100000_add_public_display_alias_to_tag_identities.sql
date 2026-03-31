-- Public display preference for tag identity (lead label on cards; credited users may update)
ALTER TABLE tag_identities
  ADD COLUMN IF NOT EXISTS public_display_alias_id uuid REFERENCES tag_aliases(id) ON DELETE SET NULL;

COMMENT ON COLUMN tag_identities.public_display_alias_id IS 'Which alias row to show as primary label app-wide; null = use canonical';

-- Allow credited users to update only identities they have a credit for (public display + future fields)
DROP POLICY IF EXISTS "Credited users can update tag identity display" ON tag_identities;
CREATE POLICY "Credited users can update tag identity display"
  ON tag_identities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_identities.id AND utc.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_identities.id AND utc.user_id = auth.uid()
    )
    AND (
      public_display_alias_id IS NULL
      OR EXISTS (
        SELECT 1 FROM tag_aliases ta
        WHERE ta.id = public_display_alias_id AND ta.identity_id = tag_identities.id
      )
    )
  );
