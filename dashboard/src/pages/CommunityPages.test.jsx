import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "../lib/copy";
import * as api from "../lib/api";
import { CommunityApiError } from "../lib/community-api";
import { CommunitiesPage } from "./CommunitiesPage.jsx";
import { CommunityDetailPage } from "./CommunityDetailPage.jsx";
import { CommunityLeaderboardPage } from "./CommunityLeaderboardPage.jsx";
import { clearAllCommunityQueryCache } from "../lib/community-query-cache.js";

const auth = vi.hoisted(() => ({ enabled: true, signedIn: true, loading: false, user: { id: "user-a" }, getAccessToken: vi.fn() }));
vi.mock("../contexts/InsforgeAuthContext.jsx", () => ({ useInsforgeAuth: () => auth }));
vi.mock("../lib/api", () => ({
  getCommunities: vi.fn(), getCommunityDetail: vi.fn(), getCommunityLeaderboard: vi.fn(),
  createCommunity: vi.fn(), joinCommunity: vi.fn(), leaveCommunity: vi.fn(),
  createCommunityTransfer: vi.fn(), acceptCommunityTransfer: vi.fn(), rejectCommunityTransfer: vi.fn(), deleteCommunity: vi.fn(),
}));

const limits = { max_owned: 2, max_joined: 4, max_members: 80 };
const code = "0123456789ABCDEF0123456789ABCDEF";
const community = { id: "community-a", name: "Friends", description: "A small private circle", owner_id: "user-a", invite_code: code, created_at: "2026-10-01T00:00:00Z" };
const members = [
  { user_id: "user-a", display_name: "Ada", avatar_url: null, joined_at: "2026-10-01T00:00:00Z", is_owner: true },
  { user_id: "user-b", display_name: "Bea", avatar_url: null, joined_at: "2026-10-01T01:00:00Z", is_owner: false },
];
const ownerDetail = { ok: true, community, is_owner: true, members, transfers: [], member_count: 2, limits, owned_count: 1, joined_count: 1 };
const listData = { ok: true, communities: [{ ...community, is_owner: true, member_count: 2 }], incoming_transfers: [], limits, owned_count: 1, joined_count: 1 };
const pending = { id: "transfer-a", community_id: "community-a", from_user_id: "user-a", to_user_id: "user-b", status: "pending", created_at: "2026-10-01T00:00:00Z", expires_at: "2026-10-08T00:00:00Z" };
const row = { user_id: "user-a", display_name: "Ada", avatar_url: null, rank: 1, total_tokens: "9007199254740993" };
const board = { ok: true, community_id: "community-a", period: "week", from_day: "2026-09-28", to_day: "2026-10-04", rows: [row, { ...members[1], total_tokens: "0", rank: 2 }], me: row, member_count: 2, ranked_count: 2, excluded_member_count: 0, basis: "client_reported_tokens", automatic_anticheat: false };

function tree(detail = false) {
  return <MemoryRouter initialEntries={[detail ? "/communities/community-a" : "/communities"]}><Routes>
    <Route path="/communities" element={<CommunitiesPage />} />
    <Route path="/communities/community-a" element={<CommunityDetailPage communityId="community-a" />} />
    <Route path="/leaderboard" element={<CommunityLeaderboardPage />} />
  </Routes></MemoryRouter>;
}
async function detailReady() { await screen.findByRole("heading", { name: community.name }); await screen.findAllByRole("link", { name: copy("communities.view_leaderboard") }); }
function setupUser() {
  const user = userEvent.setup();
  return {
    click: async (...args) => { await act(async () => { await user.click(...args); }); },
    type: async (...args) => { await act(async () => { await user.type(...args); }); },
  };
}

