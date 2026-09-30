-- COMMUNITY_V1: new fork-owned objects; no changes to TokenTracker foundation.
-- Private invite-only communities. Quotas are trusted RPC parameters, not DDL.
DO $preflight$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('public.tokentracker_user_profiles') IS NULL
    OR to_regprocedure('public.leaderboard_usage_grouped(timestamp with time zone,timestamp with time zone)') IS NULL THEN
    RAISE EXCEPTION 'Community requires the verified MVP foundation';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='project_admin' AND rolbypassrls)
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
    OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    RAISE EXCEPTION 'Community requires the verified platform roles';
  END IF;
END $preflight$;
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 100),
  description text CHECK (char_length(description) <= 2000),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  invite_code text NOT NULL UNIQUE CHECK (invite_code ~ '^[A-F0-9]{32}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX communities_owner_idx ON public.communities(owner_id);
CREATE TABLE public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
CREATE INDEX community_members_user_idx ON public.community_members(user_id, community_id);
-- Deferred to permit atomic creation of the community followed by its owner
-- membership. Also prevents owner removal by accidental server-side direct DML.
ALTER TABLE public.communities ADD CONSTRAINT communities_owner_member_fk
  FOREIGN KEY (id, owner_id) REFERENCES public.community_members(community_id, user_id)
  DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.community_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id),
  CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX community_transfer_one_pending_idx
  ON public.community_transfer_requests(community_id) WHERE status = 'pending';
CREATE INDEX community_transfer_recipient_idx ON public.community_transfer_requests(to_user_id, status, expires_at);
CREATE INDEX community_transfer_history_idx ON public.community_transfer_requests(community_id, created_at DESC, id);
