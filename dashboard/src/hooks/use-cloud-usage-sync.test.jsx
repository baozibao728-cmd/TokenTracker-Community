import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountViewProvider } from "../contexts/AccountViewContext.jsx";
import { useCloudUsageSync } from "./use-cloud-usage-sync";
import { getCloudSyncEnabled, setCloudSyncEnabled } from "../lib/cloud-sync-prefs";

const auth = vi.hoisted(() => ({ enabled: true, signedIn: true, loading: false, getAccessToken: vi.fn() }));
vi.mock("../contexts/InsforgeAuthContext", () => ({ useInsforgeAuth: () => auth }));
vi.mock("../contexts/InsforgeAuthContext.jsx", () => ({ useInsforgeAuth: () => auth }));
vi.mock("../lib/local-api-auth", () => ({ getLocalApiAuthHeaders: async () => ({}) }));
vi.mock("../lib/cloud-sync", () => ({ runCloudUsageSyncIfDue: vi.fn() }));
import { runCloudUsageSyncIfDue } from "../lib/cloud-sync";

let mirror;
let fetchMock;
let navigate;
function Screen() {
  navigate = useNavigate();
  useCloudUsageSync();
  return null;
}
function mount(path) {
  window.history.replaceState({}, "", path);
  return render(<AccountViewProvider><MemoryRouter initialEntries={[path]}><Screen /></MemoryRouter></AccountViewProvider>);
}
async function navigateTo(path) {
  window.history.replaceState({}, "", path);
  await act(async () => navigate(path));
}
beforeEach(() => {
  localStorage.clear(); mirror = false; vi.clearAllMocks();
  fetchMock = vi.fn(async (_url, init) => {
    mirror = JSON.parse(String(init.body)).enabled;
    return { ok: true };
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("OAuth relay cloud-sync isolation", () => {
  for (const path of ["/auth/callback", "/auth/native-callback/"]) {
    it.each([null, "1"])(`${path} cannot overwrite native false from browser preference %s`, async (value) => {
      if (value !== null) localStorage.setItem("tokentracker_cloud_sync_enabled", value);
      mount(path);
      await act(async () => {});
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mirror).toBe(false);
      expect(runCloudUsageSyncIfDue).not.toHaveBeenCalled();
    });
    it(`${path} cannot force a native true preference off`, async () => {
      mirror = true;
      localStorage.setItem("tokentracker_cloud_sync_enabled", "0");
      mount(path);
      await act(async () => {});
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mirror).toBe(true);
    });
  }
  it.each(["/dashboard", "/settings"])("%s still initializes and mirrors explicit switches", async (path) => {
    localStorage.setItem("tokentracker_cloud_sync_enabled", "0");
    mount(path);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(mirror).toBe(false);
    act(() => setCloudSyncEnabled(true));
    await waitFor(() => expect(mirror).toBe(true));
    act(() => setCloudSyncEnabled(false));
    await waitFor(() => expect(mirror).toBe(false));
  });
  it("initializes after native callback navigation without remounting the provider", async () => {
    localStorage.setItem("tokentracker_cloud_sync_enabled", "0");
    mount("/auth/callback");
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
    await navigateTo("/dashboard");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(getCloudSyncEnabled()).toBe(false);
    expect(mirror).toBe(false);
    act(() => setCloudSyncEnabled(true));
    await waitFor(() => expect(mirror).toBe(true));
  });
  it("a disabled signed-in dashboard never schedules an upload after the callback", async () => {
    vi.useFakeTimers();
    localStorage.setItem("tokentracker_cloud_sync_enabled", "0");
    mount("/auth/native-callback");
    await navigateTo("/dashboard");
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(runCloudUsageSyncIfDue).not.toHaveBeenCalled();
    expect(auth.getAccessToken).not.toHaveBeenCalled();
  });
  it("checks an explicit opt-out again before a scheduled upload starts", async () => {
    vi.useFakeTimers();
    localStorage.setItem("tokentracker_cloud_sync_enabled", "1");
    mount("/dashboard");
    act(() => setCloudSyncEnabled(false));
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(runCloudUsageSyncIfDue).not.toHaveBeenCalled();
    expect(auth.getAccessToken).not.toHaveBeenCalled();
  });
});
