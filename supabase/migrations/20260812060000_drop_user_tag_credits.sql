-- Drop unused user_tag_credits (tag claim feature removed).

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

  DELETE FROM public.tag_identities WHERE id = p_absorb_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_merge_tag_identities(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.garbage_collect_orphan_tag_identities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  WITH in_use AS (
    SELECT DISTINCT 'producer'::text AS tag_type, public.fold_tag_normalize(t) AS n
    FROM public.events, unnest(COALESCE(producers, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'designer', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(featured_designers, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'artist', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(featured_artists, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'model', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(models, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'hair_makeup', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(hair_makeup, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'header_tags', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(header_tags, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'footer_tags', public.fold_tag_normalize(t)
    FROM public.events, unnest(COALESCE(footer_tags, ARRAY[]::text[])) AS u(t)
    UNION
    SELECT 'venue', public.fold_tag_normalize(location)
    FROM public.events
    WHERE location IS NOT NULL AND trim(location) <> ''
    UNION
    SELECT 'city', public.fold_tag_normalize(city)
    FROM public.events
    WHERE city IS NOT NULL AND trim(city) <> ''
    UNION
    SELECT 'season', public.fold_tag_normalize(season)
    FROM public.events
    WHERE season IS NOT NULL AND trim(season) <> ''
    UNION
    SELECT ('custom:' || kv.key)::text, public.fold_tag_normalize(elem.elem::text)
    FROM public.events e
    CROSS JOIN LATERAL jsonb_each(e.custom_tags) AS kv(key, val)
    CROSS JOIN LATERAL jsonb_array_elements_text(kv.val) AS elem(elem)
    WHERE e.custom_tags IS NOT NULL
      AND e.custom_tags <> '{}'::jsonb
      AND jsonb_typeof(kv.val) = 'array'
  ),
  on_event_ids AS (
    SELECT DISTINCT ti.id
    FROM public.tag_identities ti
    JOIN in_use u ON u.tag_type = ti.tag_type AND u.n = public.fold_tag_normalize(ti.canonical_name)
  )
  DELETE FROM public.tag_identities d
  WHERE d.id NOT IN (SELECT id FROM on_event_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.garbage_collect_orphan_tag_identities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garbage_collect_orphan_tag_identities() TO service_role;
GRANT EXECUTE ON FUNCTION public.garbage_collect_orphan_tag_identities() TO authenticated;

DROP TABLE IF EXISTS public.user_tag_credits CASCADE;
