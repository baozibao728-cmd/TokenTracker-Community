-- Final upstream definitions only; provenance.json records exact extracted hashes.

-- UPSTREAM: migrations/20260718071507_add-shared-account-usage-cache.sql :: tokentracker_account_usage_cache
CREATE UNLOGGED TABLE public.tokentracker_account_usage_cache (
  cache_key text PRIMARY KEY,
  fetched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  result jsonb NOT NULL
);

-- UPSTREAM: migrations/20260718071507_add-shared-account-usage-cache.sql :: tokentracker_account_usage_cache_fetched_at_idx
CREATE INDEX tokentracker_account_usage_cache_fetched_at_idx
  ON public.tokentracker_account_usage_cache (fetched_at);

-- UPSTREAM: migrations/20260904083630_add-single-scan-account-usage-candidate.sql :: account_usage_grouped_single_scan_candidate (promoted as account_usage_grouped)
CREATE OR REPLACE FUNCTION public.account_usage_grouped(
  p_user_id uuid,
  p_device_ids uuid[],
  p_from timestamptz,
  p_to timestamptz,
  p_trunc text,
  p_tz text,
  p_offset_min integer
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO public, pg_temp
SET statement_timeout TO '8s'
AS $func$
  WITH tzr AS (
    SELECT CASE
      WHEN p_tz IS NOT NULL AND p_tz <> ''
       AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_tz)
      THEN p_tz ELSE NULL
    END AS tz
  ), base AS MATERIALIZED (
    SELECT
      h.device_id, h.hour_start, h.source, h.model,
      h.total_tokens::bigint AS total_tokens,
      h.input_tokens::bigint AS input_tokens,
      h.output_tokens::bigint AS output_tokens,
      h.cached_input_tokens::bigint AS cached_input_tokens,
      h.cache_creation_input_tokens::bigint AS cache_creation_input_tokens,
      h.reasoning_output_tokens::bigint AS reasoning_output_tokens,
      h.conversations::bigint AS conversations,
      h.updated_at
    FROM public.tokentracker_hourly h
    WHERE h.user_id = p_user_id
      AND h.hour_start >= p_from AND h.hour_start < p_to
      AND (
        h.source = 'cursor'
        OR (
          h.source NOT IN ('cursor', 'trae-cn')
          AND h.device_id = ANY(p_device_ids)
        )
      )
  ), hourly AS (
    SELECT mac.hour_start, mac.source, mac.model,
      mac.total_tokens, mac.input_tokens, mac.output_tokens,
      mac.cached_input_tokens, mac.cache_creation_input_tokens,
      mac.reasoning_output_tokens, mac.conversations
    FROM (
      SELECT DISTINCT ON (
        COALESCE(dm.machine_cluster_id, h.device_id::text),
        h.hour_start, h.source, h.model
      )
        h.hour_start, h.source, h.model,
        h.total_tokens, h.input_tokens, h.output_tokens,
        h.cached_input_tokens, h.cache_creation_input_tokens,
        h.reasoning_output_tokens, h.conversations
      FROM base h
      LEFT JOIN public.tokentracker_device_machine dm ON dm.device_id = h.device_id
      WHERE h.source NOT IN ('cursor', 'trae-cn')
        AND h.device_id = ANY(p_device_ids)
      ORDER BY COALESCE(dm.machine_cluster_id, h.device_id::text),
        h.hour_start, h.source, h.model, h.total_tokens DESC, h.updated_at DESC
    ) mac

    UNION ALL

    SELECT d.hour_start, d.source, d.model,
      d.total_tokens, d.input_tokens, d.output_tokens,
      d.cached_input_tokens, d.cache_creation_input_tokens,
      d.reasoning_output_tokens, d.conversations
    FROM (
      SELECT DISTINCT ON (h.hour_start, h.source, h.model)
        h.hour_start, h.source, h.model,
        h.total_tokens, h.input_tokens, h.output_tokens,
        h.cached_input_tokens, h.cache_creation_input_tokens,
        h.reasoning_output_tokens, h.conversations
      FROM base h
      WHERE h.source = 'cursor'
      ORDER BY h.hour_start, h.source, h.model, h.total_tokens DESC, h.updated_at DESC
    ) d

    UNION ALL

    SELECT s.bucket_start, s.source, s.model,
      SUM(s.total_tokens)::bigint, SUM(s.input_tokens)::bigint,
      SUM(s.output_tokens)::bigint, SUM(s.cached_input_tokens)::bigint,
      SUM(s.cache_creation_input_tokens)::bigint,
      SUM(s.reasoning_output_tokens)::bigint, COUNT(*)::bigint
    FROM public.tokentracker_account_session_states s
    WHERE s.user_id = p_user_id
      AND s.bucket_start >= p_from AND s.bucket_start < p_to
      AND s.source = 'trae-cn'
    GROUP BY s.bucket_start, s.source, s.model
  ), located AS (
    SELECT
      CASE p_trunc
        WHEN 'hour' THEN to_char(date_trunc('hour', local_ts), 'YYYY-MM-DD"T"HH24:00:00')
        WHEN 'day' THEN to_char(date_trunc('day', local_ts), 'YYYY-MM-DD')
        WHEN 'month' THEN to_char(date_trunc('month', local_ts), 'YYYY-MM')
        ELSE ''
      END AS bucket,
      source, model,
      CASE
        WHEN lower(model) LIKE '%deepseek-v4-flash%'
          OR lower(model) LIKE '%deepseek-v4-pro%'
        THEN CASE
          WHEN (
            extract(hour FROM hour_start AT TIME ZONE 'UTC') >= 1
            AND extract(hour FROM hour_start AT TIME ZONE 'UTC') < 4
          ) OR (
            extract(hour FROM hour_start AT TIME ZONE 'UTC') >= 6
            AND extract(hour FROM hour_start AT TIME ZONE 'UTC') < 10
          ) THEN 'peak' ELSE 'off_peak'
        END
        ELSE 'peak'
      END AS pricing_tier,
      total_tokens, input_tokens, output_tokens, cached_input_tokens,
      cache_creation_input_tokens, reasoning_output_tokens, conversations
    FROM hourly CROSS JOIN tzr
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN tzr.tz IS NOT NULL THEN hour_start AT TIME ZONE tzr.tz
        WHEN p_offset_min IS NOT NULL
          THEN (hour_start AT TIME ZONE 'UTC') + make_interval(mins => p_offset_min)
        ELSE hour_start AT TIME ZONE 'UTC'
      END AS local_ts
    ) local_time
  ), grouped AS (
    SELECT bucket, source, model, pricing_tier,
      SUM(total_tokens)::bigint AS total_tokens,
      SUM(input_tokens)::bigint AS input_tokens,
      SUM(output_tokens)::bigint AS output_tokens,
      SUM(cached_input_tokens)::bigint AS cached_input_tokens,
      SUM(cache_creation_input_tokens)::bigint AS cache_creation_input_tokens,
      SUM(reasoning_output_tokens)::bigint AS reasoning_output_tokens,
      SUM(conversations)::bigint AS conversations
    FROM located
    GROUP BY bucket, source, model, pricing_tier
  )
  SELECT COALESCE(
    jsonb_agg(to_jsonb(grouped.*) ORDER BY bucket, source, model, pricing_tier),
    '[]'::jsonb
  ) FROM grouped
