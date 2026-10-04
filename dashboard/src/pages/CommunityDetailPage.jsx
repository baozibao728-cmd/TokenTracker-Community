import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRightLeft, Clipboard, LogOut, RefreshCw, Trash2 } from "lucide-react";
import { copy } from "../lib/copy";
import { useCommunityQuery, useCommunityMutation } from "../hooks/use-communities.js";
import { getCommunityDetail, leaveCommunity, createCommunityTransfer, acceptCommunityTransfer, rejectCommunityTransfer, deleteCommunity } from "../lib/api";
import { Button } from "../ui/components/Button.jsx";
import { Card } from "../ui/components/Card.jsx";
import { ConfirmModal } from "../ui/components/ConfirmModal.jsx";
import { LeaderboardAvatar } from "../components/LeaderboardAvatar.jsx";
import { CommunityAccessState, CommunityError, CommunityUpdating, CommunityPagination, TransferRequests, communityDate, communityErrorText, communityInputClass } from "../components/community/CommunityUI.jsx";

import { communityLeaderboardPath } from "../lib/community-leaderboard-navigation.js";

const PAGE_SIZE = 20;

export function CommunityDetailPage({ communityId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [memberPage, setMemberPage] = useState(0);
  const [target, setTarget] = useState(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [notice, setNotice] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const detailLoader = useCallback((accessToken, signal) => getCommunityDetail({ accessToken, signal, communityId, limit: PAGE_SIZE, offset: memberPage * PAGE_SIZE }), [communityId, memberPage]);
  const query = useCommunityQuery(["detail", communityId, null, PAGE_SIZE, memberPage * PAGE_SIZE], detailLoader);
  const mutation = useCommunityMutation(communityId);
  const data = query.data;

  useEffect(() => {
    setMemberPage(0); setTarget(null);
    setConfirmationName(""); setConfirm(null); setNotice(""); setCopyFailed(false);
  }, [communityId, query.sessionKey]);
  useEffect(() => {
    if (data && memberPage > 0 && memberPage * PAGE_SIZE >= data.member_count) setMemberPage(Math.max(0, Math.ceil(data.member_count / PAGE_SIZE) - 1));
  }, [data, memberPage]);
  const refresh = query.reload;
  async function respond(request, accept) {
    setNotice("");
    const result = await mutation.run((accessToken) => (accept ? acceptCommunityTransfer : rejectCommunityTransfer)({ accessToken, requestId: request.id }));
    if (result) {
      setNotice(accept ? copy("communities.transfer.accepted_notice") : copy("communities.transfer.rejected_notice"));
      setConfirm(null); setTarget(null); setConfirmationName("");
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
      setConfirm(null); setTarget(null); setNotice(copy("communities.transfer.sent_notice"));
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
        {location.state?.communityNotice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{copy(location.state.communityNotice === "created" ? "communities.created_notice" : "communities.joined_notice")} <Link className="underline" to={communityLeaderboardPath(communityId)}>{copy("communities.view_leaderboard")}</Link></p> : null}
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
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-oai-gray-200 p-4 dark:border-oai-gray-800">
            <p className="text-sm text-oai-gray-500">{copy("communities.rank_sync_hint")}</p>
            <Button as={Link} to={communityLeaderboardPath(communityId)} variant="secondary" size="sm">{copy("communities.view_leaderboard")}</Button>
          </div>
          <CommunityUpdating query={query} />
          <CommunityError error={query.error} onRetry={query.reload} />
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
