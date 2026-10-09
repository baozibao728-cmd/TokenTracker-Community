# TokenOrbit — v1.2.0-preview.3 发布准备方案

准备日期：2026-10-09。状态：**READY FOR REVIEW**，本文件不是发布执行记录。本轮只准备本方案和[公告草稿](RELEASE_PREVIEW_3_NOTES_DRAFT.md)，提交到独立文档分支、创建 Draft PR 并等待普通 CI；不合并、不创建 tag / Release、不上传资产。**稳定版仍 NOT_READY。**

沿用 [preview.2 手动发布方案](RELEASE_PREVIEW_2_PLAN.md)的固定来源、草稿回核、独立公开授权及匿名回核流程。[preview.1](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1)、[preview.2](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.2) 的 tag、公告及各八个原资产保留，不覆盖或改名；第一次发布记录与 [preview.2 实际记录](RELEASE_PREVIEW_2_PUBLICATION_RECORD.md)保持原样。

## 1. 固定来源及本轮核对

| 项目 | 固定值 / 证据 |
|---|---|
| 仓库 / origin | `baozibao728-cmd/TokenTracker-Community` / `https://github.com/baozibao728-cmd/TokenTracker-Community.git` |
| 准备基线 main | `14ab8170891898e51f53ec53e22002fb4742ae57`，本地与 origin/main 一致，开始时工作区 clean |
| 实际包 source / checkout | **`04842178b611f52c3a6180fbd27b089e0737bccf`** |
| 包内版本 | **`1.2.0`** |
| 原普通 CI | [37726143349](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37726143349)，既有 **4/4 PASS** |
| 原 build-only RC | [37726143381](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37726143381)，既有三平台 **BUILD/PACKAGE + delivery PASS**；平台实际 checkout 均为固定包源码 |
| 原八文件 artifact | [11527574101](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37726143381/artifacts/11527574101)，`community-rc-04842178b611f52c3a6180fbd27b089e0737bccf` |
| 基线 main 普通 CI | [37934869263](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37934869263)，PR #9 收口时 **4/4 PASS**，实际 checkout 为上述 main |
| 本轮原件回核 | **2026-10-09 15:20:40 UTC，8/8 PASS**；第 3 节为实际文件大小及摘要 |

本轮读取保留的原交付目录，确认恰有八个普通文件。执行现有 `scripts/rc/artifacts.cjs verify`，六包实际字节与原 manifest / SHA256SUMS 相符；八文件逐一与既有不可替换的回核清单比较，包含两个元数据自身的大小 / 摘要，全部一致。只使用 verify，没有调用 record / assemble；没有重新构建、签名、压缩、改文件名或重写元数据。

`git merge-base --is-ancestor` 确认固定包源码是基线 main 的祖先。`git diff --name-only` 的精确差异清单如下，只有已审定的文档和截图，产品源码、构建脚本、工作流、版本及配置无差异：

```text
CLAUDE.md
TokenTrackerWin/README.md
docs/tokenorbit-brand-name-validation.md
docs/tokenorbit-brand-name-windows/app-header.png
docs/tokenorbit-brand-name-windows/app-settings.png
docs/tokenorbit-brand-name-windows/desktop-shortcut.png
docs/tokenorbit-brand-name-windows/start-menu-shortcut.png
```

原 artifact API 本轮返回 `expired=false`，run / artifact 的 head 为固定包源码。到期时间为 **2026-11-07 04:23:01 UTC（台北 12:23:01）**。保留的外层 Actions ZIP 本轮也重新校验：499,047,277 bytes，SHA-256 `bf2b6de748bb51a60540c326068554770ea0de397629c816cfc0070d39e222b4`，与 API digest 一致。外层 ZIP 不是 Release 安装包，不上传它代替原八文件。若 artifact 过期，只能使用经第 3 节验证的同一保留原件；原件不全或不符就停止，不静默重建。

