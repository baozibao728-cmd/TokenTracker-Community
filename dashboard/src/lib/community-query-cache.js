const DEFAULT_TTL_MS = 15_000;
const MAX_ENTRIES = 80;
const RETAIN_MS = 5 * 60_000;

const sessions = new Map();

function stableKey(queryKey) {
  return JSON.stringify(queryKey);
}

function getSession(sessionKey, create = false) {
  let session = sessions.get(sessionKey);
  if (!session && create) {
    session = { entries: new Map(), blocked: false, blockError: null };
    sessions.set(sessionKey, session);
  }
  return session;
}

function emptySnapshot() {
  return { data: null, updatedAt: 0, refreshing: false, error: null, invalidated: false };
}

function snapshot(entry) {
  if (!entry) return emptySnapshot();
  return {
    data: entry.data,
    updatedAt: entry.updatedAt,
    refreshing: Boolean(entry.promise),
    error: entry.error,
    invalidated: entry.invalidated,
  };
}

function touch(session, key, entry) {
  session.entries.delete(key);
  session.entries.set(key, entry);
}

function prune(session) {
  const now = Date.now();
  for (const [key, entry] of session.entries) {
    if (!entry.listeners.size && !entry.promise && now - Math.max(entry.updatedAt, entry.touchedAt) > RETAIN_MS) {
      session.entries.delete(key);
    }
  }
  while (session.entries.size > MAX_ENTRIES) {
    const candidate = [...session.entries].find(([, entry]) => !entry.listeners.size && !entry.promise);
    if (!candidate) break;
    session.entries.delete(candidate[0]);
  }
}

function getEntry(sessionKey, queryKey, create = false) {
  const session = getSession(sessionKey, create);
  if (!session) return { session: null, key: stableKey(queryKey), entry: null };
  const key = stableKey(queryKey);
  let entry = session.entries.get(key);
  if (!entry && create) {
    entry = { queryKey, data: null, updatedAt: 0, touchedAt: Date.now(), error: null,
      invalidated: false, promise: null, generation: 0, listeners: new Set() };
    session.entries.set(key, entry);
    prune(session);
  }
  if (entry) {
    entry.touchedAt = Date.now();
    touch(session, key, entry);
  }
  return { session, key, entry };
}

function notify(entry) {
  for (const listener of entry.listeners) listener();
}

export function getCommunityQuerySnapshot(sessionKey, queryKey) {
  if (!sessionKey) return emptySnapshot();
  const session = getSession(sessionKey);
  const value = snapshot(getEntry(sessionKey, queryKey).entry);
  if (session?.blocked) return { ...value, data: null, updatedAt: 0, error: session.blockError || value.error };
  return value;
}

export function subscribeCommunityQuery(sessionKey, queryKey, listener) {
  if (!sessionKey) return () => {};
  const { session, key, entry } = getEntry(sessionKey, queryKey, true);
  entry.listeners.add(listener);
  return () => {
    entry.listeners.delete(listener);
    prune(session);
    if (!session.entries.size && !session.blocked) sessions.delete(sessionKey);
    else if (!session.entries.size) sessions.delete(sessionKey);
    void key;
  };
}

export function isCommunityQueryFresh(sessionKey, queryKey, ttlMs = DEFAULT_TTL_MS) {
  const { session, entry } = getEntry(sessionKey, queryKey);
  return Boolean(entry?.data && !entry.invalidated && Date.now() - entry.updatedAt < ttlMs && !session?.blocked);
}

export function isCommunitySessionBlocked(sessionKey) {
  return Boolean(getSession(sessionKey)?.blocked);
}

