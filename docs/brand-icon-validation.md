# Brand Icon Replacement Validation

## Scope and source

- Own repository: `baozibao728-cmd/TokenTracker-Community`; Draft PR #8, branch `codex/brand-orbit-icon`.
- Started from current own main `78f76216210cb9247465121821dbd0abf978057c`.
- Candidate/package source and explicit checkout: `06a3284d9352e697267b141b545ca0bd765a0f8f`.
- Master: [app-icon.svg](../assets/brand/app-icon.svg); master SHA-256 `d6c5b81f32ee94b7ab63cf4ae347e7fc531bc0f5c5f1b81b3331f3cb303997d5`.
- Approved concept remains a reference only. Production resources omit its outer canvas and presentation shadow. The black tile, connected white ring/orbit, upper-right opening and satellite preserve the approved shape.
- 16–24 px renderings widen the same opening and move the satellite less than one pixel; 32 px and above follow the master directly. Separate-dot and connected-mark checks pass at 16/32/48 px.

## Visual review

![Old versus new](../assets/brand/previews/old-new.png)

![Actual 16/32/48/256 px](../assets/brand/previews/actual-sizes.png)

![Enlarged small-size pixels](../assets/brand/previews/small-pixels.png)

The first size sheet copies actual pixels without scaling. The enlarged sheet uses nearest-neighbor to expose small-size separation. Manual image inspection confirms the opening, satellite and orbit remain recognizable; this is resource inspection, not native platform GUI acceptance.

## Resources and generation

| Area | Actual consumer / change |
|---|---|
| Web | Existing BrandLogo, sidebar, login/share marks use `app-icon.png`; regenerated favicon ICO/16/32, apple-touch 180, PWA 192/512; added previously referenced but absent `icon.svg`. No page behavior changed. |
| Windows | `assets/trayicon.ico` remains the exe/window/Inno icon input; 16/32/48/64/256 frames now share the new master. `make-icon.ps1` delegates to the shared generator. |
| macOS | Actual `AppIcon.icon/icon.json` references `02-orbit.svg`, removes old bolt layer and disables presentation shadow/translucency; full-bleed black layer uses Apple's native mask. Fallback ICNS and 1024 export regenerated. Static menu bar template uses black transparent 18/36 PNGs. Swift entry points preserve directed output arguments. |
| Linux | Dashboard 512 PNG still feeds the existing RGBA sync script and Tauri icon. Application and static tray use that same icon. |
| Pets | Existing Windows mascot ICOs, macOS animation frames and all pet styles retain their original bytes/behavior. Windows pet generator now reads a separately preserved original source instead of the rebranded static macOS menu icon. |

`scripts/generate-brand-icons.cjs` uses existing pngjs, restricted closed-path rasterization and deterministic PNG/ICO/ICNS encoding. [Generated-resource manifest](../assets/brand/generated-manifest.json) records the 17 resources plus its own generated manifest (18 outputs total). No dependency upgrade. Narrow LF attributes prevent cross-platform SVG byte drift. Run `npm run gen:brand-icons`, `npm run validate:brand-icons`, then `node scripts/brand-icon-previews.cjs` for documentation previews.

## Local checks

- Generation, actual consumer, macOS asset/override and package/RC contracts: **20/20 PASS** (`node --test --test-isolation=none` on this Windows host).
- Linux icon sync: **6/6 PASS**, including indexed palette/transparency fixture and actual RGBA pixels.
- macOS independent identity guards: **3/3 PASS**.
- Windows original pet regeneration: four frames per theme match existing decoded pixels; existing two pet ICO files unchanged.
- Full 18-output generation `--check`, Windows generation wrapper, version check (1.2.0), secret/path scan and `git diff --check`: **PASS**.
- Local default child-process test isolation encountered Windows sandbox `spawn EPERM`; the same targeted tests completed with isolation disabled. Remote ordinary CI uses its normal runner and test command.
- Local machine has .NET 9 only; .NET 8 checks belong to the real Windows CI runner rather than local roll-forward.

## Boundaries and retained limits

Only icon resources, their generation chain, targeted tests and package verification change. Name, AppId/bundle ID, data/protocol, backend/updater, version, Community/Foundation/Parser/Cost/Provider behavior remain unchanged. Provider/function icons and pets are preserved. The two publish workflows and eight inherited workflows remain disabled; only ordinary CI and build-only RC run.

No local installation, tag, Release, merge, cloud change or public asset replacement. New-icon Windows GUI/runtime is NOT_TESTED this round; Windows isolated PE icon inspection is separate. macOS/Linux GUI/RUNTIME remain NOT_TESTED. Windows unsigned and macOS ad-hoc (no Developer ID/notarization) limitations remain. Existing complete Dashboard baseline failures, WSL/upgrade and metadata/config limits remain unchanged; no full business lifecycle was rerun for this image change.

## CI, artifacts and actual package evidence

**PASS** for the candidate source above; no package provenance is reassigned to a later documentation HEAD.

