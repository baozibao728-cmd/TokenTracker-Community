import { isValidJwtShape } from "./auth-token";

// Community never inherits upstream's production URL fallback. Auth and this
// adapter must use the same explicitly configured self-hosted project.
export function getCommunityBaseUrl(): string {
  const configured = (import.meta.env.VITE_INSFORGE_BASE_URL ||
    import.meta.env.VITE_TOKENTRACKER_BACKEND_BASE_URL || "").trim();
  if (!configured) throw new CommunityApiError("NOT_CONFIGURED", 0);
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || !/^\/?$/.test(url.pathname)) throw new Error();
    return url.origin;
  } catch {
    throw new CommunityApiError("NOT_CONFIGURED", 0);
  }
}

export class CommunityApiError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "CommunityApiError";
  }
}

export type CommunityLimits = { max_owned: number; max_joined: number; max_members: number };
export type Community = {
  id: string; name: string; description: string | null; owner_id: string;
  created_at: string; invite_code?: string;
};
export type CommunityListItem = Community & {
  is_owner: boolean; joined_at: string; member_count: number;
};
export type CommunityMember = {
  user_id: string; display_name: string; avatar_url: string | null;
  joined_at: string; is_owner: boolean;
};
export type CommunityTransfer = {
  id: string; community_id: string; from_user_id: string; to_user_id: string;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string; expires_at: string;
};
type Quotas = { limits: CommunityLimits; owned_count: number; joined_count: number };
export type CommunityList = Quotas & {
  ok: true; communities: CommunityListItem[]; incoming_transfers: CommunityTransfer[];
  limit: number; offset: number;
};
export type CommunityDetail = Quotas & {
  ok: true; community: Community; is_owner: boolean; member_count: number;
  members: CommunityMember[]; transfers: CommunityTransfer[]; limit: number; offset: number;
};
export type CommunityRank = {
  user_id: string; display_name: string; avatar_url: string | null;
  total_tokens: string; rank: number;
};
export type CommunityLeaderboard = {
  ok: true; community_id: string; period: "week" | "month" | "total";
  from_day: string; to_day: string; from: string; to_exclusive: string;
  rows: CommunityRank[]; me: CommunityRank | null;
  member_count: number; ranked_count: number; excluded_member_count: number;
  limit: number; offset: number; basis: string; automatic_anticheat: boolean;
};
type SessionRequest = { accessToken: string; signal?: AbortSignal };
type PageRequest = SessionRequest & { limit?: number; offset?: number };

const errorCodes = new Set([
  "INVALID_INPUT", "INVALID_TARGET", "INVALID_PAGINATION", "INVALID_PERIOD",
  "CONFIRMATION_REQUIRED", "UNAUTHORIZED", "AUTH_USER_UNAVAILABLE", "COMMUNITY_UNAVAILABLE",
  "TRANSFER_UNAVAILABLE", "METHOD_NOT_ALLOWED", "OWNED_LIMIT", "JOINED_LIMIT", "MEMBER_LIMIT",
  "OWNER_CANNOT_LEAVE", "TRANSFER_PENDING", "TRANSFER_NOT_PENDING", "TARGET_NOT_MEMBER",
  "TRANSFER_EXPIRED", "REQUEST_TOO_LARGE", "SERVER_MISCONFIGURED", "DATABASE_ERROR", "INTERNAL_ERROR",
]);

async function request<T>(slug: string, { accessToken, signal }: SessionRequest,
  body?: Record<string, unknown>, params?: Record<string, unknown>): Promise<T> {
  if (!isValidJwtShape(accessToken)) throw new CommunityApiError("UNAUTHORIZED", 401);
  const url = new URL(`${getCommunityBaseUrl()}/functions/tokentracker-${slug}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value != null) url.searchParams.set(key, String(value));
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: body ? "POST" : "GET", signal, cache: "no-store", credentials: "omit",
      headers: {
        Accept: "application/json", Authorization: `Bearer ${accessToken}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new CommunityApiError("NETWORK_ERROR", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    const code = payload?.error?.code;
    throw new CommunityApiError(response.status === 401 ? "UNAUTHORIZED" :
      errorCodes.has(code) ? code : "REQUEST_FAILED", response.status);
  }
  return payload as T;
}

export function getCommunities(options: PageRequest) {
  return request<CommunityList>("community-detail", options, undefined,
    { limit: options.limit, offset: options.offset });
}
export function getCommunityDetail(options: PageRequest & { communityId: string }) {
  return request<CommunityDetail>("community-detail", options, undefined,
    { community_id: options.communityId, limit: options.limit, offset: options.offset });
}
export function getCommunityLeaderboard(options: PageRequest & {
  communityId: string; period: "week" | "month" | "total";
}) {
  return request<CommunityLeaderboard>("community-leaderboard", options, undefined,
    { community_id: options.communityId, period: options.period, limit: options.limit, offset: options.offset });
}
export function createCommunity(options: SessionRequest & { name: string; description?: string }) {
  return request<{ ok: true; community: Community }>("create-community", options,
    { name: options.name, ...(options.description ? { description: options.description } : {}) });
}
export function joinCommunity(options: SessionRequest & { inviteCode: string }) {
  return request<{ ok: true; community_id: string; already_member: boolean }>("join-community", options,
    { invite_code: options.inviteCode });
}
export function leaveCommunity(options: SessionRequest & { communityId: string }) {
  return request<{ ok: true; community_id: string }>("leave-community", options,
    { community_id: options.communityId });
}
export function createCommunityTransfer(options: SessionRequest & { communityId: string; toUserId: string }) {
  return request<{ ok: true; transfer: CommunityTransfer }>("create-community-transfer", options,
    { community_id: options.communityId, to_user_id: options.toUserId });
}
export function acceptCommunityTransfer(options: SessionRequest & { requestId: string }) {
  return request<{ ok: true; transfer: CommunityTransfer; owner_id: string; already_accepted: boolean }>(
    "accept-community-transfer", options, { request_id: options.requestId });
}
export function rejectCommunityTransfer(options: SessionRequest & { requestId: string }) {
  return request<{ ok: true; transfer: CommunityTransfer; already_rejected: boolean }>(
    "reject-community-transfer", options, { request_id: options.requestId });
}
export function deleteCommunity(options: SessionRequest & { communityId: string; confirmationName: string }) {
  return request<{ ok: true; community_id: string }>("delete-community", options,
    { community_id: options.communityId, confirmation_name: options.confirmationName });
}
