-- Clear official ticket links once an event is no longer upcoming.
-- Client calls clear_expired_countdown_link when the countdown pill hits zero;
-- daily sweep catches rows nobody had open at expiry.

CREATE OR REPLACE FUNCTION public.clear_expired_countdown_link(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN;
  END IF;

  -- Allow clear once the listed calendar day is today or earlier in UTC, with a
  -- +1 day grace so local midnights ahead of UTC still succeed at pill expiry.
  -- Reject far-future ids so this cannot wipe an entire tour hub link early.
  UPDATE public.events
  SET countdown_link = NULL
  WHERE id = p_event_id
    AND countdown_link IS NOT NULL
    AND btrim(countdown_link) <> ''
    AND (timezone('UTC', date))::date
      <= ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.sweep_expired_countdown_links()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  -- Conservative: UTC calendar day already past (client clears same-day at local midnight).
  UPDATE public.events
  SET countdown_link = NULL
  WHERE countdown_link IS NOT NULL
    AND btrim(countdown_link) <> ''
    AND (timezone('UTC', date))::date
      < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_expired_countdown_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_expired_countdown_links() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.clear_expired_countdown_link(uuid) TO anon, authenticated;
-- Sweep is for cron / service role only (not exposed to clients).
GRANT EXECUTE ON FUNCTION public.sweep_expired_countdown_links() TO postgres;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

DO $cronsetup$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-expired-countdown-links') THEN
    PERFORM cron.unschedule('sweep-expired-countdown-links');
  END IF;
  PERFORM cron.schedule(
    'sweep-expired-countdown-links',
    '15 8 * * *',
    'SELECT public.sweep_expired_countdown_links()'
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron cron.job unavailable; skip schedule';
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron schedule skipped (insufficient privilege)';
END;
$cronsetup$;

SELECT public.sweep_expired_countdown_links();
