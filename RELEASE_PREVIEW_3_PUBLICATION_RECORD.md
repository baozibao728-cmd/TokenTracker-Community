# TokenOrbit v1.2.0-preview.3 公开交付记录

结论：**preview.3 公开交付 PASS**。这是三平台手动下载技术预览，**稳定版仍 NOT_READY**。本记录是实际发布及匿名字节回核结果，不替代原 GUI/安装验收，也不代表完整自动升级链已通过。

## 1. 实际发布及固定来源

| 项目 | 实际值 |
|---|---|
| 自有仓库 | `baozibao728-cmd/TokenTracker-Community` |
| 公开链接 | [TokenOrbit 1.2.0 — 三平台技术预览 3](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.3) |
| Release ID | **408082228**，复用同一审定草稿 |
| 实际发布时间（GitHub UTC） | **2026-10-09T17:41:51Z** |
| 台北时间 | **2026-10-10 01:41:51 (UTC+08:00)** |
| Tag | `v1.2.0-preview.3`，annotated |
| Tag object（本地与远端已核对） | `792977133bdb91fc2fe8e4735ca0805eec1014f4` |
| Tag peeled / 包 source / checkout | **`04842178b611f52c3a6180fbd27b089e0737bccf`** |
| 包内版本 | **1.2.0** |
| 原六包与元数据 artifact | [11527574101](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37726143381/artifacts/11527574101) |
| 文档 PR #10 审定 HEAD | `1a74c1b4c383c3d30f707a1c46a25e49452dc13b` |
| 实际文档 merge / 发布时 main | `809dfd170220be80a4934755bd1a3a01b41f0ea3` |
| main 普通 CI（既有合并证据） | [37954819637](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37954819637)，4/4 PASS，checkout 为文档 merge SHA |
| 匿名交付回核完成（UTC） | 2026-10-09T17:46:42.003Z |

固定包源码是上述发布时 main 的祖先；源码到发布时 main 的差异仅为已审定七份文档/截图和两份 preview.3 发布文档，共九文件。该文档合并树与审定 PR #10 HEAD 一致，完整历史保留。发布时的文档 merge SHA 只用作公告中的固定文档/图片链接，**不重写包来源或 manifest**。公开发布阶段未新增提交、移动 tag 或变更 main；后续本记录入库的文档 commit/merge 与 CI 结果单独记录在收口 PR 摘要，不循环追加本记录自身 SHA。

## 2. 公开前认证 Guard 与实际 PATCH

在公开前认证重新读取 **Release 408082228**，确认仍为 `draft=true`、`prerelease=true`，name、tag、target_commitish、公告全文、八个 asset ID/名称/大小/上传状态/服务端 SHA-256 均与已审定草稿回核一致；tag object / peeled SHA 与本地及审定记录一致。preview.1/preview.2 及十个继承 workflow 未变。PATCH 前再次执行相同 Guard，无未审定变化。

本轮唯一 Release 写入为同一 ID 的 PATCH，实际请求：

```json
{
  "draft": false,
  "prerelease": true,
  "make_latest": "false"
}
```

PATCH HTTP **200**；认证再次读取及公开后的匿名 API 均确认同一 ID、`draft=false`、`prerelease=true`、审定公告和原八资产不变。`make_latest` 是请求中显式传入的字符串 `"false"`，GitHub API 不提供对应 readback 字段；latest 实际行为另见第 5 节。未创建新 Release、上传/替换资产或自动生成历史公告；原创建记录 `generate_release_notes=false` 保留。

## 3. 匿名页面、API、公告与固定链接

在**没有 Authorization、Cookie 或凭据加载**的独立验证进程中：

- 指定 tag 页面 HTTP **200**；确认预览标记、TokenOrbit 名称、审定公告和平台未验收说明可见。
- 指定 tag Release API HTTP **200**；公告全文与审定实际正文逐字一致。正文 SHA-256：`969d87a62f01198a72205c42c095dc05d7d172138ea22337c727108a3d6bfb01`。
- 无认证 tag ref/tag object 读取确认 annotated tag peeled 仍为固定包 SHA。
- 四个文档链接均固定到文档 merge `809dfd170220be80a4934755bd1a3a01b41f0ea3`，无需认证可访问：

