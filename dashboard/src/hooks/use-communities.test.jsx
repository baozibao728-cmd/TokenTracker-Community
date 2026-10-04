/** @vitest-environment jsdom */
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const auth = { enabled: true, signedIn: true, loading: false, user: { id: "user-a" }, sessionEpoch: 1,
  getAccessToken: vi.fn(async () => "session-token") };
vi.mock("../contexts/InsforgeAuthContext.jsx", () => ({ useInsforgeAuth: () => auth }));
vi.mock("../lib/auth-token", () => ({ resolveAuthAccessTokenWithRetry: ({ getAccessToken }) => getAccessToken() }));

import { useCommunityMutation, useCommunityQuery } from "./use-communities.js";
import { clearAllCommunityQueryCache, fetchCommunityQuery, getCommunityQuerySnapshot, invalidateCommunityQueries } from "../lib/community-query-cache.js";

const key = ["list", null, null, 20, 0];
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

afterEach(() => {
  cleanup();
  clearAllCommunityQueryCache();
  vi.useRealTimers();
  Object.assign(auth, { enabled: true, signedIn: true, loading: false, user: { id: "user-a" }, sessionEpoch: 1 });
  auth.getAccessToken = vi.fn(async () => "session-token");
});

describe("useCommunityQuery", () => {
  it("reuses focus data inside the TTL and lets manual refresh bypass it", async () => {
    const loader = vi.fn().mockResolvedValueOnce("initial").mockResolvedValue("fresh");
    const { result } = renderHook(() => useCommunityQuery(key, loader, { ttlMs: 250 }));
    await waitFor(() => expect(result.current.data).toBe("initial"));
    expect(result.current.sessionKey).toBe("user-a:1");
    act(() => window.dispatchEvent(new Event("focus")));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 275)); });
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.data).toBe("fresh"));
    act(() => result.current.reload());
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(3));
  });

  it("isolates same-account re-login and ignores the previous request response", async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const loader = vi.fn().mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const { result, rerender } = renderHook(() => useCommunityQuery(key, loader));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    auth.sessionEpoch = 2;
    rerender();
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    await act(async () => oldRequest.resolve("old login"));
    await act(async () => newRequest.resolve("new login"));
    await waitFor(() => expect(result.current.data).toBe("new login"));
    expect(result.current.sessionKey).toBe("user-a:2");
  });

  it("shows unauthorized immediately for a new key in an already blocked session", async () => {
    const denied = Object.assign(new Error("unauthorized"), { status: 401, code: "UNAUTHORIZED" });
    const failing = renderHook(() => useCommunityQuery(key, async () => { throw denied; }));
    await waitFor(() => expect(failing.result.current.error).toBe(denied));
    failing.unmount();
    const otherKey = ["detail", "community-b", null, 20, 0];
    const other = renderHook(() => useCommunityQuery(otherKey, vi.fn()));
    expect(other.result.current.error).toBe(denied);
    expect(other.result.current.loading).toBe(false);
  });

  it("refetches after an invalidated in-flight response finishes", async () => {
    const first = deferred();
    const second = deferred();
    const loader = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useCommunityQuery(key, loader));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1));
    act(() => invalidateCommunityQueries("user-a:1"));
    expect(loader).toHaveBeenCalledTimes(1);
    await act(async () => first.resolve("pre-invalidation"));
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeNull();
    await act(async () => second.resolve("after-invalidation"));
    await waitFor(() => expect(result.current.data).toBe("after-invalidation"));
  });
});

