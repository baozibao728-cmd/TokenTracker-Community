# Community Leaderboard v1 — database baseline

This package is fork-owned and additive to the verified MVP foundation. It
implements the Community database and nine local-tested Edge entries. It does
not implement frontend pages or deploy cloud resources.

## Local generation and validation

```sh
node backend/community/build-migration.mjs
node backend/community/build-edges.mjs
npm --prefix backend/community run verify
```

The generated release artifact is
`backend/deploy/migrations/20261001000000_community-leaderboard-v1.sql`.
It contains exactly the five ordered SQL source bodies, with normalized LF and
source hashes. The platform migration runner supplies the transaction; do not
execute individual source files against a project. Foundation must already be
present. Reapplying this migration fails rather than overwriting existing objects.

Tests use the existing isolated PostgreSQL 15.18 runtime and foundation fixture.
The runtime's additional-connection factory is test-only; it cannot accept an
external database URL. No test reads `.insforge`, dotenv, or platform credentials.
The bootstrap package's existing dependencies/runtime must be installed first.
The foundation test reader normalizes CRLF to LF, matching its existing migration
generator and provenance hashes; it does not change SQL bodies or expected hashes.

## Trusted quota configuration

`config.mjs` exports `readCommunityLimits(getEnv)`. All nine Edge handlers supply
a reader backed by `Deno.env.get`. Tests supply an explicit reader. The module reads:

| Environment variable | Absent-variable fallback | RPC JSON field |
|---|---:|---|
| `COMMUNITY_MAX_OWNED` | 10 | `max_owned` |
| `COMMUNITY_MAX_JOINED` | 20 | `max_joined` |
| `COMMUNITY_MAX_MEMBERS` | 2000 | `max_members` |

Invalid configured values fail; only absent variables use fallbacks. Positive
PostgreSQL integers are required. There are no quota columns, SQL defaults,
configuration tables, or historical creation counters. Every quota-changing RPC
requires the server-resolved `p_limits` object. Never construct it from HTTP input.
Existing over-quota relationships are retained when limits decrease; duplicate
joins and accepted-transfer replays do not consume additional quota.

## Database objects and permissions

Three tables: `communities`, `community_members`, `community_transfer_requests`.
Nine indexes (including primary-key and unique-constraint indexes), nine public
RPC names, and four private implementation helpers. No new view or business
trigger. The deferred owner-membership FK is implemented by PostgreSQL's internal
constraint triggers, not a custom application trigger.

All tables enable RLS. `PUBLIC`, `anon`, and `authenticated` have no table or RPC
privileges; `project_admin` uses its previously verified BYPASSRLS permission.
Functions are SECURITY INVOKER with fixed search paths. No existing foundation
DDL, function, ACL, parser, pricing code, or provider integration is changed.

The service role is trusted. Direct administrator DML can bypass quota checks;
application writes must use the RPCs. `p_actor` is not database-authenticated:
the Edge validates JWT and derives it from the subject. Exposing service
credentials or these parameters directly to a browser would violate the contract.

## RPC contracts

All return JSONB. Expected business errors are `{ok:false,error:{code:...}}`.
Invalid/missing actors and invalid server configuration raise SQL errors. Errors
that expire a request return JSON so the expiration update can commit. The caller
must not roll back an expected error result if it wants that status persisted.

| RPC | Parameters beyond `p_actor uuid` | Result |
|---|---|---|
| `community_create` | `p_name text`, `p_description text`, `p_limits jsonb` | `community` with owner invite code |
| `community_join` | `p_invite_code text`, `p_limits jsonb` | `community_id`, `already_member` |
| `community_leave` | `p_community_id uuid` | `community_id`; owner cannot leave |
| `community_create_transfer` | `p_community_id uuid`, `p_to_user_id uuid` | `transfer`; owner to existing other member |
| `community_accept_transfer` | `p_request_id uuid`, `p_limits jsonb` | `transfer`, `owner_id`, `already_accepted` |
| `community_reject_transfer` | `p_request_id uuid` | `transfer`, `already_rejected` |
| `community_delete` | `p_community_id uuid`, `p_confirmation_name text` | `community_id`; current owner and exact name required |
| `community_read` | `p_limits jsonb`, `p_community_id uuid=NULL`, `p_limit int=50`, `p_offset int=0` | Own list/incoming requests or member-only detail |
| `community_leaderboard` | `p_community_id uuid`, `p_period text`, `p_limit int=50`, `p_offset int=0`, `p_excluded_user_ids uuid[]=empty`, `p_as_of timestamptz=now()` | Rows, independent `me`, counts and UTC bounds |

