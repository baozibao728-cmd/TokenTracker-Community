import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityLeaderboardPage } from "./CommunityLeaderboardPage.jsx";
import { LeaderboardScopeControl } from "../components/leaderboard/LeaderboardScopeControl.jsx";
import { clearAllCommunityQueryCache, fetchCommunityQuery, invalidateCommunityQueries } from "../lib/community-query-cache.js";
import { communityLeaderboardPath, readCommunityLeaderboardNavigation } from "../lib/community-leaderboard-navigation.js";
import { CommunityApiError } from "../lib/community-api";
import { copy } from "../lib/copy";
import * as api from "../lib/api";

const auth = vi.hoisted(() => ({ enabled: true, signedIn: true, loading: false, sessionEpoch: 1, user: { id: "user-a" }, getAccessToken: vi.fn() }));
vi.mock("../contexts/InsforgeAuthContext.jsx", () => ({ useInsforgeAuth: () => auth }));
vi.mock("../lib/api", () => ({ getCommunities: vi.fn(), getCommunityLeaderboard: vi.fn() }));
const memberships = [
  { id: "community-a", name: "Owned circle", is_owner: true },
  { id: "community-b", name: "Joined circle", is_owner: false },
];
const list = { communities: memberships, joined_count: 2, owned_count: 1, limits: { max_owned: 10, max_joined: 20, max_members: 2000 } };
const me = { user_id: "user-a", display_name: "Ada", rank: 4, total_tokens: "9007199254740993", avatar_url: null };
const board = { community_id: "community-a", period: "week", rows: [{ ...me, rank: 1 }, { user_id: "user-b", display_name: "Bea", rank: 1, total_tokens: "9007199254740993" }, { user_id: "user-c", display_name: "Zero", rank: 2, total_tokens: "0" }], me, member_count: 41, ranked_count: 41, from_day: "2026-09-28", to_day: "2026-10-04", basis: "client_reported_tokens", automatic_anticheat: false };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function Navigation() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>{"Back"}</button><button onClick={() => navigate(1)}>{"Forward"}</button></>;
}
function TestRoute() {
  const location = useLocation();
  return new URLSearchParams(location.search).get("scope") === "community" ? <CommunityLeaderboardPage /> : <LeaderboardScopeControl />;
}
function tree(path = communityLeaderboardPath("community-a")) {
  return <MemoryRouter initialEntries={[path]}><Navigation /><Routes><Route path="/leaderboard" element={<TestRoute />} /><Route path="/communities" element={<div>{"Management"}</div>} /></Routes></MemoryRouter>;
}
const ready = () => screen.findByRole("table", { name: copy("communities.leaderboard") });
function setupUser() {
  const user = userEvent.setup();
  return { click: async (...args) => { await act(async () => { await user.click(...args); }); } };
}
const choose = async (user, name) => { await user.click(screen.getByRole("combobox", { name: copy("communities.choose") })); await user.click(await screen.findByRole("option", { name })); };

beforeEach(() => {
  clearAllCommunityQueryCache(); vi.resetAllMocks();
  Object.assign(auth, { enabled: true, signedIn: true, loading: false, sessionEpoch: 1, user: { id: "user-a" } });
  auth.getAccessToken.mockResolvedValue("synthetic-session");
  api.getCommunities.mockResolvedValue(list);
  api.getCommunityLeaderboard.mockImplementation(async ({ communityId, period }) => ({ ...board, community_id: communityId, period }));
});
afterEach(() => { cleanup(); clearAllCommunityQueryCache(); vi.restoreAllMocks(); });

