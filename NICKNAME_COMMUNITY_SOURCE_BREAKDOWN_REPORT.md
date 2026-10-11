# TokenOrbit nickname and Community source breakdown validation

## Scope and provenance

- Base main: `5c78cf918ea165c5c054adca3a6d799d818289b0`.
- Branch: `codex/nickname-community-source-breakdown`.
- Current fixed product / packaging source: `b1c53c7469255d26d590a6bb5359db6168b6369c` (nickname shared-state review fix).
- Initial candidate source: `6b9999998db3f2dddcef35434a89527b9f4934fd`; its CI, packages and download verification below remain historical evidence, not validation of the follow-up fix.
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

## Initial local targeted validation — historical evidence

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

## Initial candidate CI and fixed-source RC — historical evidence

- Initial-source ordinary CI: [38117408007](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117408007) — **4/4 PASS** (Node/frontend/build, Windows, macOS unit tests, Linux Rust).
- PR event head: `6b9999998db3f2dddcef35434a89527b9f4934fd`; PR merge ref: `d5393bf226452e1e7c4300a2ff755946bdbe6727` (ordinary CI checks out the PR merge ref).
- Exact-source RC: [38117407991](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117407991) — **5/5 PASS** (candidate, Windows, macOS, Linux, delivery). Every platform explicitly checks out and verifies `6b9999998db3f2dddcef35434a89527b9f4934fd`, not the ordinary-CI merge ref.
- Initial-source isolated PostgreSQL **15.18** upgrade/rollback regression: **5/5 PASS** ([job 114404961353](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38117408007/job/114404961353)). It verifies Foundation catalog/data fingerprints, unchanged RPC ACL, source/precision/period/page/permission assertions and byte-equivalent historical responses after rollback. This is isolated runner data, not a cloud fingerprint or cloud deployment result.
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
- The account layout components, Community component, shared columns and copy remain as pictured. The follow-up nickname hook/AuthContext behavior differs from the capture source and is verified by its new integration regressions; old screenshots do not prove that repair. The earlier formatter edit changes only equivalent trillion-unit notation. All captures retain their actual source attribution.
- Inventory, source-file digests, image SHA-256, viewport, scroll measurements and network guard: [evidence.json](docs/validation/nickname-community-sources/evidence.json). External requests observed: **0**. Temporary capture harness was removed.

| View | Before | After |
| --- | --- | --- |
| Account card, 1280 × 980 | [Old nickname disabled in anonymous state](docs/validation/nickname-community-sources/before-account-desktop.png) | [Nickname first and editable with public off / anonymous on](docs/validation/nickname-community-sources/after-account-desktop.png) |
| Community, 1780 × 1100 | [Three columns](docs/validation/nickname-community-sources/before-community-desktop.png) | [Shared fourteen columns, Other and true zeros](docs/validation/nickname-community-sources/after-community-desktop.png) |
| Community, 390 × 844 | — | [Left / pinned identity](docs/validation/nickname-community-sources/after-community-mobile-left.png), [scrolled right / Other visible](docs/validation/nickname-community-sources/after-community-mobile-right.png) |

The account fixture omits the native cloud-sync control; unchanged sync behavior is supported by targeted component/upload-gate tests, not claimed as a GUI toggle test. Fixture dates and values illustrate layout; period boundaries are verified separately by the isolated database regression.

The initial read-only evidence review rehashed all six PNGs against `evidence.json` successfully and checked nickname payload isolation, source-only SQL aggregation and historical rollback compatibility. A later independent review identified the shared nickname race documented below; its absence from the initial component-only review is not treated as a pass for that path. Review is supplementary evidence, not a replacement for CI, deployment or native runtime evidence.

## Follow-up review: shared nickname state isolation

Review identified a P2 in the reused AuthContext path: after a successful nickname POST, the extra profile GET could complete after logout/account change and overwrite the shared sidebar name. An account with no saved nickname could also inherit the previous account's cached name. A failed extra GET left the sidebar's old name despite a successful save.

The fix resets shared nickname/resolution state at existing user/session boundaries and guards reads with the existing session epoch, user ID and an in-memory request sequence. Confirmed save results invalidate older reads and immediately update both settings and shared state with the server-returned normalized `display_name`; a missing response field retains the validated submitted-name fallback. Ordinary explicit profile refresh remains supported. Authentication, OAuth, persistent logout, privacy settings, Community cache and cloud-sync preference mechanisms are unchanged.

| Targeted evidence | Actual result |
| --- | --- |
| Old `55e4421c` implementation, real Provider + AccountSection | **6 FAIL / 1 PASS** across the initial seven tests: shared-state race, account fallback, normalized-save and prior-GET failures reproduced; same-session normal refresh passed |
| Final follow-up integration suite | **8/8 PASS**, including direct A/B switch, logout before late completion, same-ID new session, B without custom name, B read failure, server-normalized save without another GET, normal refresh and pre-save GET invalidation |
| Nickname / Auth / session epoch / Community cache / upload-gate group | **91/91 PASS**, 12 files; the eight new integration regressions use the real Provider and settings path with synthetic transport only |
| Sidebar and cloud-sync preferences | **13/13 PASS** |
| Selected global leaderboard suite | **15/16 PASS**; the known period-change cache timeout recurred. No global tests, timing limits or product ranking logic were changed. The historical `Preloaded User missing` limitation is also retained |
| Typecheck / production build / version / architecture / staged credential-path / whitespace | **PASS** |

