-- Final upstream definitions only; provenance.json records exact extracted hashes.

-- UPSTREAM: migrations/20260817120000_account-session-states.sql :: leaderboard_rollup_daily_advance_v2
CREATE OR REPLACE FUNCTION public.leaderboard_rollup_daily_advance_v2()
RETURNS void
LANGUAGE plpgsql
SET work_mem TO '16MB'
SET hash_mem_multiplier TO '2'
SET statement_timeout TO '25s'
AS $func$
DECLARE
  v_from timestamptz;
  v_target timestamptz := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_until timestamptz;
  v_min_day date;
  v_repair_from date;
  v_seed_gap_day date;
BEGIN
  SELECT
    (date_trunc('day', MIN(h.hour_start) AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')::date
  INTO v_min_day
  FROM public.tokentracker_hourly h;
  v_min_day := COALESCE(v_min_day, (v_target AT TIME ZONE 'UTC')::date);

  SELECT m.through, m.repair_from INTO v_from, v_repair_from
  FROM public.tokentracker_leaderboard_rollup_meta_v2 m
  WHERE m.id = 1
  FOR UPDATE;

  IF v_from IS NULL THEN
    v_from := v_min_day::timestamp AT TIME ZONE 'UTC';
    v_repair_from := v_min_day;
    INSERT INTO public.tokentracker_leaderboard_rollup_meta_v2 (
      id, through, repair_from, rebuilt_at
    ) VALUES (1, v_from, v_repair_from, now());
  END IF;

  IF v_from < v_target THEN
    -- Bootstrap/catch-up: advance at most seven closed days per request.
    v_until := LEAST(v_target, v_from + interval '7 days');
    PERFORM public.leaderboard_rollup_daily_replace_v2(v_from, v_until);
    UPDATE public.tokentracker_leaderboard_rollup_meta_v2
    SET through = v_until,
        rebuilt_at = now()
    WHERE id = 1;
    RETURN;
  END IF;

  -- Once caught up, continuously repair seven historical days per scheduled
  -- total refresh. Late history uploads, device revocations, and cluster-map
  -- changes therefore self-heal without another whole-history memory spike.
  IF v_repair_from >= (v_target AT TIME ZONE 'UTC')::date THEN
    v_repair_from := v_min_day;
  END IF;

  -- First-seed / uncovered-day prioritization (trae-cn): jump the repair
  -- window to the earliest CLOSED day that has trae-cn session states but
  -- no trae-cn rollup row yet (see the function header comment). Coverage
  -- is PER USER (the rollup PK starts at user_id): another user's same-day
  -- row does NOT cover this user's seed. A day whose rollup row exists for
  -- that user (even with stale values) is NOT a gap - corrections keep the
  -- ordinary cyclic schedule.
  SELECT MIN((s.bucket_start AT TIME ZONE 'UTC')::date) INTO v_seed_gap_day
  FROM public.tokentracker_account_session_states s
  WHERE s.source = 'trae-cn'
    AND (s.bucket_start AT TIME ZONE 'UTC')::date < (v_target AT TIME ZONE 'UTC')::date
    AND NOT EXISTS (
      SELECT 1 FROM public.tokentracker_leaderboard_rollup_daily_v2 r
      WHERE r.user_id = s.user_id
        AND r.source = 'trae-cn'
        AND r.day = (s.bucket_start AT TIME ZONE 'UTC')::date
    );
  IF v_seed_gap_day IS NOT NULL THEN
    v_repair_from := v_seed_gap_day;
  END IF;

  v_until := LEAST(
    v_target,
    (v_repair_from::timestamp AT TIME ZONE 'UTC') + interval '7 days'
  );
  PERFORM public.leaderboard_rollup_daily_replace_v2(
    v_repair_from::timestamp AT TIME ZONE 'UTC',
    v_until
  );
  UPDATE public.tokentracker_leaderboard_rollup_meta_v2
  SET repair_from = CASE
        WHEN v_until >= v_target THEN v_min_day
        ELSE (v_until AT TIME ZONE 'UTC')::date
      END,
      rebuilt_at = now()
  WHERE id = 1;
END
$func$;

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: leaderboard_usage_grouped
CREATE OR REPLACE FUNCTION public.leaderboard_usage_grouped(
  p_from timestamptz,
  p_to timestamptz
) RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path TO public, pg_temp
SET work_mem TO '96MB'
SET hash_mem_multiplier TO '4'
SET statement_timeout TO '25s'
AS $func$
DECLARE
  v_through timestamptz;
  v_cut timestamptz;
  v_base jsonb;
BEGIN
  SELECT m.through INTO v_through
  FROM public.tokentracker_leaderboard_rollup_meta_v2 m
  WHERE m.id = 1;
  v_cut := date_trunc(
    'day',
    LEAST(v_through, p_to) AT TIME ZONE 'UTC'
  ) AT TIME ZONE 'UTC';

  IF v_through IS NOT NULL
     AND p_from = date_trunc('day', p_from AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
     AND v_cut > p_from THEN
    IF p_from = TIMESTAMPTZ '1970-01-01 00:00:00+00'
       AND p_to >= v_through THEN
      -- The all-time period is the only caller allowed to use the aggregate
      -- without a day predicate. It still merges the open live tail so today
      -- remains current before the next closed-day rollup advance.
      SELECT COALESCE(jsonb_agg(to_jsonb(per_usm.*)), '[]'::jsonb)
      INTO v_base
      FROM (
        SELECT
          u.user_id, u.source, u.model, u.pricing_tier,
          SUM(u.total_tokens)::bigint AS total_tokens,
          SUM(u.input_tokens)::bigint AS input_tokens,
          SUM(u.output_tokens)::bigint AS output_tokens,
          SUM(u.cached_input_tokens)::bigint AS cached_input_tokens,
          SUM(u.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
          SUM(u.reasoning_output_tokens)::bigint AS reasoning_output_tokens
        FROM (
          SELECT
            r.user_id, r.source, r.model, r.pricing_tier,
            r.total_tokens, r.input_tokens, r.output_tokens,
            r.cached_input_tokens, r.cache_creation_input_tokens,
            r.reasoning_output_tokens
          FROM public.tokentracker_leaderboard_rollup_total_v2 r
          UNION ALL
          SELECT
            t.user_id, t.source, t.model,
            public.leaderboard_pricing_tier(t.model, t.hour_start) AS pricing_tier,
            t.total_tokens, t.input_tokens, t.output_tokens,
            t.cached_input_tokens, t.cache_creation_input_tokens,
            t.reasoning_output_tokens
          FROM public.leaderboard_hourly_dedup_v2(v_cut, p_to) t
        ) u
        GROUP BY u.user_id, u.source, u.model, u.pricing_tier
      ) per_usm;
    ELSE
      SELECT COALESCE(jsonb_agg(to_jsonb(per_usm.*)), '[]'::jsonb)
      INTO v_base
      FROM (
        SELECT
          u.user_id, u.source, u.model, u.pricing_tier,
          SUM(u.total_tokens)::bigint AS total_tokens,
          SUM(u.input_tokens)::bigint AS input_tokens,
          SUM(u.output_tokens)::bigint AS output_tokens,
          SUM(u.cached_input_tokens)::bigint AS cached_input_tokens,
          SUM(u.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
          SUM(u.reasoning_output_tokens)::bigint AS reasoning_output_tokens
        FROM (
          SELECT
            r.user_id, r.source, r.model, r.pricing_tier,
            r.total_tokens, r.input_tokens, r.output_tokens,
            r.cached_input_tokens, r.cache_creation_input_tokens,
            r.reasoning_output_tokens
          FROM public.tokentracker_leaderboard_rollup_daily_v2 r
          WHERE r.day >= (p_from AT TIME ZONE 'UTC')::date
            AND r.day < (v_cut AT TIME ZONE 'UTC')::date
          UNION ALL
          SELECT
            t.user_id, t.source, t.model,
            public.leaderboard_pricing_tier(t.model, t.hour_start) AS pricing_tier,
            t.total_tokens, t.input_tokens, t.output_tokens,
            t.cached_input_tokens, t.cache_creation_input_tokens,
            t.reasoning_output_tokens
          FROM public.leaderboard_hourly_dedup_v2(v_cut, p_to) t
        ) u
        GROUP BY u.user_id, u.source, u.model, u.pricing_tier
      ) per_usm;
    END IF;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(per_usm.*)), '[]'::jsonb)
    INTO v_base
    FROM (
      SELECT
        d.user_id, d.source, d.model,
        public.leaderboard_pricing_tier(d.model, d.hour_start) AS pricing_tier,
        SUM(d.total_tokens)::bigint AS total_tokens,
        SUM(d.input_tokens)::bigint AS input_tokens,
        SUM(d.output_tokens)::bigint AS output_tokens,
        SUM(d.cached_input_tokens)::bigint AS cached_input_tokens,
        SUM(d.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
        SUM(d.reasoning_output_tokens)::bigint AS reasoning_output_tokens
      FROM public.leaderboard_hourly_dedup_v2(p_from, p_to) d
      GROUP BY
        d.user_id, d.source, d.model,
        public.leaderboard_pricing_tier(d.model, d.hour_start)
    ) per_usm;
  END IF;

  RETURN COALESCE(v_base, '[]'::jsonb);
END
$func$;

-- UPSTREAM: migrations/20260904064500_shard-leaderboard-total-read.sql :: leaderboard_usage_grouped_total_shard
CREATE OR REPLACE FUNCTION public.leaderboard_usage_grouped_total_shard(
  p_to timestamptz,
  p_user_from uuid,
  p_user_to uuid
) RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path TO public, pg_temp
SET work_mem TO '48MB'
SET hash_mem_multiplier TO '2'
SET statement_timeout TO '8s'
AS $func$
DECLARE
  v_through timestamptz;
  v_cut timestamptz;
  v_result jsonb;
BEGIN
  SELECT m.through INTO v_through
  FROM public.tokentracker_leaderboard_rollup_meta_v2 m
  WHERE m.id = 1;

  IF v_through IS NULL THEN
    RAISE EXCEPTION 'leaderboard v2 rollup is not initialized';
  END IF;

  v_cut := date_trunc(
    'day',
    LEAST(v_through, p_to) AT TIME ZONE 'UTC'
  ) AT TIME ZONE 'UTC';

  SELECT COALESCE(jsonb_agg(to_jsonb(per_usm.*)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      u.user_id, u.source, u.model, u.pricing_tier,
      SUM(u.total_tokens)::bigint AS total_tokens,
      SUM(u.input_tokens)::bigint AS input_tokens,
      SUM(u.output_tokens)::bigint AS output_tokens,
      SUM(u.cached_input_tokens)::bigint AS cached_input_tokens,
      SUM(u.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
      SUM(u.reasoning_output_tokens)::bigint AS reasoning_output_tokens
    FROM (
      SELECT
        r.user_id, r.source, r.model, r.pricing_tier,
        r.total_tokens, r.input_tokens, r.output_tokens,
        r.cached_input_tokens, r.cache_creation_input_tokens,
        r.reasoning_output_tokens
      FROM public.tokentracker_leaderboard_rollup_total_v2 r
      WHERE (p_user_from IS NULL OR r.user_id >= p_user_from)
        AND (p_user_to IS NULL OR r.user_id < p_user_to)

      UNION ALL

      SELECT
        t.user_id, t.source, t.model,
        public.leaderboard_pricing_tier(t.model, t.hour_start) AS pricing_tier,
        t.total_tokens, t.input_tokens, t.output_tokens,
        t.cached_input_tokens, t.cache_creation_input_tokens,
        t.reasoning_output_tokens
      FROM public.leaderboard_hourly_dedup_v2(v_cut, p_to) t
      WHERE (p_user_from IS NULL OR t.user_id >= p_user_from)
        AND (p_user_to IS NULL OR t.user_id < p_user_to)
    ) u
    GROUP BY u.user_id, u.source, u.model, u.pricing_tier
  ) per_usm;

  RETURN COALESCE(v_result, '[]'::jsonb);
END
$func$;

-- UPSTREAM: migrations/20260717013000_harden-backend-hot-paths.sql :: leaderboard_user_metadata
CREATE OR REPLACE FUNCTION public.leaderboard_user_metadata(
  p_user_ids uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO public, pg_temp
SET statement_timeout TO '5s'
AS $func$
  WITH requested AS (
    SELECT DISTINCT user_id
    FROM unnest(COALESCE(p_user_ids, ARRAY[]::uuid[])) AS ids(user_id)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id', r.user_id,
        'leaderboard_public', COALESCE(s.leaderboard_public, false),
        'leaderboard_anonymous', COALESCE(s.leaderboard_anonymous, false),
        'github_url', s.github_url,
        'show_github_url', COALESCE(s.show_github_url, false),
        'display_name', CASE
          WHEN p.user_id IS NOT NULL THEN p.display_name
          ELSE previous.display_name
        END,
        'avatar_url', CASE
          WHEN p.user_id IS NOT NULL THEN p.avatar_url
          ELSE previous.avatar_url
        END
      )
      ORDER BY r.user_id
    ),
    '[]'::jsonb
  )
  FROM requested r
  LEFT JOIN public.tokentracker_user_settings s ON s.user_id = r.user_id
  LEFT JOIN public.tokentracker_user_profiles p ON p.user_id = r.user_id
  LEFT JOIN LATERAL (
    SELECT snap.display_name, snap.avatar_url
    FROM public.tokentracker_leaderboard_snapshots snap
    WHERE snap.user_id = r.user_id
    ORDER BY snap.generated_at DESC
    LIMIT 1
  ) previous ON p.user_id IS NULL;
$func$;