远端 tag / Release 是否冲突、workflow 状态和 main / PR 是否变化，在后续执行前重新核对；本轮只读检查结果在文档 PR 摘要记录，不能作为未来保证。

## 2. 拟用参数及发布契约

| 参数 | 值 |
|---|---|
| Release 展示名称 | **`TokenOrbit 1.2.0 — 三平台技术预览 3`** |
| Tag | **`v1.2.0-preview.3`**，annotated tag |
| Tag peeled SHA / target_commitish | **`04842178b611f52c3a6180fbd27b089e0737bccf`** |
| 包内版本 | `1.2.0`，不为预览标签改版本 |
| prerelease | `true` |
| make_latest | GitHub REST 请求中显式使用**字符串 `"false"`** |
| draft | 后续创建时先为 `true`；草稿回核和公开 review 通过后另获授权才改为 `false` |
| generate_release_notes | `false`，使用审定公告，不生成上游历史公告 |
| 发布入口 | 自有仓库 Git + GitHub Releases API 的已验证手动流程 |
| 资产 | 第 3 节原六包 + 原 SHA256SUMS + 原 RC_MANIFEST.json，共八文件 |

preview.1 / preview.2 / preview.3 的包内版本均为 **1.2.0**；本次标签不代表更高的应用内版本。这是**手动下载技术预览**，不承诺预览自动更新。既有稳定更新入口不会提供这次同版本预览；仅有预览、没有稳定 Release 时，自有 Releases latest API 返回 404、应用检查更新显示失败属于需如实记录的结果。网页 `/releases/latest` 可重定向到 Releases 列表，网页能打开不等于 API 已选中预览；不创建假稳定版补证。

`release-dmg.yml` / `release-windows.yml` 使用正式数字版本契约，会重新打包、写入 Release，组合流程还会自动公开。它们不能用于本次复用已验收字节：不启用、不 dispatch，不创建 `v1.2.0`，不把预览 tag 输入正式版本发布器。继承 npm / Homebrew / 榜单运营等十个 workflow 继续禁用。本纯文档 PR 不匹配 build-only RC 的触发路径，不手动重跑 RC。

未来转稳定版需要另行 review：补齐平台实机验收、签名 / 公证决策、旧客户端迁移与真正更高包内版本的完整升级链，以及已知测试 / 配置归因等风险。不得直接把本预览改为稳定或 latest；更高包内版本的新候选与资产需要自己的构建、验证和授权。

## 3. 不可替换的八文件清单

本轮实际回核如下，大小单位 bytes，摘要对应文件本体。macOS 为 arm64+x86_64；Windows / Linux 为 x86_64，deb 包架构元数据为 amd64。manifest 的 `source_sha` / `checkout_sha` 均为 `04842178b611f52c3a6180fbd27b089e0737bccf`，`version` 为 `1.2.0`。

| 原文件名 | Bytes | SHA-256 |
|---|---:|---|
| `TokenTrackerCommunity.dmg` | 61892760 | `4c47602f834e88ed970856b66765d12572c91c716e79df9d2eb2c11881c81105` |
| `TokenTracker-Community-win-x64.zip` | 114957780 | `c177df3ce46cc28f5422b13316ccaebc4ff22d41c80d9cb2d437eac7e40f4915` |
| `TokenTracker-Community-Setup.exe` | 80795557 | `30933f453897588267ef85a569071ce6d7c3e656b3143138212803b1c9f90d26` |
| `TokenTracker-Community-linux-x86_64.AppImage` | 127465976 | `8616fee6aa341f7e87b42117ded5ba02f28effb81f6674d048d168ca6c81793f` |
| `TokenTracker-Community-linux-x86_64.deb` | 56978500 | `638a1ac679703af9bb59ff6f1bb60e8d1a639e5a6ebb5327883feebe43fa398b` |
| `TokenTracker-Community-linux-x86_64.rpm` | 56953255 | `42d5a031ecd63dc46f399ebf7588f2fd30706d796a9b029fe013dcda018d6013` |
| `SHA256SUMS` | 615 | `913c43f8938d2ac8a660dc3b17872e7a6b1bb3a0971db5ae63cda0a3c3a1f8b8` |
| `RC_MANIFEST.json` | 1598 | `0d295d89bc3fd5ad35438aefcd6b2a3189a0be7cab02a507226add45692cebdc` |

