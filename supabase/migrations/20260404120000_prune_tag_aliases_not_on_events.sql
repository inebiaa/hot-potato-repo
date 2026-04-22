-- Remove tag_aliases rows whose normalized spelling does not appear on any event
-- in the corresponding tag column. Always keep the row referenced by
-- tag_identities.public_display_alias_id (when set).

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
  SELECT ('custom:' || kv.key)::text, public.fold_tag_normalize(elem.elem::text)
  FROM public.events e
  CROSS JOIN LATERAL jsonb_each(e.custom_tags) AS kv(key, val)
  CROSS JOIN LATERAL jsonb_array_elements_text(kv.val) AS elem(elem)
  WHERE e.custom_tags IS NOT NULL
    AND e.custom_tags <> '{}'::jsonb
    AND jsonb_typeof(kv.val) = 'array'
)
DELETE FROM public.tag_aliases ta
USING public.tag_identities ti
WHERE ta.identity_id = ti.id
  AND COALESCE(ta.tag_type, ti.tag_type) = ti.tag_type
  AND (ti.public_display_alias_id IS NULL OR ta.id IS DISTINCT FROM ti.public_display_alias_id)
  AND NOT EXISTS (
    SELECT 1
    FROM in_use iu
    WHERE iu.tag_type = ti.tag_type
      AND iu.n = ta.normalized_alias
  );
