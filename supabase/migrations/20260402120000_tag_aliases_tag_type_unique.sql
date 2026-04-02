-- Denormalize tag_type onto tag_aliases and enforce one normalized spelling per tag_type
-- (prevents two brands from sharing the same alias string).

ALTER TABLE public.tag_aliases
  ADD COLUMN IF NOT EXISTS tag_type text;

UPDATE public.tag_aliases ta
SET tag_type = ti.tag_type
FROM public.tag_identities ti
WHERE ta.identity_id = ti.id
  AND (ta.tag_type IS DISTINCT FROM ti.tag_type OR ta.tag_type IS NULL);

-- Remove duplicate (tag_type, normalized_alias) rows; keep the identity whose canonical matches the spelling.
UPDATE public.tag_identities i
SET public_display_alias_id = NULL
WHERE i.public_display_alias_id IN (
  SELECT id FROM (
    SELECT
      ta.id,
      ROW_NUMBER() OVER (
        PARTITION BY ta.tag_type, ta.normalized_alias
        ORDER BY
          CASE WHEN ti.normalized_name = ta.normalized_alias THEN 0 ELSE 1 END,
          ta.id
      ) AS rn
    FROM public.tag_aliases ta
    INNER JOIN public.tag_identities ti ON ti.id = ta.identity_id
  ) sub
  WHERE rn > 1
);

UPDATE public.user_tag_credits c
SET preferred_alias_id = NULL
WHERE c.preferred_alias_id IN (
  SELECT id FROM (
    SELECT
      ta.id,
      ROW_NUMBER() OVER (
        PARTITION BY ta.tag_type, ta.normalized_alias
        ORDER BY
          CASE WHEN ti.normalized_name = ta.normalized_alias THEN 0 ELSE 1 END,
          ta.id
      ) AS rn
    FROM public.tag_aliases ta
    INNER JOIN public.tag_identities ti ON ti.id = ta.identity_id
  ) sub
  WHERE rn > 1
);

DELETE FROM public.tag_aliases
WHERE id IN (
  SELECT id FROM (
    SELECT
      ta.id,
      ROW_NUMBER() OVER (
        PARTITION BY ta.tag_type, ta.normalized_alias
        ORDER BY
          CASE WHEN ti.normalized_name = ta.normalized_alias THEN 0 ELSE 1 END,
          ta.id
      ) AS rn
    FROM public.tag_aliases ta
    INNER JOIN public.tag_identities ti ON ti.id = ta.identity_id
  ) sub
  WHERE rn > 1
);

ALTER TABLE public.tag_aliases
  ALTER COLUMN tag_type SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tag_aliases_tag_type_normalized_alias_unique
  ON public.tag_aliases (tag_type, normalized_alias);

CREATE OR REPLACE FUNCTION public.tag_aliases_sync_tag_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT ti.tag_type INTO STRICT NEW.tag_type
  FROM public.tag_identities ti
  WHERE ti.id = NEW.identity_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tag_aliases_sync_tag_type ON public.tag_aliases;
CREATE TRIGGER tag_aliases_sync_tag_type
  BEFORE INSERT OR UPDATE OF identity_id ON public.tag_aliases
  FOR EACH ROW
  EXECUTE PROCEDURE public.tag_aliases_sync_tag_type();
