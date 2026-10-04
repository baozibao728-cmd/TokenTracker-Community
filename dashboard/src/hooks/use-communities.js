import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInsforgeAuth } from "../contexts/InsforgeAuthContext.jsx";
import { resolveAuthAccessTokenWithRetry } from "../lib/auth-token";
import { CommunityApiError } from "../lib/community-api";
import {
  fetchCommunityQuery,
  getCommunityQuerySnapshot,
  isCommunityQueryFresh,
  isCommunitySessionBlocked,
  subscribeCommunityQuery,
  invalidateCommunityQueries,
  blockCommunitySession,
  invalidateCommunityAccess,
  COMMUNITY_QUERY_TTL_MS,
} from "../lib/community-query-cache.js";

export function useCommunityQuery(queryKey, loader, { enabled = true, ttlMs = COMMUNITY_QUERY_TTL_MS } = {}) {
  const auth = useInsforgeAuth();
  const userId = auth?.enabled && auth?.signedIn ? auth.user?.id : null;
  const sessionKey = userId ? `${userId}:${auth?.sessionEpoch ?? 0}` : null;
  const ready = Boolean(sessionKey && !auth.loading && enabled);
  const keyString = useMemo(() => JSON.stringify(queryKey), [queryKey]);
  const [version, setVersion] = useState(0);

  const load = useCallback(async (force = false) => {
    if (!ready) return null;
    try {
      return await fetchCommunityQuery({
        sessionKey,
        queryKey,
        ttlMs,
        force,
        loader: async () => {
          const token = await resolveAuthAccessTokenWithRetry({ getAccessToken: auth.getAccessToken });
          if (!token) throw new CommunityApiError("UNAUTHORIZED", 401);
          return loader(token, undefined);
        },
      });
    } catch { return null; }
  }, [ready, auth?.getAccessToken, sessionKey, keyString, loader, ttlMs]);

  const onFocus = useCallback(() => {
    if (ready && !isCommunityQueryFresh(sessionKey, queryKey, ttlMs) &&
      !isCommunitySessionBlocked(sessionKey)) void load(false);
  }, [ready, sessionKey, keyString, ttlMs, load]);

  useEffect(() => {
    if (!ready) return undefined;
    const sync = () => setVersion((value) => value + 1);
    const unsubscribe = subscribeCommunityQuery(sessionKey, queryKey, sync);
    const snapshot = getCommunityQuerySnapshot(sessionKey, queryKey);
    if (!isCommunitySessionBlocked(sessionKey) && (snapshot.invalidated || (!snapshot.data && !snapshot.error) ||
      (snapshot.data && !snapshot.error && !isCommunityQueryFresh(sessionKey, queryKey, ttlMs)))) {
      void load(false);
    }
    return unsubscribe;
  }, [ready, sessionKey, keyString, ttlMs, load, version]);

  useEffect(() => {
    if (!ready) return;
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [ready, onFocus]);

  const reload = useCallback(() => {
    void load(true);
  }, [load]);
  const retry = reload;
  const snapshot = ready ? getCommunityQuerySnapshot(sessionKey, queryKey) : null;
  const data = snapshot?.data ?? null;
  const error = snapshot?.error ?? null;
  const refreshing = Boolean(snapshot?.refreshing || (snapshot?.invalidated && data && !error));
  return {
    data,
    error,
    loading: Boolean(auth?.loading || (ready && !data && !error)),
    refreshing,
    authRequired: !auth?.loading && !userId,
    userId,
    sessionKey,
    reload,
    refresh: reload,
    retry,
  };
}

// POST mutations are never retried. Successful mutations invalidate the current
// session cache so every active list/detail/leaderboard observer refreshes once.
export function useCommunityMutation(scope) {
  const auth = useInsforgeAuth();
  const sessionKey = auth?.enabled && auth?.signedIn && auth?.user?.id
    ? `${auth.user.id}:${auth?.sessionEpoch ?? 0}` : null;
  const identity = `${sessionKey || ""}:${scope}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const running = useRef(new Set());
  const mounted = useRef(true);
  const [state, setState] = useState(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const run = async (action) => {
    if (running.current.has(identity)) return null;
    running.current.add(identity);
    const started = identity;
    setState({ identity: started, busy: true, error: null });
    try {
      if (!auth?.enabled || !auth.signedIn) throw new CommunityApiError("UNAUTHORIZED", 401);
      const accessToken = await resolveAuthAccessTokenWithRetry({ getAccessToken: auth.getAccessToken });
      if (!mounted.current || identityRef.current !== started) return null;
      if (!accessToken) throw new CommunityApiError("UNAUTHORIZED", 401);
      const result = await action(accessToken);
      if (!mounted.current || identityRef.current !== started) return null;
      if (result) {
        invalidateCommunityQueries(sessionKey);
        setState({ identity: started, busy: false, error: null });
      } else {
        setState({ identity: started, busy: false, error: null });
      }
      return result;
    } catch (error) {
      if (mounted.current && identityRef.current === started) {
        if (error?.status === 401 || error?.code === "UNAUTHORIZED") {
          blockCommunitySession(sessionKey, null, error);
        } else if (error?.status === 403 || error?.code === "COMMUNITY_UNAVAILABLE") {
          invalidateCommunityAccess(sessionKey, scope, error);
        }
        setState({ identity: started, busy: false, error });
      }
      return null;
    } finally {
      running.current.delete(started);
    }
  };
  return {
    run,
    busy: state?.identity === identity && state.busy,
    error: state?.identity === identity ? state.error : null,
  };
}
