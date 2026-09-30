# Community Edge API v1

All nine slugs are prefixed `tokentracker-`. Only the independent Community
manifest is a publish source; foundation Edge files and manifest are unchanged.
No cloud deployment has been performed by this implementation.

## Authentication and input

Business requests require an `Authorization` bearer user access token. Verification
uses RS256 and the runtime's `JWT_PUBLIC_KEY` (SPKI PEM). A finite integer `exp`
and UUID `sub` are required. Expired tokens, future `nbf`/`iat`, other algorithms,
invalid signatures and non-user roles are rejected. A present `role` must be
`authenticated`; a missing role is permitted for platform user-token variants.
There is no HS256 fallback, service-credential login mode or unsigned identity
fallback. No remote key URL or key embedded in JWT headers is trusted.

The actor is always the verified `sub`. Body/query `user_id`, `actor`, `p_actor`,
quota fields, exclusions, date overrides and all unknown fields are rejected.
`to_user_id` on transfer creation is only a target member, never an actor override.
POST bodies must be JSON objects (`Content-Type: application/json`), at most
16 KiB. POST query parameters and duplicate GET query parameters are rejected.
OPTIONS is an unauthenticated, side-effect-free 204 CORS preflight.

All JSON responses have `Cache-Control: no-store`. No secrets or raw SQL/SDK
diagnostics are returned or logged by the handlers. Browsers have no direct table
or RPC permissions; the service-only database remains the authorization authority.

## Routes

| Slug after `tokentracker-` | Method and allowed parameters | Success |
|---|---|---|
| `create-community` | POST `name`, optional `description` (string/null) | 201: `{ok:true,community:{id,name,description,owner_id,invite_code,created_at}}` |
| `join-community` | POST `invite_code` | 200: `{ok:true,community_id,already_member}` |
| `leave-community` | POST `community_id` | 200: `{ok:true,community_id}` |
| `community-detail` | GET optional `community_id`, `limit`, `offset` | 200: own list or member-only detail, described below |
| `community-leaderboard` | GET `community_id`, optional `period`, `limit`, `offset` | 200: ranking, described below |
| `create-community-transfer` | POST `community_id`, `to_user_id` | 201: `{ok:true,transfer:{id,community_id,from_user_id,to_user_id,status,created_at,expires_at}}` |
| `accept-community-transfer` | POST `request_id` | 200: `{ok:true,transfer,owner_id,already_accepted}` |
| `reject-community-transfer` | POST `request_id` | 200: `{ok:true,transfer,already_rejected}` |
| `delete-community` | POST `community_id`, `confirmation_name` | 200: `{ok:true,community_id}` |

IDs must be UUIDs. Community name is trimmed, 1–100 Unicode code points;
description is at most 2000 code points. Invite code is a 32-character hexadecimal
string, accepting lowercase and surrounding whitespace. Delete confirmation must
exactly match the current name. Only the database's current owner can delete or
create transfers. Transfers target an existing other member and expire after seven
days. Only the recipient may accept/reject; acceptance checks current ownership
and the recipient's current owned quota in one transaction.

Pagination defaults to `limit=50,offset=0`, permits `limit=1..100` and nonnegative
32-bit integer offsets. `period` defaults to `week`, permits `week/month/total`.

## Detail responses

Without `community_id`, returns:

```json
{
  "ok": true,
  "communities": [],
  "incoming_transfers": [],
  "owned_count": 0,
  "joined_count": 0,
  "limits": {"max_owned": 10, "max_joined": 20, "max_members": 2000},
  "limit": 50,
  "offset": 0
}
```

Limits are the actual server configuration; the values above illustrate defaults.
Community list items include `is_owner`, `joined_at` and `member_count`.
Only owners receive invite codes. Incoming requests are recipient-scoped.

With `community_id`, returns `community`, `is_owner`, paginated `members`, visible
`transfers`, `member_count`, own quota counts, limits and pagination. Each member
includes `user_id`, `display_name`, `avatar_url`, `joined_at`, `is_owner`. Member
names do not fall back to email prefixes. Nonmembers receive 404 to avoid revealing
whether an inaccessible community exists.

## Ranking response

Returns `ok`, `community_id`, `period`, `from_day`, `to_day`, `from`,
`to_exclusive`, `rows`, `me`, `member_count`, `ranked_count`,
`excluded_member_count`, `limit`, `offset`, `basis`, `automatic_anticheat`.

Rows and independent `me` have the shape:

```json
{"user_id":"<member UUID>","total_tokens":"130","rank":1,"display_name":"Member","avatar_url":null}
```

Token totals are exact decimal strings. All current members, including zero-token
members, rank using UTC calendar periods and pre-join history. Dense rank uses
tokens alone; ties are displayed in UUID order. Manual exclusions come only from
the server's environment and are applied before ranking. An excluded requester's
`me` is null. No automatic anticheat is implemented:
`basis=client_reported_tokens`, `automatic_anticheat=false`.

## Environment and server credentials

| Variable | Requirement |
|---|---|
| `INSFORGE_BASE_URL` | Required project HTTPS origin; no fallback |
| `JWT_PUBLIC_KEY` | Required project RS256 SPKI public key |
| `INSFORGE_SERVICE_ROLE_KEY` / `API_KEY` | At least one; nonblank legacy service key takes priority, otherwise platform `API_KEY` |
| `COMMUNITY_MAX_OWNED` | Optional, absent default 10 |
| `COMMUNITY_MAX_JOINED` | Optional, absent default 20 |
| `COMMUNITY_MAX_MEMBERS` | Optional, absent default 2000 |
| `LEADERBOARD_BLOCKED_USER_IDS` | Optional comma-separated UUIDs for manual rank exclusion |

All nine handlers use `readCommunityLimits`, including operations that do not
increase quotas. Invalid configured values fail before database access. Reads
use Deno environment APIs only; no local credential, dotenv or project link files
are loaded. The audited foundation service resolver is inlined unchanged.
`createAdminClient({baseUrl,apiKey})` from pinned SDK 1.4.5 sends that credential to
the database. Anon keys, request API keys and user JWTs are never substituted;
known CLI user-key prefixes are rejected. `JWT_SECRET` is not used.

## Errors

Errors use `{ok:false,error:{code}}` with no raw database detail:

| HTTP | Codes |
|---|---|
| 400 | `INVALID_INPUT`, `INVALID_TARGET`, `INVALID_PAGINATION`, `INVALID_PERIOD`, `CONFIRMATION_REQUIRED` |
| 401 | `UNAUTHORIZED`, `AUTH_USER_UNAVAILABLE` |
| 404 | `COMMUNITY_UNAVAILABLE`, `TRANSFER_UNAVAILABLE` |
| 405 | `METHOD_NOT_ALLOWED` (also returns `Allow`) |
| 409 | `OWNED_LIMIT`, `JOINED_LIMIT`, `MEMBER_LIMIT`, `OWNER_CANNOT_LEAVE`, `TRANSFER_PENDING`, `TRANSFER_NOT_PENDING`, `TARGET_NOT_MEMBER` |
| 410 | `TRANSFER_EXPIRED` |
| 413 | `REQUEST_TOO_LARGE` |
| 500 | `SERVER_MISCONFIGURED`, `DATABASE_ERROR`, `INTERNAL_ERROR` |

Expired-state business errors commit the RPC's status change before HTTP mapping.
Unknown RPC failures remain errors; no capability error is suppressed as success.
Repeated joins and completed accept/reject requests are idempotent. Repeated
create requests can create separate communities within quotas; no request-level
idempotency store or extra table is introduced.