describe("Unified community leaderboard navigation and server data", () => {
  it("normalizes malformed navigation without changing the server ranking", () => {
    expect(readCommunityLeaderboardNavigation("?community=x&period=bad&page=-2&size=999")).toEqual({ communityId: "x", period: "week", page: 1, pageSize: 20 });
    expect(readCommunityLeaderboardNavigation("?community=x&period=total&page=3&size=10")).toEqual({ communityId: "x", period: "total", page: 3, pageSize: 10 });
  });
  it("opens a direct link at its selected community, period and page", async () => {
    render(tree(communityLeaderboardPath("community-b", { period: "month", page: 2, pageSize: 10 })));
    await ready();
    expect(screen.getByRole("heading", { name: "Joined circle" })).toBeInTheDocument();
    expect(api.getCommunityLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ communityId: "community-b", period: "month", limit: 10, offset: 10 }));
  });
  it("renders only API rank/user/token columns, dense ties, zero usage and exact bigint", async () => {
    render(tree()); const table = await ready();
    expect(within(table).getAllByRole("columnheader")).toHaveLength(3);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map(row => within(row).getAllByRole("cell")[0].textContent)).toEqual(["1", "1", "2"]);
    expect(rows[0]).toHaveAttribute("data-current-user", "true");
    expect(within(table).getByText("Zero")).toBeInTheDocument();
    expect(screen.getByText("#4")).toBeInTheDocument(); // me comes from the API, not row position.
    expect(screen.queryByText(/Top \d+%/)).not.toBeInTheDocument();
    expect(screen.getAllByText(new Intl.NumberFormat().format(BigInt(me.total_tokens))).length).toBeGreaterThan(0);
    expect(within(table).getAllByRole("columnheader").map(node => node.textContent)).toEqual([copy("leaderboard.column.rank"), copy("leaderboard.column.user"), copy("communities.tokens")]);
  });
  it("resets pagination on period/community changes and restores browser history", async () => {
    render(tree(communityLeaderboardPath("community-a", { page: 2 }))); await ready();
    const user = setupUser();
    await user.click(screen.getByRole("tab", { name: copy("leaderboard.period.month") }));
    await waitFor(() => expect(api.getCommunityLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ communityId: "community-a", period: "month", offset: 0 })));
    await choose(user, "Joined circle");
    await screen.findByRole("heading", { name: "Joined circle" });
    expect(screen.getByTestId("location")).toHaveTextContent("community=community-b&period=month&page=1");
    await user.click(screen.getByRole("button", { name: "Back" }));
    await screen.findByRole("heading", { name: "Owned circle" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("location")).toHaveTextContent("period=week&page=2");
    await user.click(screen.getByRole("button", { name: "Forward" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("period=month&page=1"));
  });
  it("keeps community selection when toggling scopes and uses the same board on return", async () => {
    render(tree(communityLeaderboardPath("community-b"))); await ready(); const user = setupUser();
    await user.click(screen.getByRole("tab", { name: copy("leaderboard.scope.global") }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: copy("leaderboard.scope.community") }));
    await ready(); expect(screen.getByRole("heading", { name: "Joined circle" })).toBeInTheDocument();
    expect(api.getCommunities).toHaveBeenCalledTimes(1);
    expect(api.getCommunityLeaderboard).toHaveBeenCalledTimes(1);
  });
  it("selects an owned membership on first entry and persists it in the URL", async () => {
    render(tree("/leaderboard?scope=community")); await ready();
    expect(screen.getByTestId("location")).toHaveTextContent("community=community-a");
    expect(screen.getByRole("combobox", { name: copy("communities.choose") })).toHaveTextContent("Owned circle");
  });
  it("shows login, no-membership and unavailable-link states without querying the wrong community", async () => {
    auth.signedIn = false; auth.user = null; const view = render(tree());
    expect(screen.getByRole("link", { name: copy("communities.sign_in") })).toHaveAttribute("href", "/login");
    expect(api.getCommunities).not.toHaveBeenCalled();
    Object.assign(auth, { signedIn: true, user: { id: "user-a" } });
    api.getCommunities.mockResolvedValue({ ...list, communities: [], joined_count: 0 });
    view.rerender(tree()); await screen.findByText(copy("communities.no_memberships"));
    expect(api.getCommunityLeaderboard).not.toHaveBeenCalled();
    cleanup(); clearAllCommunityQueryCache(); api.getCommunities.mockResolvedValue(list);
    render(tree(communityLeaderboardPath("deleted-circle"))); await screen.findByText(copy("communities.rank_unavailable"));
    expect(api.getCommunityLeaderboard).not.toHaveBeenCalled();
  });
  it("includes memberships beyond the Edge page limit without inventing a quota", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `circle-${i}`, name: `Circle ${i}` }));
    api.getCommunities.mockImplementation(async ({ offset }) => ({ ...list, joined_count: 101, communities: offset ? [memberships[1]] : first }));
    render(tree(communityLeaderboardPath("community-b"))); await ready();
    expect(api.getCommunities).toHaveBeenCalledTimes(2);
    expect(api.getCommunities).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, offset: 100 }));
  });
});

