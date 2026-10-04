# Community scan-root candidate

This candidate selectively ports upstream
`459d568a777a78faec05c446cb34a72bde4a2804` onto Community
`a5561e0b32b28ff0252fe39280488138f99acd1e`. The reviewed upstream boundary is
`956e3ab331ce265021ed61c73622a516e882da2e`; no later upstream change is included.
Both remote main SHAs were confirmed through GitHub REST before implementation.
Version remains **1.2.0**. This is a build-only review candidate, not a release.

## Scope and adaptations

- Port the source commit's scan-root resolver, sync/cursor wiring, status,
  diagnostics, doctor, session discovery, context environment normalization,
  isolation adjustments, tests and usage instructions.
- Preserve `CODEX_HOME` replacement and additive `CLAUDE_CONFIG_DIR` semantics,
  home-relative paths, and existing native/WSL selection. Canonicalize readable
  Codex roots and retain both configured/canonical cursor roots so alternating
  path aliases do not create additional cursors. Deduplicate shared sessions
  directories before collection and shared Claude projects before discovery.
- Keep Community's `resolveTrackerPaths` / `resolveTrackerRoot` calls. No
  backend, RPC, routing, Auth, identity, updater, deployment, version, dependency
  or workflow changes are included. Provider roots remain read-only.
- Extend directory enumeration with optional completion callbacks in
  `rollout.js`; token parsing and normalization are unchanged. Nested listing
  errors now defer Claude history repair and sidecar replacement too.
- Pass sync's completed file inventory into `computeClaudeGroundTruthBuckets`
  rather than repeating an enumeration that can swallow directory errors.
  The legacy root-based caller and aggregation algorithm are unchanged.
- Retain unavailable configured roots in session discovery. Store only hashed
  directory identities in Community sidecar metadata, so disappearance of an
  observed directory protects the prior complete snapshot, including during
  forced refresh. Existing metadata gains that inventory on a complete refresh.
- Add Community fixture coverage for realpath aliases, CLI/background/notify
  alternation, repeated sync, missing/unreadable directories and recovery,
  sidecar byte preservation, and unchanged official fixture config/hooks.
  Windows uses junctions for directory-alias tests; injected EACCES tests run
  on all platforms in addition to upstream's POSIX permission tests.

These are discovery/repair-boundary adaptations required by this batch's
acceptance criteria, not parser or Cost Engine refactors. No out-of-scope
upstream dependency was needed.

## Local verification (Windows, Node 24.16.0)

- Four scan-root test files: **38 tests, 35 PASS, 0 FAIL, 3 platform skips**.
  The three original chmod tests require POSIX permission enforcement; all
  equivalent injected root/projects/nested EACCES cases passed on Windows.
- Eighteen affected background, cursor-store, session, path, isolation,
  categorizer, context, doctor and runtime regression files: **253/253 PASS**.
- Broader parser/WSL compatibility comparison retained all assertions. Five
  failures reproduce on the fixed baseline: three POSIX-style UNC aliases,
  one POSIX backslash filename, and the Kiro CLI fixture total (438 vs 384).
  The diagnostics Grok override slash assertion also fails identically on
  baseline and candidate on Windows. None was weakened or skipped to pass.
- `git diff --check`, version consistency and architecture guardrails passed.

The first CI run exposed system HOME aliases on macOS (`/var` versus
`/private/var`) and duplicate reporting of one unavailable directory. The
candidate now preserves the established HOME spelling while canonicalizing
provider aliases inside it, and reports one known failure rather than adding a
generic missing-directory warning. A symlinked-HOME fixture pins this behavior;
existing cursor/path and permission assertions were retained unchanged.
The next macOS run isolated the combined HOME-alias/provider-alias case: cursor
classification also needs the HOME-preserving canonical path, alongside the
configured spelling and filesystem realpath. The end-to-end alias test now
uses both aliases and checks the same per-day shard after every alternation.

New acceptance tests use disposable HOME/USERPROFILE, explicit provider roots,
Community data roots and native-only discovery. Existing source-layout
compatibility tests run in separately sanitized temporary homes; their explicit
legacy-layout assertions remain intact. Real `wsl.exe` calls are blocked by a
fixture preload for the local regression run; WSL-policy tests inject mocks.
No fixture was uploaded and no real provider session or production cloud data
was used as test input. Local evidence is not cloud acceptance.

## Review and release boundaries

CI and the existing build-only RC run from the Draft PR; their immutable run
links, head SHA, six-package manifest and runtime evidence are recorded in the
delivery report/PR after completion. No tag, Release, install, cloud operation
or merge belongs to this batch. The ten inherited/release workflows remain
disabled; only CI and build-only RC are active.

Directory disappearance is treated conservatively, including deliberate
deletion: restore the directory to resume a complete inventory. Forced refresh
does not authorize destructive cache replacement. Old sidecars without a
directory inventory cannot identify a previously removed nested directory
until a complete refresh has established that inventory; configured-root
absence and present-directory read failures are protected immediately.

### PR #3 review follow-up

Directory metadata now records hashed identities and inventories per selected
provider root. Removing an extra config/env root permits complete, persistent
refreshes of the remaining scope. Missing/unreadable retained roots or nested
directories still preserve the last complete sidecar, even during a scope
change or forced refresh. Shared projects and aliases retain their surviving
owner; an undetected WSL root remains required while WSL probing is enabled.
No parser, token normalization, pricing, version or cloud contract changed.

The `51bee187` metadata format has only global directory hashes and cannot
prove which root owned a disappeared directory. It remains conservatively
protected until one complete scan of the original scope establishes the
per-root inventory. If the scope was already reduced before that migration,
restore the original scope for one complete refresh, then remove the extra
root again. Neither deleting the old inventory nor forcing a partial snapshot
is used as a migration shortcut. This compatibility limitation is retained.

New incomplete-discovery and deferred-repair warnings aggregate only a safe
provider identifier, errno and count. Raw directory paths and exception
messages stay out of these fault logs; local diagnostic/status path display
and existing parser warnings are outside this follow-up.

Follow-up verification: 14 affected test files ran with Node's default process
isolation and sanitized fixture preload: **231 tests, 226 PASS, 0 FAIL,
5 existing platform/integration skips**. The seven initial review regressions
failed against `51bee187` before the fix; an additional cross-provider shared
directory regression failed before the provider-scoped comparison was added.
Version consistency and architecture guardrails passed. Final CI/RC links and
new package checksums are recorded separately without changing packaged HEAD.

This candidate does not change the accepted first technical-preview PASS.
Cloud account/Community ranking comparison and macOS/Linux GUI/runtime remain
outside this batch. Stable release status remains **NOT_READY**.
