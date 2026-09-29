-- INFERRED_COMPATIBILITY_IMPLEMENTATION
-- leaderboard-refresh.ts requires a boolean, atomic time-window claim. This
-- is throttling, NOT a job lease. Force (interval=0) intentionally bypasses it,
-- matching the Edge caller. A crashed attempt becomes eligible after interval.
CREATE FUNCTION public.leaderboard_refresh_try_claim(p_period text, p_min_interval_s integer)
RETURNS boolean LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_claimed text;
BEGIN
  IF p_period IS NULL OR p_period NOT IN ('week', 'month', 'total')
    OR p_min_interval_s IS NULL OR p_min_interval_s < 0 THEN
    RAISE EXCEPTION 'Invalid refresh claim arguments';
  END IF;
  INSERT INTO public.tokentracker_leaderboard_refresh_state AS s(period, last_attempt_at)
  VALUES (p_period, clock_timestamp())
  ON CONFLICT (period) DO UPDATE SET last_attempt_at = EXCLUDED.last_attempt_at
  WHERE s.last_attempt_at <= EXCLUDED.last_attempt_at - make_interval(secs => p_min_interval_s)
  RETURNING period INTO v_claimed;
  RETURN v_claimed IS NOT NULL;
END
$fn$;
