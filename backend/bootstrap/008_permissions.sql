-- INFERRED_COMPATIBILITY_IMPLEMENTATION: baseline security envelope.
-- All listed Edges authenticate their caller and query with service credentials.
-- No direct browser/client access, including public leaderboard tables/views.
-- Preflight proves these namespaces contain no preexisting TokenTracker objects.
DO $permissions$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT c.relname, c.relkind FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname LIKE 'tokentracker\_%' ESCAPE '\'
      AND c.relkind IN ('r', 'v')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', obj.relname);
    IF obj.relkind = 'r' THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', obj.relname);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO project_admin', obj.relname);
    ELSE
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO project_admin', obj.relname);
    END IF;
  END LOOP;
  FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'account\_%' ESCAPE '\'
      OR p.proname LIKE 'leaderboard\_%' ESCAPE '\'
      OR p.proname LIKE 'tokentracker\_%' ESCAPE '\'
      OR p.proname = 'refresh_tokentracker_device_identity')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', obj.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO project_admin', obj.signature);
    -- Upstream hourly_dedup_v2 has unqualified relations and no SET clause.
    -- Pin every function, including invoker functions, to trusted schemas.
    EXECUTE format('ALTER FUNCTION %s SET search_path TO pg_catalog, public, pg_temp', obj.signature);
  END LOOP;
END
$permissions$;

-- INFERRED_COMPATIBILITY_IMPLEMENTATION: daily interval arithmetic must use
-- UTC even if the database/session default observes DST. Otherwise a "day"
-- may be 23/25 hours and the replacement loop can delete an already-built day.
ALTER FUNCTION public.leaderboard_rollup_daily_replace_v2(timestamptz, timestamptz) SET timezone TO 'UTC';
ALTER FUNCTION public.leaderboard_rollup_daily_advance_v2() SET timezone TO 'UTC';
