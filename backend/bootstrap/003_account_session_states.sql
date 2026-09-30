-- Final upstream definitions only; provenance.json records exact extracted hashes.

-- UPSTREAM: migrations/20260817120000_account-session-states.sql :: tokentracker_account_session_states
CREATE TABLE IF NOT EXISTS public.tokentracker_account_session_states (
  user_id uuid NOT NULL,
  source text NOT NULL,
  -- Provider-side session identity (TRAE session_id): stable across
  -- repeated fetches and window changes (VERIFIED), account-scoped rather
  -- than device-scoped in the request (cross-device id stability itself is
  -- NOT DIRECTLY VERIFIED - see the header's evidence split).
  session_id text NOT NULL,
  model text NOT NULL,
  -- Canonical UTC half-hour bucket of this session's CURRENT placement.
  bucket_start timestamptz NOT NULL,
  input_tokens bigint NOT NULL,
  output_tokens bigint NOT NULL,
  cached_input_tokens bigint NOT NULL,
  cache_creation_input_tokens bigint NOT NULL,
  reasoning_output_tokens bigint NOT NULL,
  total_tokens bigint NOT NULL,
  -- Client logical fetch stamp (see the freshness note above). Ops metadata
  -- only - updated_at (first server write time) never participates in
  -- correctness.
  snapshot_verified_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source, session_id),
  CHECK (
    total_tokens =
      input_tokens + cached_input_tokens + cache_creation_input_tokens + output_tokens
  ),
  CHECK (
    input_tokens >= 0 AND output_tokens >= 0 AND cached_input_tokens >= 0
    AND cache_creation_input_tokens >= 0 AND reasoning_output_tokens >= 0
    AND total_tokens >= 0
  )
);

-- UPSTREAM: migrations/20260817120000_account-session-states.sql :: tokentracker_account_session_states_bucket_idx
CREATE INDEX IF NOT EXISTS tokentracker_account_session_states_bucket_idx
  ON public.tokentracker_account_session_states (user_id, source, bucket_start);

-- UPSTREAM: migrations/20260817120000_account-session-states.sql :: tokentracker_upsert_account_session_states
CREATE OR REPLACE FUNCTION public.tokentracker_upsert_account_session_states(
  p_user_id uuid,
  p_states jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_applied integer;
BEGIN
  INSERT INTO tokentracker_account_session_states AS t
    (user_id, source, session_id, model, bucket_start,
     input_tokens, output_tokens, cached_input_tokens,
     cache_creation_input_tokens, reasoning_output_tokens, total_tokens,
     snapshot_verified_at)
  SELECT
    p_user_id, x.source, x.session_id, x.model, x.bucket_start,
    x.input_tokens, x.output_tokens, x.cached_input_tokens,
    x.cache_creation_input_tokens, x.reasoning_output_tokens, x.total_tokens,
    x.snapshot_verified_at
  FROM jsonb_to_recordset(p_states) AS x(
    source text, session_id text, model text, bucket_start timestamptz,
    input_tokens bigint, output_tokens bigint, cached_input_tokens bigint,
    cache_creation_input_tokens bigint, reasoning_output_tokens bigint,
    total_tokens bigint, snapshot_verified_at timestamptz)
  ON CONFLICT (user_id, source, session_id) DO UPDATE SET
    model = EXCLUDED.model,
    bucket_start = EXCLUDED.bucket_start,
    input_tokens = EXCLUDED.input_tokens,
    output_tokens = EXCLUDED.output_tokens,
    cached_input_tokens = EXCLUDED.cached_input_tokens,
    cache_creation_input_tokens = EXCLUDED.cache_creation_input_tokens,
    reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
    total_tokens = EXCLUDED.total_tokens,
    snapshot_verified_at = EXCLUDED.snapshot_verified_at,
    updated_at = now()
  WHERE EXCLUDED.snapshot_verified_at > t.snapshot_verified_at;

  GET DIAGNOSTICS v_applied = ROW_COUNT;
  RETURN v_applied;
END
$fn$;