原 SHA256SUMS 仅列六包；它自身及 RC_MANIFEST.json 的摘要由上表固定，不往原文件追加两行。保留 Community 技术文件名，不把下载名改为 TokenOrbit，不用文档 HEAD 或 merge SHA 重写 manifest。额外自动 RC 产物与本表来源分开，不替换这批原件。

## 4. 变更、证据归属及保留限制

相比 preview.2，重点为圆环品牌图标、按图片内容 hash 的资源缓存键、透明单色 Windows 静态托盘，以及 TokenOrbit 显示名。真实宠物动画、Provider 图标、Token / 排名算法与 Community 契约保持。原扫描目录、统一排行榜、登出持久性功能继续保留，不包装为本次新增功能。

| 范围 | 可复用证据与准确边界 |
|---|---|
| 图标生成、各平台实际资源、升级缓存和静态托盘 | [图标报告](docs/brand-icon-validation.md)；缓存保留、正常启动新图标、真实静态托盘 / 桌面截图属于 `7e7b63d42e847f9387a4c83af24b9af415c534cd`，已纳入本候选，不改写旧截图来源 |
| TokenOrbit 改名、Windows 原包覆盖安装与保护 | [改名报告](docs/tokenorbit-brand-name-validation.md)及该报告四张截图；固定 `04842178…` 的原 Setup 覆盖安装 / 品牌 **PASS**，唯一卸载入口、owned 快捷方式迁移、原账号 / 数据及云同步关闭保留，官方安装 / 数据 / 配置 / 协议保护比较通过 |
| macOS 旧安装落点 | 新客户端按既有 bundle ID 选择 owned 旧路径或新 `TokenOrbit.app` 路径，8 项 XCTest PASS；**不代表旧客户端已经自动升级，旧客户端自动升级 NOT_TESTED** |
| Linux 三格式身份 | AppImage / deb / rpm 分别解包检查 runtime、显示名、包身份和协议 PASS；Tauri 内部 `productName` 及 `TokenTracker Community/EmbeddedServer` 路径保持；GUI/RUNTIME NOT_TESTED |
| 原六包与元数据 | 原 run / artifact 及本轮 8/8 原字节回核；Windows portable 本候选 BUILD/PACKAGE / 下载回核 PASS，不把旧候选 portable 的原生 smoke 改写成本包新增实测 |
| Community / Auth / 同步关闭 / 原 130 Token | 复用已接受的 [Community 云端记录](backend/deploy/community-first-cloud-runtime-report.md)、[Ownership 报告](RELEASE_OWNERSHIP_CUTOVER_REPORT.md)与原生记录；本轮不访问云端、不上传用量、不重跑生命周期 |
| 扫描、统一榜单、Windows 登出 | [扫描移植](docs/community-scan-roots-port.md)、[UI review](docs/community-leaderboard-ui-review.md)、[组合包及登出验收](docs/windows-combined-rc-acceptance.md)保留原源码 / 包归属，本轮不重复验收 |

必须在公告和后续实际记录保留：

