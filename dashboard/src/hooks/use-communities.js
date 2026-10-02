import { useCallback, useEffect, useRef, useState } from "react";
import { useInsforgeAuth } from "../contexts/InsforgeAuthContext.jsx";
import { resolveAuthAccessTokenWithRetry } from "../lib/auth-token";
import { CommunityApiError } from "../lib/community-api";

// Local dashboard access is not a cloud session. These pages always need a
// genuine user token, even on localhost or in the existing screenshot mode.
export function useCommunityQuery(loader, { enabled = true } = {}) {
  const auth = useInsforgeAuth();
  const userId = auth?.enabled && auth?.signedIn ? auth.user?.id : null;
  const ready = Boolean(userId && !auth.loading && enabled);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(null);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!ready) return undefined;
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, [ready, reload]);

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    let active = true;
    const identity = { userId, loader, version };
    setState({ ...identity, loading: true, data: null, error: null });
    (async () => {
      try {
        const token = await resolveAuthAccessTokenWithRetry({ getAccessToken: auth.getAccessToken });
        if (!active) return;
        if (!token) throw new CommunityApiError("UNAUTHORIZED", 401);
        const data = await loader(token, controller.signal);
        if (active) setState({ ...identity, loading: false, data, error: null });
      } catch (error) {
        if (active) setState({ ...identity, loading: false, data: null, error });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [ready, userId, auth?.getAccessToken, loader, version]);

  const current = ready && state?.userId === userId && state.loader === loader && state.version === version;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: Boolean(auth?.loading || (ready && (!current || state.loading))),
    authRequired: !auth?.loading && !userId,
    userId, reload,
  };
}

// No automatic POST retry: create is intentionally not request-idempotent.
// A result from an old account/route must not update the new account's UI.
export function useCommunityMutation(scope) {
  const auth = useInsforgeAuth();
  const identity = `${auth?.user?.id || ""}:${scope}`;
  const current = useRef(identity);
  current.current = identity;
  const running = useRef(false);
  const mounted = useRef(false);
  const [state, setState] = useState(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const run = async (action) => {
    if (running.current) return null;
    running.current = true;
    const started = identity;
    setState({ identity: started, busy: true, error: null });
    try {
      if (!auth?.enabled || !auth.signedIn) throw new CommunityApiError("UNAUTHORIZED", 401);
      const accessToken = await resolveAuthAccessTokenWithRetry({ getAccessToken: auth.getAccessToken });
      if (!mounted.current || current.current !== started) return null;
      if (!accessToken) throw new CommunityApiError("UNAUTHORIZED", 401);
      const result = await action(accessToken);
      if (!mounted.current || current.current !== started) return null;
      setState({ identity: started, busy: false, error: null });
      return result;
    } catch (error) {
      if (mounted.current && current.current === started) setState({ identity: started, busy: false, error });
      return null;
    } finally {
      running.current = false;
    }
  };
  return { run, busy: state?.identity === identity && state.busy,
    error: state?.identity === identity ? state.error : null };
}
