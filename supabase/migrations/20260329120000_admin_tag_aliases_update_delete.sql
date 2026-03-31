-- Admins can update or delete any tag_aliases row (in addition to credited-user delete policy)

CREATE POLICY "Admins can update tag_aliases"
  ON tag_aliases FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Admins can delete tag_aliases"
  ON tag_aliases FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
