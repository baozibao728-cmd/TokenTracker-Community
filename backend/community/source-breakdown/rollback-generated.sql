-- GENERATED rollback companion. Never place this file in backend/deploy/migrations.
-- Restores the historical Community v1 RPC from backend/community/sql/004_read_rpc.sql SHA256=46746fbf4002b030a1bc07c6221200692ae31fc71e723eb0acc4a45a06ebfa7b.
-- Apply only after the source-breakdown migration has been applied. This is one atomic CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.community_leaderboard(p_actor uuid, p_community_id uuid, p_period text,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0,
  p_excluded_user_ids uuid[] DEFAULT ARRAY[]::uuid[], p_as_of timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp SET timezone = 'UTC' AS $fn$
DECLARE start_at timestamptz; end_at timestamptz; result jsonb;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  IF NOT EXISTS(SELECT 1 FROM public.community_members WHERE community_id=p_community_id AND user_id=p_actor)
    THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0
    THEN RETURN public.community_error('INVALID_PAGINATION'); END IF;
  IF p_period IS NULL OR p_period NOT IN ('week','month','total') OR p_as_of IS NULL OR NOT isfinite(p_as_of)
    OR p_as_of < timestamptz '1970-01-01 00:00:00+00' THEN RETURN public.community_error('INVALID_PERIOD'); END IF;
  -- Same Monday-start UTC calendar ranges as the MVP global refresh. Exclusive
  -- upper boundary includes the final calendar day. total starts at epoch.
  IF p_period='week' THEN start_at:=date_trunc('week',p_as_of); end_at:=start_at+interval '7 days';
  ELSIF p_period='month' THEN start_at:=date_trunc('month',p_as_of); end_at:=start_at+interval '1 month';
  ELSE start_at:=timestamptz '1970-01-01 00:00:00+00'; end_at:=date_trunc('day',p_as_of)+interval '1 day'; END IF;
  -- Existing aggregation is not member-parameterized. It may aggregate the
  -- whole site before this filter; no copied token table or ranking snapshots.
  WITH members AS MATERIALIZED (
    SELECT user_id FROM public.community_members WHERE community_id=p_community_id
  ), eligible AS MATERIALIZED (
    SELECT user_id FROM members m WHERE NOT EXISTS (
      SELECT 1 FROM unnest(p_excluded_user_ids) blocked(user_id) WHERE blocked.user_id=m.user_id)
  ), usage AS MATERIALIZED (
    SELECT a.user_id,sum(a.total_tokens)::numeric AS tokens
    FROM jsonb_to_recordset(public.leaderboard_usage_grouped(start_at,end_at)) AS a(user_id uuid,total_tokens bigint)
    JOIN eligible e ON e.user_id=a.user_id GROUP BY a.user_id
  ), ranked AS MATERIALIZED (
    SELECT e.user_id,coalesce(u.tokens,0) AS tokens,
      dense_rank() OVER(ORDER BY coalesce(u.tokens,0) DESC) AS rank
    FROM eligible e LEFT JOIN usage u ON u.user_id=e.user_id
  ), formatted AS MATERIALIZED (
    SELECT r.user_id,r.tokens,r.rank,jsonb_build_object('user_id',r.user_id,
      'total_tokens',r.tokens::text,'rank',r.rank,
      'display_name',coalesce(nullif(s.display_name,''),nullif(u.profile->>'name',''),'Member'),
      'avatar_url',p.avatar_url) AS item
    FROM ranked r JOIN auth.users u ON u.id=r.user_id
    LEFT JOIN public.tokentracker_user_settings s ON s.user_id=r.user_id
    LEFT JOIN public.tokentracker_user_profiles p ON p.user_id=r.user_id
  ), page AS (
    SELECT * FROM formatted ORDER BY tokens DESC,user_id LIMIT p_limit OFFSET p_offset
  ) SELECT jsonb_build_object('ok',true,'community_id',p_community_id,'period',p_period,
    'from_day',start_at::date,'to_day',(end_at-interval '1 day')::date,
    'from',start_at,'to_exclusive',end_at,'basis','client_reported_tokens',
    'automatic_anticheat',false,'member_count',(SELECT count(*) FROM members),
    'ranked_count',(SELECT count(*) FROM ranked),
    'excluded_member_count',(SELECT count(*) FROM members)-(SELECT count(*) FROM ranked),
    'rows',coalesce((SELECT jsonb_agg(item ORDER BY tokens DESC,user_id) FROM page),'[]'::jsonb),
    'me',(SELECT item FROM formatted WHERE user_id=p_actor),'limit',p_limit,'offset',p_offset)
    INTO result;
  RETURN result;
END $fn$;