- [Ordinary CI](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37429406370): **4/4 PASS** (test/validate/build, Linux Rust, macOS unit tests, Windows .NET 8 build/tests). PR source `06a3284d9352e697267b141b545ca0bd765a0f8f`; ordinary CI default merge checkout `e54f272099093c6a5c12b423c3774f2224278d7b` merges that candidate with own main `78f76216210cb9247465121821dbd0abf978057c`.
- [Build-only RC](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37429406437): candidate, Windows, macOS, Linux and delivery **5/5 PASS**. All runners explicitly check out the exact candidate `06a3284d9352e697267b141b545ca0bd765a0f8f` and validate actual HEAD; no publish workflow is called.
- [Final delivery artifact 11396657946](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37429406437/artifacts/11396657946), `community-rc-06a3284d9352e697267b141b545ca0bd765a0f8f`: 498,861,850-byte outer Actions ZIP; its downloaded SHA-256 `0a2f47076efba24daf37a60015d81b2ac55269b75048ae4b8eee1e36c651f45c` matches GitHub's artifact digest. This outer ZIP is separate from the six native package hashes below.
- Eight original files were extracted and retained; the six package bytes, SHA256SUMS, version/source/checkout and exact filename inventory were verified. Both metadata files' own hashes are recorded below.

| Package inspection | Actual evidence / result |
|---|---|
| Windows RC | ZIP-extracted and runner-installed exe plus actual Setup PE RT_GROUP_ICON/RT_ICON PNG payloads match the shared ICO at 16/32/48/64/256. All eight embedded web brand assets exact. Formal self-contained x64 payload and installer identity checks PASS. |
| Windows local download | In an isolated extraction directory, downloaded ZIP exe and original Setup PE resources independently match the five canonical icon frames. All eight extracted web resources match source bytes. No executable or installer was run locally. |
| macOS DMG | Both Swift entry points ran on macOS and their isolated outputs matched committed resources. Mounted DMG fallback ICNS matches canonical bytes; compiled Assets.car contains AppIcon (not a claim of decoded catalog pixel/GUI validation). Universal app/widget/Node, version/bundle/protocol and ad-hoc signature checks PASS; all eight embedded web resources exact. |
| Linux AppImage | Its own extracted 512x512 hicolor PNG pixels and all eight web resources match; runtime, version and protocol/identity checks PASS. |
| Linux deb | Its own independently extracted 512x512 hicolor PNG pixels and all eight web resources match; runtime, package metadata and protocol/identity checks PASS. |
| Linux rpm | Its own independently extracted 512x512 hicolor PNG pixels and all eight web resources match; runtime, package metadata and protocol/identity checks PASS. |

The hashes correspond to actual native package bytes, not an Actions outer ZIP. All six packages keep version **1.2.0**.

| Original filename | Architecture | Bytes | SHA-256 |
|---|---|---:|---|
| TokenTracker-Community-win-x64.zip | x86_64 | 114954278 | `b454883f4075262c1b5d6d84f80c31b1875be6cc92e7f6f61c06efe3f57ef307` |
| TokenTracker-Community-Setup.exe | x86_64 | 80795701 | `d6b0f6ea25c54302bbf4f31b0f38d5f6bca3a662866323f6cc9b0410a0e6fa87` |
| TokenTrackerCommunity.dmg | arm64+x86_64 | 61722358 | `9ce1b66bff29ed10e230faa08a3011e428f6d3f43377beee99596d37d8f8a334` |
| TokenTracker-Community-linux-x86_64.AppImage | x86_64 | 127453688 | `7002a02ca0c83a456ddb7525577aea913e0898c17e3251174cbd2f101c3afb83` |
| TokenTracker-Community-linux-x86_64.deb | x86_64 | 56980672 | `e2048bcf8febfd8793bc099ecaad0405f96591dc52763b6dcf52092c33afd872` |
| TokenTracker-Community-linux-x86_64.rpm | x86_64 | 56951704 | `73a8cc567f2e301864418e1fea45ab107cef5bb90e15e80dc5246fa292b5f904` |
| SHA256SUMS | metadata | 615 | `39841b7e8e76c9fd596040046bf34fa20243d6cc0e963aad7abcc0fd6f58057b` |
| RC_MANIFEST.json | metadata | 1598 | `2928799a98514c2a4b48abe8cb9240e40984781ad257016f62f79d0a4f333281` |

## Iterations and review boundary

The initial `d50e2dde2e62428c476a3bdc6cd7ef0dda1e45c7` [CI](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37429117275) and [RC](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37429117273) runs were cancelled by normal PR concurrency when the pet-source isolation fix was pushed. They are not the final acceptance or artifact source. The original pet binaries remain unchanged; only their future generator input was isolated. The final candidate had no CI/package failure and did not remove or relax existing gates.

The first local small-icon check exposed satellite/ring contact at 16 px. The documented sub-pixel spacing adjustment and final 16/32/48 regression resolve it. A local test initially used an incorrect Inno source filename; the test now targets the actual TokenTracker.iss consumer. These are retained implementation checks, not runtime failures.

The first single-connection artifact download was too slow. Parallel HTTP byte ranges and resumable retries were used; the assembled outer ZIP digest and all native package hashes passed. No package was rebuilt, repacked or resigned during download verification.

The report's later documentation-only commit is distinct from the tested package source. Its exact HEAD and subsequent ordinary CI status belong to the Draft PR validation summary, avoiding a self-recording commit loop. Documentation-only updates do not rebuild the three packages.

**READY FOR REVIEW.** Draft PR remains unmerged. New-icon native GUI/runtime validation remains NOT_TESTED, as do the previously retained platform/upgrade limits. Public preview assets are untouched.
