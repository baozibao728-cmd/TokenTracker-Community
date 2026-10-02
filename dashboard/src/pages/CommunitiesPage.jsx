import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, KeyRound, Plus, RefreshCw, Users } from "lucide-react";
import { copy } from "../lib/copy";
import { getCommunities, createCommunity, joinCommunity, acceptCommunityTransfer, rejectCommunityTransfer } from "../lib/api";
import { useCommunityQuery, useCommunityMutation } from "../hooks/use-communities.js";
import { Button } from "../ui/components/Button.jsx";
import { Card } from "../ui/components/Card.jsx";
import { CommunityAccessState, CommunityError, CommunityPagination, TransferRequests, communityInputClass } from "../components/community/CommunityUI.jsx";

const PAGE_SIZE = 20;

export function CommunitiesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState("");
  const loader = useCallback((accessToken, signal) => getCommunities({ accessToken, signal, limit: PAGE_SIZE, offset: page * PAGE_SIZE }), [page]);
  const query = useCommunityQuery(loader);
  const mutation = useCommunityMutation("list");
  const data = query.data;

  useEffect(() => { setPage(0); setName(""); setDescription(""); setInviteCode(""); setNotice(""); }, [query.userId]);
  useEffect(() => {
    if (data && page > 0 && page * PAGE_SIZE >= data.joined_count) setPage(Math.max(0, Math.ceil(data.joined_count / PAGE_SIZE) - 1));
  }, [data, page]);

  async function create(event) {
    event.preventDefault(); setNotice("");
    const result = await mutation.run((accessToken) => createCommunity({ accessToken, name: name.trim(), description: description.trim() }));
    if (result) navigate(`/communities/${result.community.id}`);
  }
  async function join(event) {
    event.preventDefault(); setNotice("");
    const result = await mutation.run((accessToken) => joinCommunity({ accessToken, inviteCode: inviteCode.trim() }));
    if (result) navigate(`/communities/${result.community_id}`);
  }
  async function respond(request, accept) {
    setNotice("");
    const result = await mutation.run((accessToken) => (accept ? acceptCommunityTransfer : rejectCommunityTransfer)({ accessToken, requestId: request.id }));
    if (result) {
      setNotice(accept ? copy("communities.transfer.accepted_notice") : copy("communities.transfer.rejected_notice"));
      query.reload();
    }
  }
  const ownedFull = data ? data.limits.max_owned <= data.owned_count : true;
  const joinedFull = data ? data.limits.max_joined <= data.joined_count : true;
  const hasListPagination = data && !(data.joined_count <= PAGE_SIZE && page === 0);

  return (
    <main className="flex flex-1 flex-col text-oai-black dark:text-oai-gray-100">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight">{copy("communities.title")}</h1><p className="mt-2 text-sm text-oai-gray-500">{copy("communities.subtitle")}</p></div>
          <Button type="button" variant="secondary" size="sm" onClick={query.reload} disabled={query.loading || mutation.busy || query.authRequired}><RefreshCw className="mr-2 h-4 w-4" aria-hidden />{copy("communities.refresh")}</Button>
        </header>
        {notice ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p> : null}
        <CommunityError error={mutation.error} />
        {!data ? <CommunityAccessState query={query} /> : <>
          <div className="flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-oai-gray-200 px-5 py-4 text-sm dark:border-oai-gray-800">
            <span>{copy("communities.quota.owned")}<strong className="ml-3 font-mono tabular-nums">{data.owned_count} / {data.limits.max_owned}</strong></span>
            <span>{copy("communities.quota.joined")}<strong className="ml-3 font-mono tabular-nums">{data.joined_count} / {data.limits.max_joined}</strong></span>
            <span className="text-oai-gray-500">{copy("communities.quota.includes_owner")}</span>
          </div>
          <section aria-labelledby="my-communities-title">
            <h2 id="my-communities-title" className="mb-4 text-base font-semibold">{copy("communities.my_list")}</h2>
            {data.communities.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.communities.map((community) => <Link key={community.id} to={`/communities/${community.id}`} className="group rounded-xl border border-oai-gray-200 bg-white p-5 no-underline transition-colors hover:border-oai-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oai-brand/40 dark:border-oai-gray-800 dark:bg-oai-gray-900 dark:hover:border-oai-gray-600">
                <div className="flex items-start justify-between gap-3"><Users className="h-5 w-5 text-oai-gray-400" aria-hidden /><span className="rounded-full bg-oai-gray-100 px-2 py-1 text-[11px] dark:bg-oai-gray-800">{community.is_owner ? copy("communities.owner") : copy("communities.member")}</span></div>
                <h3 className="mt-4 break-words text-base font-semibold">{community.name}</h3>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm text-oai-gray-500">{community.description || copy("communities.no_description")}</p>
                <div className="mt-5 flex items-center justify-between text-xs text-oai-gray-500"><span>{copy("communities.member_count", { count: String(community.member_count), max: String(data.limits.max_members) })}</span><ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden /></div>
              </Link>)}
            </div> : <div className="rounded-xl border border-dashed border-oai-gray-300 p-10 text-center text-sm text-oai-gray-500 dark:border-oai-gray-700">{copy("communities.empty")}</div>}
            {hasListPagination ? <CommunityPagination page={page} pageSize={PAGE_SIZE} total={data.joined_count} onChange={setPage} disabled={mutation.busy} label={copy("communities.list_pagination")} /> : null}
          </section>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={copy("communities.create.title")} subtitle={copy("communities.create.hint")}>
              <form onSubmit={create} className="space-y-4">
                <label className="block text-sm" htmlFor="community-name">{copy("communities.create.name")}<input id="community-name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} disabled={mutation.busy || ownedFull || joinedFull} className={`${communityInputClass} mt-2`} /></label>
                <label className="block text-sm" htmlFor="community-description">{copy("communities.create.description")}<textarea id="community-description" rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} disabled={mutation.busy || ownedFull || joinedFull} className={`${communityInputClass} mt-2 resize-y`} /></label>
                {ownedFull || joinedFull ? <p className="text-xs text-oai-gray-500">{ownedFull ? copy("communities.error.owned_limit") : copy("communities.error.joined_limit")}</p> : null}
                <Button type="submit" disabled={mutation.busy || ownedFull || joinedFull || !name.trim()}><Plus className="mr-2 h-4 w-4" aria-hidden />{copy("communities.create.submit")}</Button>
              </form>
            </Card>
            <Card title={copy("communities.join.title")} subtitle={copy("communities.join.hint")}>
              <form onSubmit={join} className="space-y-4">
                <label className="block text-sm" htmlFor="community-invite">{copy("communities.join.code")}<input id="community-invite" required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} autoComplete="off" spellCheck={false} disabled={mutation.busy} className={`${communityInputClass} mt-2 font-mono`} /></label>
                {joinedFull ? <p className="text-xs text-oai-gray-500">{copy("communities.join.full_hint")}</p> : null}
                <Button type="submit" disabled={mutation.busy || !inviteCode.trim()}><KeyRound className="mr-2 h-4 w-4" aria-hidden />{copy("communities.join.submit")}</Button>
              </form>
            </Card>
          </div>
          <Card title={copy("communities.transfer.incoming")}><TransferRequests requests={data.incoming_transfers} communities={data.communities} userId={query.userId} busy={mutation.busy} onAccept={(request) => respond(request, true)} onReject={(request) => respond(request, false)} /></Card>
        </>}
      </div>
    </main>
  );
}