describe("Community pages using existing Edge contracts", () => {
  beforeEach(() => {
    clearAllCommunityQueryCache();
    vi.resetAllMocks();
    Object.assign(auth, { enabled: true, signedIn: true, loading: false, sessionEpoch: 1, user: { id: "user-a" } });
    auth.getAccessToken.mockResolvedValue("synthetic-user-session");
    api.getCommunities.mockResolvedValue(listData);
    api.getCommunityDetail.mockResolvedValue(ownerDetail);
    api.getCommunityLeaderboard.mockResolvedValue(board);
  });
  afterEach(() => { cleanup(); clearAllCommunityQueryCache(); vi.restoreAllMocks(); });

  it("requires cloud sign-in on localhost and does not query an Edge while auth loads", async () => {
    auth.signedIn = false; auth.user = null;
    const view = render(tree());
    expect(screen.getByRole("heading", { name: copy("communities.sign_in_title") })).toBeInTheDocument();
    expect(api.getCommunities).not.toHaveBeenCalled();
    auth.loading = true; view.rerender(tree());
    expect(screen.getByRole("status")).toHaveTextContent(copy("communities.loading"));
    expect(api.getCommunities).not.toHaveBeenCalled();
  });
  it("shows a sign-in action when a previously signed-in session receives Edge 401", async () => {
    api.getCommunities.mockRejectedValue(new CommunityApiError("UNAUTHORIZED", 401));
    render(tree());
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(copy("communities.error.sign_in"));
    expect(within(alert).getByRole("link", { name: copy("communities.sign_in") })).toHaveAttribute("href", "/login");
  });
  it("uses server quota values, disables create at the boundary and keeps existing-membership join available", async () => {
    api.getCommunities.mockResolvedValue({ ...listData, owned_count: 2, joined_count: 4 });
    render(tree()); await screen.findByRole("heading", { name: copy("communities.my_list") });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy("communities.create.submit") })).toBeDisabled();
    const user = setupUser(); await user.type(screen.getByLabelText(copy("communities.join.code")), code);
    expect(screen.getByRole("button", { name: copy("communities.join.submit") })).toBeEnabled();
    expect(screen.getByText(copy("communities.member_count", { count: "2", max: "80" }))).toBeInTheDocument();
  });
  it("creates through Edge with only name/description and navigates to detail", async () => {
    api.createCommunity.mockResolvedValue({ ok: true, community });
    render(tree()); await screen.findByRole("heading", { name: copy("communities.my_list") });
    const user = setupUser();
    await user.type(screen.getByLabelText(copy("communities.create.name")), "  Friends  ");
    await user.type(screen.getByLabelText(copy("communities.create.description")), "Circle");
    await user.click(screen.getByRole("button", { name: copy("communities.create.submit") }));
    await detailReady();
    expect(screen.getAllByRole("link", { name: copy("communities.view_leaderboard") }).every(link => link.getAttribute("href").includes("community=community-a"))).toBe(true);
    expect(api.createCommunity).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", name: "Friends", description: "Circle" });
  });
  it("opens an existing membership after an idempotent join", async () => {
    api.joinCommunity.mockResolvedValue({ ok: true, community_id: community.id, already_member: true });
    render(tree()); await screen.findByRole("heading", { name: copy("communities.my_list") });
    const user = setupUser(); await user.type(screen.getByLabelText(copy("communities.join.code")), code.toLowerCase());
    await user.click(screen.getByRole("button", { name: copy("communities.join.submit") })); await detailReady();
    expect(api.joinCommunity).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", inviteCode: code.toLowerCase() });
  });
  it("offers read retry and safe mutation errors without automatic duplicate creation", async () => {
    api.getCommunities.mockRejectedValueOnce(new CommunityApiError("DATABASE_ERROR", 500));
    render(tree()); await screen.findByRole("alert");
    const user = setupUser(); await user.click(screen.getByRole("button", { name: copy("communities.retry") }));
    await screen.findByRole("heading", { name: copy("communities.my_list") });
    api.createCommunity.mockRejectedValue(new CommunityApiError("OWNED_LIMIT", 409));
    await user.type(screen.getByLabelText(copy("communities.create.name")), "Friends");
    await user.click(screen.getByRole("button", { name: copy("communities.create.submit") }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy("communities.error.owned_limit"));
    expect(api.createCommunity).toHaveBeenCalledTimes(1);
  });
  it("hides invite/owner actions for members and confirms leave", async () => {
    api.getCommunityDetail.mockResolvedValue({ ...ownerDetail, is_owner: false });
    api.leaveCommunity.mockResolvedValue({ ok: true, community_id: community.id });
    render(tree(true)); await detailReady();
    expect(screen.queryByLabelText(copy("communities.invite.title"))).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy("communities.delete.submit") })).not.toBeInTheDocument();
    const user = setupUser(); await user.click(screen.getByRole("button", { name: copy("communities.leave.submit") }));
    expect(api.leaveCommunity).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy("communities.confirm") }));
    await screen.findByRole("heading", { name: copy("communities.my_list") });
    expect(api.leaveCommunity).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", communityId: community.id });
  });
  it("keeps exact bigint text and the current rank outside a paginated leaderboard", async () => {
    api.getCommunityLeaderboard.mockImplementation(async ({ offset }) => ({ ...board, ranked_count: 21, rows: offset ? [] : board.rows }));
    render(tree(true)); await detailReady();
    const user = setupUser();
    await user.click(screen.getByRole("link", { name: copy("communities.view_leaderboard") }));
    await screen.findByText(copy("communities.rank_basis"));
    expect(screen.getAllByText(new Intl.NumberFormat().format(BigInt(row.total_tokens))).length).toBeGreaterThan(0);
    await user.click(within(screen.getByRole("navigation", { name: copy("communities.rank_pagination") })).getByRole("button", { name: copy("leaderboard.pagination.next") }));
    await screen.findByText(copy("communities.rank_empty"));
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(api.getCommunityLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20, period: "week" }));
    await user.click(screen.getByRole("tab", { name: copy("leaderboard.period.month") }));
    await waitFor(() => expect(api.getCommunityLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, period: "month" })));
    await user.click(screen.getByRole("tab", { name: copy("leaderboard.period.total") }));
    await waitFor(() => expect(api.getCommunityLeaderboard).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, period: "total" })));
  });
  it("loads members on the requested page without requesting an unbounded list", async () => {
    api.getCommunityDetail.mockImplementation(async ({ offset }) => ({ ...ownerDetail, member_count: 21, members: offset ? [{ ...members[1], display_name: "Last member" }] : members }));
    render(tree(true)); await detailReady(); const user = setupUser();
    await user.click(within(screen.getByRole("navigation", { name: copy("communities.members_pagination") })).getByRole("button", { name: copy("leaderboard.pagination.next") }));
    await screen.findByText("Last member");
    expect(api.getCommunityDetail).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 20, offset: 20 }));
  });
  it("sends a transfer to the selected backend member after confirmation", async () => {
    api.createCommunityTransfer.mockResolvedValue({ ok: true, transfer: pending });
    render(tree(true)); await detailReady(); const user = setupUser();
    expect(screen.queryByRole("button", { name: copy("communities.leave.submit") })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy("communities.transfer.select_member", { name: "Bea" }) }));
    await user.click(screen.getByRole("button", { name: copy("communities.transfer.send") }));
    api.getCommunityDetail.mockResolvedValue({ ...ownerDetail, transfers: [pending] });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy("communities.confirm") }));
    expect(await screen.findByText(copy("communities.transfer.sent_notice"))).toBeInTheDocument();
    expect(api.createCommunityTransfer).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", communityId: community.id, toUserId: "user-b" });
    expect(await screen.findByText(copy("communities.transfer.pending"))).toBeInTheDocument();
  });
  it("accepts an incoming request and refreshes owner capabilities from the response", async () => {
    const incoming = { ...pending, from_user_id: "user-b", to_user_id: "user-a" };
    api.getCommunityDetail.mockResolvedValue({ ...ownerDetail, is_owner: false, transfers: [incoming] });
    api.acceptCommunityTransfer.mockResolvedValue({ ok: true, owner_id: "user-a", transfer: { ...incoming, status: "accepted" } });
    render(tree(true)); await detailReady(); const user = setupUser();
    await user.click(screen.getByRole("button", { name: copy("communities.transfer.accept") }));
    api.getCommunityDetail.mockResolvedValue(ownerDetail);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy("communities.confirm") }));
    expect(await screen.findByLabelText(copy("communities.invite.title"))).toHaveValue(code);
    expect(screen.getByText(copy("communities.transfer.accepted_notice"))).toBeInTheDocument();
  });
  it("rechecks owner permissions when returning after another member accepts a transfer", async () => {
    render(tree(true)); await detailReady();
    expect(screen.getByLabelText(copy("communities.invite.title"))).toHaveValue(code);
    api.getCommunityDetail.mockResolvedValue({
      ...ownerDetail, is_owner: false,
      community: { ...community, owner_id: "user-b", invite_code: undefined },
      members: members.map((member) => ({ ...member, is_owner: member.user_id === "user-b" })),
    });
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now + 16_000);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(screen.queryByLabelText(copy("communities.invite.title"))).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: copy("communities.leave.submit") })).toBeInTheDocument();
  });
  it("rejects a request from the list and keeps expired requests read-only", async () => {
    api.getCommunities.mockResolvedValue({ ...listData, incoming_transfers: [{ ...pending, to_user_id: "user-a" }, { ...pending, id: "expired", to_user_id: "user-a", status: "expired" }] });
    api.rejectCommunityTransfer.mockResolvedValue({ ok: true });
    render(tree()); await screen.findByText(copy("communities.transfer.expired"));
    expect(screen.getAllByRole("button", { name: copy("communities.transfer.reject") })).toHaveLength(1);
    const user = setupUser(); await user.click(screen.getByRole("button", { name: copy("communities.transfer.reject") }));
    expect(await screen.findByText(copy("communities.transfer.rejected_notice"))).toBeInTheDocument();
    expect(api.rejectCommunityTransfer).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", requestId: pending.id });
  });
  it("requires exact-name confirmation and a dialog before deleting", async () => {
    api.deleteCommunity.mockResolvedValue({ ok: true });
    render(tree(true)); await detailReady(); const user = setupUser();
    const remove = screen.getByRole("button", { name: copy("communities.delete.submit") });
    expect(remove).toBeDisabled();
    await user.type(screen.getByLabelText(copy("communities.delete.confirm_name", { name: "Friends" })), "Friends");
    await user.click(remove); expect(api.deleteCommunity).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: copy("communities.confirm") }));
    await screen.findByRole("heading", { name: copy("communities.my_list") });
    expect(api.deleteCommunity).toHaveBeenCalledWith({ accessToken: "synthetic-user-session", communityId: community.id, confirmationName: "Friends" });
  });
  it("discards late responses after sign-out and never shows the old invite", async () => {
    let resolve;
    api.getCommunityDetail.mockReturnValue(new Promise((r) => { resolve = r; }));
    const view = render(tree(true));
    await waitFor(() => expect(api.getCommunityDetail).toHaveBeenCalled());
    auth.signedIn = false; auth.user = null;
    view.rerender(tree(true));
    await act(async () => { resolve(ownerDetail); });
    expect(screen.getByRole("heading", { name: copy("communities.sign_in_title") })).toBeInTheDocument();
    expect(screen.queryByLabelText(copy("communities.invite.title"))).not.toBeInTheDocument();
    expect(api.getCommunityLeaderboard).not.toHaveBeenCalled();
  });
});
