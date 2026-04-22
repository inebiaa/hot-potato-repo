-- Delete `tag_identities` rows (with CASCADE to `tag_aliases` / `user_tag_credits`) when the entire
-- cluster is unused: no event references any of its spellings, no user credit, and no
-- `pending_tag_suggestions.linked_identity_id` to any member. Safe for linked clusters: if any
-- member is “protected”, the whole cluster is kept. Run manually: SELECT
-- public.garbage_collect_orphan_tag_identities();
--
-- City/season are included in “in use on an event” alongside the list used in
-- 20260404120000_prune_tag_aliases_not_on_events.sql (plus `events.city` / `events.season`).

CREATE OR REPLACE FUNCTION public.garbage_collect_orphan_tag_identities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  -- Allow: migration / service session with no JWT, or admin.
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
    UNION
    SELECT DISTINCT ta.identity_id
    FROM public.tag_aliases ta
    JOIN public.tag_identities ti ON ti.id = ta.identity_id
    JOIN in_use u
      ON u.tag_type = COALESCE(ta.tag_type, ti.tag_type)
     AND u.n = ta.normalized_alias
  ),
  protected_ids AS (
    SELECT id FROM on_event_ids
    UNION
    SELECT identity_id AS id FROM public.user_tag_credits
    UNION
    SELECT linked_identity_id AS id
    FROM public.pending_tag_suggestions
    WHERE linked_identity_id IS NOT NULL
  ),
  deletable_cluster AS (
    SELECT t.cluster_id
    FROM public.tag_identities t
    GROUP BY t.cluster_id
    HAVING NOT EXISTS (
      SELECT 1
      FROM public.tag_identities t2
      WHERE t2.cluster_id = t.cluster_id
        AND t2.id IN (SELECT id FROM protected_ids)
    )
  )
  DELETE FROM public.tag_identities d
  WHERE d.cluster_id IN (SELECT cluster_id FROM deletable_cluster);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.garbage_collect_orphan_tag_identities() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.garbage_collect_orphan_tag_identities() TO service_role;
GRANT EXECUTE ON FUNCTION public.garbage_collect_orphan_tag_identities() TO authenticated;

-- One-time clean on deploy (runs as definer, no end-user session).
SELECT public.garbage_collect_orphan_tag_identities();
