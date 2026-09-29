-- INFERRED_COMPATIBILITY_IMPLEMENTATION
-- Base shape: migrations/20260804043427_align-leaderboard-machine-clusters.sql.
-- The final reads/triggers in 20260904064000 require pricing_tier, but upstream
-- contains no matching final daily-table DDL. Tier MUST be in the primary key.
CREATE TABLE public.tokentracker_leaderboard_rollup_daily_v2 (
  user_id uuid NOT NULL,
  source text NOT NULL,
  model text NOT NULL,
  day date NOT NULL,
  pricing_tier text NOT NULL CHECK (pricing_tier IN ('peak', 'off_peak')),
  total_tokens bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cached_input_tokens bigint NOT NULL DEFAULT 0,
  cache_creation_input_tokens bigint NOT NULL DEFAULT 0,
  reasoning_output_tokens bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, source, model, day, pricing_tier)
);
CREATE INDEX tokentracker_leaderboard_rollup_daily_v2_day_idx
  ON public.tokentracker_leaderboard_rollup_daily_v2(day);

-- Exact CASE semantics from the promoted account_usage_grouped, factored into
-- the missing leaderboard helper. No price calculations or provider changes.
CREATE FUNCTION public.leaderboard_pricing_tier(model text, hour_start timestamptz)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $fn$
  SELECT CASE
    WHEN lower(model) LIKE '%deepseek-v4-flash%'
      OR lower(model) LIKE '%deepseek-v4-pro%'
    THEN CASE WHEN (
      extract(hour FROM hour_start AT TIME ZONE 'UTC') >= 1
      AND extract(hour FROM hour_start AT TIME ZONE 'UTC') < 4
    ) OR (
      extract(hour FROM hour_start AT TIME ZONE 'UTC') >= 6
      AND extract(hour FROM hour_start AT TIME ZONE 'UTC') < 10
    ) THEN 'peak' ELSE 'off_peak' END
    ELSE 'peak'
  END
$fn$;
