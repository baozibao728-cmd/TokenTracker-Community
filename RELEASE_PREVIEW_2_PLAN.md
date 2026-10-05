# TokenTracker Community — v1.2.0-preview.2 发布准备方案

日期：2026-10-05（Asia/Taipei）。本文件是独立的第二次技术预览方案，状态 **READY FOR REVIEW**；不是执行记录。本轮仅文档提交、Draft PR 和既有规则下的普通 CI，不 merge、不创建 tag / Release、不上传资产。稳定版仍 **NOT_READY**。

第一次发布的 [方案](RELEASE_READINESS_PLAN.md)、[公告草稿](RELEASE_NOTES_DRAFT.md)和 [实际发布记录第 17 节](RELEASE_OWNERSHIP_CUTOVER_REPORT.md#17-首次三平台技术预览实际发布2026-10-04)保持原样。公开的 [v1.2.0-preview.1](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1)（Release ID `402619253`）及其 tag、公告和八个原资产全部保留。

## 1. 固定来源与本轮只读核对

| 项目 | 固定值 / 已取得证据 |
|---|---|
| 仓库 | `baozibao728-cmd/TokenTracker-Community` |
| 准备基线 main | `3614084f0197c41bd01b04e2438810fefbff1fee`，本地与 origin 一致，开始时 clean |
| 实际包 source / checkout | `6321b24e0c46699db2695995491fea5bae97b359` |
| 包内版本 | `1.2.0` |
| 已审定 PR #5 HEAD | `37ece1c1efd6c8a39e53ab4116d3e6ac84f10275`；合并树与审核树相同，三提交完整保留 |
| 原 build-only RC | [37225559792](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559792)，五 job PASS，固定包源码 checkout |
| 原八文件 artifact | [11311863214](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559792/artifacts/11311863214)，`community-rc-6321b24e0c46699db2695995491fea5bae97b359` |
| main 普通 CI | [37279345794](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37279345794)，4/4 PASS，对应实际 merge SHA |

本轮重新只读核对：交付目录恰有八个文件；六包实际字节 / 大小符合原 manifest，SHA256SUMS 与原六包一致；两个元数据文件自身大小及 SHA-256 也符合第 3 节。使用现有 `scripts/rc/artifacts.cjs verify`，未调用会写元数据的 record / assemble。没有重新构建、签名、压缩、改名或重新生成 manifest / checksums。

`git merge-base --is-ancestor` 确认包源码是固定 main 的祖先；`git diff --name-status` 的唯一差异为 `docs/windows-combined-rc-acceptance.md`。产品、构建、版本、配置及工作流均无包源码至 main 的差异。后续纯文档 HEAD 与包源码分别记录于 PR，不把文档 HEAD / merge SHA 写回 manifest。

artifact API 本轮显示未过期，原 run 为 success、head 为包源码。外层 artifact ZIP 为 499127642 字节、摘要 `2ede3a978c2a06e61e2d3a9c82c3d050141977fb271cd4b5ceee2c7a2629d30a`；这是既有下载回核的外层记录，不能代替八个文件本体摘要。当前到期时间为 **2026-11-04 02:54:32 台北时间**。如 Actions 过期，只能使用已保留、通过第 3 节逐字节验证的同一原件；原件不全或摘要不符就停止，不静默重建。

本轮只读 GitHub 检查确认 preview.2 tag / Release 均不存在；仅 CI、Community build-only RC active，其余十个 workflow 均 disabled_manually。实际执行前必须重新检查，不能把当前结果当作未来保证。

## 2. 拟定发布参数

| 参数 | 值 |
|---|---|
| Release 名称 | `TokenTracker Community 1.2.0 — Three-platform Technical Preview 2` |
| tag | `v1.2.0-preview.2`，annotated tag |
| tag peeled commit / target_commitish | **`6321b24e0c46699db2695995491fea5bae97b359`** |
| 包内版本 | **`1.2.0`**，不为 preview tag 改版本 |
| prerelease | `true` |
| make_latest | **字符串 `"false"`**，创建草稿和公开 PATCH 时均显式设置 |
| draft | 先 `true`；草稿八文件回核与 review 批准公开后才改为 `false` |
| generate_release_notes | `false`，使用 [独立公告草稿](RELEASE_PREVIEW_2_NOTES_DRAFT.md) |
| 发布方式 | 自有仓库 Git + GitHub Releases REST API；不调用继承发布 workflow |
| 资产 | 第 3 节原六包 + 原 SHA256SUMS + 原 RC_MANIFEST.json，共八文件 |

这是**手动下载技术预览**。preview.1 / preview.2 的包内数字版本都为 1.2.0，现有稳定 updater 不把它们当作更高版本升级；不承诺预览自动推送或完整自动下载升级已通过。没有稳定 Release 时，自有 `releases/latest` 可实际返回 404，检查更新 UI 可显示失败；不得据此创建假稳定版补证。

现有 `release-dmg.yml` / `release-windows.yml` 会按正式版本契约重新构建并写 Release，其中组合 workflow 最终自动公开。因此它们不能作为复用原字节的本次入口，保持禁用，不 dispatch。`v1.2.0-preview.2` 是独立 tag，不输入现有数字三段版本校验器，不创建 `v1.2.0`，也不把预览原地改为 latest。

拟定参数与草稿 / 预览 / latest 的处理依据 [GitHub Releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28)。需要稳定升级时另选更高包内版本（推荐 1.2.1 或以上）、产生新候选并完成相应 review；本轮不预先修改版本或承诺日期。

## 3. 不可替换的八个原文件

以下是本轮实际只读回核结果。大小单位 bytes，SHA-256 对应各文件本体。macOS 为 arm64+x86_64；Windows / Linux 为 x86_64（deb 的平台包架构名为 amd64）。所有包 source / checkout 均为固定 `6321b24e0c46699db2695995491fea5bae97b359`。

| 原文件名 | Bytes | SHA-256 |
|---|---:|---|
| `TokenTrackerCommunity.dmg` | 61953630 | `c0d73971b7f4a640b2a052b59c52514b9e34e85e7db8547c95d10f1beaf7eb4e` |
| `TokenTracker-Community-win-x64.zip` | 114910002 | `576e5d72f69c2d031bc2f59c6b91b35784fa2661cc9d5be10622f3bffd502703` |
| `TokenTracker-Community-Setup.exe` | 80754105 | `e2996f510dfc6c8d4fee9bd57f5b24d2e68a55d40de2a264b4ddbdb056b1958b` |
| `TokenTracker-Community-linux-x86_64.AppImage` | 127502840 | `dcac2b0898266a7a74fd24bb1b0c756c2ca3dbf57165cbdca2c669f9eee3aa89` |
| `TokenTracker-Community-linux-x86_64.deb` | 57011188 | `f0b72ac0fb0ccebcf2fbfbb2fe1e93c962df90b37c0f4028148a8a49346942c6` |
| `TokenTracker-Community-linux-x86_64.rpm` | 56992428 | `9c6e5c847b6cae2e052df87aabf257e279da90d2baaf22363eff951d093c0205` |
| `SHA256SUMS` | 615 | `04c74fed3cc2453c60b8edb9a9e288000fb6a91573883aec9cac522dfb4392ee` |
| `RC_MANIFEST.json` | 1598 | `29e42ff60c9a9ef3c9e2808f7aaeba8387fb491b0d464aaf3c5ae8120c7d348f` |

SHA256SUMS 原文件仅列六包；它自身和 RC_MANIFEST.json 的摘要由上表固定，不向原文件追加两行。上传源使用原 artifact 的保留交付物，不使用 preview.1 的同名资产、d294 组合包或 Actions 外层 ZIP。禁止 clobber、改签名、重压 ZIP、修改换行或覆盖原 metadata。

## 4. 对应验收证据与限制

| 范围 | 可复用结论 / 证据归属 |
|---|---|
| 扫描根、去重、不完整发现与旧 metadata | [扫描目录移植报告](docs/community-scan-roots-port.md)：正式回归及已接受的 CI / RC；包内扫描定向实测使用旧 d294 ZIP，见 [组合包报告的扫描工具收口](docs/windows-combined-rc-acceptance.md#扫描验收工具定向收口)。6321 未改扫描代码，不宣称重新跑了一次完整原生扫描 |
| 全站 / 社区统一入口、选择器、缓存与刷新 | [UI review 与原截图](docs/community-leaderboard-ui-review.md)，以及 [d294 原生榜单验收](docs/windows-combined-rc-acceptance.md#统一排行榜与加载体验)。缓存改善是 GET 复用 / 保留内容，不能说后端变快、首次未缓存的周期不再等待，或所有原生历史快捷键均通过 |
| Windows 登出修复 | [6321 原包定向实机验收](docs/windows-combined-rc-acceptance.md#windows-登出持久性定向实机验收2026-10-05)：同 exe 重启、安装版登出→便携版、合法新登录重启三项 PASS；旧 d294 自动恢复 FAIL 保留 |
| 原六包 BUILD/PACKAGE 与下载回核 | 37225559792 / artifact 11311863214；Windows 两格式、macOS DMG、Linux 三格式内容分别核对，非桌面 GUI 替代验收 |
| Community / Auth / 同步关闭 / 原 130 Token | 复用已接受的 [Community 云端报告](backend/deploy/community-first-cloud-runtime-report.md)、Ownership 报告和 6321 原生证据。本轮无云端操作或完整双用户重跑 |
| 原普通 CI 与合并后 CI | source [37225559795](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559795)、审核 HEAD [37272841250](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37272841250)、main [37279345794](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37279345794) 均 4/4 PASS。新文档 PR CI 单独记录，不当作新产品打包 |

必须保留的限制：

- macOS / Linux **GUI/RUNTIME NOT_TESTED**。macOS ad-hoc 不是 Developer ID / notarization；Windows 未签名。包内容检查、Windows 结果不替代这些平台安装与真实运行。
- **真实 WSL、完整更高版本 updater 下载升级链 NOT_TESTED**；Linux 无应用内 updater。同版本覆盖安装不是更高版本升级。
- 旧 `51bee187` metadata 只有全局目录哈希：若先缩小范围再迁移，需恢复原范围完成一次扫描，建立分根 inventory 后再移除额外根；不能强制接受不完整历史替换。旧 `626f331` 重叠 WSL 根还需一次成功 WSL 发现建立来源标志；不可从旧 explicit 标签推断。
- 活动 Codex 配置存在整文件指纹差异，缺可信旧内容及写入者证据，变更键名 / hook / notify 分类 **NOT_TESTED / 未归因**。没有把此变化归因为 Community，也未恢复旧配置。官方安装 / 协议等其他已验证保护证据继续有效。
- 完整 Dashboard suite 两个既有基线失败：`period changes cache timeout`、`Preloaded User missing`；另保留扫描兼容性比较中五项 Windows / POSIX 路径或 Kiro fixture 基线失败、Grok slash 断言和 macOS notify 不稳定性。精选普通 CI PASS 不等于全部测试或桌面通知行为都通过。
- 完整离线及原生历史快捷键的逐步恢复不计全部 PASS。既有失败 / harness 重试记录保留，不重写为全绿。榜单仍为 `client_reported_tokens`，未启用 automatic anticheat。

稳定版仍 NOT_READY：缺少 macOS/Linux 实机环境与对应验收；签名 / 公证、真实 WSL、完整升级和既有测试 / 配置归因风险需后续分别 review。已关闭的 Windows 登出问题不再次当作开放故障，也不以该修复覆盖其他证据缺口。

## 5. Review 后的执行方案（本轮不运行）

### A. 文档合并前后 Guard

1. 经后续授权才将本次纯文档 PR 转 Ready，以 merge commit 保留历史。届时记录审定文档 HEAD、当前 origin/main、必要 CI 和实际 merge SHA；main 或 PR 有未审定变化时停止 review，不自动合入 upstream。
2. 重新核对 `6321b24e... → main` 祖先关系及差异。准备基线只允许 `docs/windows-combined-rc-acceptance.md`；本纯文档 PR 合并后允许再新增 `RELEASE_PREVIEW_2_PLAN.md`、`RELEASE_PREVIEW_2_NOTES_DRAFT.md`，总共只允许上述三份已审定文档。非文档目录差异必须为空。合并后的普通 CI 4/4 完成后再进入发布执行。
3. 确认 repo、自有 origin、工作区、十个禁用 workflow 和没有同名 tag / Release；确认 preview.1 的 tag / 公告 / 八资产仍保留。任何额外改动或名称冲突立即停止，不覆盖。
4. 再对原八文件逐一校验 size/hash、source/checkout/version 与第 3 节，不用文档 HEAD 替代打包来源。

### B. 固定 Annotated tag

仅在后续明确授权 tag 操作后执行：

```powershell
git tag -a v1.2.0-preview.2 6321b24e0c46699db2695995491fea5bae97b359 -m 'TokenTracker Community 1.2.0 technical preview 2'
git push origin refs/tags/v1.2.0-preview.2
git rev-parse 'v1.2.0-preview.2^{commit}'
git ls-remote origin 'refs/tags/v1.2.0-preview.2*'
```

必须核对 annotated tag object 与 peeled commit 的区别，本地与远端 peeled 均等于完整包 SHA。禁止 force-push、移动或覆盖已存在 tag；`target_commitish` 不能修正一个错误的已存在 tag。

### C. Draft Release 与原八文件上传

创建前安全核对自有 repo 和凭据权限，不把认证值写入命令参数、文档或临时请求文件。通过 Releases REST API 创建：

```json
{
  "tag_name": "v1.2.0-preview.2",
  "target_commitish": "6321b24e0c46699db2695995491fea5bae97b359",
  "name": "TokenTracker Community 1.2.0 — Three-platform Technical Preview 2",
  "body": "审定的 preview.2 公告正文",
  "draft": true,
  "prerelease": true,
  "make_latest": "false",
  "generate_release_notes": false
}
```

1. body 使用新公告，发布时只去掉标题“公告草稿”和准备提示，保留全部验证限制；不自动生成上游历史公告。记录 Release ID 与实际参数，始终指向已有正确 tag。
2. 上传前只运行 `node scripts/rc/artifacts.cjs verify <原交付目录> 6321b24e0c46699db2695995491fea5bae97b359`；同时按第 3 节核对八文件大小 / 摘要和目录恰有八个文件。验证不调用 assemble / record。
3. 用返回的 upload_url 逐个上传原六包与两个元数据，记录 asset ID / 名称 / size / uploaded 状态；不上传源码、外层 artifact ZIP、观察器或 credentials。
4. 失败重试仅限草稿中的明确未完成上传；已有同名条目先检查真实字节，不 clobber 或覆盖已公开资产。无法取得完整一致的八文件时停止在草稿。

### D. 草稿下载回核与公开批准

1. 从该草稿的八个 asset API 下载到新的验证目录；认证仅内存使用，不保存含签名参数的重定向 URL 或 headers。
2. 对下载文件重新校验恰八个名称、每个 size/SHA-256 对第 3 节及原上传源相同；调用 verify 校验六包和原 manifest / SHA256SUMS，另检查两个元数据自身摘要。不能仅信服务端 digest。
3. 重新核对 tag peeled、manifest source / checkout / version、Release 参数、公告及八个 asset ID。提交结果给 review；**未获公开授权时必须停在 draft**。草稿回核 PASS 不等于已经公开，也不允许新增包替代。
4. 经后续 review 批准公开才 PATCH 同一 Release：`draft=false`、`prerelease=true`、`make_latest="false"`。核对返回状态；若任何检查失败保持草稿并报告，不公开不完整交付。

创建 / 更新及资产下载行为依据 [Releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28) 与 [Release Assets API](https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28)。无需启用继承的 release workflow，不修改其版本或自动公开契约。

### E. 公开后的匿名交付核对

1. 无认证请求指定 tag 页面，检查预览标签、完整公告及八个上传资产；记录实际 HTTP 状态和 Release / asset IDs。GitHub 自动生成源码 ZIP/TAR 另计，不算这八文件。
2. 无认证下载八个 Release assets 到另一个新目录，逐文件 size/hash 与第 3 节一致；核对 manifest source / checkout/version 和 tag peeled。不是复查 Actions 外层 ZIP，也不重复产品安装。
3. `releases/latest` 不应选中 preview.2（也不把 preview.1 改为 latest）。无稳定版时实际 404 可接受；未来有稳定版则应返回该稳定版。手动下载入口使用明确 tag 页面，不使用 /latest。
4. 只读核对 preview.1 原 tag / Release / 八资产名称、size、IDs 和 digest 保留，两个发布 workflow 及其他八个仍禁用，无意外发布 / npm / Homebrew / 运营 run。
5. 记录实际操作与匿名结果，区分技术预览交付 PASS 和稳定版 NOT_READY。原已验产品、云端及安装证据复用；不补写不存在的下载或 GUI 验收。

## 6. 当前交付与待 review 决定

新公告为 [RELEASE_PREVIEW_2_NOTES_DRAFT.md](RELEASE_PREVIEW_2_NOTES_DRAFT.md)。本轮仅这两份新文档；纯文档 HEAD、Draft PR 链接与文档 CI 的实际 SHA / run 在 PR 摘要和交付结果记录，不为自记 SHA 循环追加文档提交。CI 按现有规则自动执行；本纯文档差异不匹配三平台 build-only 触发路径，不手动重跑 RC。

待 review 的事项是：批准这份公告、固定 tag/source 与原八文件技术预览定位；是否授权后续文档 PR merge 和 tag / draft / 上传操作；以及草稿八文件回核后何时明确批准公开。macOS/Linux GUI、签名、真实 WSL、完整升级及配置归因并未关闭，不能把本次材料通过等同稳定版可发布。

**停止点：READY FOR REVIEW。** 本轮不 merge、不创建 tag / Release、不上传资产，不修改产品、版本、云端或 workflow 开关，不开始下一批移植或新功能。
