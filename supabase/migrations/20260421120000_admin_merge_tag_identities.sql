-- Admin-only merge of two tag identities of the same tag_type (duplicate designers, etc.).
-- Moves aliases and credits from p_absorb_id into p_keep_id, then deletes p_absorb_id.

CREATE OR REPLACE FUNCTION public.admin_merge_tag_identities(p_keep_id uuid, p_absorb_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_keep text;
  t_abs text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_keep_id = p_absorb_id THEN
    RETURN;
  END IF;
  SELECT tag_type INTO t_keep FROM public.tag_identities WHERE id = p_keep_id;
  SELECT tag_type INTO t_abs FROM public.tag_identities WHERE id = p_absorb_id;
  IF t_keep IS NULL OR t_abs IS NULL THEN
    RAISE EXCEPTION 'identity not found' USING ERRCODE = 'P0001';
  END IF;
  IF t_keep <> t_abs THEN
    RAISE EXCEPTION 'tag types differ' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tag_identities
  SET public_display_alias_id = NULL
  WHERE id = p_absorb_id;

  DELETE FROM public.user_tag_credits c
  USING public.user_tag_credits k
  WHERE c.identity_id = p_absorb_id
    AND k.identity_id = p_keep_id
    AND c.user_id = k.user_id;

  UPDATE public.user_tag_credits
  SET identity_id = p_keep_id
  WHERE identity_id = p_absorb_id;

  UPDATE public.pending_tag_suggestions
  SET linked_identity_id = p_keep_id
  WHERE linked_identity_id = p_absorb_id;

  UPDATE public.tag_aliases a
  SET identity_id = p_keep_id
  WHERE a.identity_id = p_absorb_id
  AND NOT EXISTS (
    SELECT 1 FROM public.tag_aliases a2
    WHERE a2.identity_id = p_keep_id
    AND a2.normalized_alias = a.normalized_alias
  );

  DELETE FROM public.tag_aliases WHERE identity_id = p_absorb_id;

  INSERT INTO public.tag_aliases (identity_id, alias, normalized_alias, created_by)
  SELECT
    p_keep_id,
    ti.canonical_name,
    ti.normalized_name,
    NULL
  FROM public.tag_identities ti
  WHERE ti.id = p_absorb_id
  AND NOT EXISTS (
    SELECT 1 FROM public.tag_aliases a
    WHERE a.identity_id = p_keep_id
    AND a.normalized_alias = ti.normalized_name
  );

  UPDATE public.user_tag_credits c
  SET preferred_alias_id = NULL
  WHERE c.preferred_alias_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tag_aliases a WHERE a.id = c.preferred_alias_id);

  UPDATE public.tag_identities t
  SET public_display_alias_id = NULL
  WHERE t.public_display_alias_id IS NOT NULL
  AND t.id = p_keep_id
  AND NOT EXISTS (SELECT 1 FROM public.tag_aliases a WHERE a.id = t.public_display_alias_id);

  DELETE FROM public.tag_identities WHERE id = p_absorb_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_merge_tag_identities(uuid, uuid) TO authenticated;