- macOS / Linux **GUI/RUNTIME NOT_TESTED**；Windows 未签名，macOS 仅 ad-hoc，非 Developer ID / notarization。macOS 编译后图标像素与 GUI 对照未验；Windows 深色任务栏静态托盘变体实际切换未验。生成 / 包内容通过不替代这些 GUI 证据。
- **旧客户端自动升级、真实 WSL、完整更高版本 updater 下载 → 安装 → 重启链 NOT_TESTED**；Linux 没有应用内 updater。同版本覆盖安装不是完整升级。
- 旧 `51bee187` metadata 只有全局目录哈希：已缩小范围时，需恢复原范围成功扫描建立分根 inventory 后再移除额外根。旧 `626f331` 重叠 WSL 来源需一次成功 WSL 发现建立来源标记，不从旧 explicit 标签猜测。
- 既有 Codex 配置整文件指纹差异缺少可信旧内容及写入者证据，变更键 / hook / notify 分类保留 **NOT_TESTED / 未归因**；不据此声称本产品改写配置或已排除所有写入者。
- 完整 Dashboard suite 两个基线失败（`period changes cache timeout`、`Preloaded User missing`）、扫描比较中五项 Windows / POSIX 路径或 Kiro fixture 基线失败、Grok slash 断言及 macOS notify 不稳定性保留。普通 CI PASS 不等于全部测试全绿；完整离线和原生历史快捷键逐步恢复未全部验收。
- 少量 README/tagline 和 Linux 故障提示仍有旧名，详见改名报告，不掩盖为全部字符串已替换。保留 upstream 归属及 MIT 许可证；Community 仓库、技术文件名、AppId / bundle ID、Linux 包身份、内部 exe/runtime、数据目录、协议、自启动、backend 和 updater 归属保持。
- 社区排行榜依据 `client_reported_tokens`；automatic anticheat 未启用。初次未缓存读取仍可能等待，缓存改善不等于后端加速，不承诺预读或完整离线。

## 5. Review 后的操作方案（本轮不执行）

### A. 合并前后 Guard

1. 后续获得明确授权才将纯文档 PR 转 Ready、以 merge commit 合并。重新核对审定 PR HEAD、origin/main、工作区及必要 CI；出现未审定变化时报告差异并停止。
2. 核对合并树等于审定文档 HEAD，main 普通 CI 4/4 PASS。固定包源码仍须为 main 祖先；除第 1 节七个已审定文件外，只允许新增本方案与公告两份文档，共九个文件。所有源码 / 配置 / 构建差异必须为空。
3. 确认自有 repo、没有同名 tag / Release、十个继承 workflow 仍禁用，preview.1 / preview.2 的 tag / 公告 / 各八资产保持。名称冲突时不覆盖、不移动。
4. 上传前再次核对第 3 节八文件的名称、size / SHA-256、source / checkout / version。后续文档 commit、merge、额外 RC 不替代原来源。

### B. 固定 annotated tag

仅在后续明确授权后：

```powershell
git tag -a v1.2.0-preview.3 04842178b611f52c3a6180fbd27b089e0737bccf -m 'TokenOrbit 1.2.0 technical preview 3'
git push origin refs/tags/v1.2.0-preview.3
git rev-parse 'v1.2.0-preview.3^{commit}'
git ls-remote origin 'refs/tags/v1.2.0-preview.3*'
```

核对 tag object 与 peeled commit 的区别，本地 / 远端 peeled 都必须等于完整包 SHA。不 force-push，不覆盖、移动或删除已有 tag。

### C. 草稿、实际公告及上传

后续使用 Releases API 创建，参数显式如下：

```json
{
  "tag_name": "v1.2.0-preview.3",
  "target_commitish": "04842178b611f52c3a6180fbd27b089e0737bccf",
  "name": "TokenOrbit 1.2.0 — 三平台技术预览 3",
  "body": "审定的 preview.3 公告正文",
  "draft": true,
  "prerelease": true,
  "make_latest": "false",
  "generate_release_notes": false
}
```