The initial sandboxed runner failed before collection (`EPERM realpath`), then the old-code red run succeeded outside that sandbox. The first post-fix combined run had one test-harness container-query failure after its shared-state assertion passed; the query was corrected and the final 91-test group rerun passed. No assertions or production behavior were weakened. A separate read-only review found no blocker in the new isolation logic; its suggested B-read-failure case is included in the eighth test.

New-source ordinary CI [38121270532](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38121270532) is **4/4 PASS**. Event head is `b1c53c7469255d26d590a6bb5359db6168b6369c`; actual checkout from the completed Node job log is PR merge ref `cbd3771811c05c009ab5abe8d305667a3b08c009`. The new nickname integration suite is explicitly included. Isolated runner PG15 upgrade/rollback remains **5/5 PASS**; no hosted resources were touched.

Fixed-source three-platform RC [38121270600](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38121270600) is **5/5 PASS**. The candidate job log records actual checkout `b1c53c7469255d26d590a6bb5359db6168b6369c`; all platform jobs enforce that same SHA and retain the existing individual package-content checks. No new native installation or cloud operation is authorized in this follow-up.

New-source delivery artifact: [11695862640](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/38121270600/artifacts/11695862640), `community-rc-b1c53c7469255d26d590a6bb5359db6168b6369c`. Original eight-file download verification completed at **2026-10-11 07:41:12 UTC: PASS**. The original Actions ZIP is **499,065,065 bytes**; its local SHA-256 matches GitHub's server digest, `c065559395c8af86a55b49d3698f32b98ee6283d6758697d47714c76bf1b6d6c`. This container hash is separate from the deliverable hashes below.

The archive has exactly the expected eight flat filenames. The guarded artifact verifier and an independent inventory/hash comparison both pass. Manifest `source_sha` and `checkout_sha` equal `b1c53c7469255d26d590a6bb5359db6168b6369c`; version remains **1.2.0**. `SHA256SUMS` matches all six original package bytes, and both original metadata files are independently hashed. No package or metadata was rebuilt, signed, recompressed or rewritten during verification. Original files, the verified ZIP and the safe inventory are retained locally outside Git; initial-candidate packages remain historical evidence only.

| New-source original file | Bytes | SHA-256 |
| --- | ---: | --- |
| TokenTrackerCommunity.dmg | 61,893,808 | `2c1ce1224547b85e9d8215afa408dd54f9ea8c8d8b42bc754236eec83a327cd0` |
| TokenTracker-Community-win-x64.zip | 114,959,075 | `0ee9568ac55205c3989872444648c1a49a3a8c40380cfc2c46ca41537c17f0b6` |
| TokenTracker-Community-Setup.exe | 80,794,954 | `9e7d68f3b521f1599a58e47ed8dfb1806108c25b2c2de2b9a0ffa74358ba7984` |
| TokenTracker-Community-linux-x86_64.AppImage | 127,470,072 | `738b34749b390180689f6044f2fbe592d5fb35324fedf90519015bebde97bea5` |
| TokenTracker-Community-linux-x86_64.deb | 56,989,050 | `39fd11e9d61a70fe236b871410a135eab4e7adb91ad40bd040073fa441d2bbb7` |
| TokenTracker-Community-linux-x86_64.rpm | 56,954,657 | `26051dcdedcf0470ffd5c85fad26d500cc29bdf9d2cbc8c1c2f273a8fd4d5779` |
| SHA256SUMS | 615 | `cde44665b320fd634a653c750e46a8ecd0b6ca74c607a1122ae6b0480f290448` |
| RC_MANIFEST.json | 1,598 | `8c746f51670e961417511196f446fb54b8bceef323b0f0944e932079271bd00a` |

Architectures remain macOS arm64 + x86_64, Windows x86_64 and Linux x86_64. BUILD/PACKAGE and download-byte verification do not establish native runtime or hosted migration acceptance. The follow-up changes no backend files; committed migration/rollback hashes above remain unchanged.

## Proposed deployment, compatibility and recovery — NOT EXECUTED

