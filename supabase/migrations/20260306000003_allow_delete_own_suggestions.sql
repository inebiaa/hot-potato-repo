-- Allow users to delete their own pending suggestions (withdraw)
CREATE POLICY "Users can delete own suggestions"
  ON pending_tag_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = suggested_by);
