-- Final upstream definitions only; provenance.json records exact extracted hashes.

-- UPSTREAM: migrations/20260804043427_align-leaderboard-machine-clusters.sql :: tokentracker_leaderboard_rollup_meta_v2
CREATE TABLE IF NOT EXISTS public.tokentracker_leaderboard_rollup_meta_v2 (
  id int PRIMARY KEY CHECK (id = 1),
  through timestamptz NOT NULL,
  repair_from date NOT NULL,
  rebuilt_at timestamptz NOT NULL DEFAULT now()
);

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: tokentracker_leaderboard_rollup_total_v2
CREATE TABLE IF NOT EXISTS public.tokentracker_leaderboard_rollup_total_v2 (
  user_id uuid NOT NULL,
  source text NOT NULL,
  model text NOT NULL,
  pricing_tier text NOT NULL,
  total_tokens bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cached_input_tokens bigint NOT NULL DEFAULT 0,
  cache_creation_input_tokens bigint NOT NULL DEFAULT 0,
  reasoning_output_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, source, model, pricing_tier)
);

-- UPSTREAM: migrations/20260817120000_account-session-states.sql :: leaderboard_hourly_dedup_v2
CREATE OR REPLACE FUNCTION public.leaderboard_hourly_dedup_v2(
  p_from timestamptz,
  p_to timestamptz
) RETURNS TABLE (
  user_id uuid,
  source text,
  model text,
  hour_start timestamptz,
  total_tokens bigint,
  input_tokens bigint,
  output_tokens bigint,
  cached_input_tokens bigint,
  cache_creation_input_tokens bigint,
  reasoning_output_tokens bigint
)
LANGUAGE sql STABLE
AS $func$
  WITH cfg AS (
    SELECT ARRAY['cursor', 'trae-cn']::text[] AS account_sources
  )
  -- Deduplicate device-id drift/replays inside one physical machine cluster,
  -- then add genuinely distinct machines for the same user/hour/model.
  SELECT mac.user_id, mac.source, mac.model, mac.hour_start,
    SUM(mac.total_tokens)::bigint                AS total_tokens,
    SUM(mac.input_tokens)::bigint                AS input_tokens,
    SUM(mac.output_tokens)::bigint               AS output_tokens,
    SUM(mac.cached_input_tokens)::bigint         AS cached_input_tokens,
    SUM(mac.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
    SUM(mac.reasoning_output_tokens)::bigint     AS reasoning_output_tokens
  FROM (
    SELECT DISTINCT ON (
      h.user_id,
      COALESCE(dm.machine_cluster_id, h.device_id::text),
      h.source,
      h.model,
      h.hour_start
    )
      h.user_id,
      COALESCE(dm.machine_cluster_id, h.device_id::text) AS machine_cluster_id,
      h.source, h.model, h.hour_start,
      h.total_tokens::bigint                AS total_tokens,
      h.input_tokens::bigint                AS input_tokens,
      h.output_tokens::bigint               AS output_tokens,
      h.cached_input_tokens::bigint         AS cached_input_tokens,
      h.cache_creation_input_tokens::bigint AS cache_creation_input_tokens,
      h.reasoning_output_tokens::bigint     AS reasoning_output_tokens
    FROM tokentracker_hourly h
    CROSS JOIN cfg
    JOIN tokentracker_devices d
      ON d.id = h.device_id AND d.revoked_at IS NULL
    LEFT JOIN tokentracker_device_machine dm
      ON dm.device_id = h.device_id
    WHERE h.hour_start >= p_from AND h.hour_start < p_to
      AND NOT (h.source = ANY(cfg.account_sources))
    ORDER BY
      h.user_id,
      COALESCE(dm.machine_cluster_id, h.device_id::text),
      h.source,
      h.model,
      h.hour_start,
      h.total_tokens DESC,
      h.updated_at DESC
  ) mac
  GROUP BY mac.user_id, mac.source, mac.model, mac.hour_start

  UNION ALL

  -- 'cursor' (account-level but with NO stable session identity): rows are
  -- identical across devices, so the legacy whole-row MAX pick per
  -- (user, hour, source, model) dedups them.
  SELECT acct.user_id, acct.source, acct.model, acct.hour_start,
    acct.total_tokens, acct.input_tokens, acct.output_tokens,
    acct.cached_input_tokens, acct.cache_creation_input_tokens,
    acct.reasoning_output_tokens
  FROM (
    SELECT DISTINCT ON (h.user_id, h.source, h.model, h.hour_start)
      h.user_id, h.source, h.model, h.hour_start,
      h.total_tokens::bigint                AS total_tokens,
      h.input_tokens::bigint                AS input_tokens,
      h.output_tokens::bigint               AS output_tokens,
      h.cached_input_tokens::bigint         AS cached_input_tokens,
      h.cache_creation_input_tokens::bigint AS cache_creation_input_tokens,
      h.reasoning_output_tokens::bigint     AS reasoning_output_tokens
    FROM tokentracker_hourly h
    WHERE h.hour_start >= p_from AND h.hour_start < p_to
      AND h.source = 'cursor'
    ORDER BY h.user_id, h.source, h.model, h.hour_start, h.total_tokens DESC, h.updated_at DESC
  ) acct

  UNION ALL

  -- trae-cn: canonical account truth aggregated from session states. Every
  -- device's observations of the same session collapsed to ONE row by the
  -- LWW upsert; corrections (downward / model / bucket) are already
  -- reflected because each session exists exactly once.
  SELECT s.user_id, s.source, s.model, s.bucket_start AS hour_start,
    SUM(s.total_tokens)::bigint                AS total_tokens,
    SUM(s.input_tokens)::bigint                AS input_tokens,
    SUM(s.output_tokens)::bigint               AS output_tokens,
    SUM(s.cached_input_tokens)::bigint         AS cached_input_tokens,
    SUM(s.cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
    SUM(s.reasoning_output_tokens)::bigint     AS reasoning_output_tokens
  FROM tokentracker_account_session_states s
  WHERE s.bucket_start >= p_from AND s.bucket_start < p_to
    AND s.source = 'trae-cn'
  GROUP BY s.user_id, s.source, s.model, s.bucket_start
$func$;

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: leaderboard_rollup_total_v2_after_insert
CREATE OR REPLACE FUNCTION public.leaderboard_rollup_total_v2_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $func$
BEGIN
  INSERT INTO public.tokentracker_leaderboard_rollup_total_v2 AS total (
    user_id, source, model, pricing_tier,
    total_tokens, input_tokens, output_tokens,
    cached_input_tokens, cache_creation_input_tokens, reasoning_output_tokens
  )
  SELECT
    user_id, source, model, pricing_tier,
    SUM(total_tokens)::bigint,
    SUM(input_tokens)::bigint,
    SUM(output_tokens)::bigint,
    SUM(cached_input_tokens)::bigint,
    SUM(cache_creation_input_tokens)::bigint,
    SUM(reasoning_output_tokens)::bigint
  FROM new_rows
  GROUP BY user_id, source, model, pricing_tier
  ON CONFLICT (user_id, source, model, pricing_tier) DO UPDATE SET
    total_tokens = total.total_tokens + EXCLUDED.total_tokens,
    input_tokens = total.input_tokens + EXCLUDED.input_tokens,
    output_tokens = total.output_tokens + EXCLUDED.output_tokens,
    cached_input_tokens = total.cached_input_tokens + EXCLUDED.cached_input_tokens,
    cache_creation_input_tokens = total.cache_creation_input_tokens
      + EXCLUDED.cache_creation_input_tokens,
    reasoning_output_tokens = total.reasoning_output_tokens
      + EXCLUDED.reasoning_output_tokens;
  RETURN NULL;
END
$func$;

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: leaderboard_rollup_total_v2_after_delete
CREATE OR REPLACE FUNCTION public.leaderboard_rollup_total_v2_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $func$
BEGIN
  UPDATE public.tokentracker_leaderboard_rollup_total_v2 AS total
  SET
    total_tokens = total.total_tokens - removed.total_tokens,
    input_tokens = total.input_tokens - removed.input_tokens,
    output_tokens = total.output_tokens - removed.output_tokens,
    cached_input_tokens = total.cached_input_tokens - removed.cached_input_tokens,
    cache_creation_input_tokens = total.cache_creation_input_tokens
      - removed.cache_creation_input_tokens,
    reasoning_output_tokens = total.reasoning_output_tokens
      - removed.reasoning_output_tokens
  FROM (
    SELECT
      user_id, source, model, pricing_tier,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(input_tokens)::bigint AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(cached_input_tokens)::bigint AS cached_input_tokens,
      SUM(cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
      SUM(reasoning_output_tokens)::bigint AS reasoning_output_tokens
    FROM old_rows
    GROUP BY user_id, source, model, pricing_tier
  ) AS removed
  WHERE total.user_id = removed.user_id
    AND total.source = removed.source
    AND total.model = removed.model
    AND total.pricing_tier = removed.pricing_tier;

  DELETE FROM public.tokentracker_leaderboard_rollup_total_v2
  WHERE total_tokens = 0
    AND input_tokens = 0
    AND output_tokens = 0
    AND cached_input_tokens = 0
    AND cache_creation_input_tokens = 0
    AND reasoning_output_tokens = 0;
  RETURN NULL;
END
$func$;

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: leaderboard_rollup_total_v2_after_update
CREATE OR REPLACE FUNCTION public.leaderboard_rollup_total_v2_after_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $func$
BEGIN
  UPDATE public.tokentracker_leaderboard_rollup_total_v2 AS total
  SET
    total_tokens = total.total_tokens - removed.total_tokens,
    input_tokens = total.input_tokens - removed.input_tokens,
    output_tokens = total.output_tokens - removed.output_tokens,
    cached_input_tokens = total.cached_input_tokens - removed.cached_input_tokens,
    cache_creation_input_tokens = total.cache_creation_input_tokens
      - removed.cache_creation_input_tokens,
    reasoning_output_tokens = total.reasoning_output_tokens
      - removed.reasoning_output_tokens
  FROM (
    SELECT
      user_id, source, model, pricing_tier,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(input_tokens)::bigint AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(cached_input_tokens)::bigint AS cached_input_tokens,
      SUM(cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
      SUM(reasoning_output_tokens)::bigint AS reasoning_output_tokens
    FROM old_rows
    GROUP BY user_id, source, model, pricing_tier
  ) AS removed
  WHERE total.user_id = removed.user_id
    AND total.source = removed.source
    AND total.model = removed.model
    AND total.pricing_tier = removed.pricing_tier;

  INSERT INTO public.tokentracker_leaderboard_rollup_total_v2 AS total (
    user_id, source, model, pricing_tier,
    total_tokens, input_tokens, output_tokens,
    cached_input_tokens, cache_creation_input_tokens, reasoning_output_tokens
  )
  SELECT
    user_id, source, model, pricing_tier,
    SUM(total_tokens)::bigint,
    SUM(input_tokens)::bigint,
    SUM(output_tokens)::bigint,
    SUM(cached_input_tokens)::bigint,
    SUM(cache_creation_input_tokens)::bigint,
    SUM(reasoning_output_tokens)::bigint
  FROM new_rows
  GROUP BY user_id, source, model, pricing_tier
  ON CONFLICT (user_id, source, model, pricing_tier) DO UPDATE SET
    total_tokens = total.total_tokens + EXCLUDED.total_tokens,
    input_tokens = total.input_tokens + EXCLUDED.input_tokens,
    output_tokens = total.output_tokens + EXCLUDED.output_tokens,
    cached_input_tokens = total.cached_input_tokens + EXCLUDED.cached_input_tokens,
    cache_creation_input_tokens = total.cache_creation_input_tokens
      + EXCLUDED.cache_creation_input_tokens,
    reasoning_output_tokens = total.reasoning_output_tokens
      + EXCLUDED.reasoning_output_tokens;

  DELETE FROM public.tokentracker_leaderboard_rollup_total_v2
  WHERE total_tokens = 0
    AND input_tokens = 0
    AND output_tokens = 0
    AND cached_input_tokens = 0
    AND cache_creation_input_tokens = 0
    AND reasoning_output_tokens = 0;
  RETURN NULL;
END
$func$;

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: tokentracker_leaderboard_rollup_daily_v2_total_insert
CREATE TRIGGER tokentracker_leaderboard_rollup_daily_v2_total_insert
AFTER INSERT ON public.tokentracker_leaderboard_rollup_daily_v2
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.leaderboard_rollup_total_v2_after_insert();

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: tokentracker_leaderboard_rollup_daily_v2_total_delete
CREATE TRIGGER tokentracker_leaderboard_rollup_daily_v2_total_delete
AFTER DELETE ON public.tokentracker_leaderboard_rollup_daily_v2
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.leaderboard_rollup_total_v2_after_delete();

-- UPSTREAM: migrations/20260904064000_cache-leaderboard-total-rollup.sql :: tokentracker_leaderboard_rollup_daily_v2_total_update
CREATE TRIGGER tokentracker_leaderboard_rollup_daily_v2_total_update
AFTER UPDATE ON public.tokentracker_leaderboard_rollup_daily_v2
REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
FOR EACH STATEMENT
EXECUTE FUNCTION public.leaderboard_rollup_total_v2_after_update();
