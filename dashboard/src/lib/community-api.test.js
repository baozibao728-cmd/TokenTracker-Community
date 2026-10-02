import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./community-api";

const encode = (value) => btoa(JSON.stringify(value)).replace(/=/g, "");
const token = `${encode({ alg: "RS256" })}.${encode({ sub: "00000000-0000-4000-8000-000000000001" })}.synthetic-signature`;

describe("Community Edge transport", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_INSFORGE_BASE_URL", "https://community.example");
    vi.stubEnv("VITE_TOKENTRACKER_BACKEND_BASE_URL", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) }));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses only the configured cloud Edge and a real session header", async () => {
    await api.getCommunityLeaderboard({ accessToken: token, communityId: "community-1", period: "month", limit: 20, offset: 40, user_id: "spoof", max_owned: 999 });
    const [url, options] = fetch.mock.calls[0];
    expect(url.origin).toBe("https://community.example");
    expect(url.pathname).toBe("/functions/tokentracker-community-leaderboard");
    expect(Object.fromEntries(url.searchParams)).toEqual({ community_id: "community-1", period: "month", limit: "20", offset: "40" });
    expect(options).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit", headers: { Authorization: `Bearer ${token}` } });
    expect(options.headers.apikey).toBeUndefined();
  });

  it.each([
    ["getCommunities", "community-detail", {}, undefined],
    ["getCommunityDetail", "community-detail", { communityId: "c" }, undefined],
    ["createCommunity", "create-community", { name: "Friends", description: "Small circle" }, { name: "Friends", description: "Small circle" }],
    ["joinCommunity", "join-community", { inviteCode: "invite" }, { invite_code: "invite" }],
    ["leaveCommunity", "leave-community", { communityId: "c" }, { community_id: "c" }],
    ["createCommunityTransfer", "create-community-transfer", { communityId: "c", toUserId: "b" }, { community_id: "c", to_user_id: "b" }],
    ["acceptCommunityTransfer", "accept-community-transfer", { requestId: "r" }, { request_id: "r" }],
    ["rejectCommunityTransfer", "reject-community-transfer", { requestId: "r" }, { request_id: "r" }],
    ["deleteCommunity", "delete-community", { communityId: "c", confirmationName: "Friends" }, { community_id: "c", confirmation_name: "Friends" }],
  ])("%s preserves the existing request contract", async (name, slug, params, body) => {
    await api[name]({ accessToken: token, ...params, user_id: "spoof", p_actor: "spoof", limits: { max_owned: 999 } });
    const [url, options] = fetch.mock.calls[0];
    expect(url.pathname).toBe(`/functions/tokentracker-${slug}`);
    expect(options.method).toBe(body ? "POST" : "GET");
    expect(options.body ? JSON.parse(options.body) : undefined).toEqual(body);
  });

  it("does not fall back to upstream or localhost when configuration is absent", async () => {
    vi.stubEnv("VITE_INSFORGE_BASE_URL", "");
    await expect(api.getCommunities({ accessToken: token })).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv("VITE_TOKENTRACKER_BACKEND_BASE_URL", "https://self.example/");
    expect(api.getCommunityBaseUrl()).toBe("https://self.example");
  });
  it.each(["http://community.example", "https://user:pass@community.example", "https://community.example/path", "https://community.example/?key=value"])("rejects invalid base URL %s", (url) => {
    vi.stubEnv("VITE_INSFORGE_BASE_URL", url);
    expect(() => api.getCommunityBaseUrl()).toThrow("NOT_CONFIGURED");
  });
  it.each(["", "opaque-anon-credential"])("requires a JWT even on localhost (%s)", async (accessToken) => {
    await expect(api.createCommunity({ accessToken, name: "Friends" })).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("preserves business error codes without exposing database diagnostics", async () => {
    fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ ok: false, error: { code: "OWNED_LIMIT", detail: "private SQL" } }) });
    await expect(api.createCommunity({ accessToken: token, name: "Friends" })).rejects.toMatchObject({ code: "OWNED_LIMIT", message: "OWNED_LIMIT", status: 409 });
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: { code: "private SQL or credential" } }) });
    await expect(api.getCommunities({ accessToken: token })).rejects.toMatchObject({ code: "REQUEST_FAILED", message: "REQUEST_FAILED" });
  });
  it("surfaces expired session responses for the sign-in state", async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: "opaque gateway error" }) });
    await expect(api.getCommunities({ accessToken: token })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });
  it("keeps decimal Token strings intact and never retries a failed POST", async () => {
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, rows: [{ total_tokens: "9007199254740993" }] }) });
    expect((await api.getCommunityLeaderboard({ accessToken: token, communityId: "c", period: "total" })).rows[0].total_tokens).toBe("9007199254740993");
    fetch.mockRejectedValue(new Error("private network detail"));
    await expect(api.createCommunity({ accessToken: token, name: "Friends" })).rejects.toMatchObject({ code: "NETWORK_ERROR", message: "NETWORK_ERROR" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