$func$;

-- UPSTREAM: migrations/20260904090000_promote-single-scan-account-usage.sql :: account_usage_grouped_v2
CREATE OR REPLACE FUNCTION public.account_usage_grouped_v2(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_trunc text,
  p_tz text,
  p_offset_min integer
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO public, pg_temp
SET statement_timeout TO '8s'
AS $func$
  WITH active AS (
    SELECT COALESCE(array_agg(d.id ORDER BY d.id), ARRAY[]::uuid[]) AS ids
    FROM public.tokentracker_devices d
    WHERE d.user_id = p_user_id AND d.revoked_at IS NULL
  ), scoped AS (
    SELECT ids,
      CASE WHEN p_device_id IS NOT NULL AND p_device_id = ANY(ids)
        THEN ARRAY[p_device_id]::uuid[] ELSE ids END AS selected_ids
    FROM active
  )
  SELECT CASE WHEN cardinality(ids) = 0 THEN '[]'::jsonb
    ELSE public.account_usage_grouped(
      p_user_id, selected_ids, p_from, p_to, p_trunc, p_tz, p_offset_min
    ) END
  FROM scoped
$func$;

-- UPSTREAM: migrations/20260821173500_deepseek-v4-time-pricing.sql :: account_usage_grouped_cached
CREATE OR REPLACE FUNCTION public.account_usage_grouped_cached(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_trunc text,
  p_tz text,
  p_offset_min integer
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE
SET search_path TO public, pg_temp
SET statement_timeout TO '8s'
AS $func$
DECLARE
  v_cache_key text;
  v_result jsonb;
BEGIN
  v_cache_key := concat_ws(
    chr(31), 'v2-deepseek-time-pricing', p_user_id::text,
    COALESCE(p_device_id::text, ''),
    to_char(p_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    to_char(p_to AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
    p_trunc, COALESCE(p_tz, ''), COALESCE(p_offset_min::text, '')
  );

  SELECT c.result INTO v_result
  FROM public.tokentracker_account_usage_cache c
  WHERE c.cache_key = v_cache_key
    AND c.fetched_at >= clock_timestamp() - interval '30 seconds';
  IF FOUND THEN RETURN v_result; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_cache_key, 0));
  SELECT c.result INTO v_result
  FROM public.tokentracker_account_usage_cache c
  WHERE c.cache_key = v_cache_key
    AND c.fetched_at >= clock_timestamp() - interval '30 seconds';
  IF FOUND THEN RETURN v_result; END IF;

  v_result := public.account_usage_grouped_v2(
    p_user_id, p_device_id, p_from, p_to, p_trunc, p_tz, p_offset_min
  );

  INSERT INTO public.tokentracker_account_usage_cache AS c (cache_key, fetched_at, result)
  VALUES (v_cache_key, clock_timestamp(), v_result)
  ON CONFLICT (cache_key) DO UPDATE
  SET fetched_at = EXCLUDED.fetched_at, result = EXCLUDED.result;

  IF random() < 0.01 THEN
    WITH stale AS (
      SELECT s.cache_key
      FROM public.tokentracker_account_usage_cache s
      WHERE s.fetched_at < clock_timestamp() - interval '5 minutes'
      ORDER BY s.fetched_at, s.cache_key
      FOR UPDATE SKIP LOCKED
      LIMIT 256
    )
    DELETE FROM public.tokentracker_account_usage_cache c
    USING stale WHERE c.cache_key = stale.cache_key;
  END IF;
  RETURN v_result;
END
$func$;

-- UPSTREAM: migrations/20260918041500_fold-account-summary-and-heatmap-aggregation.sql :: account_summary_compact
CREATE OR REPLACE FUNCTION public.account_summary_compact(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text,
  p_offset_min integer,
  p_range_from text,
  p_range_to text
) RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '8s'
AS $fn$
  WITH raw AS (
    SELECT public.account_usage_grouped_cached(
      p_user_id, p_device_id, p_from, p_to, 'day', p_tz, p_offset_min
    ) AS j
  ), g AS (
    SELECT
      e->>'bucket' AS bucket,
      e->>'source' AS source,
      e->>'model' AS model,
      e->>'pricing_tier' AS pricing_tier,
      COALESCE((e->>'total_tokens')::bigint, 0) AS total_tokens,
      COALESCE((e->>'input_tokens')::bigint, 0) AS input_tokens,
      COALESCE((e->>'output_tokens')::bigint, 0) AS output_tokens,
      COALESCE((e->>'cached_input_tokens')::bigint, 0) AS cached_input_tokens,
      COALESCE((e->>'cache_creation_input_tokens')::bigint, 0) AS cache_creation_input_tokens,
      COALESCE((e->>'reasoning_output_tokens')::bigint, 0) AS reasoning_output_tokens,
      COALESCE((e->>'conversations')::bigint, 0) AS conversations
    FROM raw, jsonb_array_elements(raw.j) e
  ), in_range AS (
    SELECT * FROM g WHERE bucket >= p_range_from AND bucket <= p_range_to
  ), dims AS (
    SELECT source, model, pricing_tier,
      SUM(input_tokens) AS i,
      SUM(output_tokens) AS o,
      SUM(cached_input_tokens) AS cr,
      SUM(cache_creation_input_tokens) AS cw,
      SUM(reasoning_output_tokens) AS rs
    FROM in_range
    GROUP BY source, model, pricing_tier
  ), days AS (
    SELECT bucket, SUM(total_tokens) AS t, SUM(conversations) AS c
    FROM g GROUP BY bucket
  )
  SELECT jsonb_build_object(
    'cost_dims', COALESCE(
      (SELECT jsonb_agg(jsonb_build_array(source, model, pricing_tier, i, o, cr, cw, rs)
                        ORDER BY source, model, pricing_tier) FROM dims),
      '[]'::jsonb),
    'day_rollup', COALESCE(
      (SELECT jsonb_agg(jsonb_build_array(bucket, t, c) ORDER BY bucket) FROM days),
      '[]'::jsonb),
    'range_totals', (SELECT jsonb_build_object(
        'total_tokens', COALESCE(SUM(total_tokens), 0),
        'input_tokens', COALESCE(SUM(input_tokens), 0),
        'output_tokens', COALESCE(SUM(output_tokens), 0),
        'cached_input_tokens', COALESCE(SUM(cached_input_tokens), 0),
        'cache_creation_input_tokens', COALESCE(SUM(cache_creation_input_tokens), 0),
        'reasoning_output_tokens', COALESCE(SUM(reasoning_output_tokens), 0),
        'conversation_count', COALESCE(SUM(conversations), 0),
        'active_days', COUNT(DISTINCT bucket)
      ) FROM in_range)
  )
$fn$;

-- UPSTREAM: migrations/20260918041500_fold-account-summary-and-heatmap-aggregation.sql :: account_heatmap_compact
CREATE OR REPLACE FUNCTION public.account_heatmap_compact(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text,
  p_offset_min integer,
  p_range_from text,
  p_range_to text
) RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '8s'
AS $fn$
  WITH raw AS (
    SELECT public.account_usage_grouped_cached(
      p_user_id, p_device_id, p_from, p_to, 'day', p_tz, p_offset_min
    ) AS j
  ), g AS (
    SELECT
      e->>'bucket' AS bucket,
      COALESCE(NULLIF(e->>'model', ''), 'unknown') AS model,
      COALESCE((e->>'total_tokens')::bigint, 0) AS tt
    FROM raw, jsonb_array_elements(raw.j) e
    WHERE e->>'bucket' >= p_range_from AND e->>'bucket' <= p_range_to
  ), per_model AS (
    SELECT bucket, model, SUM(tt) AS mt
    FROM g GROUP BY bucket, model
  ), per_day AS (
    SELECT bucket, SUM(mt) AS t, jsonb_object_agg(model, mt) AS models
    FROM per_model GROUP BY bucket
  )
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_array(bucket, t, models) ORDER BY bucket) FROM per_day),
    '[]'::jsonb)
