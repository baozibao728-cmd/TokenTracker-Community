import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearAllCommunityQueryCache,
  clearCommunitySession,
  fetchCommunityQuery,
  getCommunityQuerySnapshot,
  invalidateCommunityQueries,
  isCommunityQueryFresh,
  isCommunitySessionBlocked,
  subscribeCommunityQuery,
} from "./community-query-cache.js";

const listKey = ["list", null, null, 20, 0];
const detailKey = ["detail", "community-a", null, 20, 0];
const boardKey = ["leaderboard", "community-a", "week", 20, 0];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

afterEach(() => {
  clearAllCommunityQueryCache();
  vi.useRealTimers();
});

describe("community query cache", () => {
  it("deduplicates concurrent reads and keeps entries isolated by login session", async () => {
    const wait = deferred();
    const loader = vi.fn(() => wait.promise);
    const a = fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader });
    const b = fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader });
    const otherLogin = fetchCommunityQuery({ sessionKey: "user-a:3", queryKey: listKey, loader: async () => "new-login" });
    await Promise.resolve();
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(otherLogin).resolves.toBe("new-login");
    wait.resolve("old-login");
    await expect(Promise.all([a, b])).resolves.toEqual(["old-login", "old-login"]);
    expect(getCommunityQuerySnapshot("user-a:3", listKey).data).toBe("new-login");
    expect(getCommunityQuerySnapshot("user-a:1", listKey).data).toBe("old-login");
  });

  it("uses the short TTL, allows forced refresh, and preserves data with a refresh error", async () => {
    vi.useFakeTimers();
    const loader = vi.fn().mockResolvedValueOnce("first").mockRejectedValueOnce(new Error("offline"));
    await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader, ttlMs: 15_000 });
    expect(isCommunityQueryFresh("user-a:1", listKey)).toBe(true);
    vi.advanceTimersByTime(15_001);
    expect(isCommunityQueryFresh("user-a:1", listKey)).toBe(false);
    await expect(fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader, force: true }))
      .rejects.toThrow("offline");
    expect(getCommunityQuerySnapshot("user-a:1", listKey)).toMatchObject({ data: "first", error: expect.any(Error) });
  });

  it("does not let an invalidated in-flight read overwrite the post-mutation state", async () => {
    const wait = deferred();
    const changed = vi.fn();
    const unsubscribe = subscribeCommunityQuery("user-a:1", listKey, changed);
    const pending = fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader: () => wait.promise });
    invalidateCommunityQueries("user-a:1");
    const joined = fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader: async () => "duplicate" });
    expect(changed).toHaveBeenCalledTimes(2);
    wait.resolve("before-mutation");
    await Promise.all([pending, joined]);
    expect(getCommunityQuerySnapshot("user-a:1", listKey).data).toBeNull();
    expect(getCommunityQuerySnapshot("user-a:1", listKey).invalidated).toBe(true);
    unsubscribe();
  });

  it("blocks automatic session retries on 401 and clears private data without affecting another account", async () => {
    await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: listKey, loader: async () => "private" });
    await fetchCommunityQuery({ sessionKey: "user-b:1", queryKey: listKey, loader: async () => "other" });
    const denied = Object.assign(new Error("unauthorized"), { status: 401, code: "UNAUTHORIZED" });
    await expect(fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: detailKey, loader: async () => { throw denied; } }))
      .rejects.toBe(denied);
    expect(isCommunitySessionBlocked("user-a:1")).toBe(true);
    expect(getCommunityQuerySnapshot("user-a:1", listKey).data).toBeNull();
    expect(getCommunityQuerySnapshot("user-b:1", listKey).data).toBe("other");
  });

  it("clears a signed-out session so its late response cannot refill the cache", async () => {
    const wait = deferred();
    const pending = fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: detailKey, loader: () => wait.promise });
    clearCommunitySession("user-a:1");
    wait.resolve({ invite_code: "old" });
    await pending;
    expect(getCommunityQuerySnapshot("user-a:1", detailKey).data).toBeNull();
  });

  it("invalidates only the affected community routes when membership disappeared", async () => {
    await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: boardKey, loader: async () => "old-board" });
    await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: ["leaderboard", "community-b", "week", 20, 0], loader: async () => "other-board" });
    const unavailable = Object.assign(new Error("gone"), { code: "COMMUNITY_UNAVAILABLE", status: 404 });
    await expect(fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: detailKey, loader: async () => { throw unavailable; } }))
      .rejects.toBe(unavailable);
    expect(getCommunityQuerySnapshot("user-a:1", boardKey).data).toBeNull();
    expect(getCommunityQuerySnapshot("user-a:1", ["leaderboard", "community-b", "week", 20, 0]).data).toBe("other-board");
  });
});