Pagination accepts limits 1–100 and nonnegative offsets. List/detail reports live
configuration and current owned/joined counts. Invite codes are owner-visible;
ordinary members do not receive them. Member display names use existing settings
and Auth profile names, with a neutral fallback rather than email-derived names.
No email, password, JWT or service credential is returned.

Names are trimmed and limited to 100 characters, descriptions to 2000 characters.
Invite codes are independent random UUID-derived 32-character uppercase hex
strings with a unique constraint. Only invite collisions are retried; unrelated
unique violations propagate.

## Concurrency and ownership

Writers require READ COMMITTED and acquire transaction advisory quota locks in
sorted user-UUID order, then the community row, then a transfer row. Counts are
checked after locks, within the same transaction as writes. Other isolation modes
fail explicitly rather than relying on a stale snapshot. Community row locking
also serializes membership capacity, pending-transfer creation and deletion.

Creation atomically inserts the owner membership. A deferred composite FK ensures
the owner remains a member. Ownership transfer retains the old owner's membership
and checks the target's current owned count on acceptance, not merely at request
creation. Only one pending request per community is permitted. Replaying an old
accepted request never restores a former owner; the response identifies the
current owner. No roles, multiple admins, kicks or approval workflow are added.

Transfers expire after seven days, checked using wall clock after locks. Read-only
responses expose elapsed pending requests as expired without writing. Mutations
persist expiration lazily; no scheduler is introduced. Leaving expires that
member's pending incoming transfer. Deletion cascades only community relationships
and transfer history. Deleting an Auth user who still owns a community is blocked
until ownership is transferred or the community is deleted.

## Ranking

The member-gated STABLE read RPC operates within one statement snapshot. It calls
the unchanged `leaderboard_usage_grouped(from,to)` inside PostgreSQL, filters the
current members, sums per-user tokens, fills zeros, computes `dense_rank` by tokens
alone, orders ties by UUID, then paginates. Historical usage before joining counts.
Token sums are returned as decimal strings, including values beyond JavaScript's
safe integer range. No token data is copied and no community snapshots are stored.

Periods match the existing MVP global UTC calendar ranges: Monday–Sunday week,
calendar month, and epoch through today's end for total. The `to_exclusive` bound
is explicit. `p_as_of` is a trusted-server/test parameter, not browser input.
Manual exclusions are passed by the Edge from its own blocklist configuration,
never from browser input. Excluded members remain members but are absent from ranks;
the response reports both member/ranked counts. A blocked requester's `me` is null.

`basis=client_reported_tokens`, `automatic_anticheat=false`. No automatic anticheat,
Quarantine, cost ranking, provider ranking, Community snapshots or Subscription
Value. Community membership grants community visibility independently of the
foundation's global public-visibility setting.

The existing aggregation has no member predicate parameter. Filtering happens
inside the database after potentially global aggregation. The local 2000-member
fixture is functional coverage, not a production load test or latency promise.

## Edge publish and HTTP contracts

See [API.md](./API.md) for request/response contracts. `src/` contains the reviewed
TypeScript sources; `edge/` contains nine generated self-contained ESM `.js`
entries. Deploy only `manifest.json` entries after separate authorization.
`build-edges.mjs --check` verifies every source, shared template, generator and
published entry hash. Strict checking applies to the TypeScript sources and the
shared configuration JS; generated JS is emitted by the same pinned compiler.
The existing foundation manifest and Edge files remain unchanged.

Runtime tests load the actual published JS with the real SDK 1.4.5, execute RPCs
against isolated PG15, inspect actual server-credential headers and block external
hosts. They exercise no-JWT/forgery/expiration/role rejection, input injection,
quota configuration, membership, transfers, exact token values and error mapping.
This is local Runtime proof, not proof of a successful cloud build/deployment.
