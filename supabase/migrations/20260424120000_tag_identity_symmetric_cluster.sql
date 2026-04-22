-- Symmetric "same person" groups: `cluster_id` is shared; no "main" row.
-- Link merges two clusters; unlink gives that row a new `cluster_id`.

ALTER TABLE public.tag_identities
  ADD COLUMN IF NOT EXISTS cluster_id uuid;

UPDATE public.tag_identities SET cluster_id = id WHERE cluster_id IS NULL;

-- Merge each links_to tree into one cluster (root’s id) while column still exists
UPDATE public.tag_identities t
SET cluster_id = sub.comp_root
FROM (
  WITH RECURSIVE tree AS (
    SELECT id, links_to_identity_id, id AS comp_root
    FROM public.tag_identities
    WHERE links_to_identity_id IS NULL
    UNION ALL
    SELECT child.id, child.links_to_identity_id, tree.comp_root
    FROM public.tag_identities child
    INNER JOIN tree ON child.links_to_identity_id = tree.id
  )
  SELECT id, comp_root FROM tree
) sub
WHERE t.id = sub.id;

ALTER TABLE public.tag_identities
  ALTER COLUMN cluster_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS tag_identities_cluster_id_idx ON public.tag_identities (cluster_id);

-- Defaults for new rows (singleton: cluster = own id)
CREATE OR REPLACE FUNCTION public.tag_identities_default_cluster()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cluster_id IS NULL AND NEW.id IS NOT NULL THEN
    NEW.cluster_id := NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_identities_default_cluster_trg ON public.tag_identities;
CREATE TRIGGER tag_identities_default_cluster_trg
  BEFORE INSERT ON public.tag_identities
  FOR EACH ROW
  EXECUTE PROCEDURE public.tag_identities_default_cluster();

-- Remove parent/child link
ALTER TABLE public.tag_identities
  DROP CONSTRAINT IF EXISTS tag_identities_no_self_link;
ALTER TABLE public.tag_identities
  DROP CONSTRAINT IF EXISTS tag_identities_links_to_identity_id_fkey;
DROP INDEX IF EXISTS public.tag_identities_links_to_idx;
ALTER TABLE public.tag_identities
  DROP COLUMN IF EXISTS links_to_identity_id;

-- Replace link/unlink: merge two clusters, or split one row out
CREATE OR REPLACE FUNCTION public.admin_link_tag_identities(p_subject_id uuid, p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t_sub text;
  t_targ text;
  cs uuid;
  ct uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_subject_id = p_target_id THEN
    RAISE EXCEPTION 'cannot link identity to itself' USING ERRCODE = 'P0001';
  END IF;

  SELECT tag_type, cluster_id INTO t_sub, cs FROM public.tag_identities WHERE id = p_subject_id;
  SELECT tag_type, cluster_id INTO t_targ, ct FROM public.tag_identities WHERE id = p_target_id;
  IF t_sub IS NULL OR t_targ IS NULL OR cs IS NULL OR ct IS NULL THEN
    RAISE EXCEPTION 'identity not found' USING ERRCODE = 'P0001';
  END IF;
  IF t_sub <> t_targ THEN
    RAISE EXCEPTION 'tag types differ' USING ERRCODE = 'P0001';
  END IF;
  IF cs = ct THEN
    RETURN;
  END IF;

  UPDATE public.tag_identities
  SET cluster_id = cs
  WHERE cluster_id = ct;
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
  SET cluster_id = gen_random_uuid()
  WHERE id = p_identity_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'identity not found' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_link_tag_identities(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_tag_identity(uuid) TO authenticated;
