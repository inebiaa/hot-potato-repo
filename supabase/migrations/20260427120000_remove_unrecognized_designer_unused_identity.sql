-- Remove one orphan designer identity if it is still unused.
-- Guarded: only deletes when singleton cluster + no event references by canonical spelling.
-- Uses an anonymized normalized-name hash (no plain-text personal name in migration source).

DO $$
DECLARE
  v_id uuid;
  v_cluster uuid;
  v_norm_md5 text := '6d4d31d9fc7d5ea147dbe4afd6f7b1a7';
  v_in_events boolean := false;
  v_cluster_size int := 0;
BEGIN
  SELECT id, cluster_id
  INTO v_id, v_cluster
  FROM public.tag_identities
  WHERE tag_type = 'designer'
    AND md5(normalized_name) = v_norm_md5
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'No matching hashed designer identity found';
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO v_cluster_size
  FROM public.tag_identities
  WHERE cluster_id = v_cluster;

  SELECT EXISTS (
    SELECT 1
    FROM public.events e,
         unnest(COALESCE(e.featured_designers, ARRAY[]::text[])) AS u(t)
    WHERE md5(public.fold_tag_normalize(u.t)) = v_norm_md5
  )
  INTO v_in_events;

  IF v_in_events THEN
    RAISE NOTICE 'Skipping delete: hashed designer identity still appears on at least one event';
    RETURN;
  END IF;

  IF v_cluster_size > 1 THEN
    RAISE NOTICE 'Skipping delete: identity is in linked cluster (size %)', v_cluster_size;
    RETURN;
  END IF;

  DELETE FROM public.tag_identities
  WHERE id = v_id;

  RAISE NOTICE 'Deleted orphan designer identity id=%', v_id;
END
$$;
