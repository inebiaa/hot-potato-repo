-- Allow users with a credit on an identity to delete alias rows for that identity
DROP POLICY IF EXISTS "Credited users can delete tag_aliases" ON tag_aliases;
CREATE POLICY "Credited users can delete tag_aliases"
  ON tag_aliases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_tag_credits utc
      WHERE utc.identity_id = tag_aliases.identity_id AND utc.user_id = auth.uid()
    )
  );