export async function fetchCommunityQuery({ sessionKey, queryKey, loader, ttlMs = DEFAULT_TTL_MS,
  force = false, signal }) {
  if (!sessionKey) return null;
  const { session, key, entry } = getEntry(sessionKey, queryKey, true);
  if (entry.promise) return entry.promise;
  if (session.blocked && !force) {
    entry.invalidated = false;
    entry.error = session.blockError || new Error("Community session is unauthorized");
    notify(entry);
    throw entry.error;
  }
  if (!force && entry.data && !entry.invalidated && Date.now() - entry.updatedAt < ttlMs) return entry.data;

  const generation = ++entry.generation;
  entry.error = null;
  entry.invalidated = false;
  const promise = Promise.resolve().then(() => loader(signal)).then((data) => {
    const current = getEntry(sessionKey, queryKey).entry;
    if (current === entry && current.generation === generation) {
      current.data = data;
      current.updatedAt = Date.now();
      current.touchedAt = current.updatedAt;
      current.error = null;
      current.invalidated = false;
      session.blocked = false;
      session.blockError = null;
    }
    return data;
  }).catch((error) => {
    const current = getEntry(sessionKey, queryKey).entry;
    if (current === entry && current.generation === generation) {
      current.error = error;
      if (error?.status === 401 || error?.code === "UNAUTHORIZED") blockCommunitySession(sessionKey, queryKey, error);
      else if (error?.code === "COMMUNITY_UNAVAILABLE" && queryKey?.[1]) {
        current.data = null;
        current.updatedAt = 0;
        clearCommunityQueries(sessionKey, (candidate) => candidate?.[1] === queryKey[1] &&
          stableKey(candidate) !== stableKey(queryKey));
        invalidateCommunityQueries(sessionKey, (candidate) => candidate?.[0] === "list" || candidate?.[0] === "memberships");
      } else if (error?.status === 403) {
        current.data = null;
        current.updatedAt = 0;
        if (queryKey?.[1]) {
          clearCommunityQueries(sessionKey, (candidate) => candidate?.[1] === queryKey[1] &&
            stableKey(candidate) !== stableKey(queryKey));
        }
      }
    }
    throw error;
  }).finally(() => {
    const current = getEntry(sessionKey, queryKey).entry;
    if (current === entry && current.promise === promise) {
      current.promise = null;
      notify(current);
      prune(session);
    }
  });
  entry.promise = promise;
  notify(entry);
  return promise;
}

export function invalidateCommunityQueries(sessionKey, predicate = () => true) {
  const session = getSession(sessionKey);
  if (!session) return;
  for (const entry of session.entries.values()) {
    if (!predicate(entry.queryKey)) continue;
    entry.invalidated = true;
    entry.updatedAt = 0;
    entry.generation += 1;
    entry.error = null;
    notify(entry);
  }
}

function clearCommunityQueries(sessionKey, predicate, error = null) {
  const session = getSession(sessionKey);
  if (!session) return;
  for (const entry of session.entries.values()) {
    if (!predicate(entry.queryKey)) continue;
    entry.generation += 1;
    entry.data = null;
    entry.updatedAt = 0;
    entry.invalidated = false;
    entry.error = error;
    notify(entry);
  }
}

export function invalidateCommunityAccess(sessionKey, communityId, error) {
  clearCommunityQueries(sessionKey, (candidate) => candidate?.[1] === communityId, error);
  invalidateCommunityQueries(sessionKey, (candidate) => candidate?.[0] === "list" || candidate?.[0] === "memberships");
}

export function blockCommunitySession(sessionKey, queryKey, error) {
  const session = getSession(sessionKey);
  if (!session) return;
  session.blocked = true;
  session.blockError = error;
  for (const entry of session.entries.values()) {
    entry.generation += 1;
    entry.promise = null;
    entry.data = null;
    entry.updatedAt = 0;
    entry.invalidated = false;
    entry.error = error;
    notify(entry);
  }
}

export function clearCommunitySession(sessionKey) {
  if (!sessionKey) return;
  const session = sessions.get(sessionKey);
  if (!session) return;
  for (const entry of session.entries.values()) {
    entry.generation += 1;
    entry.promise = null;
    entry.data = null;
    entry.updatedAt = 0;
    entry.invalidated = false;
    notify(entry);
  }
  sessions.delete(sessionKey);
}

export function clearAllCommunityQueryCache() {
  for (const key of sessions.keys()) clearCommunitySession(key);
}

export { DEFAULT_TTL_MS as COMMUNITY_QUERY_TTL_MS };
