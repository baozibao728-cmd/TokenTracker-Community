-- COMMUNITY_V1: expiration is enforced on every action. No scheduler required.
-- Expected failures return JSON, allowing an expired status update to commit;
-- raising an exception after that update would incorrectly roll it back.
CREATE FUNCTION public.community_create_transfer(p_actor uuid, p_community_id uuid, p_to_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp SET timezone = 'UTC' AS $fn$
DECLARE c public.communities; r public.community_transfer_requests; t timestamptz;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  IF p_to_user_id IS NULL OR p_to_user_id=p_actor THEN RETURN public.community_error('INVALID_TARGET'); END IF;
  PERFORM public.community_lock_users(ARRAY[p_actor,p_to_user_id]);
  SELECT * INTO c FROM public.communities WHERE id=p_community_id FOR UPDATE;
  IF NOT FOUND OR c.owner_id<>p_actor THEN RETURN public.community_error('COMMUNITY_UNAVAILABLE'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_members WHERE community_id=c.id AND user_id=p_to_user_id)
    THEN RETURN public.community_error('TARGET_NOT_MEMBER'); END IF;
  t := clock_timestamp();
  UPDATE public.community_transfer_requests SET status='expired'
    WHERE community_id=c.id AND status='pending' AND expires_at<=t;
  IF EXISTS(SELECT 1 FROM public.community_transfer_requests WHERE community_id=c.id AND status='pending')
    THEN RETURN public.community_error('TRANSFER_PENDING'); END IF;
  INSERT INTO public.community_transfer_requests(community_id,from_user_id,to_user_id,created_at,expires_at)
    VALUES(c.id,p_actor,p_to_user_id,t,t+interval '7 days') RETURNING * INTO r;
  RETURN jsonb_build_object('ok',true,'transfer',to_jsonb(r));
END $fn$;
CREATE FUNCTION public.community_accept_transfer(p_actor uuid, p_request_id uuid, p_limits jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities; r public.community_transfer_requests;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  PERFORM public.community_validate_limits(p_limits);
  SELECT * INTO r FROM public.community_transfer_requests WHERE id=p_request_id;
  IF NOT FOUND OR r.to_user_id<>p_actor THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  PERFORM public.community_lock_users(ARRAY[r.from_user_id,p_actor]);
  SELECT * INTO c FROM public.communities WHERE id=r.community_id FOR UPDATE;
  IF NOT FOUND THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  SELECT * INTO r FROM public.community_transfer_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.to_user_id<>p_actor THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  IF r.status='accepted' THEN RETURN jsonb_build_object('ok',true,'already_accepted',true,'transfer',to_jsonb(r),'owner_id',c.owner_id); END IF;
  IF r.status<>'pending' THEN RETURN public.community_error('TRANSFER_NOT_PENDING'); END IF;
  IF r.expires_at<=clock_timestamp() OR c.owner_id<>r.from_user_id
     OR NOT EXISTS(SELECT 1 FROM public.community_members WHERE community_id=c.id AND user_id=p_actor) THEN
    UPDATE public.community_transfer_requests SET status='expired' WHERE id=r.id;
    RETURN public.community_error('TRANSFER_EXPIRED');
  END IF;
  IF (SELECT count(*) FROM public.communities WHERE owner_id=p_actor) >= (p_limits->>'max_owned')::integer
    THEN RETURN public.community_error('OWNED_LIMIT'); END IF;
  UPDATE public.communities SET owner_id=p_actor WHERE id=c.id;
  UPDATE public.community_transfer_requests SET status='accepted' WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('ok',true,'already_accepted',false,'transfer',to_jsonb(r),'owner_id',p_actor);
END $fn$;
CREATE FUNCTION public.community_reject_transfer(p_actor uuid, p_request_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE c public.communities; r public.community_transfer_requests;
BEGIN
  PERFORM public.community_assert_actor(p_actor);
  SELECT * INTO r FROM public.community_transfer_requests WHERE id=p_request_id;
  IF NOT FOUND OR r.to_user_id<>p_actor THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  PERFORM public.community_lock_users(ARRAY[r.from_user_id,p_actor]);
  SELECT * INTO c FROM public.communities WHERE id=r.community_id FOR UPDATE;
  IF NOT FOUND THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  SELECT * INTO r FROM public.community_transfer_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR r.to_user_id<>p_actor THEN RETURN public.community_error('TRANSFER_UNAVAILABLE'); END IF;
  IF r.status='rejected' THEN RETURN jsonb_build_object('ok',true,'already_rejected',true,'transfer',to_jsonb(r)); END IF;
  IF r.status<>'pending' THEN RETURN public.community_error('TRANSFER_NOT_PENDING'); END IF;
  IF r.expires_at<=clock_timestamp() OR c.owner_id<>r.from_user_id
     OR NOT EXISTS(SELECT 1 FROM public.community_members WHERE community_id=c.id AND user_id=p_actor) THEN
    UPDATE public.community_transfer_requests SET status='expired' WHERE id=r.id;
    RETURN public.community_error('TRANSFER_EXPIRED');
  END IF;
  UPDATE public.community_transfer_requests SET status='rejected' WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('ok',true,'already_rejected',false,'transfer',to_jsonb(r));
END $fn$;
