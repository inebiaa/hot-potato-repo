-- Aggregate rating averages/counts in the database so the feed does not download every rating row.
-- security_invoker: RLS on `ratings` still applies to underlying reads.

CREATE OR REPLACE VIEW public.event_rating_stats
WITH (security_invoker = true) AS
SELECT
  r.event_id,
  AVG(r.rating)::double precision AS average_rating,
  COUNT(*)::integer AS rating_count
FROM public.ratings r
GROUP BY r.event_id;

GRANT SELECT ON public.event_rating_stats TO anon, authenticated;

COMMENT ON VIEW public.event_rating_stats IS
  'Per-event rating average and count for feed cards; use with a separate user ratings query.';
