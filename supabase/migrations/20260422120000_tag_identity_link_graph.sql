-- Reversible links between tag identities: a follower points at a parent so search/filters
-- resolve to the same cluster; unlink clears the edge without deleting either profile.

ALTER TABLE public.tag_identities
  ADD COLUMN IF NOT EXISTS links_to_identity_id uuid REFERENCES public.tag_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tag_identities_links_to_idx ON public.tag_identities (links_to_identity_id);

ALTER TABLE public.tag_identities
  DROP CONSTRAINT IF EXISTS tag_identities_no_self_link;
ALTER TABLE public.tag_identities
  ADD CONSTRAINT tag_identities_no_self_link
  CHECK (links_to_identity_id IS NULL OR id <> links_to_identity_id);

-- Link: p_subject (duplicate) -> p_target (parent toward root). No cycles.
CREATE OR REPLACE FUNCTION public.admin_link_tag_identities(p_subject_id uuid, p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_sub text;
  t_targ text;
  v uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_subject_id = p_target_id THEN
    RAISE EXCEPTION 'cannot link identity to itself' USING ERRCODE = 'P0001';
  END IF;

  SELECT tag_type INTO t_sub FROM public.tag_identities WHERE id = p_subject_id;
  SELECT tag_type INTO t_targ FROM public.tag_identities WHERE id = p_target_id;
  IF t_sub IS NULL OR t_targ IS NULL THEN
    RAISE EXCEPTION 'identity not found' USING ERRCODE = 'P0001';
  END IF;
  IF t_sub <> t_targ THEN
    RAISE EXCEPTION 'tag types differ' USING ERRCODE = 'P0001';
  END IF;

  -- If p_subject is on the chain from p_target up to the root, linking would form a cycle.
  v := p_target_id;
  FOR i IN 1..50 LOOP
    EXIT WHEN v IS NULL;
    IF v = p_subject_id THEN
      RAISE EXCEPTION 'invalid link (would form a cycle)' USING ERRCODE = 'P0001';
    END IF;
    SELECT links_to_identity_id INTO v FROM public.tag_identities WHERE id = v;
  END LOOP;

  UPDATE public.tag_identities
  SET links_to_identity_id = p_target_id
  WHERE id = p_subject_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlink_tag_identity(p_identity_id uuid)
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
  UPDATE public.tag_identities
  SET links_to_identity_id = NULL
  WHERE id = p_identity_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'identity not found' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_link_tag_identities(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_tag_identity(uuid) TO authenticated;
