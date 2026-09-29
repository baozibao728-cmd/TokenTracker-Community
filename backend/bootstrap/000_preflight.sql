-- Empty-project baseline only. Execute 000..008 together in ONE transaction.
-- InsForge owns auth.users and the three roles: never create them here.
DO $bootstrap$
BEGIN
  IF current_user <> 'project_admin' THEN
    RAISE EXCEPTION 'Run bootstrap as the InsForge project_admin role';
  END IF;
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'InsForge prerequisite auth.users is missing';
  END IF;
  IF NOT has_column_privilege(current_user, 'auth.users', 'id', 'SELECT')
     OR NOT has_column_privilege(current_user, 'auth.users', 'email', 'SELECT')
     OR NOT has_column_privilege(current_user, 'auth.users', 'profile', 'SELECT') THEN
    RAISE EXCEPTION 'InsForge auth.users projection privileges are missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'InsForge runtime roles are missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname LIKE 'tokentracker\_%' ESCAPE '\')
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND (p.proname LIKE 'account\_%' ESCAPE '\'
      OR p.proname LIKE 'leaderboard\_%' ESCAPE '\'
      OR p.proname LIKE 'tokentracker\_%' ESCAPE '\'
      OR p.proname = 'refresh_tokentracker_device_identity')) THEN
    RAISE EXCEPTION 'Existing TokenTracker objects found; baseline must not overwrite an existing backend';
  END IF;
END
$bootstrap$;
