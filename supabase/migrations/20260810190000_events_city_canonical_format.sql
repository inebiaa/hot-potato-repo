-- Enforce City, XX format (2–3 letter region/country code). Blocks full country names.
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_city_canonical_format;

ALTER TABLE public.events
  ADD CONSTRAINT events_city_canonical_format
  CHECK (
    city IS NULL
    OR btrim(city) = ''
    OR city ~ '^[^,]+, [A-Z]{2,3}$'
  );

COMMENT ON CONSTRAINT events_city_canonical_format ON public.events IS
  'City must be "Name, XX" with a 2–3 letter uppercase region/country code (e.g. Denver, CO or Sydney, AU).';
