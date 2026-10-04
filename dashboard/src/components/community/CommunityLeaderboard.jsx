import React, { useCallback, useEffect } from "react";
import { getCommunityLeaderboard } from "../../lib/api";
import { copy } from "../../lib/copy";
import { toDisplayNumber } from "../../lib/format";
import { cn } from "../../lib/cn";
import { useCommunityQuery } from "../../hooks/use-communities.js";
import { useTokenFormat } from "../../hooks/useTokenFormat.js";
import { LeaderboardAvatar } from "../LeaderboardAvatar.jsx";
import { LeaderboardMeChip } from "../LeaderboardSummaryCard.jsx";
import { Select } from "../../ui/components/Select.jsx";
import { LB_STICKY_TH_RANK, LB_STICKY_TH_USER, lbStickyTdRank, lbStickyTdUser } from "../../lib/leaderboard-columns.js";
import { COMMUNITY_PAGE_SIZES } from "../../lib/community-leaderboard-navigation.js";
import { CommunityAccessState, CommunityError, CommunityPagination, CommunityUpdating } from "./CommunityUI.jsx";

// A single board renderer for the unified leaderboard. Ranks and me are always
// read from the Community Edge response, including dense ties and zero usage.
export function CommunityLeaderboard({ communityId, period, page, pageSize, onPageChange, onPageSizeChange }) {
  const offset = (page - 1) * pageSize;
  const loader = useCallback((accessToken, signal) => getCommunityLeaderboard({ accessToken, signal, communityId, period, limit: pageSize, offset }), [communityId, period, pageSize, offset]);
  const query = useCommunityQuery(["leaderboard", communityId, period, pageSize, offset], loader);
  const { formatTokens, formatTokensTooltip } = useTokenFormat();
  const board = query.data;
  useEffect(() => {
    if (board && page > 1 && offset >= board.ranked_count) {
      onPageChange(Math.max(1, Math.ceil(board.ranked_count / pageSize)), true);
    }
  }, [board, offset, page, pageSize, onPageChange]);
  if (!board) { return <CommunityAccessState query={query} />; }
  return <section aria-label={copy("communities.leaderboard")} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-oai-gray-500">
      <p>{copy("communities.date_range", { from: board.from_day, to: board.to_day })}</p>
      <div className="flex flex-wrap items-center gap-3">
        <span>{copy("communities.rank_members", { count: String(board.member_count) })}</span>
        <LeaderboardMeChip me={board.me} totalEntries={board.ranked_count} meLabel={copy("communities.you")} canJump={false} showPercentile={false} />
        {board.me ? <span className="tabular-nums" title={formatTokensTooltip(board.me.total_tokens)}>{toDisplayNumber(board.me.total_tokens)} {copy("communities.tokens")}</span> : <span>{copy("communities.not_ranked")}</span>}
      </div>
    </div>
    <CommunityUpdating query={query} />
    <CommunityError error={query.error} onRetry={query.reload} />
    <div className="overflow-hidden rounded-xl border border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-950">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{copy("communities.leaderboard")}</caption>
          <thead className="border-b border-oai-gray-200 dark:border-oai-gray-800"><tr>
            <th scope="col" className={cn(LB_STICKY_TH_RANK, "text-[11px] font-semibold uppercase tracking-wider text-oai-gray-400")}>{copy("leaderboard.column.rank")}</th>
            <th scope="col" className={cn(LB_STICKY_TH_USER, "text-[11px] font-semibold uppercase tracking-wider text-oai-gray-400")}>{copy("leaderboard.column.user")}</th>
            <th scope="col" className="px-3 py-4 text-right text-[11px] font-semibold uppercase tracking-wider text-oai-gray-400 sm:px-4">{copy("communities.tokens")}</th>
          </tr></thead>
          <tbody className="divide-y divide-oai-gray-100 dark:divide-oai-gray-800/50">
            {board.rows.map((row) => {
              const isMe = row.user_id === board.me?.user_id;
              const exact = toDisplayNumber(row.total_tokens);
              const formatted = formatTokens(row.total_tokens);
              return <tr key={row.user_id} data-current-user={isMe || undefined} className={cn("group transition-colors", isMe ? "bg-oai-brand-50 dark:bg-oai-brand-900/10" : "hover:bg-oai-gray-50 dark:hover:bg-oai-gray-900/60")}>
                <td className={cn(lbStickyTdRank(isMe), "font-medium tabular-nums", isMe ? "text-oai-brand-600 dark:text-oai-brand-400" : "text-oai-gray-500")}>{row.rank}</td>
                <td className={lbStickyTdUser(isMe)}><div className="flex min-w-0 items-center gap-2"><LeaderboardAvatar avatarUrl={row.avatar_url} displayName={row.display_name} seed={row.user_id} /><span className={cn("truncate font-medium", isMe && "font-semibold")}>{row.display_name}</span>{isMe ? <span className="shrink-0 text-xs text-oai-gray-500">{copy("communities.you")}</span> : null}</div></td>
                <td title={formatTokensTooltip(row.total_tokens)} className="whitespace-nowrap px-3 py-4 text-right font-semibold tabular-nums sm:px-4">{formatted}{formatted !== exact ? <span className="mt-1 block text-xs font-normal text-oai-gray-500">{exact}</span> : null}</td>
              </tr>;
            })}
            {!board.rows.length ? <tr><td colSpan={3} className="px-6 py-12 text-center text-oai-gray-500">{copy("communities.rank_empty")}</td></tr> : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 px-4 pt-3 text-sm text-oai-gray-500">
        <label htmlFor="community-board-page-size">{copy("leaderboard.pagination.page_size_label")}</label>
        <Select id="community-board-page-size" ariaLabel={copy("leaderboard.pagination.page_size_label")} value={pageSize} onValueChange={(value) => onPageSizeChange(Number(value))} options={COMMUNITY_PAGE_SIZES.map(value => ({ value, label: String(value) }))} />
      </div>
      <CommunityPagination page={page - 1} pageSize={pageSize} total={board.ranked_count} onChange={(next) => onPageChange(next + 1)} label={copy("communities.rank_pagination")} />
    </div>
    <p className="text-xs leading-5 text-oai-gray-500">{copy("communities.rank_sync_hint")}</p>
    {!board.automatic_anticheat && board.basis === "client_reported_tokens" ? <p className="text-xs text-oai-gray-500">{copy("communities.rank_basis")}</p> : null}
  </section>;
}
