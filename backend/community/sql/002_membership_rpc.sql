-- COMMUNITY_V1: SECURITY INVOKER, service-only. p_actor is a verified JWT subject
-- supplied by the future Edge; clients cannot execute any of these RPCs.
-- All writers lock user quota keys (sorted UUID), then community, then request.
-- READ COMMITTED required: counts after a waiting lock must see prior commits.
CREATE FUNCTION public.community_assert_actor(p_actor uuid) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_actor) THEN
    RAISE EXCEPTION 'INVALID_ACTOR' USING ERRCODE = '28000';
  END IF;
END $fn$;
CREATE FUNCTION public.community_validate_limits(p_limits jsonb) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE k text;
BEGIN
  IF p_limits IS NULL OR jsonb_typeof(p_limits) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_LIMITS' USING ERRCODE = '22023';
  END IF;
  FOREACH k IN ARRAY ARRAY['max_owned','max_joined','max_members'] LOOP
    IF jsonb_typeof(p_limits->k) IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'INVALID_LIMITS: %', k USING ERRCODE = '22023';
    END IF;
    IF (p_limits->>k) !~ '^[1-9][0-9]*$' OR (p_limits->>k)::numeric > 2147483647 THEN
      RAISE EXCEPTION 'INVALID_LIMITS: %', k USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM jsonb_object_keys(p_limits)) <> 3 THEN
    RAISE EXCEPTION 'INVALID_LIMITS: unexpected fields' USING ERRCODE = '22023';
  END IF;
END $fn$;
CREATE FUNCTION public.community_lock_users(p_users uuid[]) RETURNS void
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE u uuid;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'COMMUNITY_WRITES_REQUIRE_READ_COMMITTED' USING ERRCODE = '25000';
  END IF;
  FOR u IN SELECT DISTINCT x FROM unnest(p_users) x WHERE x IS NOT NULL ORDER BY x LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('community:user:' || u::text, 0));
  END LOOP;
END $fn$;
CREATE FUNCTION public.community_error(p_code text) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public, pg_temp AS $fn$
  SELECT jsonb_build_object('ok',false,'error',jsonb_build_object('code',p_code))
$fn$;
CREATE FUNCTION public.community_create(p_actor uuid, p_name text, p_description text, p_limits jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities; attempt integer; violated text;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_validate_limits(p_limits);
  IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 100
     OR char_length(p_description) > 2000 THEN RETURN public.community_error('INVALID_INPUT'); END IF;
  PERFORM public.community_lock_users(ARRAY[p_actor]);
  IF (SELECT count(*) FROM public.communities WHERE owner_id=p_actor) >= (p_limits->>'max_owned')::integer
    THEN RETURN public.community_error('OWNED_LIMIT'); END IF;
  IF (SELECT count(*) FROM public.community_members WHERE user_id=p_actor) >= (p_limits->>'max_joined')::integer
    THEN RETURN public.community_error('JOINED_LIMIT'); END IF;
  -- Collision retries only for the invite-code unique constraint, never hide
  -- unrelated constraint errors. Each iteration's subtransaction is atomic.
  FOR attempt IN 1..5 LOOP
    BEGIN
      INSERT INTO public.communities(name,description,owner_id,invite_code)
      VALUES (btrim(p_name),p_description,p_actor,upper(replace(gen_random_uuid()::text,'-',''))) RETURNING * INTO c;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS violated = CONSTRAINT_NAME;
      IF violated <> 'communities_invite_code_key' THEN RAISE; END IF;
      IF attempt=5 THEN RAISE; END IF;
    END;
  END LOOP;
  INSERT INTO public.community_members(community_id,user_id) VALUES(c.id,p_actor);
  RETURN jsonb_build_object('ok',true,'community',to_jsonb(c));
END $fn$;
CREATE FUNCTION public.community_join(p_actor uuid, p_invite_code text, p_limits jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_validate_limits(p_limits);
  PERFORM public.community_lock_users(ARRAY[p_actor]);
  SELECT * INTO c FROM public.communities WHERE invite_code=upper(btrim(p_invite_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  IF EXISTS (SELECT 1 FROM public.community_members WHERE community_id=c.id AND user_id=p_actor) THEN
    RETURN jsonb_build_object('ok',true,'already_member',true,'community_id',c.id);
  END IF;
  IF (SELECT count(*) FROM public.community_members WHERE user_id=p_actor) >= (p_limits->>'max_joined')::integer
    THEN RETURN public.community_error('JOINED_LIMIT'); END IF;
  IF (SELECT count(*) FROM public.community_members WHERE community_id=c.id) >= (p_limits->>'max_members')::integer
    THEN RETURN public.community_error('MEMBER_LIMIT'); END IF;
  INSERT INTO public.community_members(community_id,user_id) VALUES(c.id,p_actor);
  RETURN jsonb_build_object('ok',true,'already_member',false,'community_id',c.id);
END $fn$;
CREATE FUNCTION public.community_leave(p_actor uuid, p_community_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_lock_users(ARRAY[p_actor]);
  SELECT * INTO c FROM public.communities WHERE id=p_community_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.community_members WHERE community_id=c.id AND user_id=p_actor)
    THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  IF c.owner_id=p_actor THEN RETURN public.community_error('OWNER_CANNOT_LEAVE'); END IF;
  UPDATE public.community_transfer_requests SET status='expired'
    WHERE community_id=c.id AND to_user_id=p_actor AND status='pending';
  DELETE FROM public.community_members WHERE community_id=c.id AND user_id=p_actor;
  RETURN jsonb_build_object('ok',true,'community_id',c.id);
END $fn$;
CREATE FUNCTION public.community_delete(p_actor uuid, p_community_id uuid, p_confirmation_name text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_lock_users(ARRAY[p_actor]);
  SELECT * INTO c FROM public.communities WHERE id=p_community_id FOR UPDATE;
  IF NOT FOUND OR c.owner_id<>p_actor THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  IF p_confirmation_name IS DISTINCT FROM c.name THEN RETURN public.community_error('CONFIRMATION_REQUIRED'); END IF;
  DELETE FROM public.communities WHERE id=c.id;
  RETURN jsonb_build_object('ok',true,'community_id',c.id);
END $fn$;
