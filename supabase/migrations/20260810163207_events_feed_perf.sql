-- Faster date-ordered feed scans + keep rating averages as a real table
-- (updated by triggers) instead of recomputing a view on every home load.

CREATE INDEX IF NOT EXISTS events_date_desc_idx ON public.events (date DESC);

DROP VIEW IF EXISTS public.event_rating_stats;

CREATE TABLE public.event_rating_stats (
  event_id uuid PRIMARY KEY REFERENCES public.events (id) ON DELETE CASCADE,
  average_rating double precision NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0
);

INSERT INTO public.event_rating_stats (event_id, average_rating, rating_count)
SELECT
  r.event_id,
  AVG(r.rating)::double precision,
  COUNT(*)::integer
FROM public.ratings r
GROUP BY r.event_id;

ALTER TABLE public.event_rating_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read event rating stats"
  ON public.event_rating_stats
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.event_rating_stats TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_event_rating_stats(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_r double precision;
  cnt integer;
BEGIN
  SELECT COALESCE(AVG(rating), 0)::double precision, COUNT(*)::integer
  INTO avg_r, cnt
  FROM public.ratings
  WHERE event_id = p_event_id;

  IF cnt = 0 THEN
    DELETE FROM public.event_rating_stats WHERE event_id = p_event_id;
  ELSE
    INSERT INTO public.event_rating_stats (event_id, average_rating, rating_count)
    VALUES (p_event_id, avg_r, cnt)
    ON CONFLICT (event_id) DO UPDATE
    SET
      average_rating = EXCLUDED.average_rating,
      rating_count = EXCLUDED.rating_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ratings_stats_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
    PERFORM public.refresh_event_rating_stats(OLD.event_id);
    PERFORM public.refresh_event_rating_stats(NEW.event_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_event_rating_stats(OLD.event_id);
  ELSE
    PERFORM public.refresh_event_rating_stats(NEW.event_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ratings_refresh_stats ON public.ratings;
CREATE TRIGGER ratings_refresh_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.ratings_stats_trigger();

COMMENT ON TABLE public.event_rating_stats IS
  'Per-event rating average and count for feed cards; maintained by ratings triggers.';