describe("useCommunityMutation", () => {
  it("allows a new session to mutate while an old session POST remains pending", async () => {
    const oldRequest = deferred();
    const newRequest = deferred();
    const { result, rerender } = renderHook(() => useCommunityMutation("community-a"));
    const oldAction = vi.fn(() => oldRequest.promise);
    const newAction = vi.fn(() => newRequest.promise);
    let oldPending;
    let newPending;
    await act(async () => { oldPending = result.current.run(oldAction); });
    auth.sessionEpoch = 2;
    rerender();
    await act(async () => { newPending = result.current.run(newAction); });
    expect(newAction).toHaveBeenCalledTimes(1);
    await act(async () => { oldRequest.resolve({ ok: true }); await oldPending; });
    expect(result.current.busy).toBe(true);
    await act(async () => { await result.current.run(newAction); });
    expect(newAction).toHaveBeenCalledTimes(1);
    await act(async () => { newRequest.resolve({ ok: true }); await newPending; });
    expect(result.current.busy).toBe(false);
  });

  it.each([403, 404])("clears affected community reads after a POST returns %s", async (status) => {
    const detailKey = ["detail", "community-a", null, 20, 0];
    const boardKey = ["leaderboard", "community-a", "week", 20, 0];
    const otherKey = ["leaderboard", "community-b", "week", 20, 0];
    for (const queryKey of [detailKey, boardKey, otherKey, key]) {
      await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey, loader: async () => "private" });
    }
    const { result } = renderHook(() => useCommunityMutation("community-a"));
    const denied = Object.assign(new Error("unavailable"), { status,
      code: status === 404 ? "COMMUNITY_UNAVAILABLE" : "FORBIDDEN" });
    const action = vi.fn(async () => { throw denied; });
    await act(async () => { await result.current.run(action); });
    expect(getCommunityQuerySnapshot("user-a:1", detailKey)).toMatchObject({ data: null, error: denied });
    expect(getCommunityQuerySnapshot("user-a:1", boardKey)).toMatchObject({ data: null, error: denied });
    expect(getCommunityQuerySnapshot("user-a:1", otherKey).data).toBe("private");
    expect(getCommunityQuerySnapshot("user-a:1", key).invalidated).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("clears private query data when a POST rejects the current session without retrying it", async () => {
    const loader = vi.fn(async () => ({ name: "private community" }));
    const { result: query } = renderHook(() => useCommunityQuery(key, loader));
    const { result: mutation } = renderHook(() => useCommunityMutation("list"));
    await waitFor(() => expect(query.current.data?.name).toBe("private community"));
    const denied = Object.assign(new Error("unauthorized"), { status: 401, code: "UNAUTHORIZED" });
    const action = vi.fn(async () => { throw denied; });
    await act(async () => { await mutation.current.run(action); });
    await waitFor(() => expect(query.current.data).toBeNull());
    expect(query.current.error).toBe(denied);
    expect(query.current.loading).toBe(false);
    expect(mutation.current.error).toBe(denied);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(action).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("invalidates active community queries once and never repeats a POST", async () => {
    let calls = 0;
    const loader = vi.fn(async () => `read-${++calls}`);
    const actionWait = deferred();
    const { result: query } = renderHook(() => useCommunityQuery(key, loader));
    const { result: mutation } = renderHook(() => useCommunityMutation("list"));
    await waitFor(() => expect(query.current.data).toBe("read-1"));
    const action = vi.fn(() => actionWait.promise);
    let first;
    await act(async () => {
      first = mutation.current.run(action);
      await mutation.current.run(action);
    });
    expect(action).toHaveBeenCalledTimes(1);
    await act(async () => actionWait.resolve({ ok: true }));
    await act(async () => first);
    await waitFor(() => expect(query.current.data).toBe("read-2"));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not call the POST if identity changes while access token is resolving", async () => {
    const token = deferred();
    auth.getAccessToken = vi.fn(() => token.promise);
    const { result, rerender } = renderHook(() => useCommunityMutation("list"));
    const action = vi.fn(async () => ({ ok: true }));
    let pending;
    act(() => { pending = result.current.run(action); });
    auth.user = { id: "user-b" };
    auth.sessionEpoch = 2;
    rerender();
    await act(async () => { token.resolve("session-token"); await pending; });
    expect(action).not.toHaveBeenCalled();
  });

  it("ignores an action result after identity changes and clears busy on a null result", async () => {
    const actionWait = deferred();
    const { result, rerender } = renderHook(() => useCommunityMutation("list"));
    const action = vi.fn(() => actionWait.promise);
    let pending;
    await act(async () => { pending = result.current.run(action); await Promise.resolve(); });
    expect(action).toHaveBeenCalledTimes(1);
    auth.user = { id: "user-b" };
    auth.sessionEpoch = 2;
    rerender();
    await act(async () => { actionWait.resolve({ ok: true }); await pending; });
    expect(result.current.busy).toBe(false);

    auth.user = { id: "user-a" };
    auth.sessionEpoch = 3;
    rerender();
    const emptyAction = vi.fn(async () => null);
    await act(async () => { await result.current.run(emptyAction); });
    expect(result.current.busy).toBe(false);
  });

  it("does not call the POST after unmount while access token is resolving", async () => {
    const token = deferred();
    auth.getAccessToken = vi.fn(() => token.promise);
    const { result, unmount } = renderHook(() => useCommunityMutation("list"));
    const action = vi.fn(async () => ({ ok: true }));
    let pending;
    act(() => { pending = result.current.run(action); });
    unmount();
    await act(async () => { token.resolve("session-token"); await pending; });
    expect(action).not.toHaveBeenCalled();
  });

  it("does not return a completed POST result after unmount while the action is resolving", async () => {
    const actionWait = deferred();
    const { result, unmount } = renderHook(() => useCommunityMutation("list"));
    const action = vi.fn(() => actionWait.promise);
    let pending;
    await act(async () => { pending = result.current.run(action); await Promise.resolve(); });
    expect(action).toHaveBeenCalledTimes(1);
    unmount();
    let output;
    await act(async () => { actionWait.resolve({ ok: true }); output = await pending; });
    expect(output).toBeNull();
  });
});
