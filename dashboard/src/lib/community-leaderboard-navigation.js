const PERIODS = new Set(["week", "month", "total"]);
export const COMMUNITY_PAGE_SIZES = [10, 20, 50, 100];

export function readCommunityLeaderboardNavigation(search) {
  const params = new URLSearchParams(search);
  const rawPage = Number(params.get("page") || 1);
  const size = Number(params.get("size") || 20);
  return {
    communityId: params.get("community") || "",
    period: PERIODS.has(params.get("period")) ? params.get("period") : "week",
    page: Number.isSafeInteger(rawPage) && rawPage >= 1 && rawPage <= 1_000_000 ? rawPage : 1,
    pageSize: COMMUNITY_PAGE_SIZES.includes(size) ? size : 20,
  };
}

export function communityLeaderboardPath(communityId, { period = "week", page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ scope: "community", community: communityId, period, page: String(page), size: String(pageSize) });
  return `/leaderboard?${params}`;
}
