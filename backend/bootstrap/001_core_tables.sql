-- INFERRED_COMPATIBILITY_IMPLEMENTATION
-- Complete upstream DDL is absent. Contracts: device-token-issue.ts, ingest.ts,
-- account-devices.ts, and refresh_tokentracker_device_identity (20260719152022).
-- Defaults, ownership FKs and nonnegative checks are explicit baseline choices.
CREATE TABLE public.tokentracker_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  platform text NOT NULL,
  machine_id text,
  name_customized boolean NOT NULL DEFAULT false,
  default_device_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (user_id, id)
);
CREATE UNIQUE INDEX tokentracker_devices_active_unique
  ON public.tokentracker_devices (user_id, platform, device_name) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX tokentracker_devices_active_machine_unique
  ON public.tokentracker_devices (user_id, machine_id)
  WHERE revoked_at IS NULL AND machine_id IS NOT NULL;

CREATE TABLE public.tokentracker_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  FOREIGN KEY (user_id, device_id) REFERENCES public.tokentracker_devices(user_id, id) ON DELETE CASCADE
);
CREATE INDEX tokentracker_device_tokens_device_idx ON public.tokentracker_device_tokens(user_id, device_id);

CREATE TABLE public.tokentracker_hourly (
  user_id uuid NOT NULL,
  device_id uuid NOT NULL,
  hour_start timestamptz NOT NULL,
  source text NOT NULL,
  model text NOT NULL,
  input_tokens bigint NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens bigint NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  cache_creation_input_tokens bigint NOT NULL DEFAULT 0 CHECK (cache_creation_input_tokens >= 0),
  reasoning_output_tokens bigint NOT NULL DEFAULT 0 CHECK (reasoning_output_tokens >= 0),
  total_tokens bigint NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
  billable_total_tokens bigint NOT NULL DEFAULT 0 CHECK (billable_total_tokens >= 0),
  conversations bigint NOT NULL DEFAULT 0 CHECK (conversations >= 0),
  total_cost_usd numeric NOT NULL DEFAULT 0 CHECK (total_cost_usd >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id, hour_start, source, model),
  FOREIGN KEY (user_id, device_id) REFERENCES public.tokentracker_devices(user_id, id) ON DELETE CASCADE
);
-- No total=sum check: reasoning is an informational subset for some providers.
CREATE INDEX tokentracker_hourly_user_time_idx ON public.tokentracker_hourly(user_id, hour_start);
CREATE INDEX tokentracker_hourly_time_idx ON public.tokentracker_hourly(hour_start);

-- A real sparse alias map, NOT a dummy view. Existing RPCs use device_id when
-- no alias exists. New machine_id issuance already converges on one device.
-- Upstream's historical/offline value-based clustering is unavailable and is
-- deliberately not invented. Mapping rows can be maintained by a later audited
-- repair; identity convergence deletes absorbed legacy mappings upstream.
CREATE TABLE public.tokentracker_device_machine (
  device_id uuid PRIMARY KEY REFERENCES public.tokentracker_devices(id) ON DELETE CASCADE,
  machine_cluster_id text NOT NULL
);

-- Ingest omits updated_at; dedup reads it as a tie-breaker. Preserve an explicit
-- timestamp from the upstream identity merge; stamp ordinary upserts.
CREATE FUNCTION public.tokentracker_hourly_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $fn$
BEGIN
  IF NEW.updated_at IS NOT DISTINCT FROM OLD.updated_at THEN
    NEW.updated_at := clock_timestamp();
  END IF;
  RETURN NEW;
END
$fn$;
CREATE TRIGGER tokentracker_hourly_stamp BEFORE UPDATE ON public.tokentracker_hourly
FOR EACH ROW EXECUTE FUNCTION public.tokentracker_hourly_stamp();
