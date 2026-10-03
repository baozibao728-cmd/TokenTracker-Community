# TokenTracker Community — 首次三平台技术预览发布方案

日期：2026-10-04（Asia/Taipei）。**审定方案已获授权并执行：三平台技术预览已公开，八文件匿名回核 PASS；稳定版仍 NOT_READY。实际 merge/tag/Release/asset IDs 及工作流状态见 [发布记录第 17 节](RELEASE_OWNERSHIP_CUTOVER_REPORT.md#17-首次三平台技术预览实际发布2026-10-04)。**

以下保留原审定准备方案的参数和步骤；实际执行结果以发布记录第 17 节为准。准备阶段只更新文档和 Draft PR 描述，沿用已接受的普通 CI、三平台 BUILD/PACKAGE、下载回核、最终 Windows 安装版/便携版及 Community/Auth/隔离证据。没有重新构建包、重复生命周期或全量回归。历史 run、失败/重试、隔离例外和凭据处置详见 [Ownership Cutover Report](RELEASE_OWNERSHIP_CUTOVER_REPORT.md)；完整对外公告见 [Release Notes Draft](RELEASE_NOTES_DRAFT.md)。

## 1. 发布定位与已接受证据

首发保留全部六包，统一标为三平台技术预览。Windows 实机验收 PASS；macOS/Linux BUILD/PACKAGE PASS，但 GUI/RUNTIME NOT_TESTED，不缩减成 Windows-only。

| 范围 | 结论 | 证据/边界 |
|---|---|---|
| 固定包源码 | `0a143a05b975854365294201d9f690f6f70c0059` | 三个平台及 delivery checkout 均为此 SHA，包内版本 1.2.0 |
| 该源码普通 CI | PASS，4 jobs | [37119385289](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289)，实际 PR merge checkout `359c80ff102dcb234e748d7266c668777dbabc5b` |
| 三平台 build-only RC | BUILD/PACKAGE PASS，attempt 1 | [37119385283](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283)，candidate、Windows、macOS、Linux、delivery 成功 |
| 原交付 artifact | 下载回核 PASS | [11272578871](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/artifacts/11272578871)，原六包、SHA256SUMS、RC_MANIFEST.json |
| Windows 安装版/便携版 | 最终 CI 字节实机定向验收 PASS | 报告第 15 节；不是 Vite 或管理员注入 session |
| Community、Auth、同步偏好与管理 key 处置 | review 接受 PASS | 复用已有证据，本轮不重复验证或操作自有云端 |
| macOS/Linux | 仅 BUILD/PACKAGE PASS | GUI/RUNTIME NOT_TESTED；人工清单在报告第 15.3 节 |
| 开始本轮时的 PR head | `2500aabc42da8cc3bb95a021e9492e157833aa4a` | 相对包源码仅报告差异；普通 [CI 37133392957](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37133392957) PASS，实际 merge checkout `ab948ede149620fd0c53b18bd350d4400621a264` |

上述 artifact 的 API 元数据已重新只读核对：未过期、run/source 一致、run completed/success；当前到期时间 **2026-11-02 19:32:54 台北时间**。若后续 Actions 链接过期，使用已下载回核、受原 manifest/checksum 约束的同一份原文件；不得静默重建替代。新文档提交的 PR head 以 Git/PR 实际值为准，不能改写成上述包源码。

## 2. 拟定发布参数

| 参数 | 拟定值 |
|---|---|
| Repository | `baozibao728-cmd/TokenTracker-Community` |
| PR | [Draft PR #1](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/1)，base `main` |
| Release 名称 | `TokenTracker Community 1.2.0 — Three-platform Technical Preview 1` |
| tag | `v1.2.0-preview.1` |
| tag 解引用后的完整 commit / target_commitish | **`0a143a05b975854365294201d9f690f6f70c0059`** |
| 包内版本 | **`1.2.0`**，所有平台保持不变；tag 的 preview 后缀只表达发布通道 |
| prerelease | `true` |
| make_latest | **字符串 `"false"`**，创建及公开更新时都显式设置 |
| draft | 先 `true`，原资产上传、下载回核及 review 完成后才 `false` |
| generate_release_notes | `false`；使用审定的公告，避免混入上游历史 |
| 发布执行方式 | 自有仓库的 Git + GitHub Releases REST API/正常管理界面，附加原文件；不 dispatch 现有 release workflows |
| 资产 | 六个原安装包 + 原 `SHA256SUMS` + 原 `RC_MANIFEST.json`，共 8 文件 |

tag 指向包的真实 source，而不是尚未产生的 merge commit，也不是之后的纯文档 head。PR 合入 main 后，应证明该源码已在 main 的历史中；GitHub 自动生成的 tag 源码归档也对应实际打包源码。后续公告/验收文档可以来自审定的 PR 文档 head，二者分别记录。

GitHub 的 prerelease 不作为 latest，`releases/latest` 只返回非 draft、非 prerelease 的发行版。[GitHub Releases API](https://docs.github.com/en/rest/releases/releases?apiVersion=latest)

因此预览通过明确的 tag 页面和资产链接手动下载，**不会被现有 Windows/macOS 稳定更新检查发现**。只有预览、没有稳定 Release 时，latest 查询仍可能 404、原生 UI 仍可能显示检查失败；这是首发更新通道的已知限制，不承诺修复或下载升级已通过。

## 3. 与现有发布 workflow 的契约

- `scripts/version-files.cjs` 只接受数字三段 `x.y.z`；现有 `release-dmg.yml` 检查受管理版本一致，创建 `v$VERSION` tag，tag 指向触发它的 `$GITHUB_SHA`。
- 该 workflow 会从 tag 重新构建 Windows/macOS/Linux，产生新的六包及 checksum，最终自动取消 draft 并设置 latest。它不能消费本次既有 artifact 原字节，也不支持 `1.2.0-preview.1` 作为包版本输入。
- `release-windows.yml` 也会重新打包，且只向匹配版本、已存在的 draft 上传；不能作为本次原样发布的替代入口。
- 给现有 workflow 输入 `1.2.0` 会创建 `v1.2.0`、重建及走稳定发布路径；输入 preview 后缀会违反版本校验。本次不修改该契约，也不为了 tag 命名更改包内版本。
- **保持两个发布 workflow 及其余 8 个继承/运营 workflow disabled_manually**。只保留普通 CI 和审查过的 build-only RC active；本次操作步骤不使用任一自动发布 workflow。

当前 Windows/macOS updater 读取自有 `releases/latest`，按数字段比较版本，不具备独立 preview 更新通道。预览 tag 不进入此解析路径；不能宣称 updater 支持完整 prerelease SemVer。

## 4. 不可替换的原资产清单

六包 version/source/checkout 均为 `1.2.0` / `0a143a05b975854365294201d9f690f6f70c0059`。大小是原文件 bytes；SHA-256 对应安装包本体，不是 Actions 外层 ZIP。

| 原文件名 | 架构 | Bytes | SHA-256 |
|---|---|---:|---|
| `TokenTrackerCommunity.dmg` | arm64+x86_64 | 61896126 | `5c850f0dba9d72d8cbe544cf244b8b2985c8783386ef27e73e50ef448e177441` |
| `TokenTracker-Community-win-x64.zip` | x86_64 | 114892518 | `2e913bb78c18aec0f1b96d71edf9854521e4d678a842eed9e29619dd751c4f4e` |
| `TokenTracker-Community-Setup.exe` | x86_64 | 80741452 | `9660c2ddeda46f88f9da10329560a393dfe284ff9615fbdeca77af13acfb008d` |
| `TokenTracker-Community-linux-x86_64.AppImage` | x86_64 | 127486456 | `aabac8decd202a9f3d3c41048508daca324ed4acd412e15699da5d09ed8fdc63` |
| `TokenTracker-Community-linux-x86_64.deb` | amd64 | 56989076 | `39ce996cbf1982f0b0e0a254a85a561c4e1e064c98e8c28298598f9967241add` |
| `TokenTracker-Community-linux-x86_64.rpm` | x86_64 | 56975561 | `d14b8c7e763d812f10504b011080840cc403a9778b1cbdeccbd24a8ab6150125` |

补充两个既有元数据文件，字节不重新生成：

| 文件 | SHA-256 | 用途 |
|---|---|---|
| `SHA256SUMS` | `a28307bb0c1d6859673e6f933542e6ace47e7d4c65c284080bb63b15328b5ee8` | 只包含六个原包的 checksum 行；保留原顺序和换行 |
| `RC_MANIFEST.json` | `a1d63763c6350a6ae51453f4d7629abc3e0b7b4ee1ccd78340b8491e8dc5bacd` | version/source/checkout、六包名称/架构/size/hash 的原交付记录 |

不改名，不对 Windows 包追加签名，不改 DMG 签名，不重压 ZIP，不重新生成 SHA256SUMS。若必须改变任何包字节，停止这个原样发布方案，另建版本候选并重新审查受影响验收。

## 5. Review 后的 merge → tag → Release 操作步骤

以下是待授权的执行方案，**本轮没有运行**。每阶段保存 commit、Release ID、资产 ID、HTTP 结果和摘要；不保存 credential/header、签名下载 URL 或原始敏感响应。

### A. 合并前 guard

1. 重新确认自有 origin、PR #1 仍指向自有 main，开发分支工作区 clean。记录届时审定的完整 `FINAL_PR_SHA`、`origin/main` 与 review 结果；若 PR head/main 已变，先 review 差异。
2. PR 的最终必要检查完成。文档更新不会改变已验收包的 source SHA；不得把新 head 的普通 CI 当成一次新打包。
3. 检查 10 个不应运行的 workflows 仍禁用，尤其 npm、运营和两个 release workflows。确认没有同名 tag/Release；若已存在，停止，不覆盖或 force-push。
4. 对照包源码到最终 PR 的差异。当前允许的文档差异仅：`RELEASE_OWNERSHIP_CUTOVER_REPORT.md`、`RELEASE_NOTES_DRAFT.md`、`RELEASE_READINESS_PLAN.md`。任何源码、构建脚本、workflow、lockfile、版本、配置、后端、migration 的额外差异都先停止 review。

示例只读命令（变量值来自实际 Git 结果，不猜测）：

```powershell
$packageSha = '0a143a05b975854365294201d9f690f6f70c0059'
$finalPrSha = git rev-parse origin/chore/release-ownership-cutover
git diff --name-status $packageSha $finalPrSha
git merge-base --is-ancestor $packageSha $finalPrSha
```

最后命令应 exit 0。对新增的每个差异文件审查内容，并核对非文档目录 diff 为空；不能只用包版本相同推断源码相同。

### B. PR 合并与 main 核对

1. 经独立授权后用 merge commit 保留 cutover 历史，建议通过 PR 的 **Create a merge commit**；不 squash/rebase，不合入 upstream。
2. 取回 origin/main，记录实际 `MERGED_MAIN_SHA`，确认最终 PR SHA 和 package SHA 均为其祖先。不得将 GitHub CI 的 synthetic merge checkout 当作 main 实际 merge commit。
3. 再对照 `packageSha → MERGED_MAIN_SHA`：除上述三个审定文档外必须完全相同。检查主线意外并发变更、merge 冲突解决、工作流或 runtime-config 差异；不满足就停止发布。
4. 保存 merge SHA、PR SHA、package SHA 的关系。无需为纯文档差异重建已验收六包，也不将 main 的 merge SHA 写回 RC_MANIFEST。

### C. 固定 tag

在上述核对后，经 tag 操作授权：

```powershell
git tag -a v1.2.0-preview.1 0a143a05b975854365294201d9f690f6f70c0059 -m 'TokenTracker Community 1.2.0 technical preview 1'
git push origin refs/tags/v1.2.0-preview.1
git rev-parse 'v1.2.0-preview.1^{commit}'
git ls-remote origin 'refs/tags/v1.2.0-preview.1*'
```

本地与远端 annotated tag 解引用必须都是完整 package SHA；tag object SHA 可以不同于 commit SHA，二者不能混淆。禁止自动补 tag、移动已发布 tag 或恢复任何继承发布流程。

### D. 草稿 Release 与原文件上传

1. 使用自有仓库的正常认证；通过 `POST /repos/baozibao728-cmd/TokenTracker-Community/releases` 创建 draft。认证由安全配置在内存提供，不把 key 写到命令参数、请求文件或报告。
2. 请求体固定如下；`body` 填入审定公告正文（标题去掉“公告草稿”，删除草稿提示行及“目前尚未创建”字样），不得自动生成上游历史说明：

```json
{
  "tag_name": "v1.2.0-preview.1",
  "target_commitish": "0a143a05b975854365294201d9f690f6f70c0059",
  "name": "TokenTracker Community 1.2.0 — Three-platform Technical Preview 1",
  "body": "审定公告正文（执行时替换本占位文字）",
  "draft": true,
  "prerelease": true,
  "make_latest": "false",
  "generate_release_notes": false
}
```

3. 将已下载的原 artifact 作为上传源；上传前执行现有只读字节校验：

```powershell
node scripts/rc/artifacts.cjs verify $releaseAssetDirectory 0a143a05b975854365294201d9f690f6f70c0059
```

`$releaseAssetDirectory` 是装有原六包及两个原元数据文件的本机安全目录，不纳入 Git。另按第 4 节分别核对元数据文件自身摘要，验证脚本只读且不重新生成文件。

4. 使用 Release 返回的官方 `upload_url` 逐个上传第 4 节 8 个原文件；核对名称、size、state=uploaded，并保存资产 ID。不要上传 Actions 外层下载 ZIP、源码开发目录、.insforge 或临时观察器。
5. 重试只限同一草稿的明确未完成上传；若有同名文件，先对照已上传字节。不能使用 clobber 覆盖公开资产，不能隐藏上传失败或删除逻辑绕过核对。

### E. 上传后下载回核与公开

1. 从草稿 Release 的 asset API 下载 8 个文件到一个**新的**验证目录，保留原上传源不覆盖。需要认证的下载只在内存使用正常 GitHub 凭据。
2. 对下载后的六包重跑上面的 `artifacts.cjs verify`，并比较全部 8 文件 size/hash 与原上传源及第 4 节；不是核对外层 ZIP，也不只依赖服务端 digest。
3. 核对 tag peeled SHA、Release ID/参数、公告、原 manifest，全部一致才进入公开步骤。review 还未授权公开时，停在 draft。
4. 经公开发布授权，`PATCH /repos/baozibao728-cmd/TokenTracker-Community/releases/{release_id}`：`draft=false`、`prerelease=true`、`make_latest="false"`。不要去 dispatch 自动公开 workflow。
5. 若任何上传/下载/参数核对失败，保留草稿并报告具体问题；不发布不完整资产、不重建替代、不删除或移动已公开 tag。公开之后原六包和 checksum 视为不可替换；发现问题另开明确修正版本。

GitHub 允许用 draft 暂存并通过更新 Release 公开；上述参数依据 [Releases REST API](https://docs.github.com/en/rest/releases/releases?apiVersion=latest)，资产上传/下载依据 [Release Assets REST API](https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28)。

## 6. 发布后的最小核对

公开后只做交付核对，不重复已接受的产品/云端生命周期：

1. 匿名访问指定 tag 的 Release 页面，确认 prerelease 标签、公告限制、8 个资产和 6 种包格式全部可见，无平台遗漏。
2. 匿名下载 8 个实际 Release assets 到独立目录，再核对六包及两个元数据 SHA-256、size、manifest.source_sha、tag peeled commit；记录 Release/asset ID 与 HTTP 状态。无需再次安装或重跑同步。
3. 查询自有 `releases/latest`：不应选中 preview。无稳定发行版时允许实际 404；未来有稳定版则应返回该稳定版，不篡改或创建假版本补证。
4. 公告和下载按钮使用 `releases/tag/v1.2.0-preview.1` 或其明确资产链接，不使用 `/latest` 作为预览入口，不链接官方安装包。
5. 确认 10 个禁用 workflow 仍禁用，没有 npm/Homebrew、运营任务或自动发布 run 被意外启动；main/PR/tag 关系、工作区和报告与操作记录一致。
6. 不写云端数据，不执行 migration/Edge 部署，不获取用户凭据。真正的 macOS/Linux 实机反馈按既有清单补齐后独立 review，不能由本节匿名下载核对替代。

## 7. 稳定发布真正缺少的条件

| 分类 | 当前事实 | 进入稳定版前的处置 |
|---|---|---|
| 缺少对应桌面环境 | macOS DMG 与 Linux AppImage/deb/rpm 的安装、GUI、runtime、Auth/协议回调、会话/关闭偏好/官方共存未实测 | 找到实际测试者，按报告第 15.3 节逐格式、覆盖适用架构/代表性发行版验收；失败按复现修复。不可用 Windows 或解包 PASS 代替 |
| 已知发行限制 | Windows 未签名；macOS 只有 ad-hoc、无 Developer ID/notarization | 获得签名/公证后重新打包验证，或由稳定发布 review 明确接受继续未签名及真实安装阻碍/支持范围。这不是现阶段产品故障，也不能宣称已解决 |
| 升级证据缺口 | 完整 updater 下载→checksum→安装→重启未实测；Linux 没有应用内 updater | 后续真实、更高版本候选得到授权后验证 Windows/macOS 实际升级和数据/偏好保持；不为补证创建假 Release。Linux 保持手动安装渠道说明 |
| 既有测试问题 | 两个 Dashboard 全球排行榜全量 suite 基线失败、macOS notify 曾不稳定 | 分开确认影响与稳定发行风险；需要修复时另行授权。精选普通 CI PASS 不覆盖全量测试失败或 macOS 桌面通知行为 |
| 已观察体验 | 详情页 focus 时短暂“刷新中” | 已有创建/查看/删除成功证据，未证明永久卡住。若出现持续卡住，需真实复现；不为短暂刷新重构本版 |
| 预览通道本身的限制 | 没有稳定 Release 时原生更新检查可能失败；preview 不进入 latest | 这是所选通道的预期限制。稳定版公开后验证真实 latest 和正确升级提示，不把当前 404 当成网络根因或完整升级 PASS |
| 需要 review 决定的产品边界 | client_reported_tokens、无 automatic anticheat；云端仅 MVP 能力 | 稳定版继续保留这些公开边界，或另行开发/验收；不把“稳定”改名当作已获得反作弊能力 |

目前没有新增且已确证、仍未关闭的 Windows/Community 阻断故障；也不由未测环境推断“没有故障”。缺少证据和发行渠道限制应与实际故障分开。此前同步偏好和管理 key 问题已经 review 关闭，本轮不重复轮换或验收。

## 8. 后续稳定版本及资产规则

推荐稳定首版为 **`1.2.1` 或更高**，使用对应稳定 tag `v1.2.1`，受管理版本同步后建立新的三平台候选、验收、再由独立 review 授权 `prerelease=false` / `make_latest="true"`。本轮不修改版本或预先创建此 tag。

原因是本次预览原生包内版本已是 `1.2.0`；现有 updater 按包内数字版本比较，同版本 `v1.2.0` 稳定发行不会作为升级提供。GitHub tag 的 preview 后缀不能解决包内版本相同的问题。即使只变更签名或打包，也要产生新的真实资产、checksum 与验收记录；不得假称原 artifact 字节仍相同。

不要把 preview Release 原地取消 prerelease、改为 latest，也不要移动 preview tag 或覆盖资产。如决定手动把完全相同字节作为单独 `v1.2.0` 稳定发行，必须另行 review，并明确这只是发布通道变化、**不能实现从已安装 1.2.0 预览版自动升级**；因此不作为推荐稳定路径。

## 9. 本轮交付与停止条件

- 公告：`RELEASE_NOTES_DRAFT.md`，正确区分创建生成邀请码、加入邀请码、已同步云端排行和最新用量所需同步。
- 操作材料：本文件，含参数、固定 source SHA、8 文件资产、合并后差异检查、上传及两次下载回核、稳定条件。
- 验收证据：`RELEASE_OWNERSHIP_CUTOVER_REPORT.md`；历史记录保留，实际发布结果见报告第 17 节。
- Draft PR 描述重写为最终实现、有效验证及预览限制；旧 run/修复历史留在报告，不混用过时阻塞。

**原审定授权已执行：** 用户已批准按固定 v1.2.0-preview.1、固定包源码、prerelease=true/make_latest="false" 及原八文件执行 PR merge → annotated tag → draft 上传/下载回核 → 公开 → 匿名回核；全部完成。结果见发布记录第 17 节，稳定版仍 NOT_READY。
