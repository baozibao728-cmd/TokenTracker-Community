# Community Leaderboard v1 — database baseline

Fork-owned additive schema: three tables, nine RPCs, four helpers, nine indexes.
Foundation SQL, pricing and provider integrations remain unchanged.

Run `node backend/community/build-migration.mjs` to generate the single release
migration from the five ordered SQL sources. Run
`npm --prefix backend/community run verify` for configuration, PostgreSQL 15,
concurrency, permissions, ranking and artifact checks.

Quota values come from `readCommunityLimits(getEnv)` and trusted RPC parameters.
Absent configuration defaults to owned=10, joined=20, members=2000. Invalid
configured values fail. No quota schema or historical creation counter is added.

All tables use RLS; only project_admin has business table/RPC privileges.
Creation, joins, ownership transfers and deletion execute transactionally.
The owner-membership FK is deferred, pending transfers are unique per community,
and ordered transaction locks enforce concurrent quotas.

Community ranking reuses the existing usage aggregation inside PostgreSQL,
filters current members, includes zero usage, returns exact decimal strings,
and computes dense ranks with stable UUID tie ordering. No Token data is copied.

The test-only additional-connection factory uses an isolated local PG15 cluster.
The foundation SQL reader normalizes line endings to its existing canonical
provenance hashes. These changes do not alter Foundation business definitions.

This checkpoint does not deploy resources or implement frontend pages.