$fn$;

-- UPSTREAM: migrations/20260918043000_fold-account-model-breakdown-aggregation.sql :: account_model_breakdown_compact
CREATE OR REPLACE FUNCTION public.account_model_breakdown_compact(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text,
  p_offset_min integer,
  p_range_from text,
  p_range_to text
) RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '8s'
AS $fn$
  WITH raw AS (
    SELECT public.account_usage_grouped_cached(
      p_user_id, p_device_id, p_from, p_to, 'day', p_tz, p_offset_min
    ) AS j
  ), g AS (
    SELECT
      e->>'bucket' AS bucket,
      e->>'source' AS source,
      e->>'model' AS model,
      e->>'pricing_tier' AS pricing_tier,
      COALESCE((e->>'total_tokens')::bigint, 0) AS total_tokens,
      COALESCE((e->>'input_tokens')::bigint, 0) AS input_tokens,
      COALESCE((e->>'output_tokens')::bigint, 0) AS output_tokens,
      COALESCE((e->>'cached_input_tokens')::bigint, 0) AS cached_input_tokens,
      COALESCE((e->>'cache_creation_input_tokens')::bigint, 0) AS cache_creation_input_tokens,
      COALESCE((e->>'reasoning_output_tokens')::bigint, 0) AS reasoning_output_tokens
    FROM raw, jsonb_array_elements(raw.j) e
  ), dims AS (
    SELECT source, model, pricing_tier,
      SUM(total_tokens) AS tt,
      SUM(input_tokens) AS i,
      SUM(output_tokens) AS o,
      SUM(cached_input_tokens) AS cr,
      SUM(cache_creation_input_tokens) AS cw,
      SUM(reasoning_output_tokens) AS rs
    FROM g
    WHERE bucket >= p_range_from AND bucket <= p_range_to
    GROUP BY source, model, pricing_tier
  )
  SELECT COALESCE(
    (SELECT jsonb_agg(jsonb_build_array(source, model, pricing_tier, tt, i, o, cr, cw, rs)
                      ORDER BY source, model, pricing_tier) FROM dims),
    '[]'::jsonb)
