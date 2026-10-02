import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Clipboard, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { copy } from "../lib/copy";
import { toDisplayNumber } from "../lib/format";
import { useTokenFormat } from "../hooks/useTokenFormat.js";
import { useCommunityQuery, useCommunityMutation } from "../hooks/use-communities.js";
import { getCommunityDetail, getCommunityLeaderboard, leaveCommunity, createCommunityTransfer, acceptCommunityTransfer, rejectCommunityTransfer, deleteCommunity } from "../lib/api";
import { Button } from "../ui/components/Button.jsx";
import { Card } from "../ui/components/Card.jsx";
import { ConfirmModal } from "../ui/components/ConfirmModal.jsx";
import { SegmentedControl } from "../ui/components/SegmentedControl.jsx";
import { LeaderboardAvatar } from "../components/LeaderboardAvatar.jsx";
import { CommunityAccessState, CommunityError, CommunityLoading, CommunityPagination, TransferRequests, communityDate, communityErrorText, communityInputClass } from "../components/community/CommunityUI.jsx";

const PAGE_SIZE = 20;

export function CommunityDetailPage({ communityId }) {
  const navigate = useNavigate();
  const [memberPage, setMemberPage] = useState(0);
  const [rankPage, setRankPage] = useState(0);
  const [period, setPeriod] = useState("week");
  const [target, setTarget] = useState(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const { formatTokens, formatTokensTooltip } = useTokenFormat();
  const detailLoader = useCallback((accessToken, signal) => getCommunityDetail({ accessToken, signal, communityId, limit: PAGE_SIZE, offset: memberPage * PAGE_SIZE }), [communityId, memberPage]);
  const query = useCommunityQuery(detailLoader);
  const rankLoader = useCallback((accessToken, signal) => getCommunityLeaderboard({ accessToken, signal, communityId, period, limit: PAGE_SIZE, offset: rankPage * PAGE_SIZE }), [communityId, period, rankPage]);
  const ranking = useCommunityQuery(rankLoader, { enabled: Boolean(query.data) });
  const mutation = useCommunityMutation(communityId);
  const data = query.data;
  const board = ranking.data;

  useEffect(() => {
    setMemberPage(0); setRankPage(0); setPeriod("week"); setTarget(null);
    setConfirmationName(""); setConfirm(null); setNotice(""); setCopyFailed(false);
  }, [communityId, query.userId]);
  useEffect(() => {
    if (data && memberPage > 0 && memberPage * PAGE_SIZE >= data.member_count) setMemberPage(Math.max(0, Math.ceil(data.member_count / PAGE_SIZE) - 1));
  }, [data, memberPage]);
  useEffect(() => {
    if (board && rankPage > 0 && rankPage * PAGE_SIZE >= board.ranked_count) setRankPage(Math.max(0, Math.ceil(board.ranked_count / PAGE_SIZE) - 1));
  }, [board, rankPage]);

  const refresh = () => { query.reload(); ranking.reload(); };
  async function respond(request, accept) {
    setNotice("");
    const result = await mutation.run((accessToken) => (accept ? acceptCommunityTransfer : rejectCommunityTransfer)({ accessToken, requestId: request.id }));
    if (result) {
      setNotice(accept ? copy("communities.transfer.accepted_notice") : copy("communities.transfer.rejected_notice"));
      setConfirm(null); setTarget(null); setConfirmationName(""); refresh();
    }
  }
  async function confirmAction() {
    if (!confirm || !data) return;
    if (confirm.kind === "accept") { await respond(confirm.request, true); return; }
    setNotice("");
    const result = await mutation.run((accessToken) => {
      if (confirm.kind === "delete") return deleteCommunity({ accessToken, communityId, confirmationName });
      if (confirm.kind === "leave") return leaveCommunity({ accessToken, communityId });
      return createCommunityTransfer({ accessToken, communityId, toUserId: confirm.target.user_id });
    });
    if (result) {
      if (confirm.kind === "delete" || confirm.kind === "leave") { navigate("/communities"); return; }
      setConfirm(null); setTarget(null); setNotice(copy("communities.transfer.sent_notice")); refresh();
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(data.community.invite_code);
      setCopyFailed(false); setNotice(copy("communities.invite.copied"));
    } catch { setCopyFailed(true); }
  }
  const pending = data?.transfers.some((request) => request.status === "pending");
  const dialogTitle = confirm?.kind === "delete" ? copy("communities.delete.title") :
    confirm?.kind === "leave" ? copy("communities.leave.title") :
      confirm?.kind === "accept" ? copy("communities.transfer.accept") : copy("communities.transfer.title");
  const dialogDescription = confirm?.kind === "delete" ? copy("communities.delete.hint") :
    confirm?.kind === "leave" ? copy("communities.leave.hint") :
      confirm?.kind === "accept" ? copy("communities.transfer.accept_hint") :
        copy("communities.transfer.confirm", { name: confirm?.target?.display_name || "" });

  return (
    <main className="flex flex-1 flex-col text-oai-black dark:text-oai-gray-100">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <Link to="/communities" className="inline-flex items-center gap-2 text-sm text-oai-gray-500 hover:text-oai-black dark:hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden />{copy("communities.back")}</Link>
        {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
        <CommunityError error={mutation.error} />
        {!data ? <CommunityAccessState query={query} /> : <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-xs text-oai-gray-500"><span>{copy("communities.private")}</span><span aria-hidden>·</span><span>{data.is_owner ? copy("communities.owner") : copy("communities.member")}</span></div>
              <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{data.community.name}</h1>
              {data.community.description ? <p className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-oai-gray-500">{data.community.description}</p> : null}
              <p className="mt-3 text-xs text-oai-gray-500">{copy("communities.member_count", { count: String(data.member_count), max: String(data.limits.max_members) })}</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={refresh} disabled={mutation.busy}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />{copy("communities.refresh")}</Button>
          </header>
          <section aria-labelledby="community-leaderboard-title" className="overflow-hidden rounded-xl border border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <h2 id="community-leaderboard-title" className="font-semibold">{copy("communities.leaderboard")}</h2>
              <SegmentedControl value={period} onChange={(next) => { setPeriod(next); setRankPage(0); }} ariaLabel={copy("communities.period_label")} options={[
                { id: "week", label: copy("leaderboard.period.week") },
                { id: "month", label: copy("leaderboard.period.month") },
                { id: "total", label: copy("leaderboard.period.total") },
              ]} />
            </div>
            {ranking.loading ? <CommunityLoading /> : null}
            {!ranking.loading && ranking.error ? <div className="px-5 pb-5"><CommunityError error={ranking.error} onRetry={ranking.reload} /></div> : null}
            {!ranking.loading && board ? <>
              <div className="mx-5 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-oai-gray-50 px-4 py-3 dark:bg-oai-gray-950">
                <div><p className="text-xs text-oai-gray-500">{copy("communities.my_rank")}</p><p className="mt-1 text-lg font-semibold tabular-nums">{board.me ? copy("communities.rank", { rank: String(board.me.rank) }) : copy("communities.not_ranked")}</p></div>
                {board.me ? <p className="font-mono text-lg tabular-nums" title={formatTokensTooltip(board.me.total_tokens)}>{toDisplayNumber(board.me.total_tokens)}<span className="ml-2 text-xs text-oai-gray-500">{copy("communities.tokens")}</span></p> : null}
              </div>
              <p className="px-5 pb-3 text-xs text-oai-gray-500">{copy("communities.date_range", { from: board.from_day, to: board.to_day })}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{copy("communities.leaderboard")}</caption>
                  <thead className="border-y border-oai-gray-200 bg-oai-gray-50 text-xs text-oai-gray-500 dark:border-oai-gray-800 dark:bg-oai-gray-950"><tr><th scope="col" className="w-16 px-5 py-3">{copy("leaderboard.column.rank")}</th><th scope="col" className="px-3 py-3">{copy("leaderboard.column.user")}</th><th scope="col" className="px-5 py-3 text-right">{copy("communities.tokens")}</th></tr></thead>
                  <tbody className="divide-y divide-oai-gray-100 dark:divide-oai-gray-800">
                    {board.rows.map((row) => {
                      const formatted = formatTokens(row.total_tokens);
                      const exact = toDisplayNumber(row.total_tokens);
                      return <tr key={row.user_id} className={row.user_id === board.me?.user_id ? "bg-oai-brand-50/50 dark:bg-oai-brand-950/20" : ""}>
                      <td className="px-5 py-4 font-mono tabular-nums text-oai-gray-500">{row.rank}</td>
                      <td className="px-3 py-4"><div className="flex items-center gap-3"><LeaderboardAvatar avatarUrl={row.avatar_url} displayName={row.display_name} seed={row.user_id} /><span className="max-w-48 truncate sm:max-w-md">{row.display_name}</span>{row.user_id === board.me?.user_id ? <span className="text-xs text-oai-gray-500">{copy("communities.you")}</span> : null}</div></td>
                      <td className="px-5 py-4 text-right font-mono tabular-nums" title={formatTokensTooltip(row.total_tokens)}><span>{formatted}</span>{formatted !== exact ? <span className="mt-1 block text-xs text-oai-gray-500">{exact}</span> : null}</td>
                    </tr>;
                    })}
                    {!board.rows.length ? <tr><td colSpan={3} className="px-5 py-10 text-center text-oai-gray-500">{copy("communities.rank_empty")}</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <CommunityPagination page={rankPage} pageSize={PAGE_SIZE} total={board.ranked_count} onChange={setRankPage} label={copy("communities.rank_pagination")} />
              {!board.automatic_anticheat && board.basis === "client_reported_tokens" ? <p className="border-t border-oai-gray-200 px-5 py-3 text-xs text-oai-gray-500 dark:border-oai-gray-800">{copy("communities.rank_basis")}</p> : null}
            </> : null}
          </section>
          <section aria-labelledby="community-members-title" className="overflow-hidden rounded-xl border border-oai-gray-200 bg-white dark:border-oai-gray-800 dark:bg-oai-gray-900">
            <h2 id="community-members-title" className="px-5 py-4 font-semibold">{copy("communities.members")}</h2>
            <ul className="divide-y divide-oai-gray-100 px-5 dark:divide-oai-gray-800">
              {data.members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="flex min-w-0 items-center gap-3"><LeaderboardAvatar avatarUrl={member.avatar_url} displayName={member.display_name} seed={member.user_id} /><div className="min-w-0"><p className="truncate text-sm font-medium">{member.display_name}<span className="ml-2 text-xs font-normal text-oai-gray-500">{member.is_owner ? copy("communities.owner") : copy("communities.member")}</span></p><p className="mt-1 text-xs text-oai-gray-500">{copy("communities.joined_at", { date: communityDate(member.joined_at) })}</p></div></div>
                {data.is_owner && !member.is_owner ? <Button type="button" size="sm" variant="ghost" disabled={mutation.busy || pending} onClick={() => setTarget(member)} aria-label={copy("communities.transfer.select_member", { name: member.display_name })}><ArrowRightLeft className="mr-2 h-3.5 w-3.5" aria-hidden />{copy("communities.transfer.choose")}</Button> : null}
              </li>)}
            </ul>
            <CommunityPagination page={memberPage} pageSize={PAGE_SIZE} total={data.member_count} onChange={setMemberPage} disabled={mutation.busy} label={copy("communities.members_pagination")} />
          </section>
          <Card title={copy("communities.transfer.title")}>
            <TransferRequests requests={data.transfers} members={data.members} userId={query.userId} busy={mutation.busy} onAccept={(request) => setConfirm({ kind: "accept", request })} onReject={(request) => respond(request, false)} />
          </Card>
          {data.is_owner ? <section aria-labelledby="community-owner-title" className="space-y-5">
            <h2 id="community-owner-title" className="text-base font-semibold">{copy("communities.owner_settings")}</h2>
            <div className="grid gap-5 lg:grid-cols-2">
              {data.community.invite_code ? <Card title={copy("communities.invite.title")} subtitle={copy("communities.invite.hint")}><div className="flex items-center gap-2"><input readOnly aria-label={copy("communities.invite.title")} value={data.community.invite_code} spellCheck={false} className={`${communityInputClass} min-w-0 font-mono text-xs`} /><Button type="button" variant="secondary" size="sm" onClick={copyInvite}><Clipboard className="mr-1 h-4 w-4" aria-hidden />{copy("communities.invite.copy")}</Button></div>{copyFailed ? <p role="alert" className="mt-3 text-xs text-oai-gray-500">{copy("communities.invite.copy_failed")}</p> : null}</Card> : null}
              <Card title={copy("communities.transfer.title")} subtitle={copy("communities.transfer.hint")}><p className="text-sm text-oai-gray-500">{target ? copy("communities.transfer.selected", { name: target.display_name }) : copy("communities.transfer.select_hint")}</p><Button type="button" size="sm" variant="secondary" className="mt-4" disabled={mutation.busy || pending || !target} onClick={() => setConfirm({ kind: "transfer", target })}>{copy("communities.transfer.send")}</Button>{pending ? <p className="mt-3 text-xs text-oai-gray-500">{copy("communities.error.transfer_pending")}</p> : null}</Card>
            </div>
            <Card title={copy("communities.delete.title")} subtitle={copy("communities.delete.hint")}>
              <form onSubmit={(event) => { event.preventDefault(); if (confirmationName === data.community.name) setConfirm({ kind: "delete" }); }} className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 text-sm" htmlFor="community-delete-name">{copy("communities.delete.confirm_name", { name: data.community.name })}<input id="community-delete-name" autoComplete="off" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} disabled={mutation.busy} className={`${communityInputClass} mt-2`} /></label>
                <Button type="submit" variant="secondary" disabled={mutation.busy || confirmationName !== data.community.name} className="!border-red-300 !text-red-600 dark:!border-red-800 dark:!text-red-400"><Trash2 className="mr-2 h-4 w-4" aria-hidden />{copy("communities.delete.submit")}</Button>
              </form>
            </Card>
          </section> : <Card title={copy("communities.leave.title")} subtitle={copy("communities.leave.hint")}><Button type="button" variant="secondary" size="sm" disabled={mutation.busy} onClick={() => setConfirm({ kind: "leave" })}><LogOut className="mr-2 h-4 w-4" aria-hidden />{copy("communities.leave.submit")}</Button></Card>}
          <ConfirmModal open={Boolean(confirm && (data.is_owner || confirm.kind === "accept" || confirm.kind === "leave"))} title={dialogTitle} description={dialogDescription} confirmLabel={copy("communities.confirm")} cancelLabel={copy("shared.action.cancel")} destructive={confirm?.kind === "delete"} busy={mutation.busy} error={mutation.error ? communityErrorText(mutation.error) : null} onCancel={() => setConfirm(null)} onConfirm={confirmAction} />
        </>}
      </div>
    </main>
  );
}
