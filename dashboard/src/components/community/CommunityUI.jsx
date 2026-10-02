import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "../../ui/components/Button.jsx";
import { copy, getCopyLocale } from "../../lib/copy";
import { getPaginationFlags } from "../../lib/leaderboard-ui";

export const communityInputClass = "w-full rounded-lg border border-oai-gray-300 bg-white px-3 py-2 text-sm text-oai-black placeholder:text-oai-gray-400 focus:outline-none focus:ring-2 focus:ring-oai-brand/30 disabled:opacity-50 dark:border-oai-gray-700 dark:bg-oai-gray-950 dark:text-white";

export function communityErrorText(error) {
  switch (error?.code) {
    case "NOT_CONFIGURED": return copy("communities.error.not_configured");
    case "UNAUTHORIZED":
    case "AUTH_USER_UNAVAILABLE": return copy("communities.error.sign_in");
    case "OWNED_LIMIT": return copy("communities.error.owned_limit");
    case "JOINED_LIMIT": return copy("communities.error.joined_limit");
    case "MEMBER_LIMIT": return copy("communities.error.member_limit");
    case "COMMUNITY_UNAVAILABLE": return copy("communities.error.unavailable");
    case "TRANSFER_UNAVAILABLE": return copy("communities.error.transfer_unavailable");
    case "TRANSFER_PENDING": return copy("communities.error.transfer_pending");
    case "TRANSFER_NOT_PENDING": return copy("communities.error.transfer_not_pending");
    case "TRANSFER_EXPIRED": return copy("communities.error.transfer_expired");
    case "OWNER_CANNOT_LEAVE": return copy("communities.error.owner_leave");
    case "TARGET_NOT_MEMBER": return copy("communities.error.target_not_member");
    case "CONFIRMATION_REQUIRED": return copy("communities.error.confirmation");
    case "INVALID_INPUT":
    case "INVALID_TARGET":
    case "REQUEST_TOO_LARGE": return copy("communities.error.invalid_input");
    case "NETWORK_ERROR": return copy("communities.error.network");
    default: return copy("communities.error.generic");
  }
}

export function CommunityError({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
      <p>{communityErrorText(error)}</p>
      <div className="mt-2 flex gap-2">
        {error.status === 401 ? <Link to="/login" className="underline">{copy("communities.sign_in")}</Link> : null}
        {onRetry ? <Button type="button" size="sm" variant="secondary" onClick={onRetry}>{copy("communities.retry")}</Button> : null}
      </div>
    </div>
  );
}

export function CommunityAccessState({ query }) {
  if (query.authRequired) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-oai-gray-200 px-6 py-16 text-center dark:border-oai-gray-800">
        <ShieldCheck className="h-9 w-9 text-oai-gray-400" aria-hidden />
        <h2 className="text-lg font-semibold">{copy("communities.sign_in_title")}</h2>
        <p className="max-w-sm text-sm text-oai-gray-500">{copy("communities.sign_in_hint")}</p>
        <Button as={Link} to="/login">{copy("communities.sign_in")}</Button>
      </div>
    );
  }
  if (query.loading) { return <CommunityLoading />; }
  return <CommunityError error={query.error} onRetry={query.reload} />;
}

export function CommunityLoading() {
  return <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-oai-gray-500"><LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />{copy("communities.loading")}</div>;
}

export function CommunityPagination({ page, pageSize, total, onChange, disabled = false, label }) {
  const pages = Math.max(1, Math.ceil(Number(total || 0) / pageSize));
  const { canPrev, canNext } = getPaginationFlags({ page: page + 1, totalPages: pages });
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-oai-gray-200 px-4 py-3 dark:border-oai-gray-800">
      <span className="text-xs tabular-nums text-oai-gray-500">{copy("communities.pagination", { page: String(page + 1), pages: String(pages), total: String(total || 0) })}</span>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" disabled={disabled || !canPrev} onClick={() => onChange(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" aria-hidden />{copy("leaderboard.pagination.prev")}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={disabled || !canNext} onClick={() => onChange(page + 1)}>{copy("leaderboard.pagination.next")}<ChevronRight className="ml-1 h-4 w-4" aria-hidden /></Button>
      </div>
    </nav>
  );
}

export function communityDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(getCopyLocale(), { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";
}

export function transferStatus(status) {
  switch (status) {
    case "pending": return copy("communities.transfer.pending");
    case "accepted": return copy("communities.transfer.accepted");
    case "rejected": return copy("communities.transfer.rejected");
    case "expired": return copy("communities.transfer.expired");
    default: return "—";
  }
}

export function TransferRequests({ requests, userId, communities = [], members = [], busy, onAccept, onReject }) {
  if (!requests?.length) { return <p className="text-sm text-oai-gray-500">{copy("communities.transfer.empty")}</p>; }
  return (
    <ul className="divide-y divide-oai-gray-200 dark:divide-oai-gray-800">
      {requests.map((request) => {
        const target = members.find((member) => member.user_id === request.to_user_id);
        const community = communities.find((item) => { return item.id === request.community_id; });
        // Requests are scoped by community_read; the backend remains the final
        // authority for recipient checks and a pending request's current validity.
        const recipient = request.to_user_id === userId && request.status === "pending";
        return (
          <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Link to={`/communities/${request.community_id}`} className="text-sm font-medium hover:underline">{community?.name || copy("communities.transfer.title")}</Link>
              <p className="mt-1 text-xs text-oai-gray-500">{copy("communities.transfer.to", { name: target?.display_name || request.to_user_id })}</p>
              <p className="mt-1 text-xs text-oai-gray-500">{copy("communities.transfer.expires", { date: communityDate(request.expires_at) })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-oai-gray-100 px-2.5 py-1 text-xs text-oai-gray-600 dark:bg-oai-gray-800 dark:text-oai-gray-300">{transferStatus(request.status)}</span>
              {recipient ? <>
                <Button type="button" size="sm" disabled={busy} onClick={() => onAccept(request)}>{copy("communities.transfer.accept")}</Button>
                <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onReject(request)}>{copy("communities.transfer.reject")}</Button>
              </> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
