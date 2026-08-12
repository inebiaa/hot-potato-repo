-- Remove events.models (feature retired; use custom tags if needed).

CREATE OR REPLACE FUNCTION public.search_events(q text)
RETURNS SETOF public.events
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT e.*
  FROM public.events e
  WHERE length(trim(q)) >= 2
    AND (
      e.name ILIKE '%' || trim(q) || '%'
      OR COALESCE(e.city, '') ILIKE '%' || trim(q) || '%'
      OR COALESCE(e.location, '') ILIKE '%' || trim(q) || '%'
      OR COALESCE(e.season, '') ILIKE '%' || trim(q) || '%'
      OR COALESCE(e.show_type, '') ILIKE '%' || trim(q) || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.featured_artists, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.producers, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.featured_designers, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.hair_makeup, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.header_tags, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(e.footer_tags, ARRAY[]::text[])) x
        WHERE x ILIKE '%' || trim(q) || '%'
      )
      OR COALESCE(e.custom_tags::text, '') ILIKE '%' || trim(q) || '%'
    )
  ORDER BY e.date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.search_events(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.events_with_tag_values(
  field_name text,
  vals text[]
)
RETURNS SETOF public.events
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF vals IS NULL OR cardinality(vals) = 0 THEN
    RETURN;
  END IF;
  CASE field_name
    WHEN 'featured_artists' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.featured_artists && vals ORDER BY e.date DESC;
    WHEN 'producers' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.producers && vals ORDER BY e.date DESC;
    WHEN 'featured_designers' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.featured_designers && vals ORDER BY e.date DESC;
    WHEN 'hair_makeup' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.hair_makeup && vals ORDER BY e.date DESC;
    WHEN 'header_tags' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.header_tags && vals ORDER BY e.date DESC;
    WHEN 'footer_tags' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.footer_tags && vals ORDER BY e.date DESC;
    WHEN 'city' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.city = ANY(vals) ORDER BY e.date DESC;
    WHEN 'location' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.location = ANY(vals) ORDER BY e.date DESC;
    ELSE
      RETURN;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.events_with_tag_values(text, text[]) TO anon, authenticated;

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

ALTER TABLE public.events DROP COLUMN IF EXISTS models;
