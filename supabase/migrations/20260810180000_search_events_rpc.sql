-- Fast text search across event fields + tag arrays (invoker RLS).
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
        SELECT 1 FROM unnest(COALESCE(e.models, ARRAY[]::text[])) x
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

-- Events that include any of the given exact tag strings on the named array/text column.
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
    WHEN 'models' THEN
      RETURN QUERY SELECT e.* FROM public.events e WHERE e.models && vals ORDER BY e.date DESC;
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
