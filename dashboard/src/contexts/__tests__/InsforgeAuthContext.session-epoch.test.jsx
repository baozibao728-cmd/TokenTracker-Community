import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let restoredUser = { id: "user-a" };
let currentUser = { id: "user-a" };
const client = {
  tokenManager: { getAccessToken: () => "synthetic-access-token" },
  auth: {
    signInWithPassword: vi.fn(async () => ({ data: { user: { id: "user-a" } }, error: null })),
    signUp: vi.fn(async () => ({ data: { user: { id: "user-a" }, accessToken: "synthetic-access-token" }, error: null })),
    getCurrentUser: vi.fn(async () => ({ data: { user: currentUser }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
};

vi.mock("../../lib/insforge-config", () => ({
  getOrCreateInsforgeClient: () => client,
  isCloudInsforgeConfigured: () => true,
}));
vi.mock("../../lib/insforge-session-recovery.mjs", () => ({
  restoreInsforgeUser: async () => ({ data: { user: restoredUser }, error: null }),
}));
vi.mock("../../lib/cloud-sync-prefs", () => ({ clearCloudDeviceSession: vi.fn(), setCloudSyncEnabled: vi.fn() }));
vi.mock("../../lib/api", () => ({ getPublicVisibility: vi.fn(async () => ({ display_name: "" })) }));
vi.mock("../../lib/local-api-auth", () => ({ clearLocalApiAuthToken: vi.fn() }));
vi.mock("../../lib/copy", () => ({ copy: (key) => key }));
vi.mock("../../lib/native-bridge.js", () => ({
  getNativeOAuthBridge: () => null,
  isNativeLinuxApp: () => false,
  isNativeWindowsApp: () => false,
}));

import { InsforgeAuthProvider, useInsforgeAuth } from "../InsforgeAuthContext.jsx";
import { clearAllCommunityQueryCache, fetchCommunityQuery, getCommunityQuerySnapshot } from "../../lib/community-query-cache.js";

const wrapper = ({ children }) => <InsforgeAuthProvider>{children}</InsforgeAuthProvider>;

afterEach(() => {
  clearAllCommunityQueryCache();
  restoredUser = { id: "user-a" };
  currentUser = { id: "user-a" };
  vi.clearAllMocks();
});

describe("InsforgeAuthProvider community session epoch", () => {
  it("changes for restored/login/logout sessions, stays stable on same-user refresh, and clears prior cache", async () => {
    const { result } = renderHook(() => useInsforgeAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user.id).toBe("user-a");
    const restoredEpoch = result.current.sessionEpoch;
    await fetchCommunityQuery({ sessionKey: `user-a:${restoredEpoch}`, queryKey: ["list"], loader: async () => "private" });

    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.sessionEpoch).toBe(restoredEpoch);

    await act(async () => { await result.current.signInWithPassword({ email: "a@example.test", password: "secret" }); });
    const reauthenticatedEpoch = result.current.sessionEpoch;
    expect(reauthenticatedEpoch).toBeGreaterThan(restoredEpoch);
    expect(getCommunityQuerySnapshot(`user-a:${restoredEpoch}`, ["list"]).data).toBeNull();

    currentUser = { id: "user-b" };
    await act(async () => { await result.current.refreshUser(); });
    expect(result.current.user.id).toBe("user-b");
    const switchedEpoch = result.current.sessionEpoch;
    expect(switchedEpoch).toBeGreaterThan(reauthenticatedEpoch);

    await fetchCommunityQuery({ sessionKey: `user-b:${switchedEpoch}`, queryKey: ["list"], loader: async () => "private-b" });
    await act(async () => { await result.current.signOut(); });
    const signedOutEpoch = result.current.sessionEpoch;
    expect(result.current.signedIn).toBe(false);
    expect(signedOutEpoch).toBeGreaterThan(switchedEpoch);
    expect(getCommunityQuerySnapshot(`user-b:${switchedEpoch}`, ["list"]).data).toBeNull();

    await act(async () => { await result.current.signInWithPassword({ email: "b@example.test", password: "secret" }); });
    expect(result.current.user.id).toBe("user-a");
    expect(result.current.sessionEpoch).toBeGreaterThan(signedOutEpoch);
  });
});
