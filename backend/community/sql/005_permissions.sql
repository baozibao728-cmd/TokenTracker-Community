-- COMMUNITY_V1: project_admin BYPASSRLS was verified by own-project preflight.
-- No browser table access, no client RPC execution, no SECURITY DEFINER bypass.
DO $permissions$
DECLARE obj record; name text;
BEGIN
  FOREACH name IN ARRAY ARRAY['communities','community_members','community_transfer_requests'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated',name);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO project_admin',name);
  END LOOP;
  FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace AND p.proname IN (
      'community_assert_actor','community_validate_limits','community_lock_users','community_error',
      'community_create','community_join','community_leave','community_create_transfer',
      'community_accept_transfer','community_reject_transfer','community_delete','community_read','community_leaderboard')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',obj.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO project_admin',obj.signature);
  END LOOP;
END $permissions$;
