-- COMMUNITY_V1: STABLE read functions share the caller's statement snapshot.
-- Membership authorization, usage filtering, zero-fill and ranking stay in DB.
CREATE FUNCTION public.community_read(p_actor uuid, p_limits jsonb,
  p_community_id uuid DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp SET timezone = 'UTC' AS $fn$
DECLARE c public.communities; rows jsonb; requests jsonb; owned bigint; joined bigint;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_validate_limits(p_limits);
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_offset IS NULL OR p_offset<0
    THEN RETURN public.community_error('INVALID_PAGINATION'); END IF;
  SELECT count(*) INTO owned FROM public.communities WHERE owner_id=p_actor;
  SELECT count(*) INTO joined FROM public.community_members WHERE user_id=p_actor;
  IF p_community_id IS NULL THEN
    SELECT coalesce(jsonb_agg(item ORDER BY created_at DESC,id),'[]'::jsonb) INTO rows FROM (
      SELECT co.id,co.created_at,
        (CASE WHEN co.owner_id=p_actor THEN to_jsonb(co) ELSE to_jsonb(co)-'invite_code' END)
        || jsonb_build_object('is_owner',co.owner_id=p_actor,'joined_at',m.joined_at,
          'member_count',(SELECT count(*) FROM public.community_members cm WHERE cm.community_id=co.id)) AS item
      FROM public.communities co JOIN public.community_members m ON m.community_id=co.id AND m.user_id=p_actor
      ORDER BY co.created_at DESC,co.id LIMIT p_limit OFFSET p_offset
    ) page;
    SELECT coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('status',
      CASE WHEN r.expires_at<=statement_timestamp() THEN 'expired' ELSE r.status END)
      ORDER BY r.created_at,r.id),'[]'::jsonb) INTO requests
      FROM public.community_transfer_requests r
      WHERE r.to_user_id=p_actor AND r.status='pending'
        AND EXISTS(SELECT 1 FROM public.community_members m WHERE m.community_id=r.community_id AND m.user_id=p_actor);
    RETURN jsonb_build_object('ok',true,'communities',rows,'incoming_transfers',requests,
      'owned_count',owned,'joined_count',joined,'limits',p_limits,'limit',p_limit,'offset',p_offset);
  END IF;
  SELECT * INTO c FROM public.communities WHERE id=p_community_id
    AND EXISTS(SELECT 1 FROM public.community_members WHERE community_id=p_community_id AND user_id=p_actor);
  IF NOT FOUND THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  SELECT coalesce(jsonb_agg(item ORDER BY joined_at,user_id),'[]'::jsonb) INTO rows FROM (
    SELECT m.user_id,m.joined_at,jsonb_build_object('user_id',m.user_id,'joined_at',m.joined_at,
      'display_name',coalesce(nullif(s.display_name,''),nullif(u.profile->>'name',''),'Member'),
      'avatar_url',p.avatar_url,'is_owner',m.user_id=c.owner_id) AS item
    FROM public.community_members m JOIN auth.users u ON u.id=m.user_id
    LEFT JOIN public.tokentracker_user_settings s ON s.user_id=m.user_id
    LEFT JOIN public.tokentracker_user_profiles p ON p.user_id=m.user_id
    WHERE m.community_id=c.id ORDER BY m.joined_at,m.user_id LIMIT p_limit OFFSET p_offset
  ) page;
  SELECT coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object('status',
    CASE WHEN r.expires_at<=statement_timestamp() THEN 'expired' ELSE r.status END)
    ORDER BY r.created_at,r.id),'[]'::jsonb) INTO requests
    FROM public.community_transfer_requests r WHERE r.community_id=c.id AND r.status='pending'
      AND (c.owner_id=p_actor OR r.to_user_id=p_actor);
  RETURN jsonb_build_object('ok',true,'community',CASE WHEN c.owner_id=p_actor THEN to_jsonb(c) ELSE to_jsonb(c)-'invite_code' END,
    'is_owner',c.owner_id=p_actor,'members',rows,'transfers',requests,
    'member_count',(SELECT count(*) FROM public.community_members WHERE community_id=c.id),
    'limits',p_limits,'owned_count',owned,'joined_count',joined,'limit',p_limit,'offset',p_offset);
END $fn$;
CREATE FUNCTION public.community_leaderboard(p_actor uuid, p_community_id uuid, p_period text,
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
