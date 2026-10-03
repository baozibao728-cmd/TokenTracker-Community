import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCloudSyncEnabled, syncCloudSyncPrefToLocalServer } from "./cloud-sync-prefs";

const headers = vi.hoisted(() => ({ get: vi.fn(async () => ({})) }));
vi.mock("./local-api-auth", () => ({ getLocalApiAuthHeaders: headers.get }));

beforeEach(() => {
  localStorage.clear(); headers.get.mockReset(); headers.get.mockResolvedValue({});
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true })));
});
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, "", "/"); });
async function settle() { await new Promise((resolve) => setTimeout(resolve, 0)); }

describe("all preference mirror writers respect OAuth relay routes", () => {
  it.each(["/auth/callback", "/auth/native-callback/"])("%s blocks initialization and explicit mirroring", async (path) => {
    window.history.replaceState({}, "", path);
    syncCloudSyncPrefToLocalServer();
    setCloudSyncEnabled(true);
    setCloudSyncEnabled(false);
    await settle();
    expect(headers.get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("blocks a pending write if navigation enters a relay while local headers resolve", async () => {
    window.history.replaceState({}, "", "/settings");
    let resolveHeaders!: (value: Record<string, string>) => void;
    headers.get.mockImplementation(() => new Promise((resolve) => { resolveHeaders = resolve; }));
    syncCloudSyncPrefToLocalServer();
    await settle();
    expect(headers.get).toHaveBeenCalledOnce();
    window.history.replaceState({}, "", "/auth/callback");
    resolveHeaders({});
    await settle();
    expect(fetch).not.toHaveBeenCalled();
  });
});
