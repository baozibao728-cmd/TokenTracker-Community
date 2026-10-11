# TokenOrbit nickname and Community source breakdown validation

## Scope and provenance

- Base main: `5c78cf918ea165c5c054adca3a6d799d818289b0`.
- Branch: `codex/nickname-community-source-breakdown`.
- Fixed product / packaging source: `6b9999998db3f2dddcef35434a89527b9f4934fd`.
- Initial product and screenshot source: `3bdab4cf25ba4b793fe441b8402ea17b699f97a5`. Follow-up commits normalize PostgreSQL catalog comparison and express the exact trillion unit as `10n ** 12n`; neither changes RPC output or the pictured layout.
- Draft PR: [#12](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/12).
- Package version remains **1.2.0**. Later report/screenshot commits are documentation; they must not replace the package source SHA.
- This task does not merge, install clients, publish releases, deploy Edge, apply migrations, change credentials or write cloud data. Public preview.3 and prior validation evidence remain unchanged.

## Implemented behavior

The account card puts **昵称（显示名称） / Nickname (display name)** immediately below its heading/email, above user ID. The current nickname and Edit are available independently of public-profile or anonymous state. The existing `display_name` save endpoint and 50-character limit remain. Save/cancel, Enter/Escape, safe failure feedback and immediate sidebar-name refresh remain. Public profile, anonymity and GitHub visibility are separately labeled below; saving a nickname sends none of those preferences and never enables cloud sync. Session changes clear drafts/errors and ignore stale save responses. A profile-read failure keeps visibility preferences unknown and disables their switches rather than writing inferred defaults.

Community rankings reuse `LEADERBOARD_TOKEN_COLUMNS`, provider headers/icons, saved global column order, token formatting, sticky rank/user cells and horizontal scrolling. Fields are `gpt_tokens` (Codex), `claude_tokens`, `gemini_tokens`, `cursor_tokens`, `kiro_tokens`, `copilot_tokens`, `kimi_tokens`, `opencode_tokens`, `openclaw_tokens`, `hermes_tokens`, `other_tokens`. No cost, model ranking or new sorting is introduced.

The additive RPC uses the existing Foundation `leaderboard_usage_grouped` result and classifies **source**, never model/user names. Existing aliases match the global board (`pi-anthropic` → Claude; `pi-github-copilot` / `pi-copilot` → Copilot). Unknown sources go to Other. SQL sums use `numeric`, all eleven values and total are decimal strings, and zero-usage members have real string zeros. `rows` and independent `me` use the same formatted CTE. Dense ties, periods, exclusions, membership checks and pagination remain unchanged. Community visibility still follows its existing membership rules; this task does not change the separate global public/anonymous rules.

Anonymity retains its existing **global public leaderboard** meaning: it hides the public name/avatar there. Community is independently member-authorized; its historical RPC already returns the saved display name to members, including when public profile is off or global anonymity is on. This task preserves that behavior and does not introduce Community-wide anonymity or expand access to nonmembers.

Client-side sum validation uses BigInt only to check response integrity; it never recalculates ranks or infers source attribution. Missing, malformed or inconsistent source fields produce unavailable placeholders and an explicit hint while retaining server totals/ranks. Older clients ignore additive fields; this client remains usable against the current totals-only backend. Integer-string compact formatting now also rounds with BigInt, including numbers beyond Number range; exact tooltips retain all digits.

The existing HTTP `no-store`, short in-memory cache, account/session/community/period/page keys, deduplication, background refresh, 401 blocking and late-response isolation are unchanged. No private data is added to persistent cache.

## Source and database change boundaries

| Area | Change |
| --- | --- |
| Settings / copy | Account card, existing profile hook, multilingual registered copy, nine component regressions |
| Community UI / types | Shared source columns, optional rollout fields, payload integrity check, exact formatter and targeted regressions |
| Backend | New Community-only `CREATE OR REPLACE FUNCTION public.community_leaderboard(...)`, same signature/owner/ACL/search path and additive JSON fields |
| Migration | New `backend/deploy/migrations/20261011000000_community-leaderboard-source-breakdown.sql`; historical migration is unchanged |
| Rollback | Generated `backend/community/source-breakdown/rollback-generated.sql`, outside automatic migrations |
| CI | Adds nickname, exact formatting/shared-column coverage and real isolated PG15 upgrade/rollback regression to ordinary CI |
| Unchanged | Foundation SQL/functions, all Edge sources/manifest entries, collection/upload/dedup, Auth identity, backend target, updater, version and install identities |

Reviewed committed Git-blob SHA-256 (LF): new migration `6a02d576c8266f4e217fb6c8dfa8f9afa09717f01149b274f87118574bf090cf`; rollback companion `bae8ed90c180cd0c8937ec2240f41a56e64e7c91c05858efff52cca1fa0a5381`. Neither artifact has been applied to the hosted project.

## Local targeted validation

| Check | Actual result |
| --- | --- |
| Nickname component regressions | **9/9 PASS**: all four public × anonymous combinations save only display_name; preferences remain; safe failure/cancel, keyboard actions, remount persistence, GET-failure protection, account change and late-save isolation. Final test helper has no React act warnings. |
| Community/API/cache/format regressions | **95/95 PASS** across seven files: source fields, exact large integers, true zeros, legacy/invalid payloads, saved column order, URL/page/period, membership/401/session/TTL/background-refresh behavior. |
| Global leaderboard / Context / upload gate | **61/61 PASS** across eight files, including all 16 selected `LeaderboardPage` tests. |
| Dashboard typecheck | **PASS** |
| Production build | **PASS**, isolated output directory and empty local-data root with the existing validated self-owned public client configuration |
| Version / copy / locale / UI hardcode / architecture | **PASS**, version 1.2.0; zh and zh-TW complete coverage |
| Historical / additive migration generators | **PASS**, normalized source/hash checks and rollback consistency |
| Edge source hashes / strict types | **PASS**, nine Community entries unchanged |
| Backend artifact scan | **PASS**, 96 files; no detected credentials, local user paths or official backend endpoint |
| Sensitive/path scan and whitespace | **PASS** for the staged change scope; only synthetic test values are present |
| PG15 on this Windows host | **NOT_TESTED**: existing portable PostgreSQL failed with a Windows DLL relocation error / spawn UNKNOWN; local Docker daemon is unavailable. This is not a SQL pass. |
| Supplemental local PostgreSQL WASM | **5/5 PASS**, same upgrade/rollback assertions; supplemental, not a substitute for PG15 |
| Follow-up formatting / shared-column / badge checks | **19/19 + 3/3 PASS**, unchanged badge single-source assertions; exact formatting still passes |

The first sandboxed Vitest attempt failed before collecting tests (`EPERM realpath`); the same targeted tests passed outside that sandbox. The initial plain production-build attempt correctly rejected missing self-owned client config. A configured retry hit an occupied existing `dashboard/dist/index.html`; the successful build used a new isolated output directory without stopping or changing the installed app. Existing SDK browser-externalization / large-chunk build warnings remain. One new rounding-test expectation was corrected at the actual rounding boundary; no old global test was altered.

Historical Dashboard baseline failures (`period changes cache timeout`, `Preloaded User missing`) remain recorded in earlier reports. Both affected selected global tests passed in this run; this is not a claim that those historical intermittent failures were fixed. The full Dashboard suite was not required or run locally.

## CI and fixed-source build-only RC

- Final-source ordinary CI: [38117408007](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117408007) — **4/4 PASS** (Node/frontend/build, Windows, macOS unit tests, Linux Rust).
- PR event head: `6b9999998db3f2dddcef35434a89527b9f4934fd`; PR merge ref: `d5393bf226452e1e7c4300a2ff755946bdbe6727` (ordinary CI checks out the PR merge ref).
- Exact-source RC: [38117407991](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117407991) — **5/5 PASS** (candidate, Windows, macOS, Linux, delivery). Every platform explicitly checks out and verifies `6b9999998db3f2dddcef35434a89527b9f4934fd`, not the ordinary-CI merge ref.
- Final-source isolated PostgreSQL **15.18** upgrade/rollback regression: **5/5 PASS** ([job 114404961353](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117408007/job/114404961353)). It verifies Foundation catalog/data fingerprints, unchanged RPC ACL, source/precision/period/page/permission assertions and byte-equivalent historical responses after rollback. This is isolated runner data, not a cloud fingerprint or cloud deployment result.
- Eight-file artifact download and byte verification: **PASS**. The original artifact container matches GitHub's server digest; a new extraction directory contains exactly the six packages and two original metadata files. `scripts/rc/artifacts.cjs verify` and an independent eight-file inventory/hash check pass. Manifest version is **1.2.0**, and both `source_sha` and `checkout_sha` equal `6b9999998db3f2dddcef35434a89527b9f4934fd`. No previous candidate artifact is used as evidence for this source.

| Platform | Actual package checks in the fixed-source RC | Runtime boundary |
| --- | --- | --- |
| Windows x86_64 | .NET 8 self-contained publish; ZIP and Inno Setup extraction; embedded Node/CLI/Dashboard, release config, identity and brand payload checks **PASS** | Unsigned; no overwrite installation or GUI run in this task |
| macOS universal | Release Xcode build, inner/outer ad-hoc signing and mounted DMG app/runtime/config/identity/brand checks **PASS** | Ad-hoc is not Developer ID/notarization; GUI **NOT_TESTED** |
| Linux x86_64 | AppImage, deb and rpm **each** extracted and checked for executable modes, embedded runtime, version, original package identity, TokenOrbit display name, protocol and brand **PASS** | GUI/runtime **NOT_TESTED**, no claim from headless payload checks |
| Delivery | Downloaded the three platform artifacts, checked their original package bytes, assembled six packages plus metadata and uploaded the final artifact **PASS** | Local post-upload download verification recorded separately below |

Delivery artifact: [11693971977](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117407991/artifacts/11693971977), `community-rc-6b9999998db3f2dddcef35434a89527b9f4934fd`. Actions artifact outer ZIP: **499,075,705 bytes**, server digest `6fa70481ddbf8e3f051474729a53981e0c0e2fddc493b92e28bbbfff5e2b4856`. This outer-container digest is separate from the eight deliverable file hashes.

| Original file | Bytes | SHA-256 |
| --- | ---: | --- |
| TokenTrackerCommunity.dmg | 61,907,384 | `0a3126f0a7fa1b17e48602f749d002ecc0aea8429b626510956814493765152f` |
| TokenTracker-Community-win-x64.zip | 114,958,951 | `1ce6e01e63d4387ebdd02a73cc5cb7de24f071c70ac14ae3d8f16facf5006e88` |
| TokenTracker-Community-Setup.exe | 80,796,961 | `f70fcf2e02e6f3e4fac7a3ecb38f8a3d71c44774ae20ecb98c758617bc1da81d` |
| TokenTracker-Community-linux-x86_64.AppImage | 127,470,072 | `23ced559cfd5d750b4de01cf3738b223ca3f60c9ee804c4243c591dafa703724` |
| TokenTracker-Community-linux-x86_64.deb | 56,984,334 | `444379082aec2e05689d6ab2ed978ddbddca91d587d760cd08e64120130e7e53` |
| TokenTracker-Community-linux-x86_64.rpm | 56,954,554 | `ae8a667662e28e605b7846d4a60ba929572baeb9c2d592f7ba9ba9a2338cfc7e` |
| SHA256SUMS | 615 | `66d2805859888d6563026aaf9bbb2b531e9973a98d1eb40b86f0b44a2d02839d` |
| RC_MANIFEST.json | 1,598 | `5c2cba59addc081a0433051d36768adafc628f6aac7aa3bcba7322829ff2f7c9` |

Package architectures: macOS arm64 + x86_64; Windows and all Linux formats x86_64. `SHA256SUMS` matches the six original package bytes; the two metadata hashes above are independently recorded, not regenerated metadata. Original packages and the verified original ZIP are retained locally outside Git. No package was installed, rebuilt, resigned or recompressed during download verification.

Transport retry record: initial single-connection Node/curl downloads were slow and interrupted; a connector-local fetch was unavailable and its later alternate transfer was stopped after the primary path finished. The successful path fetched byte ranges from the same original GitHub artifact, concatenated them without recompression, and matched the full ZIP's server digest before extraction. Partial files are not used as evidence and are removed during cleanup.

The final documentation-only head and its ordinary CI are recorded in the PR summary after this report commit. They do not replace the fixed package source or screenshot source. Ten inherited workflows, including both release workflows, remain `disabled_manually`; only ordinary CI and build-only RC are active.

### Failures and retries retained

| Source / run | Actual result and action |
| --- | --- |
| `3bdab4cf` / [CI 38116646490](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38116646490) | **FAIL**: raw `pg_proc.proargdefaults` includes SQL byte-location metadata. Replaced that comparison with PostgreSQL's normalized `pg_get_expr` default expression; owner, signature, ACL and all business assertions remain. |
| `23fa8b7c` / [CI 38116960138](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38116960138) | **FAIL**, despite PG15 PASS: the existing badge-threshold scanner matched a substring of the new trillion formatting literal. Expressed the same base-ten unit as `10n ** 12n`; no scanner exemption, skipped check or badge logic change. |
| `23fa8b7c` / [RC 38116882238](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38116882238) | Candidate-only SUCCESS with packaging jobs **SKIPPED** after a backend-test-only update; this is **not** three-platform packaging evidence. The same Draft PR was briefly closed/reopened to request the existing full-diff build-only path; it was never marked Ready or merged. |
| Superseded CI/RC attempts | Cancelled by same-PR concurrency when the next correction was pushed; retained in Actions history and not claimed as PASS. |

## Before / after screenshots

Screenshots are isolated browser renders of the **actual React components** with explicitly synthetic local fixture responses and no external API access. They are labeled **LOCAL FIXTURE**. They are UI/layout evidence, not native WebView, real account, cloud deployment or RC runtime evidence.

- Before source: `5c78cf918ea165c5c054adca3a6d799d818289b0`.
- After source: `3bdab4cf25ba4b793fe441b8402ea17b699f97a5`.
- The account components, Community component, shared columns and copy are unchanged between capture source and final package source. The later formatter edit changes only equivalent trillion-unit notation; screenshots are still attributed to their actual capture source.
- Inventory, source-file digests, image SHA-256, viewport, scroll measurements and network guard: [evidence.json](docs/validation/nickname-community-sources/evidence.json). External requests observed: **0**. Temporary capture harness was removed.

| View | Before | After |
| --- | --- | --- |
| Account card, 1280 × 980 | [Old nickname disabled in anonymous state](docs/validation/nickname-community-sources/before-account-desktop.png) | [Nickname first and editable with public off / anonymous on](docs/validation/nickname-community-sources/after-account-desktop.png) |
| Community, 1780 × 1100 | [Three columns](docs/validation/nickname-community-sources/before-community-desktop.png) | [Shared fourteen columns, Other and true zeros](docs/validation/nickname-community-sources/after-community-desktop.png) |
| Community, 390 × 844 | — | [Left / pinned identity](docs/validation/nickname-community-sources/after-community-mobile-left.png), [scrolled right / Other visible](docs/validation/nickname-community-sources/after-community-mobile-right.png) |

The account fixture omits the native cloud-sync control; unchanged sync behavior is supported by targeted component/upload-gate tests, not claimed as a GUI toggle test. Fixture dates and values illustrate layout; period boundaries are verified separately by the isolated database regression.

An independent read-only evidence review found no actionable product defect, rehashed all six PNGs against `evidence.json` successfully and checked nickname payload isolation, source-only SQL aggregation and historical rollback compatibility. This is supplementary review, not a replacement for CI, deployment or native runtime evidence.

## Proposed deployment, compatibility and recovery — NOT EXECUTED

1. Obtain separate deployment authorization. Check the self-owned project identity, existing migration history, `community_leaderboard` definition/owner/ACL, deployed Edge source hashes and Foundation data/schema/ACL fingerprints. Keep an immutable pre-snapshot. Read the original 130 Token's existing source attribution without changing it. Record Community-table counts and existing users without exporting user data or credentials.
2. Apply **only the new timestamped migration**, after the historical Foundation and Community migrations, via the project's controlled migration runner and its transaction. Do not edit/replay the historical migration, execute fixture setup or upload example usage. This changes one Community function and its platform migration record; no table, ingest, ranking or quota change is needed.
3. Verify committed migration status, the same signature/owner/ACL/search path, unchanged Edge manifest/source hashes and Foundation pre/post fingerprints. **No Edge source update or redeployment is required** because the current handler transparently returns RPC JSON.
4. Using a normal existing user session, inspect Community Edge `rows` and `me` over week/month/total and page boundaries. Compare all eleven exact decimal strings, their sum and total/rank. Use existing memberships or an explicitly authorized temporary Community; zero-usage existing members can validate real zeros. A nonmember must still get the existing unavailable response. Do not add Token samples, relabel the 130 Token source or turn on cloud sync. Multi-source/unknown/extreme-number fixtures remain local unless existing real data naturally covers them.
5. Verify nickname save in the normal native settings UI, immediate sidebar update and process-restart persistence while preserving public/anonymous/cloud-sync preferences. Global snapshots and Community cached reads reflect names through their existing refresh paths; no forced global snapshot rebuild or new upload is introduced.
6. If the additive RPC causes problems, use the reviewed generated rollback companion in one controlled transaction to restore the exact historical function body. Do not delete migration-history records or edit old files. Prefer reverting client rollout first; the current client also safely handles missing breakdown fields. Recheck data/catalog/ACL and old-response equality. A later redeploy should use a separately reviewed forward migration rather than replaying the applied timestamp.

## Remaining limitations and review status

- Real-cloud new RPC fields/deployment, actual source attribution of the original 130 Token, fresh cloud data fingerprints: **NOT_TESTED in this task**. No InsForge calls or writes have been made. The historical 130-Token baseline is preserved by not touching its data, not by claiming a new audit.
- New Windows/macOS/Linux package installation and GUI/runtime, real nickname persistence across a native process restart, actual sidebar/global/Community refresh after a real save: **NOT_TESTED**. This round prohibits overwrite installation; component remount/API regression is explicitly separate from native persistence evidence.
- Existing Windows unsigned, macOS ad-hoc (not Developer ID/notarized), macOS/Linux GUI/runtime limitations, real WSL, old metadata migration constraints, un-attributed Codex config differences and complete higher-version download/upgrade chain remain. Version 1.2.0 is unchanged.
- Historical macOS notification instability is not addressed by this task; a passing macOS CI run is not a GUI notification acceptance result.
- No model/cost/provider logic, product release decision or preview.3 asset is changed. Stable release remains **NOT_READY**.
- Product evidence status: **READY FOR REVIEW** — product-source ordinary CI, fixed-source three-platform BUILD/PACKAGE and downloaded eight-file verification all pass. Final documentation-head CI is tracked in the PR summary; handoff waits for that check. This is not real-cloud deployment or native-runtime acceptance. Stop at Draft PR review; do not merge or deploy.
