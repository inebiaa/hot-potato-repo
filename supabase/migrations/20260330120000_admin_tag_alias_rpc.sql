-- Admin alias delete/update via SECURITY DEFINER RPCs so deletes succeed even when
-- client DELETE ... RETURNING returns no rows under RLS quirks.

CREATE OR REPLACE FUNCTION public.admin_delete_tag_alias(p_alias_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.tag_aliases WHERE id = p_alias_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'alias not found or could not be deleted' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_tag_alias(p_alias_id uuid, p_new_alias text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  norm text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  norm := lower(regexp_replace(trim(p_new_alias), '[[:space:]]+', ' ', 'g'));
  IF norm = '' THEN
    RAISE EXCEPTION 'invalid alias' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.tag_aliases
  SET alias = trim(p_new_alias), normalized_alias = norm
  WHERE id = p_alias_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'alias not found' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_tag_alias(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_tag_alias(uuid, text) TO authenticated;
