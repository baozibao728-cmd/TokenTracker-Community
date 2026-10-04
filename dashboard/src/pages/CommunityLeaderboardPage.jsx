import React, { useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { getCommunities } from "../lib/api";
import { copy } from "../lib/copy";
import { communityLeaderboardPath, readCommunityLeaderboardNavigation } from "../lib/community-leaderboard-navigation.js";
import { useCommunityQuery } from "../hooks/use-communities.js";
import { Button } from "../ui/components/Button.jsx";
import { Select } from "../ui/components/Select.jsx";
import { SegmentedControl } from "../ui/components/SegmentedControl.jsx";
import { CommunityAccessState, CommunityError, CommunityLoading, CommunityUpdating } from "../components/community/CommunityUI.jsx";
import { CommunityLeaderboard } from "../components/community/CommunityLeaderboard.jsx";
import { LeaderboardScopeControl } from "../components/leaderboard/LeaderboardScopeControl.jsx";
import { invalidateCommunityQueries } from "../lib/community-query-cache.js";

// Paginate the existing membership API so a configured quota above 100 never
// silently removes communities from the selector. 100 is the Edge page limit,
// not a membership or ownership quota.
async function loadMemberships(accessToken, signal) {
  const limit = 100;
  let offset = 0;
  let result;
  const communities = [];
  do {
    result = await getCommunities({ accessToken, signal, limit, offset });
    communities.push(...result.communities);
    offset += result.communities.length;
  } while (result.communities.length === limit && offset < result.joined_count);
  return { ...result, communities };
}

export function CommunityLeaderboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { communityId, period, page, pageSize } = readCommunityLeaderboardNavigation(location.search);
  const query = useCommunityQuery(["memberships"], loadMemberships);
  const memberships = query.data?.communities || [];
  const selected = memberships.find(item => item.id === communityId);
  const change = useCallback((values, replace = false) => {
    navigate(communityLeaderboardPath(values.communityId ?? communityId, {
      period: values.period ?? period,
      page: values.page ?? page,
      pageSize: values.pageSize ?? pageSize,
    }), { replace });
  }, [communityId, period, page, pageSize, navigate]);
  const changePage = useCallback((next, replace = false) => change({ page: next }, replace), [change]);
  useEffect(() => {
    if (!communityId && memberships.length) change({ communityId: memberships[0].id, page: 1 }, true);
  }, [communityId, memberships, change]);
  const refresh = () => {
    invalidateCommunityQueries(query.sessionKey);
  };
  return <div className="flex flex-1 flex-col font-oai text-oai-black antialiased dark:text-oai-white">
    <main className="flex-1 pb-12 pt-8 sm:pb-16 sm:pt-10">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy("leaderboard.title")}</h1><LeaderboardScopeControl /></div>
          <Button type="button" size="sm" variant="secondary" onClick={refresh} disabled={query.authRequired || query.loading || query.refreshing}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />{copy("communities.refresh")}</Button>
        </header>
        {!query.data ? <CommunityAccessState query={query} /> : <>
          <CommunityUpdating query={query} />
          <CommunityError error={query.error} onRetry={query.reload} />
          {memberships.length ? <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <label htmlFor="leaderboard-community" className="text-sm text-oai-gray-500">{copy("communities.choose")}</label>
              <Select id="leaderboard-community" value={selected?.id || null} ariaLabel={copy("communities.choose")} className="min-w-40 max-w-full sm:max-w-sm" onValueChange={(id) => change({ communityId: id, page: 1 })} options={memberships.map(item => ({ value: item.id, label: item.name }))} />
            </div>
            <SegmentedControl value={period} ariaLabel={copy("communities.period_label")} onChange={(next) => change({ period: next, page: 1 })} options={["week", "month", "total"].map(id => ({ id, label: copy(`leaderboard.period.${id}`) }))} />
          </div> : null}
          {!memberships.length ? (query.refreshing ? <CommunityLoading /> : <div className="rounded-xl border border-dashed border-oai-gray-300 p-10 text-center dark:border-oai-gray-700"><p className="mb-4 text-sm text-oai-gray-500">{copy("communities.no_memberships")}</p><Button as={Link} to="/communities">{copy("communities.memberships")}</Button></div>) : <>{!selected ? (query.refreshing ? <CommunityLoading /> : <div role="alert" className="space-y-4 rounded-xl border border-oai-gray-200 p-6 dark:border-oai-gray-800"><p className="text-sm text-oai-gray-500">{copy("communities.rank_unavailable")}</p><Button as={Link} to="/communities" variant="secondary">{copy("communities.memberships")}</Button></div>) : <>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{selected.name}</h2><Link to={`/communities/${selected.id}`} className="text-sm text-oai-gray-500 hover:underline">{copy("communities.manage")}</Link></div>
            <CommunityLeaderboard communityId={selected.id} period={period} page={page} pageSize={pageSize} onPageChange={changePage} onPageSizeChange={(size) => change({ pageSize: size, page: 1 })} />
          </>}</>}
        </>}
      </div>
    </main>
  </div>;
}