$fn$;

-- UPSTREAM: migrations/20260918050000_fold-account-daily-aggregation.sql :: account_daily_compact
CREATE OR REPLACE FUNCTION public.account_daily_compact(
  p_user_id uuid,
  p_device_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text,
  p_offset_min integer,
  p_range_from text,
  p_range_to text
) RETURNS jsonb
LANGUAGE sql
VOLATILE
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '8s'
AS $fn$
  WITH raw AS (
    SELECT public.account_usage_grouped_cached(
      p_user_id, p_device_id, p_from, p_to, 'day', p_tz, p_offset_min
    ) AS j
  ), g AS (
    SELECT
      e->>'bucket' AS bucket,
      e->>'source' AS source,
      e->>'model' AS model,
      e->>'pricing_tier' AS pricing_tier,
      COALESCE(NULLIF(e->>'model', ''), 'unknown') AS model_key,
      COALESCE((e->>'total_tokens')::bigint, 0) AS total_tokens,
      COALESCE((e->>'input_tokens')::bigint, 0) AS input_tokens,
      COALESCE((e->>'output_tokens')::bigint, 0) AS output_tokens,
      COALESCE((e->>'cached_input_tokens')::bigint, 0) AS cached_input_tokens,
      COALESCE((e->>'cache_creation_input_tokens')::bigint, 0) AS cache_creation_input_tokens,
      COALESCE((e->>'reasoning_output_tokens')::bigint, 0) AS reasoning_output_tokens,
      COALESCE((e->>'conversations')::bigint, 0) AS conversations
    FROM raw, jsonb_array_elements(raw.j) e
    WHERE e->>'bucket' >= p_range_from AND e->>'bucket' <= p_range_to
  ), per_day_model AS (
    SELECT bucket, model_key, SUM(total_tokens) AS mt
    FROM g GROUP BY bucket, model_key
  ), models AS (
    SELECT bucket, jsonb_object_agg(model_key, mt) AS mm
    FROM per_day_model GROUP BY bucket
  ), days AS (
    SELECT bucket,
      SUM(total_tokens) AS tt, SUM(input_tokens) AS i, SUM(output_tokens) AS o,
      SUM(cached_input_tokens) AS cr, SUM(cache_creation_input_tokens) AS cw,
      SUM(reasoning_output_tokens) AS rs, SUM(conversations) AS cv
    FROM g GROUP BY bucket
  ), cost AS (
    SELECT bucket, source, model, pricing_tier,
      SUM(input_tokens) AS i, SUM(output_tokens) AS o,
      SUM(cached_input_tokens) AS cr, SUM(cache_creation_input_tokens) AS cw,
      SUM(reasoning_output_tokens) AS rs
    FROM g GROUP BY bucket, source, model, pricing_tier
  )
  SELECT jsonb_build_object(
    'days', COALESCE(
      (SELECT jsonb_agg(jsonb_build_array(d.bucket, d.tt, d.i, d.o, d.cr, d.cw, d.rs, d.cv, m.mm)
                        ORDER BY d.bucket)
       FROM days d JOIN models m ON m.bucket = d.bucket),
      '[]'::jsonb),
    'cost_dims', COALESCE(
      (SELECT jsonb_agg(jsonb_build_array(bucket, source, model, pricing_tier, i, o, cr, cw, rs)
                        ORDER BY bucket, source, model, pricing_tier) FROM cost),
      '[]'::jsonb)
  )
$fn$;
