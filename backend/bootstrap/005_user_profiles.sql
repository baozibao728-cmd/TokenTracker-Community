-- INFERRED_COMPATIBILITY_IMPLEMENTATION
-- Writable settings and read-only view are documented in public-visibility.ts.
-- Settings default false; only trusted Edge functions may access these objects.
-- IMPORTANT: upstream public leaderboard reads do not filter is_public. A false
-- setting alone does not guarantee exclusion from the upstream public HTTP API.
CREATE TABLE public.tokentracker_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  leaderboard_public boolean NOT NULL DEFAULT false,
  leaderboard_anonymous boolean NOT NULL DEFAULT false,
  github_url text,
  show_github_url boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE VIEW public.tokentracker_user_profiles AS
SELECT u.id AS user_id,
  COALESCE(s.display_name, u.profile->>'name', split_part(u.email, '@', 1)) AS display_name,
  u.profile->>'avatar_url' AS avatar_url
FROM auth.users u LEFT JOIN public.tokentracker_user_settings s ON s.user_id = u.id;
-- avatar_url JSON key is inferred, pending own-project OAuth metadata validation.

-- Snapshot writer contract: leaderboard-refresh.ts .upsert rows, conflict key.
CREATE TABLE public.tokentracker_leaderboard_snapshots (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period text NOT NULL CHECK (period IN ('week', 'month', 'total')),
  from_day date NOT NULL,
  to_day date NOT NULL CHECK (to_day >= from_day),
  rank bigint NOT NULL CHECK (rank > 0),
  total_tokens bigint NOT NULL DEFAULT 0,
  gpt_tokens bigint NOT NULL DEFAULT 0,
  claude_tokens bigint NOT NULL DEFAULT 0,
  gemini_tokens bigint NOT NULL DEFAULT 0,
  cursor_tokens bigint NOT NULL DEFAULT 0,
  opencode_tokens bigint NOT NULL DEFAULT 0,
  openclaw_tokens bigint NOT NULL DEFAULT 0,
  hermes_tokens bigint NOT NULL DEFAULT 0,
  kiro_tokens bigint NOT NULL DEFAULT 0,
  copilot_tokens bigint NOT NULL DEFAULT 0,
  kimi_tokens bigint NOT NULL DEFAULT 0,
  other_tokens bigint NOT NULL DEFAULT 0,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  display_name text,
  avatar_url text,
  github_url text,
  is_public boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, period, from_day, to_day)
);
CREATE INDEX tokentracker_leaderboard_snapshots_period_rank_idx
  ON public.tokentracker_leaderboard_snapshots(period, from_day DESC, to_day DESC, rank);

-- Minimal persistent rate-limit state for refresh_try_claim; not an anti-cheat queue.
CREATE TABLE public.tokentracker_leaderboard_refresh_state (
  period text PRIMARY KEY,
  last_attempt_at timestamptz NOT NULL
);