1. 从审定公告删除“公告草稿”和准备提示，将拟用下载说明改为正常下载说明，保留限制。所有相对文档 / 图片链接转换为**固定文档 merge SHA** 的 GitHub blob / raw 绝对链接并验证可访问；本方案尚不在包源码中，不能链接到包 tag。记录实际正文和文档 merge SHA，不自动生成上游历史。
2. GitHub 发布认证只在安全进程内存使用，不放命令参数、报告、Git 或临时请求文件，不使用 InsForge 管理凭据。只读验证入口为 `node scripts/rc/artifacts.cjs verify <原交付目录> 04842178b611f52c3a6180fbd27b089e0737bccf`；另按第 3 节检查两个元数据自身摘要与目录恰八文件。
3. 逐个上传原六包与原元数据，记录 Release ID、八个 asset ID / name / size / uploaded 状态。不上传外层 Actions ZIP、临时工具、凭据或用户数据；不重压、改签名、改名、clobber 或生成 metadata。
4. 若上传失败，仅处理明确未完成的草稿上传；已有同名条目先核对真实字节。无法保证原八文件一致时停在草稿，不替换公开资产。

### D. 草稿下载回核及公开停止点

1. 从同一草稿的八个 asset API 下载到**新的独立目录**；认证和带签名重定向地址仅在内存使用，不记录 headers / 原始 URL。
2. 逐一核对名称、size、SHA-256，必须与第 3 节及上传源一致；重新 verify 六包及 manifest / checksums，再检查两个元数据自身摘要。服务端 digest、外层 ZIP 或包内容检查不能代替八文件字节回核。
3. 重新读取并核对 tag peeled、manifest source / checkout / version、公告正文、参数、Release / asset IDs。草稿回核通过后停止在 **DRAFT VERIFIED / READY FOR PUBLICATION REVIEW**，等待明确公开授权。
4. 后续 review 批准公开才 PATCH **同一个** Release 为 `draft=false`、`prerelease=true`、`make_latest="false"`；任何核对失败均保持草稿并报告，不公开不完整交付。

### E. 公开后匿名交付验证

1. 无认证访问指定 tag 页面 / API，确认预览标签、公告、固定文档链接和八个上传资产，记录实际 HTTP / 发布时间 / IDs。GitHub 自动生成的源码 ZIP/TAR 另计。
2. 无认证下载八文件到另一个新目录，逐个核对名称、size / SHA-256及 manifest source / checkout / version、两个元数据自身摘要、tag peeled，均须与第 3 节一致。不重装或重复已验云端生命周期。
3. 无认证查询 `GET /repos/baozibao728-cmd/TokenTracker-Community/releases/latest`，不得选中 preview.3；只有预览时该 API 实际 404 可接受。网页 `/releases/latest` 的重定向 / 最终 HTTP 状态另记，不和 API 混同。下载入口指向明确 tag，不使用 /latest，不宣称完整自动升级通过。
4. 只读核对 preview.1 / preview.2 原 tag、公告、Release / asset IDs、size / digest 保持，十个继承 workflow 仍禁用、没有意外发布 / npm / Homebrew / 云运营 run。
5. 将实际发布与匿名回核写入独立记录，区分“技术预览交付 PASS”与“稳定版 NOT_READY”；本轮不提前填写这些结果。

## 6. 当前交付与待决定事项

本轮只新增本方案及 [RELEASE_PREVIEW_3_NOTES_DRAFT.md](RELEASE_PREVIEW_3_NOTES_DRAFT.md)。文档 commit / Draft PR / 自动普通 CI 的实际 head、checkout 和 run 单独记录在 PR 摘要与交付结果，不循环提交文档自身 SHA，不把文档 CI 当作新的打包或安装证据。

待 review：公告、固定参数、原八文件及技术预览定位是否批准；是否随后授权文档 PR 合并、固定 tag、draft / 上传 / 草稿回核；草稿通过后再单独决定公开。稳定版缺口保持，不因此缩减三平台范围。

**停止点：READY FOR REVIEW。** 未授权 merge、tag、Release、资产上传或公开；不修改 preview.1 / preview.2、产品、版本、云端、凭据或 workflow 开关，不重复 Windows 验收或手动触发 RC。
