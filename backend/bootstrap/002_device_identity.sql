-- Final upstream definitions only; provenance.json records exact extracted hashes.

-- UPSTREAM: migrations/20260719152022_harden-backend-concurrency.sql :: refresh_tokentracker_device_identity
CREATE OR REPLACE FUNCTION public.refresh_tokentracker_device_identity(
  p_user_id uuid,
  p_device_id uuid,
  p_device_name text,
  p_platform text
) RETURNS boolean
LANGUAGE plpgsql VOLATILE
SET search_path TO public, pg_temp
SET statement_timeout TO '15s'
AS $func$
DECLARE
  v_current_name text;
  v_name_customized boolean;
  v_current_default_name text;
  v_legacy_id uuid;
  v_legacy_name text;
  v_legacy_name_customized boolean;
  v_legacy_default_name text;
  v_target_name text;
  v_target_name_customized boolean;
  v_target_default_name text;
BEGIN
  SELECT d.device_name, d.name_customized, d.default_device_name
    INTO v_current_name, v_name_customized, v_current_default_name
  FROM public.tokentracker_devices AS d
  WHERE d.id = p_device_id
    AND d.user_id = p_user_id
    AND d.revoked_at IS NULL
    AND d.machine_id IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT
    legacy.id,
    legacy.device_name,
    legacy.name_customized,
    legacy.default_device_name
  INTO
    v_legacy_id,
    v_legacy_name,
    v_legacy_name_customized,
    v_legacy_default_name
  FROM public.tokentracker_devices AS legacy
  WHERE legacy.user_id = p_user_id
    AND legacy.id <> p_device_id
    AND legacy.revoked_at IS NULL
    AND legacy.machine_id IS NULL
    AND legacy.platform IS NOT DISTINCT FROM p_platform
    AND (
      legacy.device_name = p_device_name
      OR legacy.default_device_name = p_device_name
    )
  ORDER BY
    CASE WHEN legacy.device_name = p_device_name THEN 0 ELSE 1 END,
    legacy.created_at,
    legacy.id
  LIMIT 1
  FOR UPDATE;

  IF v_legacy_id IS NOT NULL THEN
    INSERT INTO public.tokentracker_hourly AS canonical (
      user_id,
      device_id,
      source,
      model,
      hour_start,
      input_tokens,
      cached_input_tokens,
      cache_creation_input_tokens,
      output_tokens,
      reasoning_output_tokens,
      total_tokens,
      billable_total_tokens,
      conversations,
      created_at,
      updated_at,
      total_cost_usd
    )
    SELECT
      ranked.user_id,
      p_device_id,
      ranked.source,
      ranked.model,
      ranked.hour_start,
      ranked.input_tokens,
      ranked.cached_input_tokens,
      ranked.cache_creation_input_tokens,
      ranked.output_tokens,
      ranked.reasoning_output_tokens,
      ranked.total_tokens,
      ranked.billable_total_tokens,
      ranked.conversations,
      ranked.created_at,
      ranked.updated_at,
      ranked.total_cost_usd
    FROM (
      SELECT
        h.*,
        ROW_NUMBER() OVER (
          PARTITION BY h.user_id, h.source, h.model, h.hour_start
          ORDER BY h.total_tokens DESC, h.updated_at DESC, h.device_id = p_device_id DESC
        ) AS canonical_rank
      FROM public.tokentracker_hourly AS h
      WHERE h.user_id = p_user_id
        AND h.device_id IN (p_device_id, v_legacy_id)
    ) AS ranked
    WHERE ranked.canonical_rank = 1
    ON CONFLICT (user_id, device_id, source, model, hour_start) DO UPDATE SET
      input_tokens = EXCLUDED.input_tokens,
      cached_input_tokens = EXCLUDED.cached_input_tokens,
      cache_creation_input_tokens = EXCLUDED.cache_creation_input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      reasoning_output_tokens = EXCLUDED.reasoning_output_tokens,
      total_tokens = EXCLUDED.total_tokens,
      billable_total_tokens = EXCLUDED.billable_total_tokens,
      conversations = EXCLUDED.conversations,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      total_cost_usd = EXCLUDED.total_cost_usd;

    DELETE FROM public.tokentracker_hourly
    WHERE user_id = p_user_id
      AND device_id = v_legacy_id;

    UPDATE public.tokentracker_device_tokens
    SET device_id = p_device_id
    WHERE user_id = p_user_id
      AND device_id = v_legacy_id;

    IF to_regclass('public.tokentracker_device_machine') IS NOT NULL THEN
      EXECUTE
        'DELETE FROM public.tokentracker_device_machine WHERE device_id = $1'
      USING v_legacy_id;
    END IF;

    UPDATE public.tokentracker_devices
    SET revoked_at = clock_timestamp()
    WHERE id = v_legacy_id
      AND user_id = p_user_id
      AND revoked_at IS NULL
      AND machine_id IS NULL;
  END IF;

  v_target_name := CASE
    WHEN v_name_customized THEN v_current_name
    WHEN COALESCE(v_legacy_name_customized, false) THEN v_legacy_name
    ELSE p_device_name
  END;
  v_target_name_customized :=
    v_name_customized OR COALESCE(v_legacy_name_customized, false);
  v_target_default_name := CASE
    WHEN v_name_customized THEN v_current_default_name
    WHEN COALESCE(v_legacy_name_customized, false)
      THEN COALESCE(v_legacy_default_name, p_device_name)
    ELSE v_current_default_name
  END;

  BEGIN
    UPDATE public.tokentracker_devices
    SET
      device_name = v_target_name,
      platform = p_platform,
      name_customized = v_target_name_customized,
      default_device_name = v_target_default_name
    WHERE id = p_device_id
      AND user_id = p_user_id
      AND revoked_at IS NULL;
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  RETURN true;
END;
$func$;