describe("Community board refresh and permission states", () => {
  it.each(["top-bar refresh", "cache invalidation"])("settles after %s of a blocked session without automatic retries", async (trigger) => {
    const onRender = vi.fn(() => {
      if (onRender.mock.calls.length > 40) throw new Error("Community refresh exceeded render budget");
    });
    api.getCommunities.mockRejectedValueOnce(new CommunityApiError("UNAUTHORIZED", 401));
    render(<React.Profiler id="blocked-community" onRender={onRender}>{tree()}</React.Profiler>);
    await screen.findByRole("link", { name: copy("communities.sign_in") });
    onRender.mockClear();
    if (trigger === "top-bar refresh") {
      await setupUser().click(screen.getByRole("button", { name: copy("communities.refresh") }));
    } else {
      act(() => invalidateCommunityQueries("user-a:1"));
    }
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
    const settledRenders = onRender.mock.calls.length;
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise(resolve => setTimeout(resolve, 25)); });
    expect(onRender.mock.calls.length).toBe(settledRenders);
    expect(api.getCommunities).toHaveBeenCalledTimes(1);
    expect(api.getCommunityLeaderboard).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: copy("communities.sign_in") })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each(["explicit retry", "new login"])("recovers a blocked page after %s and resumes TTL reuse", async (recovery) => {
    api.getCommunities.mockRejectedValueOnce(new CommunityApiError("UNAUTHORIZED", 401));
    const view = render(tree());
    await screen.findByRole("link", { name: copy("communities.sign_in") });
    expect(api.getCommunities).toHaveBeenCalledTimes(1);
    if (recovery === "explicit retry") {
      await setupUser().click(screen.getByRole("button", { name: copy("communities.retry") }));
    } else {
      auth.sessionEpoch += 1;
      view.rerender(tree());
    }
    await ready();
    expect(screen.getByRole("heading", { name: "Owned circle" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(api.getCommunities).toHaveBeenCalledTimes(2);
    expect(api.getCommunityLeaderboard).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event("focus")));
    expect(api.getCommunities).toHaveBeenCalledTimes(2);
    expect(api.getCommunityLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("waits for invalidated memberships before declaring a newly created community unavailable", async () => {
    await fetchCommunityQuery({ sessionKey: "user-a:1", queryKey: ["memberships"], loader: async () => ({ ...list, communities: [memberships[0]], joined_count: 1 }) });
    invalidateCommunityQueries("user-a:1");
    const pending = deferred(); api.getCommunities.mockReturnValueOnce(pending.promise);
    render(tree(communityLeaderboardPath("community-b")));
    await waitFor(() => expect(api.getCommunities).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(copy("communities.rank_unavailable"))).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(api.getCommunityLeaderboard).not.toHaveBeenCalled();
    await act(async () => pending.resolve(list));
    await ready();
    expect(screen.getByRole("heading", { name: "Joined circle" })).toBeInTheDocument();
    expect(api.getCommunityLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ communityId: "community-b" }));
  });
  it("keeps loaded rows during manual refresh and failure, then retries explicitly", async () => {
    render(tree()); await ready(); const user = setupUser(); const pending = deferred();
    api.getCommunityLeaderboard.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole("button", { name: copy("communities.refresh") }));
    await waitFor(() => expect(api.getCommunityLeaderboard).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("status").some(node => node.textContent.includes(copy("communities.refreshing")))).toBe(true);
    await act(async () => pending.reject(new CommunityApiError("NETWORK_ERROR", 0)));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy("communities.error.network"));
    expect(screen.getByRole("table")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy("communities.retry") }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api.getCommunityLeaderboard).toHaveBeenCalledTimes(3);
  });
  it("clears private rows on Edge 401 and provides a login action", async () => {
    render(tree()); await ready(); api.getCommunityLeaderboard.mockRejectedValueOnce(new CommunityApiError("UNAUTHORIZED", 401));
    await setupUser().click(screen.getByRole("button", { name: copy("communities.refresh") }));
    await screen.findByRole("link", { name: copy("communities.sign_in") });
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });
  it("clears an unavailable community, refreshes memberships and retains the unavailable URL", async () => {
    render(tree()); await ready();
    api.getCommunityLeaderboard.mockRejectedValueOnce(new CommunityApiError("COMMUNITY_UNAVAILABLE", 404));
    api.getCommunities.mockResolvedValue({ ...list, communities: [memberships[1]], joined_count: 1 });
    await setupUser().click(screen.getByRole("button", { name: copy("communities.refresh") }));
    await screen.findByText(copy("communities.rank_unavailable"));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("community=community-a");
  });
  it("does not carry account A rows into account B while a request is pending", async () => {
    const pending = deferred(); api.getCommunityLeaderboard.mockReturnValueOnce(pending.promise);
    const view = render(tree()); await waitFor(() => expect(api.getCommunityLeaderboard).toHaveBeenCalled());
    Object.assign(auth, { user: { id: "user-b" }, sessionEpoch: 2 });
    api.getCommunities.mockResolvedValue({ ...list, communities: [], joined_count: 0 }); view.rerender(tree());
    await screen.findByText(copy("communities.no_memberships"));
    await act(async () => pending.resolve(board));
    expect(screen.queryByRole("table")).not.toBeInTheDocument(); expect(screen.queryByText("Ada")).not.toBeInTheDocument();
  });
});
