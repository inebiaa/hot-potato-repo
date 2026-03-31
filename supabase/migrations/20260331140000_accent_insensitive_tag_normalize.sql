-- Align DB tag keys with app `normalizeTagName` / `normalizeTagNameKey`:
-- unaccent + lower + collapse whitespace. Enables searching "Jose" against stored "José", etc.
--
-- If this migration fails on duplicate (tag_type, normalized_name), two identities differ only
-- by accents; resolve manually before re-running.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.fold_tag_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $func$
  SELECT trim(regexp_replace(lower(unaccent(coalesce(p_text, ''))), '\s+', ' ', 'g'));
$func$;

UPDATE public.tag_identities
SET normalized_name = public.fold_tag_normalize(canonical_name);

UPDATE public.tag_aliases
SET normalized_alias = public.fold_tag_normalize(alias);

UPDATE public.pending_tag_suggestions
SET normalized_name = public.fold_tag_normalize(proposed_name);

-- Keep admin RPC in sync with client inserts
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
  norm := public.fold_tag_normalize(p_new_alias);
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