1. Obtain separate deployment authorization. Check the self-owned project identity, existing migration history, `community_leaderboard` definition/owner/ACL, deployed Edge source hashes and Foundation data/schema/ACL fingerprints. Keep a fresh immutable immediate pre-snapshot. Reconfirm the directly read original 130 Token attribution (`trae-cn` → Other) remains unchanged. Record Community-table counts and existing users without exporting user data or credentials.
2. Apply **only the new timestamped migration**, after the historical Foundation and Community migrations, via the project's controlled migration runner and its transaction. Do not edit/replay the historical migration, execute fixture setup or upload example usage. This changes one Community function and its platform migration record; no table, ingest, ranking or quota change is needed.
3. Verify committed migration status, the same signature/owner/ACL/search path, unchanged Edge manifest/source hashes and Foundation pre/post fingerprints. **No Edge source update or redeployment is required** because the current handler transparently returns RPC JSON.
4. Using a normal existing user session, inspect Community Edge `rows` and `me` over week/month/total and page boundaries. Compare all eleven exact decimal strings, their sum and total/rank. Use existing memberships or an explicitly authorized temporary Community; zero-usage existing members can validate real zeros. A nonmember must still get the existing unavailable response. Do not add Token samples, relabel the 130 Token source or turn on cloud sync. Multi-source/unknown/extreme-number fixtures remain local unless existing real data naturally covers them.
5. Verify nickname save in the normal native settings UI, immediate sidebar update and process-restart persistence while preserving public/anonymous/cloud-sync preferences. Global snapshots and Community cached reads reflect names through their existing refresh paths; no forced global snapshot rebuild or new upload is introduced.
6. If the additive RPC causes problems, use the reviewed generated rollback companion in one controlled transaction to restore the exact historical function body. Do not delete migration-history records or edit old files. Prefer reverting client rollout first; the current client also safely handles missing breakdown fields. Recheck data/catalog/ACL and old-response equality. A later redeploy should use a separately reviewed forward migration rather than replaying the applied timestamp.

## Remaining limitations and review status

- At the reviewed `0d860aab` report HEAD, real-cloud new RPC fields/deployment, original 130 Token attribution and fresh cloud fingerprints were **NOT_TESTED**, with no InsForge calls. Later read-only authorization preparation below supersedes only attribution/fingerprint preparation; deployment and new Edge-response acceptance remain **NOT_TESTED**. No cloud write has been made.
- New Windows/macOS/Linux package installation and GUI/runtime, real nickname persistence across a native process restart, actual sidebar/global/Community refresh after a real save: **NOT_TESTED**. This round prohibits overwrite installation; component remount/API regression is explicitly separate from native persistence evidence.
- Existing Windows unsigned, macOS ad-hoc (not Developer ID/notarized), macOS/Linux GUI/runtime limitations, real WSL, old metadata migration constraints, un-attributed Codex config differences and complete higher-version download/upgrade chain remain. Version 1.2.0 is unchanged.
- Historical macOS notification instability is not addressed by this task; a passing macOS CI run is not a GUI notification acceptance result.
- No model/cost/provider logic, product release decision or preview.3 asset is changed. Stable release remains **NOT_READY**.
- Product evidence status: **READY FOR REVIEW** — product-source ordinary CI, fixed-source three-platform BUILD/PACKAGE and downloaded eight-file verification all pass. Final documentation-head CI is tracked in the PR summary; handoff waits for that check. This is not real-cloud deployment or native-runtime acceptance. Stop at Draft PR review; do not merge or deploy.

## Read-only authorization preparation after product review

The later formal source review reported Standards/Spec zero actionable issues for reviewed report HEAD `0d860aab5a61287f12e514b99ad7acc65b7f8499` and fixed package source `b1c53c7469255d26d590a6bb5359db6168b6369c`. No product code, test, package or prior screenshot was changed or rerun. Preparation status: **READY FOR AUTHORIZATION**, not execution approval.

Protected reads at **2026-10-11 04:15:50–04:16:30 EDT / 08:15:50–08:16:30 UTC** were restricted to the existing self-owned project link and `tc79bxhm` host. [Safe current baseline](docs/validation/nickname-community-sources/preflight-20261011-safe.json) records two historical migrations with the new migration absent, historical RPC body/signature/owner/ACL/search_path equality, 22/22 active Edge source/manifest/fixed-source Git-blob equality, all 12 Foundation business-table counts/content hashes and full Foundation schema/ACL groups. A/B are present and Auth count is 2; Community is 0/0/0; hourly is one row totaling `"130"`. Its directly read real source is **`trae-cn`**, which the reviewed mapping classifies as **Other**. No data was relabeled, fixture uploaded or account information exported.

The initial local byte validator falsely failed on CRLF working-copy versus LF manifest bytes. The immutable failure was preserved; a separate local Git-blob/normalized-copy comparison passes 22/22 without changing or rereading Edge sources. Previous data/schema hash serialization differs and is not claimed equal to this new baseline. Account usage cache count is 10 versus historical 8; its writer remains unattributed. The capture is sequential, not an atomic snapshot, so an eventual authorized write requires a fresh immutable immediate pre-state.

[Precise cloud and Windows authorization plan](PR12_CLOUD_WINDOWS_AUTHORIZATION_PLAN.md) fixes artifact `11695862640`, Setup `9e7d68f3…` and ZIP `0ee9568a…`, migration/rollback bytes and order, phase-specific pre/post invariants, failure stops and recovery. It explicitly lists still-unapproved installation/protocol operations, real nickname/privacy saves, the one-function migration and one minimal temporary Community. No Edge redeployment is needed. Real source-field UI/API, native persistence/restart, no-ingest observation and cleanup are not yet executed. Missing multi-source/large-number/populated-page real data remains isolated-test evidence; no Tokens or users may be manufactured. Main and all public assets remain untouched; stable release remains **NOT_READY**.