- [RELEASE_PREVIEW_3_PLAN.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/809dfd170220be80a4934755bd1a3a01b41f0ea3/RELEASE_PREVIEW_3_PLAN.md)：匿名 blob HTTP 200 / raw HTTP 200，raw 字节与固定 Git tree 及审定摘要一致。
- [docs/tokenorbit-brand-name-validation.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/809dfd170220be80a4934755bd1a3a01b41f0ea3/docs/tokenorbit-brand-name-validation.md)：匿名 blob HTTP 200 / raw HTTP 200，raw 字节与固定 Git tree 及审定摘要一致。
- [docs/brand-icon-validation.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/809dfd170220be80a4934755bd1a3a01b41f0ea3/docs/brand-icon-validation.md)：匿名 blob HTTP 200 / raw HTTP 200，raw 字节与固定 Git tree 及审定摘要一致。
- [docs/windows-combined-rc-acceptance.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/809dfd170220be80a4934755bd1a3a01b41f0ea3/docs/windows-combined-rc-acceptance.md)：匿名 blob HTTP 200 / raw HTTP 200，raw 字节与固定 Git tree 及审定摘要一致。

公告不直接嵌入图片；固定报告内 **16** 个图片引用按同一文档 merge SHA 的 raw 路径匿名 HEAD 核对，全部 HTTP 200。这是链接可访问性检查，旧截图继续保留原候选归属，不作为新 GUI 验收。

## 4. 八资产匿名下载及实际字节回核

公开的八个原资产保留原文件名、ID、大小及 digest。使用 Release API 提供并核对的公开 download URL，将每个文件匿名下载到**新的独立目录**，没有沿用原件或带认证草稿下载目录。所有下载通过 GitHub 302 到公开资产存储后实际 HTTP **200**；重定向中的临时签名 URL 仅在内存使用，不保存到记录或日志。

逐一读取下载字节、计算 SHA-256，与审定原八文件及草稿回核清单比较：**8/8 PASS**。以下摘要均对应实际文件本体，不是 Actions 外层 ZIP。

| 原文件名 | Asset ID | Bytes | 匿名下载 SHA-256 | HTTP / 结果 |
|---|---:|---:|---|---|
| `RC_MANIFEST.json` | 625456592 | 1598 | `0d295d89bc3fd5ad35438aefcd6b2a3189a0be7cab02a507226add45692cebdc` | 200 / PASS |
| `SHA256SUMS` | 625456635 | 615 | `913c43f8938d2ac8a660dc3b17872e7a6b1bb3a0971db5ae63cda0a3c3a1f8b8` | 200 / PASS |
| `TokenTracker-Community-linux-x86_64.AppImage` | 625456693 | 127465976 | `8616fee6aa341f7e87b42117ded5ba02f28effb81f6674d048d168ca6c81793f` | 200 / PASS |
| `TokenTracker-Community-linux-x86_64.deb` | 625458710 | 56978500 | `638a1ac679703af9bb59ff6f1bb60e8d1a639e5a6ebb5327883feebe43fa398b` | 200 / PASS |
| `TokenTracker-Community-linux-x86_64.rpm` | 625459550 | 56953255 | `42d5a031ecd63dc46f399ebf7588f2fd30706d796a9b029fe013dcda018d6013` | 200 / PASS |
| `TokenTracker-Community-Setup.exe` | 625460552 | 80795557 | `30933f453897588267ef85a569071ce6d7c3e656b3143138212803b1c9f90d26` | 200 / PASS |
| `TokenTracker-Community-win-x64.zip` | 625462038 | 114957780 | `c177df3ce46cc28f5422b13316ccaebc4ff22d41c80d9cb2d437eac7e40f4915` | 200 / PASS |
| `TokenTrackerCommunity.dmg` | 625464014 | 61892760 | `4c47602f834e88ed970856b66765d12572c91c716e79df9d2eb2c11881c81105` | 200 / PASS |

现有 `scripts/rc/artifacts.cjs verify` 在独立匿名下载目录验证六包、RC_MANIFEST 和 SHA256SUMS：**PASS**。manifest source_sha / checkout_sha 均为 `04842178b611f52c3a6180fbd27b089e0737bccf`，version 为 `1.2.0`。SHA256SUMS 原六条记录不变；两个元数据文件自身摘要也按上表分别回核 **PASS**，未向原文件追加、重写或重新生成 metadata。

GitHub 自动生成的源码 ZIP / TAR 另计，**不属于八个上传资产**，本轮没有把它们作为原安装包或重新上传。未重建、重签、重压、改名、重装或替换既有公开预览资产。

## 5. latest 的 API 与网页行为分别记录

