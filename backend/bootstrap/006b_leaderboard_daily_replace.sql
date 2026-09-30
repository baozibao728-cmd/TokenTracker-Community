-- INFERRED_COMPATIBILITY_IMPLEMENTATION
-- Based on upstream 20260804043427 replace_v2. Final reader and total triggers
-- require tier-preserving daily writes; their matching upstream writer is absent.
CREATE FUNCTION public.leaderboard_rollup_daily_replace_v2(p_from timestamptz, p_to timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE v_day timestamptz := p_from;
BEGIN
  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Expected an ordered UTC day range';
  END IF;
  -- Upstream advance passes an empty range on a brand-new database.
  IF p_from = p_to THEN RETURN; END IF;
  IF p_from <> date_trunc('day', p_from AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    OR p_to <> date_trunc('day', p_to AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' THEN
    RAISE EXCEPTION 'Daily rollup boundaries must be UTC midnight';
  END IF;
  -- Serialize writers so a repair's DELETE/INSERT cannot double-count totals.
  LOCK TABLE public.tokentracker_leaderboard_rollup_daily_v2 IN SHARE ROW EXCLUSIVE MODE;
  -- Preserve the upstream one-day-at-a-time scan to bound memory on catch-up.
  WHILE v_day < p_to LOOP
  DELETE FROM public.tokentracker_leaderboard_rollup_daily_v2
  WHERE day = (v_day AT TIME ZONE 'UTC')::date;
  INSERT INTO public.tokentracker_leaderboard_rollup_daily_v2
    (user_id, source, model, day, pricing_tier, total_tokens, input_tokens,
     output_tokens, cached_input_tokens, cache_creation_input_tokens, reasoning_output_tokens)
  SELECT user_id, source, model, (hour_start AT TIME ZONE 'UTC')::date,
    public.leaderboard_pricing_tier(model, hour_start), SUM(total_tokens)::bigint,
    SUM(input_tokens)::bigint, SUM(output_tokens)::bigint,
    SUM(cached_input_tokens)::bigint, SUM(cache_creation_input_tokens)::bigint,
    SUM(reasoning_output_tokens)::bigint
  FROM public.leaderboard_hourly_dedup_v2(v_day, v_day + interval '1 day')
  GROUP BY user_id, source, model, (hour_start AT TIME ZONE 'UTC')::date,
    public.leaderboard_pricing_tier(model, hour_start);
  v_day := v_day + interval '1 day';
  END LOOP;
END
$fn$;