无认证 `GET /repos/baozibao728-cmd/TokenTracker-Community/releases/latest` 实际 HTTP **404**，选中 tag 为 **无**。没有选中 preview.3；只有预览、没有稳定版时的实际 404 按审定方案接受。

网页 `/releases/latest` 无认证、手动跟随重定向，实际链路：

| 地址 | HTTP |
|---|---:|
| [https://github.com/baozibao728-cmd/TokenTracker-Community/releases/latest](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/latest) | 302 |
| [https://github.com/baozibao728-cmd/TokenTracker-Community/releases](https://github.com/baozibao728-cmd/TokenTracker-Community/releases) | 200 |

网页最终地址：[https://github.com/baozibao728-cmd/TokenTracker-Community/releases](https://github.com/baozibao728-cmd/TokenTracker-Community/releases)，HTTP **200**。网页能进入 Releases 列表不等于 latest API 选中本预览。实际下载入口仍是明确 preview.3 tag；包内版本依然 1.2.0，不宣称同版本预览自动更新或完整更高版本升级链通过。

## 6. 旧预览、工作流与操作边界

认证与匿名保护核对均与发布前不可覆盖的安全 snapshot 相同：

| 预览 | Release ID | 上传资产数 | 比较结果 |
|---|---:|---:|---|
| [v1.2.0-preview.1](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1) | 402619253 | 8 | tag / 公告 / asset IDs、名称、大小、digest 均不变 |
| [v1.2.0-preview.2](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.2) | 403529694 | 8 | tag / 公告 / asset IDs、名称、大小、digest 均不变 |

比较覆盖 tag object / peeled、Release ID/name/body/target/draft/prerelease、各八个 asset ID/name/size/state/digest。未再次下载旧预览包，未修改旧 tag、公告或资产。

实际工作流状态（发布后只读）：

| Workflow | ID | 状态 |
|---|---:|---|
| .github/workflows/ci.yml | 369909803 | active |
| .github/workflows/codeql.yml | 369909806 | disabled_manually |
| .github/workflows/labeler.yml | 369909810 | disabled_manually |
| .github/workflows/leaderboard-anticheat.yml | 369909815 | disabled_manually |
| .github/workflows/leaderboard-freshness.yml | 369909820 | disabled_manually |
| .github/workflows/leaderboard-moderation-audit.yml | 369909821 | disabled_manually |
| .github/workflows/lock-closed.yml | 369909824 | disabled_manually |
| .github/workflows/npm-publish.yml | 369909825 | disabled_manually |
| .github/workflows/rc-build-only.yml | 373836111 | active |
| .github/workflows/release-dmg.yml | 369909826 | disabled_manually |
| .github/workflows/release-windows.yml | 369909827 | disabled_manually |
| .github/workflows/stale.yml | 369909828 | disabled_manually |

十个继承工作流继续 `disabled_manually`，与前置 snapshot 一致。检查 Actions runs 自 **2026-10-09T15:50:46.517Z** 起至发布后复核；继承发布/npm/Homebrew/云运营等 workflow 新 run **0**。该区间可见的普通 CI/RC run 如下，均为已知文档阶段的自动 CI，不是本轮 dispatch：

| Run | Workflow | Event | 状态 / 结果 | HEAD |
|---|---|---|---|---|
| [37954819637](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37954819637) | .github/workflows/ci.yml | push | completed / success | `809dfd170220be80a4934755bd1a3a01b41f0ea3` |

本轮仅对自有 GitHub Release 进行一次 PATCH，并读取公开交付及仓库保护状态；未启用/dispatch workflow，未调用 InsForge、执行 migration、部署 Edge、轮换凭据或上传 Token 数据。对“无云端操作”的结论限于本轮执行范围及 Actions 可见记录，未另作云端访问审计，也未重复已有云端验收。

**发布操作结束时的历史状态：**当时本地 main、origin/main 和远端 main 均为文档 merge `809dfd170220be80a4934755bd1a3a01b41f0ea3`，公开发布阶段无新的 commit/push；写入本记录前工作区 clean。发布验收交付时唯一新增未跟踪文件是本记录，随后获得独立的文档入库收口授权。后续纯文档提交/merge 及 CI 结果单独记录在收口 PR 摘要，不与实际发布 merge 混淆，不循环追加本记录自身的提交 SHA。

安全 JSON、实际审定公告和匿名下载回核文件保留在忽略的证据目录；发布认证仅在进程内存中，未进入命令参数、报告、Git、资产或非必要临时文件。临时执行 helpers 在收尾清理；原八文件和必要安全证据保留。

## 7. 本轮失败与修正记录

本轮认证 Guard、同 Release PATCH、匿名页面/API、八文件实际下载、元数据与 tag、固定链接、latest、旧预览和 workflow 保护核对均一次通过。**本轮没有验证器失败或产品修正**，未因失败覆盖公开资产或放宽断言。

此前草稿阶段的本地 Git ref 写入权限问题及读取 job log 首次 HTTP 415 是既有执行工具失败；对应旧回核报告保留其失败与处理记录，不抹去或改写成新的产品 PASS。新旧证据分开归属。

## 8. 既有有效验收与完整保留限制

- 本固定 `04842178…` Windows Setup 覆盖安装/TokenOrbit 品牌/唯一卸载入口/owned 快捷方式迁移/账号与本地数据/关闭同步保留为已接受实机 **PASS**；本轮不重复安装。图标缓存、托盘与桌面截图归属此前 `7e7b63d42e847f9387a4c83af24b9af415c534cd`，不改写为本包新实测。Windows portable 本固定包为 BUILD/PACKAGE/下载回核与 Setup payload 一致性 PASS，旧候选 portable/登出原生 smoke 不冒充本包新增 GUI 证据。
- 三平台正式包 BUILD/PACKAGE 及下载回核 PASS；macOS arm64+x86_64、Windows/Linux x86_64（deb metadata amd64）。**macOS/Linux GUI/RUNTIME NOT_TESTED**，无对应桌面实机不缩减发布范围，也不将包检查或 Windows 结果代替其 GUI。
- **Windows 未签名**；macOS 仅 **ad-hoc**，无 Developer ID/notarization。编译后 macOS 图标像素/GUI 对照及 Windows 深色任务栏静态托盘变体实际切换未验。
- 包内保持 **1.2.0**；这是**手动下载技术预览**。**旧客户端自动升级、真实 WSL、完整更高版本 updater 下载→安装→重启链 NOT_TESTED**。macOS 新安装落点策略与 XCTest 只覆盖新客户端，不代表旧客户端自动获得该策略；Linux 没有应用内 updater，同版本覆盖安装不等于更高版本完整升级。
- 旧 `51bee187` metadata 只有全局目录哈希：已缩小范围时需恢复原范围成功扫描建立分根 inventory，再移除额外根。旧 `626f331` 重叠 WSL 来源仍需一次成功 WSL 发现建立标记，不从旧 explicit 标签猜测；不删除历史或放宽完整发现保护取得表面通过。
- Codex 配置整文件指纹差异缺少可信旧内容和写入者证据，变更键/hook/notify 分类保持 **NOT_TESTED / 未归因**。不恢复旧配置，也不声称已证明本产品改写或排除全部写入者。
- 完整 Dashboard suite 两个基线失败（`period changes cache timeout`、`Preloaded User missing`）、扫描比较的五项 Windows/POSIX 路径或 Kiro fixture 基线失败、Grok slash 断言、macOS notify 不稳定性保留。精选普通 CI PASS 不等于全部测试全绿；完整离线与原生历史快捷键逐步恢复未全部验收。
- 少量 README/tagline 及 Linux 故障文案旧名留待后续清理。保留 MIT/上游来源，以及 Community 技术文件名、AppId/bundle ID、Linux 包身份、内部 exe/runtime、数据目录、协议、自启动、backend/updater 归属；GitHub 仓库不改名。
- Community 排行使用已同步自有云端的 `client_reported_tokens`，需要最新用量时用户主动开启同步；automatic anticheat 未启用。首次无缓存读取仍可能等待，短时缓存/保留内容刷新不等于后端响应加速，不承诺预读或完整离线。
- Community/Auth/同步关闭/数据隔离/管理 key 处置及原 130 Token、空 Community 表的已接受证据保留；本轮不触达云端或上传样本，不把旧结论写成新的数据审计。
- 本地登出持久性 PASS 不等于云端会话撤销已验证；上游 logout 403 的实际状态及响应语义保持，不伪装成云端撤销成功。

## 9. 最终结论与停止

**TokenOrbit v1.2.0-preview.3 三平台技术预览已公开，匿名交付 PASS。稳定版仍 NOT_READY。** 八个审定原资产和全部限制保留；公开交付阶段已停止并通过 review。后续仅进行获授权的纯文档入库收口，不开始新功能或签名/平台/升级补验。
