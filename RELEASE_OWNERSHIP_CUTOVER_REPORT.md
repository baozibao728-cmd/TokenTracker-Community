# TokenTracker-Community Release Ownership Cutover Report

日期：2026-10-03。结论：**BLOCKED（正式发布条件尚未全部满足）**。

Ownership Cutover、本地 Windows RC 构建及真实安装共存检查已完成。同步偏好修复和定向原生回调/重启验收 **PASS**；管理 API key 处置 **PASS**（第 12 节）。固定候选的普通 CI 与三平台正式 build-only RC **BUILD/PACKAGE PASS**，六个正式包仅交付为 Actions artifacts，源码、checkout、内容检查和下载回核证据见第 14 节。第 15 节已使用最终 CI 原字节完成 Windows 同版本覆盖安装、原生页面/会话/关闭偏好/重启及 portable smoke **PASS**，未重建客户端。保护对照保留官方自身更新造成的实际差异，不宣称全过程所有官方文件不变。没有修改数据库、migration、Edge 或产品业务逻辑；没有 merge main、tag、GitHub Release 或正式发布。macOS/Linux 安装与真实运行、正式代码签名及完整下载升级链仍未完成，正式发布保持 **BLOCKED**。

## 1. Collision & Ownership Audit

| 范围 | 原有归属/冲突 | 本轮处理与证据 |
| --- | --- | --- |
| Windows/macOS 更新 | 官方 GitHub Releases、官方安装器/DMG 名称 | 改为 `baozibao728-cmd/TokenTracker-Community`；资产及 checksum 路径受 fork 归属约束；Windows 更新下载 URL 另有拒绝上游及非 HTTPS URL 测试 |
| Linux 更新 | 尚无应用内自动更新器；下载链接及打包身份属于上游 | 保持无自动更新器，下载/发布资产指向 fork，独立包、桌面项、协议与扩展 UUID |
| 原生安装身份 | 原 Windows AppId/目录、macOS bundle/App Group、Linux app/package/desktop identity 会共享资源 | 三个平台均改为独立产品身份；Windows 已实际完成安装/覆盖/卸载/重装测试 |
| 后端默认值 | Dashboard、CLI、DevicePage 与 Actions 有官方 URL/客户端 credential 默认值 | 移除默认值；正式构建必须显式提供自有项目配置。打包 CLI 锁定自有地址，拒绝旧配置/环境/CLI 参数将其改到上游 |
| Actions | 上游 npm/Homebrew 发布及官方 leaderboard 运营 workflows | 远端仅普通 CI 和专用 build-only RC 启用，其余 10 个 workflow 保持手动禁用，详情见第 13、14 节 |
| 支持/下载 metadata | repository、homepage、issues、下载、Star、原生支持入口属于上游 | 更新到 fork；没有独立官网，因此 homepage 为 fork GitHub 仓库；Issue 模板改为本仓库入口 |
| 遥测归属 | Dashboard 硬编码上游 PostHog public write key | 删除该默认 key；无显式 `VITE_POSTHOG_KEY` 时不启动 analytics。未配置或启用新的遥测项目 |
| 分享/公开 profile 链接 | 分享意图和 profile modal 可将 fork 用户引到官方网站 | 分享产品链接改为 fork 仓库，profile 访问改为当前应用 origin；尚无 Community 独立公开网站，localhost profile URL 不承诺可供其他机器访问 |
| 数据/缓存/日志 | native settings、WebView、CLI queue、pricing/provider cache、sidecar、machine-id 可能共用 | 统一经独立 native directory / tracker root 解析；拒绝指向上游根目录及其符号链接/目录联接的 alias |
| Provider 全局 hooks | 新 native runtime 初始化/修复可覆盖上游 hooks | Community 隔离运行模式不安装、修复或卸载共享 hooks，读取 provider 数据并使用原 native 定时 sync；没有改写解析或 provider integration 实现 |

### 明确保留的上游引用

- MIT LICENSE 与上游版权/attribution 保留，LICENSE 无 diff。
- README 的上游来源、历史截图/比较资料，以及明确标为上游的 npm/Homebrew 说明保留。本 fork 不发布 `tokentracker-cli` npm 包或上游 Homebrew tap。
- 原 marketing/SEO/copy 和分享图片模板中的 `tokentracker.cc` 仍属于继承的品牌素材；它们不是 Community 云端、安装、更新或下载 fallback。本轮没有部署继承的官网页面，也没有进行全站品牌重构。
- `runtime-config.js` 中两个官方/旧 InsForge host 只用于识别并拒绝旧持久配置；相应负面测试保留旧 URL。原 upstream `dashboard/edge-patches/` 与历史文档保留，未部署或用作本 fork 发布入口。
- Linux GNOME 扩展保留旧源码目录名以减少无关移动，运行时 UUID 已独立。目录/UUID 后缀不是网络目标。
- 源码 checkout 的 CLI 保留原开发模式；需要隔离运行时必须显式设置 `TOKENTRACKER_DATA_ROOT`。当前独立发布范围是原生安装包，未引入新的全局 npm 命令安装渠道。

## 2. Backend Cutover 与 Actions 配置

唯一正式构建目标：`https://tc79bxhm.ap-southeast.insforge.app`，项目 `TokenTracker-Community`，Project ID `a6ae494f-4e08-40b5-8985-fd69581d0409`。

发布 workflow 使用以下 repository 配置，并映射到对应 Vite build env：

| GitHub Actions 配置 | 类型 | 构建变量 |
| --- | --- | --- |
| `TOKENTRACKER_COMMUNITY_INSFORGE_BASE_URL` | Repository Variable | `VITE_INSFORGE_BASE_URL` |
| `TOKENTRACKER_COMMUNITY_INSFORGE_ANON_KEY` | Repository Secret：自有项目的公开 anon client credential | `VITE_INSFORGE_ANON_KEY` |

`scripts/prepare-release-client-config.cjs` 校验自有 base URL、必需客户端 credential，以及非管理凭据类型，再生成 gitignored 的 `.tmp/release-client-config.json`。正式 Dashboard build 也执行同一校验。缺少配置或目标不符直接失败；macOS/Windows/Linux 发布路径行为一致，release guard 在 tag/release 创建之前执行。npm/Homebrew 发布和官方运营 jobs 在本地工作流中明确禁用。

本地 RC 的公开客户端 credential 由现有 own-project CLI 只读取得，未打印值，未复制 CLI user credential。credential 只进入忽略的构建暂存与最终客户端产物；源文件、Git 和本报告不包含其值，也不包含管理员 key、JWT secret、密码或 OTP。浏览器客户端 credential 会随客户端产品分发，这不是 Edge service credential。

前期 Chrome 只读检查时 Variables/Secrets 为空且 Actions 页面未启用，这是历史证据。第 13 节已通过 GitHub REST 重新核对实际状态并配置自有 Variable/public anon Secret；不能把先前状态当成当前状态。Secret 的实际有效性以本轮 runner 配置校验与 Dashboard build 为准。

最终 RC 验证了：打包 runtime 的 backend target 为上述 own-project 地址；旧配置覆盖被忽略；Dashboard 108 个 JS 产物未发现两个官方 InsForge host；原上游 PostHog key 已移除。使用独立临时数据根运行最终嵌入式 Node/CLI，`/communities` HTTP 200，透过本地 Auth proxy 调用真实 `/api/auth/public-config` HTTP 200；无登录、业务数据或用户创建。

探针最初用错 `/api/auth/metadata`，得到 404；对照已安装 InsForge SDK 后使用真实 `/api/auth/public-config`，成功。没有为通过探针修改产品 Auth 逻辑。

## 3. 三个平台的稳定产品身份

| 项目 | Windows | macOS | Linux |
| --- | --- | --- | --- |
| 显示名称 | TokenTracker Community | TokenTracker Community | TokenTracker Community |
| 安装/应用身份 | AppId `638F4DBF-F2B4-4408-B654-5A5D0F5B7AC7`，后续版本必须保持 | bundle `com.tokentracker.community`，widget `com.tokentracker.community.widget` | Tauri `io.github.baozibao728cmd.tokentrackercommunity` |
| 执行文件/应用 | `TokenTrackerCommunity.exe` | `TokenTracker Community.app` | `tokentracker-community-linux` |
| 原生数据 | `%LOCALAPPDATA%/TokenTrackerCommunity` | `~/Library/Application Support/TokenTrackerCommunity`；独立 preferences/container | XDG state 下 `tokentracker-community` |
| CLI 数据 | `~/.tokentracker-community` | 同左 | 同左 |
| 回调协议 | `tokentracker-community://` | 同左 | 同左 |
| 其他身份 | startup `TokenTrackerCommunity`，mutex `TokenTrackerCommunity.Windows.Tray.SingleInstance`，pipe `TokenTrackerCommunity.Windows.Tray.DeepLink` | App Group `group.com.tokentracker.community`；独立 login item/bundle identity | desktop `tokentracker-community-linux.desktop`，AppImage handler `tokentracker-community-appimage.desktop`，GNOME UUID `tokentracker-community@tokentracker.cc` |
| 端口 | 首选 17681；冲突时选择空闲 loopback port | 7682；不接管/杀掉上游 7680 进程 | 17681 |

Windows 默认安装目录为 `%LOCALAPPDATA%/Programs/TokenTrackerCommunity`，publisher 为 `baozibao728-cmd`。卸载只移除自己的安装文件、协议和启动注册，不删除用户数据、不清理上游目录。

三个平台的 fork release assets：`TokenTrackerCommunity.dmg`；`TokenTracker-Community-win-x64.zip` / `TokenTracker-Community-Setup.exe`；`TokenTracker-Community-linux-x86_64.AppImage` / `.deb` / `.rpm`。Windows/macOS updater、下载及 checksum 使用本 fork Releases；Linux 没有新增自动更新机制。

## 4. 版本同步与最终 RC

使用原机制：`npm version 1.2.0 --no-git-tag-version --ignore-scripts` → `npm run sync-versions` → `npm run validate:versions`。root package/lock、Windows csproj、两处 macOS MARKETING_VERSION、Linux package/lock/Cargo/Tauri/PKGBUILD 均为 `1.2.0`；未创建 `v1.2.0` tag。版本 registry 只调整为识别独立 Linux Cargo package 名称。

最终产物目录：`.tmp/release-candidate/1.2.0-sync-pref-verified/`。在 Windows 安装许可门禁与 OAuth/deep-link 日志补修之后，本轮按 review 修复 OAuth 中继页覆盖同步偏好，并重建 Dashboard 和 Windows RC。此前 `1.2.0-ownership-cutover-final`、`1.2.0-updater-verified`、`1.2.0-oauth-log-verified` 不再作为本轮定向回调验收对象；有效的既有同步、邮箱登录、Community 生命周期、安装共存和 updater 证据仍保留且标明所属构建。

| 文件 | Bytes | SHA-256 | 架构/类型/签名 |
| --- | ---: | --- | --- |
| `TokenTracker-Community-Setup-v1.2.0.exe` | 80688324 | `5221732BB1A6DC7700B5E02CE541DC63BC0690D1810B2A148656E260359818C1` | Windows x64，Inno Setup per-user installer，NotSigned |
| `TokenTracker-Community-win-x64-v1.2.0.zip` | 114871186 | `7ACFAE5C8CB31EB89C5AD8F6ED3028B877A9050CCE5461A37172830522383564` | Windows x64 portable bundle；ZIP 无 Authenticode 签名 |

使用现有 Inno Setup/.NET packaging；未更换打包框架。包含 .NET 8 self-contained runtime 和 SHA-256 验证的 pinned Node `22.22.2`。可执行文件 FileVersion `1.2.0.0`。RC 来自未提交工作区，不是可复现的已发布 Git tag。仅本地生成，未上传。

## 5. 安装共存检查

首轮 1.2.0 RC 完成真实安装 → 隐藏启动 → `/communities` HTTP 200 → 覆盖安装 → 卸载 → 重装。官方 `TokenTracker 1.1.8` 与 `TokenTracker Community 1.2.0` 同时具有独立卸载项、不同安装目录。Community protocol 注册正确，卸载时移除该 protocol，官方执行文件及注册表保持。

完整官方文件内容的前后稳定 SHA-256 fingerprint 相同：

| 官方范围 | 文件数 | pre = post SHA-256 |
| --- | ---: | --- |
| 安装目录 | 1658 | `bf8e58b15bad777ee7504f8ba9ee702a257932044949757e9242027710e0bbc5` |
| 原生数据/WebView/cache/log 目录 | 1395 | `41024f1cf4cb15d52ea6b6c0a1ca97ab86aa144bb736baa477e8c6a7d39b1d40` |
| `.tokentracker` CLI 数据 | 1420 | `0daa53f5db2fc5c9dbde2e018683d9518a5f0c61d89328588cefc815b640b84c` |
| 官方 protocol/uninstall/startup 注册内容 | — | `411a902572806f92339e3cc37a21a03b4dcbd05f43e54cebbcb8fffef8e3f325` |

用户随后亲自打开已安装 RC，确认仪表盘与 Community 侧栏正常显示。本轮没有要求或记录密码，也没有登录、创建社区或写 Token 数据。

最终 RC 已覆盖安装到同一独立 Community 目录，隐藏启动成功，`/communities` HTTP 200；官方执行文件仍保留。覆盖前发现旧 Vite hash 文件仍在安装目录：安装后的 `index.html` 已引用新入口，其 SHA-256 与最终 publish 产物一致，但不再引用的旧入口仍包含退休的上游遥测 key。最终 publish 产物不存在该 key，问题为安装器保留旧构建资产。安装器现仅在自己的 `{app}/EmbeddedServer/tokentracker/dashboard/dist` 清理旧构建目录，再安装新资产；不删除用户数据。重新编译、覆盖安装后，旧入口和默认遥测 key 均不存在。Windows 43/43 与 Windows workflow 30/30 检查再次通过。

上述完整安装/卸载和文件指纹属于既有首轮证据。更新器补修后曾针对 `43093056…` 安装器完成覆盖安装：native executable/runtime DLL、Dashboard index 与 client config 均同该 publish 产物一致，FileVersion `1.2.0.0`、Community 独立运行目录、`/communities` HTTP 200。下面这组指纹为该次覆盖安装的既有证据，最终日志修复新包另有独立 pre/post 对照，见第 10 节。

本次覆盖安装前保存不可覆盖 pre snapshot，安装/启动后再比对；未复用旧 RC 指纹冒充本轮证据：

| 本轮官方保护范围 | 文件数 | pre = post SHA-256 |
| --- | ---: | --- |
| 官方安装目录 | 1658 | `7e854e16ecd95cf906c5b5f4ce599631fc448d8d2cce5be390ae2f6d2b257326` |
| 官方原生数据/WebView/cache/log | 1395 | `88f3b904db863dc5a9596e0c94b2e71ec50f5ebeeb2be27400ad549dcfa9d199` |
| 官方 CLI 数据目录 | 1420 | `21ae368da73619d8d3d2c13e063c0d7706335e3dfd2154dd67977997c1d49fa0` |
| 官方 protocol/uninstall/startup 注册内容 | — | `411a902572806f92339e3cc37a21a03b4dcbd05f43e54cebbcb8fffef8e3f325` |

同次比较还覆盖现有 Claude/Codex/Gemini 配置与 Claude/Codex hooks 的数量和内容摘要，均相同。`[InstallDelete]` 清理仅为 `{app}/EmbeddedServer/tokentracker/dashboard/dist`；`{app}` 由独立 Community AppId/安装目录确定，不指向官方安装目录或任一用户数据目录。本轮未重跑无关的整套卸载流程。

**证据边界：**此前 RC 的真实未登录同步、邮箱密码登录、最小 Community 生命周期、重启、OAuth 与更新检查分别记录于第 9/10 节并经 review 接受。当前 `5221732B…` 包仅定向验证本轮修改，见第 11 节；不把既有证据改写成新包重跑结果。

## 6. 本地验证结果

| 门禁 | 实际结果 |
| --- | --- |
| Community frontend tests | 5 文件，50/50 PASS |
| Auth / native OAuth bridge / update UI regression | 4 文件，15/15 PASS |
| Dashboard typecheck / production build | PASS；最终显式 own-project client config |
| version validation | 全部托管版本 1.2.0，PASS |
| copy / zh / zh-TW / UI hardcode | PASS；中文各 1729/1729，既有 unused-key warnings 保留 |
| architecture guardrails | PASS；架构单测 4/4 PASS |
| Community verify | PASS；PG15、9/9 DB contracts、Edge Runtime 22 checks、manifest/hash/type/config |
| Foundation verify | PASS；空库/PG15、13/13 Edge contracts、request/runtime/credential/release checks |
| pricing parity | 16/16 PASS |
| release/runtime-config/legacy migration/data-root/version tests | 53/53 PASS，无 skip |
| Windows identity/updater/log tests | 本次日志补修后 64/64 PASS，无 skip：包含原 52 项与新增 12 项 OAuth 日志/原值转发保护测试。本机只有 .NET9，使用 Major roll-forward 运行 net8 测试；RC 本身自包含 .NET8 |
| macOS identity/updater/static guard | 3/3 PASS；没有在 Windows 声称 Xcode build 或安装 PASS |
| workflow / Linux static checks | 79/79 PASS；没有实际运行 GitHub Actions、Cargo 或 Linux 安装 |
| modified/untracked credential / local-path scan | 待提交文件扫描结果见第 9 节；不把工具输出安全性与 Git 内容安全性混为一谈 |
| `git diff --check` | PASS |
| backend/community / bootstrap / deployed migration / Foundation Edge | 无 diff |
| MIT LICENSE | 无 diff |

既有全球排行榜两项 baseline failures（`period changes cache timeout`、`Preloaded User missing`）继续保留历史 clean HEAD 证据，本轮未修复、未宣称完整 Dashboard suite 零失败。

额外探索性 CLI 回归中，4 个 Windows notify interpreter/process-chain 用例失败；已将 clean HEAD 归档到独立临时目录并复现相同 4 项失败（预期 subprocess marker 为 null）。OMP/init/serve 该探索范围为 56/60。完整 usage-limits 探索范围出现平台 fixture/process 问题后停滞并被中止，不能报告为 PASS；对应变更仅为缓存/sidecar 路径，隔离路径测试通过。没有为这些问题修改 Parser、Cost Engine 计算、Provider integrations 或跳过失败项。

Windows 文件锁曾导致一次生产 build 和 `Compress-Archive` 失败：重新 build 成功，最终 ZIP 使用标准 .NET 单次 CreateFromDirectory 文件流生成。没有更换安装/打包框架。首次安装辅助脚本因官方启动项不存在而中止于只读 pre-snapshot；修正辅助脚本后重新完成全流程，没有修改产品逻辑。

除 Windows updater/identity 测试、最终重建与本轮新证据外，表中门禁复用前序实际 PASS 记录；本轮没有因更新器修复重跑完整后端或双用户生命周期。最终 Inno 编译第一次遇到输出文件被占用（error 32），相同构建重试成功；没有跳过校验或改变业务行为。

## 7. 正式发布阻塞及人工验收

1. Actions 配置与普通 CI 原阻塞已关闭：自有 Variable/public anon Secret 已配置，Draft PR 的固定 source SHA 四个 job PASS。下一阶段专用三平台 build-only 正式打包仍未执行，不能以普通 CI 代替。
2. 既有原生最小 Community 生命周期、重启会话、logout 门禁与 Google OAuth 用户流程经 review 接受，详见第 10 节。本轮同步偏好修复和新包定向验收单独记录于第 11 节；不重跑完整双用户生命周期，不以开发前端结果替代二进制证据。
3. 首发仍按三平台准备；macOS/Linux 普通 runner 编译与测试已 PASS，正式包构建、安装和原生 runtime 验收尚未执行。Windows 安装器未签名，macOS 发布签名/notarization 未验证，状态不隐藏。
4. 暴露的自有项目管理 key 已按本轮追加授权完成轮换、22 个 Edge 同源码环境刷新及实际失效验证；凭据处置 PASS，见第 12 节。第 11 节保留上一轮停止条件及访问记录边界。

已接受的原生 UI、安装共存和手动更新结果不再标为等待验收。本轮只定向补齐同步偏好及安全处置；手动检查更新的已复现失败保留，完整下载升级仍为首发 NOT_TESTED 限制。没有要求再次创建社区或卸载产品。

本轮修改了 Cost Engine 与 provider cache 文件的**路径解析**，以隔离缓存；没有改变价格规则、模型匹配、Token Parser 或 provider parsing/integration 实现。Community、Foundation SQL/API/Edge、Cloud 数据均不在本轮修改范围。

**最终判断：BLOCKED。** 可以审查 Ownership Cutover 与本地 RC；不应据此创建 tag、GitHub Release 或正式更新发布。

## 8. 修改文件附录

附录按 Git modified/untracked 文件生成；只包含待审查源码/文档，没有临时测试脚本、构建产物或本机 credentials。清单见下。

### Fork 支持入口

- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/ISSUE_TEMPLATE/docs_issue.yml`

### Actions 归属与发布 guard

- `.github/workflows/ci.yml`
- `.github/workflows/leaderboard-anticheat.yml`
- `.github/workflows/leaderboard-freshness.yml`
- `.github/workflows/leaderboard-moderation-audit.yml`
- `.github/workflows/npm-publish.yml`
- `.github/workflows/release-dmg.yml`
- `.github/workflows/release-windows.yml`

### 版本、仓库 metadata、说明及报告

- `.gitignore`
- `AGENTS.md`
- `CLAUDE.md`
- `README.de.md`
- `README.ja.md`
- `README.ko.md`
- `README.md`
- `README.zh-CN.md`
- `RELEASE_NOTES_DRAFT.md`
- `RELEASE_OWNERSHIP_CUTOVER_REPORT.md`
- `package-lock.json`
- `package.json`

### macOS 产品身份、路径、更新与静态验证

- `TokenTrackerBar/Shared/WidgetSnapshot.swift`
- `TokenTrackerBar/TokenTrackerBar/Info.plist`
- `TokenTrackerBar/TokenTrackerBar/Services/DashboardWindowController.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/DesktopPetWindowController.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/LocalAPIConfiguration.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/NativeBridge.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/QueueActivityMonitor.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/ServerManager.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/StatusBarController.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/UpdateChecker.swift`
- `TokenTrackerBar/TokenTrackerBar/Services/WidgetSnapshotWriter.swift`
- `TokenTrackerBar/TokenTrackerBar/TokenTrackerBar.entitlements`
- `TokenTrackerBar/TokenTrackerBar/TokenTrackerBarApp.swift`
- `TokenTrackerBar/TokenTrackerBar/Utilities/Constants.swift`
- `TokenTrackerBar/TokenTrackerBar/Utilities/DateHelpers.swift`
- `TokenTrackerBar/TokenTrackerBar/ViewModels/DashboardViewModel.swift`
- `TokenTrackerBar/TokenTrackerBar/Views/DynamicIslandView.swift`
- `TokenTrackerBar/TokenTrackerWidget/Info.plist`
- `TokenTrackerBar/TokenTrackerWidget/TokenTrackerWidget.entitlements`
- `TokenTrackerBar/project.yml`
- `TokenTrackerBar/scripts/bundle-node.sh`
- `TokenTrackerBar/scripts/create-dmg.sh`
- `TokenTrackerBar/scripts/verify-community-identity.cjs`

### Linux 包/协议/数据/桌面身份及测试

- `TokenTrackerLinux/README.md`
- `TokenTrackerLinux/gnome-extension/tokentracker@tokentracker.cc/README.md`
- `TokenTrackerLinux/gnome-extension/tokentracker@tokentracker.cc/extension.js`
- `TokenTrackerLinux/gnome-extension/tokentracker@tokentracker.cc/metadata.json`
- `TokenTrackerLinux/package-lock.json`
- `TokenTrackerLinux/package.json`
- `TokenTrackerLinux/packaging/arch/tokentracker-linux/PKGBUILD`
- `TokenTrackerLinux/packaging/arch/tokentracker-linux/tokentracker-linux.desktop`
- `TokenTrackerLinux/scripts/bundle-node-linux.sh`
- `TokenTrackerLinux/scripts/validate-package.sh`
- `TokenTrackerLinux/src-tauri/Cargo.lock`
- `TokenTrackerLinux/src-tauri/Cargo.toml`
- `TokenTrackerLinux/src-tauri/linux/tokentracker.desktop.hbs`
- `TokenTrackerLinux/src-tauri/src/external.rs`
- `TokenTrackerLinux/src-tauri/src/main.rs`
- `TokenTrackerLinux/src-tauri/src/oauth.rs`
- `TokenTrackerLinux/src-tauri/src/paths.rs`
- `TokenTrackerLinux/src-tauri/src/server.rs`
- `TokenTrackerLinux/src-tauri/src/tray.rs`
- `TokenTrackerLinux/src-tauri/tauri.conf.json`
- `TokenTrackerLinux/src-tauri/tests/capabilities.rs`
- `TokenTrackerLinux/src-tauri/tests/external.rs`
- `TokenTrackerLinux/src-tauri/tests/oauth.rs`
- `TokenTrackerLinux/src-tauri/tests/paths.rs`
- `TokenTrackerLinux/src-tauri/tests/server.rs`
- `TokenTrackerLinux/src/index.html`

### Windows 产品身份、路径、更新与测试

- `TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj`
- `TokenTrackerWin.Tests/OAuthDiagnosticsTests.cs`
- `TokenTrackerWin.Tests/UpdateInstallGateTests.cs`
- `TokenTrackerWin.Tests/UpdateIntegrityTests.cs`
- `TokenTrackerWin.Tests/WindowsReleaseIdentityTests.cs`
- `TokenTrackerWin/AutoUpdatePolicy.cs`
- `TokenTrackerWin/BrowserTabCloser.cs`
- `TokenTrackerWin/Constants.cs`
- `TokenTrackerWin/Currency.cs`
- `TokenTrackerWin/DashboardWindow.cs`
- `TokenTrackerWin/Diag.cs`
- `TokenTrackerWin/NativeLocalization.cs`
- `TokenTrackerWin/NativeTheme.cs`
- `TokenTrackerWin/OAuthDiagnostics.cs`
- `TokenTrackerWin/PetWindow.cs`
- `TokenTrackerWin/Program.cs`
- `TokenTrackerWin/QuotaWidgetSettings.cs`
- `TokenTrackerWin/README.md`
- `TokenTrackerWin/ServerManager.cs`
- `TokenTrackerWin/SingleInstance.cs`
- `TokenTrackerWin/TokenTrackerWin.csproj`
- `TokenTrackerWin/TrayApplicationContext.cs`
- `TokenTrackerWin/UpdateChecker.cs`
- `TokenTrackerWin/UrlProtocol.cs`
- `TokenTrackerWin/WidgetWebViewEnvironment.cs`
- `TokenTrackerWin/app.manifest`
- `TokenTrackerWin/installer/TokenTracker.iss`
- `TokenTrackerWin/scripts/bundle-node.ps1`

### Dashboard 显式配置、回调及链接归属；无 Community 业务变更

- `dashboard/src/contexts/AccountViewContext.jsx`
- `dashboard/src/hooks/use-cloud-usage-sync.ts`
- `dashboard/src/hooks/use-cloud-usage-sync.test.jsx`
- `dashboard/src/lib/cloud-sync-prefs.ts`
- `dashboard/src/lib/cloud-sync-prefs.oauth.test.ts`
- `dashboard/src/components/LocalOnlyNotice.jsx`
- `dashboard/src/components/leaderboard/LeaderboardProfileModal.jsx`
- `dashboard/src/components/settings/MenuBarSection.jsx`
- `dashboard/src/lib/analytics.js`
- `dashboard/src/lib/config.ts`
- `dashboard/src/lib/insforge-config.ts`
- `dashboard/src/pages/AchievementsPage.jsx`
- `dashboard/src/pages/DevicePage.jsx`
- `dashboard/src/pages/LeaderboardPage.jsx`
- `dashboard/src/pages/LeaderboardProfilePage.jsx`
- `dashboard/src/pages/NativeAuthCallbackPage.jsx`
- `dashboard/src/pages/WidgetsPage.jsx`
- `dashboard/src/ui/components/HeaderGithubStar.jsx`
- `dashboard/src/ui/components/Sidebar.jsx`
- `dashboard/src/ui/dashboard/components/IslandOnboardingCard.jsx`
- `dashboard/src/ui/dashboard/components/MacAppBanner.jsx`
- `dashboard/src/ui/share/ShareModal.tsx`
- `dashboard/vite.config.js`

### 公开 client 配置生成与版本 registry

- `scripts/prepare-release-client-config.cjs`
- `scripts/version-files.cjs`

### CLI 配置及数据/cache 路径隔离；保留业务算法

- `src/commands/device-login.js`
- `src/commands/init.js`
- `src/commands/serve.js`
- `src/commands/uninstall.js`
- `src/lib/ark-agent-plan-limits.js`
- `src/lib/ark-coding-plan-limits.js`
- `src/lib/claude-categorizer.js`
- `src/lib/git-outcomes.js`
- `src/lib/local-api.js`
- `src/lib/machine-id.js`
- `src/lib/omp-hook.js`
- `src/lib/outcomes-engine.js`
- `src/lib/pet-packages.js`
- `src/lib/pricing/index.js`
- `src/lib/proxy-env.js`
- `src/lib/qoder-limits.js`
- `src/lib/runtime-config.js`
- `src/lib/session-analytics.js`
- `src/lib/skill-usage.js`
- `src/lib/skills-manager.js`
- `src/lib/star-cta.js`
- `src/lib/tracker-paths.js`
- `src/lib/usage-limits.js`

### Release/config/path/workflow 回归验证

- `test/isolated-uninstall.test.js`
- `test/legacy-baseurl-migration.test.js`
- `test/linux-bundle.test.js`
- `test/linux-client-workflow.test.js`
- `test/linux-health-monitor.test.js`
- `test/machine-id-stability.test.js`
- `test/npm-publish-workflow.test.js`
- `test/omp-hook.test.js`
- `test/release-client-config.test.js`
- `test/release-dmg-workflow.test.js`
- `test/release-windows-workflow.test.js`
- `test/runtime-config.test.js`
- `test/star-cta.test.js`
- `test/tracker-paths.test.js`
- `test/version-sync.test.js`

## 9. 本轮最终 Windows Runtime 与 CI 准备验收

### 9.1 更新器修复及最终构建

`VerifySetupIntegrityAsync` 不再在 checksum URL 缺失时返回 true。缺少 SHA256SUMS、缺少安装器条目、空或错误格式、网络/HTTP 获取失败、超时以及 digest 不匹配，均丢弃下载、触发现有 `IntegrityCheckFailed` 提示，并阻止 installer launch 与 QuitRequested；保留版本比较、fork 更新源、下载和安装顺序。

只在原 `UpdateChecker` 中增加内部测试依赖入口；生产默认仍使用原 HttpClient、下载目录和 installer launcher。新增测试执行真实 `CheckAsync(false)` → `DownloadAndInstallAsync`，检查实际 launch/quit 次数，覆盖 8 个拒绝情形和 1 个摘要匹配允许情形；使用非可执行 payload，没有运行测试安装器。测试工程链接实际 updater，未只测 digest 解析器。

本轮 updater 涉及 4 个文件：`TokenTrackerWin/UpdateChecker.cs`、`TokenTrackerWin.Tests/TokenTrackerWin.Tests.csproj`、`TokenTrackerWin.Tests/UpdateIntegrityTests.cs`、`TokenTrackerWin.Tests/UpdateInstallGateTests.cs`。其余 cutover 修改来自前序工作，不是本轮扩大的功能范围。

该轮 updater RC 构建及覆盖安装为 PASS，属于 `43093056…` 包的既有证据；当前最终产物以第 4 节为准，定向验收见第 11 节。未签名状态保留。

### 9.2 最终原生包 runtime 证据

| 检查 | 状态与证据 |
| --- | --- |
| 安装版本/入口/运行目录 | PASS；1.2.0.0，安装入口/runtime 与最终 publish 摘要相同，进程位于独立 Community 安装目录 |
| 未登录本地采集 | PASS；用户在原生托盘执行同步，Dashboard 刷新显示本地用量；CLI 独立目录包含真实受支持来源 |
| 首次同步 | 本轮 safe snapshot：1744 个最新桶，total `4188716297`，week `762938419`；已安装本地 summary API HTTP 200，数值相同 |
| 重复同步（Codex 持续使用） | 1741 个既有桶完全不变，0 个历史桶改变、0 个桶丢失、0 个新桶，3 个活跃桶增加 `3212498` Token；total `4191928795`，week `766150917` |
| 完全无新增记录时全量不增 | NOT_TESTED；用户继续使用 Codex，本轮不具备该条件，不把正常增量当作重复累计，也不把历史桶不变冒充全量静止条件 |
| 普通邮箱密码登录/实际自有请求 | 既有 `43093056…` RC：用户确认原生 Settings 账户登录成功、关闭云同步、Community 页面正常；只读开关 false、云端仍 1 行/130 Token。该证据保留；`512DD534…` 新包的会话/最小 UI 验收分别见第 10 节。已安装配置与 Auth proxy 的目标为自有项目，不把配置证据扩写为逐条网络抓包 |
| 最小 Community 创建/详情/榜单/删除 | PASS，既有 `512DD534…` 原生包证据与 review 接受，见 10.3；本轮不重跑 |
| 退出重启会话、正常 logout 登录门禁 | PASS，既有 `512DD534…` 原生包用户验收，见 10.3；本轮仅定向复验重启后的关闭偏好 |
| OAuth 现有入口实际回调 | PASS，既有 Google 正常回调用户验收，见 10.3；同步偏好新包验证见第 11 节。没有修改云端 provider/allowlist |
| 手动检查更新 | 已实际操作，UI 为检查失败；独立 fork latest 请求 HTTP 404，见 10.3。手动 HTTP 串联日志未捕获，不为此扩展范围 |
| 完整下载升级链 | NOT_TESTED；没有创建假 Release，没有用单测替代真实发行版下载/安装验收 |

第一次和第二次本地同步内容指纹分别为 `184fa26d78b5d57c87663a782d5821b87bac648e08c9e32acbad4cdf84ea5128`、`cd922675ebb392d37e041afae53962a8edfaef8b3f422ccc9d336b25d609c460`。pre snapshot 不覆盖，利用 append-only queue 的原始行数重建后与 pre 摘要相同，再比较各桶；报告没有原始 queue 内容。同步来源包括 Codex、Antigravity、Zcode、DSH、OpenClaw。

该轮云端 pre 只读检查为 Community 三表 `0/0/0`，Auth 用户 `2`，hourly `1` 行/total_tokens `130`。未登录同步未配置 device token/user id。原生登录从现有 Settings 账户弹窗进入，成功仍留在 Settings，在打开用量页面前由用户关闭「同步到云端」；没有注入会话或管理员冒充用户。本轮遵守用户明确 opt-out 的修复另见第 11 节。

管理凭据工具输出事件澄清（不复述值）：

- 类型：项目 link 中的 InsForge 项目级管理 API key；不是公开 anon client key、用户登录 JWT 或 CLI 账户 user-api-key。
- 是否有效：是，曾输出有效值；同一凭据能够完成受保护的自有项目只读请求。不能把字段名或源码扫描通过当成“没有有效凭据外泄”的证明。
- 已处置及边界：停止完整读取/输出 link 文件，后续使用字段白名单，值未写入源码、报告、Git 或新增诊断文件；既有会话工具输出未撤回，不能保证平台历史副本已删除。本轮已授权轮换项目管理凭据并仅更新必要本机 link 字段，实际旧 key 拒绝证据见第 12 节。
- 当前处置：第 12 节已关闭旧管理 key 的继续有效风险；源码扫描与历史工具输出暴露是两个独立结论，轮换不代表历史输出副本已删除。

本轮扫描 155 个 modified/untracked 待审查文件：没有命中管理凭据、完整 JWT、私钥、敏感字面量赋值或本机个人绝对路径；未发现 backend/ 或构建产物被意外纳入 diff。`git diff --check` PASS；LF/CRLF 提示不属于 whitespace error。22 个自有 Edge 均 active，云端代码 SHA-256 全部与 manifest 一致；migration history 仍只有 `20260930000000` 与 `20261001000000`。

### 9.3 历史 Actions 状态及当时下阶段方案（最新见第 13 节）

本轮只读访问目标仓库 `baozibao728-cmd/TokenTracker-Community`：

本节为日志补修前同日已完成的只读审查证据，本次补修复用这些证据，未配置或启用 Actions，也未再次运行 CI。不能将本地新包成功称为远端状态或 runner 验证成功。

| 项目 | 本轮实际结果 |
| --- | --- |
| backend Base URL repository variable | ABSENT；实际未设置值，无法确认 runner 会使用自有地址 |
| anon client repository secret | ABSENT；只检查名称是否存在，没有读取 Secret 值 |
| Actions 启用状态 | DISABLED；页面显示 fork workflows 未运行，未点击 Enable |
| 普通 CI | NOT_RUN；没有本轮固定 commit 的 runner 证据 |
| 三平台正式构建 | NOT_RUN；Windows 本地正式模式构建不能替代 macOS/Linux 或 runner 实测 |

本地 `ci.yml` 触发为 main 的 push/PR，权限 contents: read；包含 Linux/CLI/校验/Dashboard、macOS 与 Windows 构建/测试。当前 cutover 是未提交工作区，远端无法执行这些未提交内容。

`release-dmg.yml` 的 workflow_dispatch 会先创建 version tag 与 draft Release，三平台 checkout 固定 tag 后上传资产，最后自动转为公开/latest Release。`release-windows.yml` 也有上传已有 draft Release 的路径，不是本轮可直接 dispatch 的纯构建器。本轮没有 dispatch 任一 release workflow。

下一阶段具体顺序（尚未执行，需后续明确授权）：

1. 审查并提交/push cutover 到自有开发分支，记录完整 SHA。配置自有 Base URL Variable 与 anon client Secret、审查继承的 npm/运营 workflows 禁用状态后启用 Actions。不得将管理凭据用作 anon client Secret。
2. 在固定 feature SHA 上验证普通 CI：现有工作流可通过该分支对 main 的 PR 触发，记录 PR head SHA、runner 实际 checkout 的 merge SHA 和结果；不合并 main。若要求直接 checkout 单个源 SHA，另行授权为 CI 添加只读 build/test workflow_dispatch，校验输入 SHA 并显式 checkout，不使用 release workflow 来实现。
3. 另行授权新增三平台 build-only RC workflow，复用正式打包命令、身份/config guard 与构建后校验，固定 checkout SHA；contents: read，没有 tag、Release、Homebrew、npm 或自动更新发布步骤，只保留 Actions artifacts 和 SHA-256。完成 macOS DMG、Windows installer/ZIP、Linux AppImage/deb/rpm 的真实 runner 构建和相应 runtime 验收。不能通过抢先取消 publish job 来控制意外发布，也不把首发改为 Windows-only。
4. 三平台/原生 runtime、签名状态及已知基线审查完成后，再单独取得创建 tag、公开 GitHub Release、上传安装包及自动更新发布的授权，才可 dispatch 原发布 workflow。

### 9.4 状态分离

- Local Ownership Cutover：本地实现/归属静态门禁 PASS；不代表远端归属切换完成。
- Final Windows RC Runtime：既有原生流程经 review 接受；当前 `5221732B…` 包仅对同步偏好做定向复验，结果见第 11 节，不宣称完整下载升级已验证。
- Update source：代码和归属测试 PASS；新包启动检查实际 HTTP 404、用户手动 UI 失败及证据边界见第 10.3 节。
- Full downloaded upgrade：NOT_TESTED。
- Actions configuration：PASS；两项自有配置已设置且实际 runner build 成功，只启用普通 CI，见第 13 节。
- Actual ordinary CI：PASS；四个 job 完成，source/checkout SHA 与 run URL 见第 13 节。
- macOS/Linux：普通 Xcode/Rust runner 编译与测试 PASS；正式打包、安装和原生运行仍 NOT_TESTED。
- 正式发布：BLOCKED；只推送已授权的 cutover 开发分支，不创建 tag/Release、不 merge main、不部署。

## 10. 既有有效证据：Windows OAuth 日志补修（512DD534… RC）

### 10.1 范围及实现

补修覆盖 `Program.Main` 的原始 deep-link、Dashboard 的 NavigationStarting/NavigationCompleted/HistoryChanged、OAuth open、Tray 的 HandleDeepLink、回调后的诊断路径以及对应 WebView 初始化/恢复/导航异常。Program 的顶层 dispatcher、unhandled、task 和 WinForms 错误入口也会接收回调错误，因此一并避免记录 Exception.Message/ToString。Tray 的 WebView summary refresh 异常使用同一安全日志入口。BrowserTabCloser 原本仅记录事件/异常类型，SingleInstance 与 UrlProtocol 没有输出原始参数，保持不变。

新增 `OAuthDiagnostics`，供上述入口使用：

- 启动只记录 argc、hasDeepLink 和 startup，不记录启动参数或原始 deep-link。
- 导航仅记录事件与 scheme/host/path，用于判断原生是否走自有 Auth 地址和回调路径。`UriComponents.SchemeAndServer | Path` 排除 userinfo/query/fragment；无效、相对、不支持 scheme 或缺少 host 时固定记录 `<unavailable>`，不回退原始字符串。
- 链路错误仅记录异常类型和 HResult，不记录 message、inner exception、data、stack trace 或任意对象 ToString。
- `OpenInBrowser(url/e.Uri)`、`SingleInstance.TryForwardToPrimary(deepLink)`、Tray query 解析/Unescape、原值送入 HandleAuthCallback、Escape 后进入 SDK exchange 均未改为日志格式化结果。日志 helper 不返回替代跳转 URL。

没有修改 Auth 产品设计、SDK 授权流程、权限、Community/Foundation、migration 或云端配置。ServerManager 的既有子进程参数只为内部固定 `sync` / `serve --port … --no-sync --no-open`，不接收 OAuth/deep-link；其启动/运维日志不扩展重构。

新增/涉及文件为 `TokenTrackerWin/OAuthDiagnostics.cs`、`Program.cs`、`DashboardWindow.cs`、`TrayApplicationContext.cs`、`TokenTrackerWin.Tests/OAuthDiagnosticsTests.cs` 和测试 csproj。

### 10.2 本轮新验证

| 验证 | 结果 |
| --- | --- |
| Windows 日志/Auth 调用保护/identity/updater | 64/64 PASS，0 skip；其中日志测试 12 项 |
| 哨兵测试 | 合成授权码、access token、userinfo 哨兵均不进入实际日志 formatter 的输出；覆盖 query、fragment、无效/相对/不支持 URL、异常消息/inner/data、非异常对象 ToString |
| 正常原值保护 | logger 不改变输入；测试保留 query 中合成 code。调用处保护检查确认浏览器跳转/pipe 转发/回调解析/交换仍使用原值；实际 OAuth 交换是否成功另以原生验收判定 |
| 现有前端 Auth/native bridge | 3 文件，13/13 PASS；没有真实凭据测试输入 |
| Release publish | PASS，.NET 8 self-contained win-x64，1.2.0.0 |
| Inno installer / ZIP | PASS；现有打包流程，安装器编译 84.891 秒，无上传 |
| 未变的 embedded entry/config/Node | SHA-256 与 `43093056…` 包中相应已验证产物相同；未重新编译无关 Dashboard/后端 |
| 覆盖安装 / 本地路由 | PASS；安装 exe/runtime DLL/entry/config 同新 publish；`/communities` HTTP 200，云同步 false，NotSigned |

旧 `43093056…` 包的未登录真实托盘同步、历史桶重复同步核对及普通邮箱登录继续保留为有效既有证据；不是本节新包流程的替代证据。本轮不重跑 Community 双用户生命周期或完整后端验证。

最终 `512DD534…` 安装器另行保存独立且不覆盖的安装前快照，覆盖安装/启动后逐项相同：

| 官方保护范围 | 数量 | 本次 pre = post SHA-256 |
| --- | ---: | --- |
| 官方安装目录 | 1658 | `7e854e16ecd95cf906c5b5f4ce599631fc448d8d2cce5be390ae2f6d2b257326` |
| 官方 native/WebView/cache/log | 1395 | `cf1ce68e357e1322599235cb81968ab14be5f2fafac1d00ad746c49e1beadb70` |
| 官方 CLI 数据 | 1420 | `511fed7263ba05adcac6d24bd84800709f50218889fdff9830311f8350be3669` |
| 官方 protocol/uninstall/startup | — | `411a902572806f92339e3cc37a21a03b4dcbd05f43e54cebbcb8fffef8e3f325` |

现有 provider config/hooks 内容摘要亦相同。目录和注册表保护结论限定于本次安装前后，不将不同时间的自然活动摘要混为同一 baseline。

### 10.3 新包原生 runtime

- 正常 User A session：新包复用此前通过正常邮箱登录取得的真实会话，用户在新包 UI 完成创建；只读确认 owner 为 User A。云同步持久开关已确认关闭。
- 临时社区：云端只读已确认 `RC120 Log Smoke 20261003`，ID `566f51b6-8f00-4547-a837-95d5c4d29eb1`，owner 为既有 User A，member_count `1`；尚不以 DB 证据替代 UI 详情/榜单显示。
- 详情与榜单：用户通过已安装新包查看详情并切换三个周期，实际显示本周/本月/总计 `130/0/130`，与仅有 2026-09-29 的 130 Token 原数据一致，未新增用量样本。
- Owner 删除与关联清理：用户在新包正常 owner UI 输入完整 confirmation_name 并删除上述唯一临时社区；随后自有项目只读确认 communities/community_members/community_transfer_requests 为 `0/0/0`，Auth 用户 `2`，hourly `1` 行、total_tokens `130`。没有通过 SQL 删除数据。
- 重启 session、正常 logout 登录门禁：用户通过托盘正常退出后从开始菜单重新启动，确认会话保留、云同步关闭；正常退出登录后 Community 页面出现登录提示。当前运行进程来自 Community 独立安装目录，其子进程为同目录的 embedded Node，实际服务端口 `17681`，exe 与最终 publish SHA-256 相同。
- 现有 OAuth 实际回调：用户在最终原生包选择已有 Google 入口和 User A 的同一账号，确认系统浏览器打开、正常回到 Community 并登录成功，没有新增登录方式、注入 JWT 或管理员冒充。独立 protocol 注册指向最终 Community exe 并转发 `%1`；Windows 代码使用当前 origin 的 `/auth/callback` 与 `tokentracker-community://auth/callback`。此前自有项目 metadata 的 allowedRedirectUrls 为 `[]`，本次真实流程被平台接受；没有修改云端 allowlist/provider，也不推断其他端口/域名都已验证。该次完整 URL/授权码未保存。
- 云同步限制：**未能证明全过程始终关闭**。OAuth 操作期间本地镜像 GET 实际曾返回 `enabled=true`；随后用户确认已登录并关闭云同步，实时 GET 与持久文件均为 false。最终云端只读仍为 Auth `2`、hourly `1` 行/total_tokens `130`、Community `0/0/0`，未观察到本机用量上传。不能将操作后的 false 改写为期间一直 false。
- 手动更新检查：用户在最终新包点击检查更新，实际弹窗为“检查更新失败 / 无法连接到更新服务器，请稍后重试或前往 GitHub 手动下载”。最终包启动时的原生日志记录 `2026-10-03T12:56:32+08:00` 的 HTTP 404；本轮独立只读 GET `https://api.github.com/repos/baozibao728-cmd/TokenTracker-Community/releases/latest` 也为 404。安装代码的请求仅使用该固定 fork endpoint，没有官方 fallback。手动点击时没有新增可串联的 HTTP 日志，启动日志不冒充手动请求追踪；手动 UI 已复现，手动 HTTP trace 为 NOT_OBSERVED。当前无 Release，未创建假 Release，完整下载升级仍为 NOT_TESTED。

OAuth 新失败的定向诊断：

- `AccountViewProvider` 在所有路由挂载时调用 `syncCloudSyncPrefToLocalServer()`，包括系统浏览器的 `/auth/callback`；`getCloudSyncEnabled()` 在该浏览器没有已保存偏好时默认 true。系统浏览器与原生 WebView 的 localStorage 独立，因此有覆盖原生关闭镜像的路径。
- 既有偏好/Context 测试本轮 2 文件、9/9 PASS；另用临时配置显式收录 1 个隔离诊断测试，使用真实 `AccountViewProvider`、空合成 localStorage 与内存 fetch stub，复现回调路由将 disabled mirror 改为 true。该测试 PASS 表示不良行为可复现，不是修复 PASS，也不是用 mock 替代真实 OAuth 验收。
- 该路径与本轮实际 enabled=true 现象一致；没有完整网络追踪，不能声称已唯一证明当时写入者。普通 signOut 源码反而显式关闭开关，不能归因为“logout 故意开启”。
- 当时两个临时诊断文件已删除，该轮没有修改正式同步代码。随后 review 已批准最小修复；当前正式修复、新测试与新 RC 证据见第 11 节。此处保留的是故障复现历史，不能据此判定当前仍未修复。

实际日志证据边界：新包创建/详情导航的安全 endpoint 采样没有 query、fragment、userinfo，unsafeNavigationLogLines 为 `0`。重启后所读取日志未继续追加该次 OAuth callback 事件（callbackEventCount `0`，最新时间停在 `13:04:02+08:00`），原因未确认；不能宣称捕获了这次真实授权码交换的完整诊断链。敏感值不进入 formatter 的证明来自本轮合成哨兵/调用处测试，真实 OAuth 用户流程成功来自用户操作反馈，两者分别记录。

本轮发现既有 Community 刷新体验问题：切换其他应用后回到 Community 详情页会出现“刷新中”。定位到 `use-communities.js` 的 window focus 触发 reload，每次重新查询先将旧 data 置空；详情与榜单 hook 均有此逻辑。`ShowDashboard()` 只显示/激活窗口；本次日志在路由变更后没有重复 NavigationStarting/NavigationCompleted，支持这是重新查询数据造成的显示变化。未修改 Community 源码或行为；若刷新长期不结束需另行定位，不能以短暂刷新证据宣称不存在卡住问题。

本轮最后只读 Edge 对照为 `22/22 active`，全部代码 SHA-256 同 manifest，status/hash 与第 9 节已保存且未覆盖的 cloud pre baseline 相同（preEqualsPost=true）。migration history 仍只有两次已执行版本。Community 临时关系已清理，Auth 两位用户保留、原 130 Token 保留。

该轮正式发布结论为 **BLOCKED**：当时同步镜像覆盖尚未修复。当前状态以第 12 节为准。手动 HTTP 串联/完整 callback 日志缺失经 review 明确不再作为扩大本轮工作的理由；完整下载升级仍为 NOT_TESTED，远端 CI、macOS/Linux 正式构建和管理 key 撤销处置另行列明。

本轮最终日志修复后重新扫描 157 个 modified/untracked 文件：管理凭据精确匹配、完整 JWT、私钥、敏感字面量赋值与本机个人绝对路径均为零命中；未发现 backend/ 改动或误纳入的构建/诊断文件。`git diff --check` PASS。第 9 节的 155 文件结果为补修前既有证据，不能替代本次扫描；本次源码/报告扫描同样不代表既有管理凭据工具输出事件已完成处置。

该轮 Git 收尾：分支为 `chore/release-ownership-cutover`，HEAD 为 `6a9c47160d350bb793e9d99e2cfc3d150f69fda3`；当时工作区有 157 个 modified/untracked 文件，staged 为空。没有创建 commit、push、merge 或 tag。当前轮次状态见下节。

## 11. 上一轮 review：同步偏好修复与管理 key 处置（历史记录）

### 11.1 写入入口核对及最小修复

核对全部前端偏好写入口：Provider 挂载初始化、Settings 显式切换、正常 signOut 关闭、Leaderboard 页显式启用。它们共同经过 `cloud-sync-prefs.ts` 的镜像写入 helper；本地 API 的 POST/PUT 仍需要原有本地认证，没有改变其权限或上传协议。

本轮产品改动只涉及三处：

1. `AccountViewContext.jsx` 移除 Router 外 Provider 挂载时的镜像初始化。Provider 位置、上下文状态及事件订阅不变。
2. `use-cloud-usage-sync.ts` 在已有 Router 内 hook 中，首次进入非 OAuth 中继页面才初始化镜像；callback → 正常页面可以在同一个 Provider 生命周期中初始化。已有上传定时器在实际开始时再检查 opt-out。
3. `cloud-sync-prefs.ts` 统一识别 `/auth/callback` 与 `/auth/native-callback`（包含尾随斜线）；两者不向原生镜像发 POST。取得本地 headers 后再检查一次，以阻止等待期间进入回调页的写入。

没有改变产品默认 true 策略；没有强制关闭原有 true。正常 Dashboard/Settings 的初始化和用户显式开关保留。NativeAuthCallbackPage 的 eager import、授权码捕获、PKCE、protocol relay、实际回调值及权限逻辑未被本轮修改；未重排全局 Provider，未修改 Community、Foundation、Auth provider、migration 或云端配置。

### 11.2 正式回归与构建

新增正式测试：`use-cloud-usage-sync.test.jsx` 11 项、`cloud-sync-prefs.oauth.test.ts` 3 项。修复前真实 Context/hook 测试曾出现 7 项失败；修复后通过的是防止错误行为的回归断言，不是旧诊断复现测试的 PASS。

覆盖：空系统浏览器存储/存储 true 不覆盖 native false；relay 不把 native true 强制关闭；两个 callback 页面；普通 Dashboard/Settings 初始化和显式切换；不重挂 Provider 的 callback → dashboard；headers 等待期间的路径变化；关闭状态不启动上传，以及定时器到期前关闭的门禁。

| 本轮实际执行 | 结果 |
| --- | --- |
| 偏好、Context、Auth/native bridge、上传门禁、本地 sync API | 9 文件，43/43 PASS |
| Dashboard typecheck | PASS |
| Dashboard production build | PASS；使用显式 own-project public client 配置，包含 desktop pet，264 个 dist 文件 |
| Windows 日志/Auth/identity/updater 回归 | 64/64 PASS，0 skip；仍使用本机 .NET9 Major roll-forward 跑 net8 测试，RC 自包含 .NET8 |
| Windows publish / Inno installer / ZIP | PASS；Inno 编译 68.828 秒，未更换打包流程，产物见第 4 节 |
| 已有 Community/Foundation/cloud 生命周期 | 复用有效 PASS 与本轮 review；未重跑完整后端或双用户流程 |

生产 build 首次受 Windows `EBUSY` 文件锁影响；按同一构建流程重试后成功，没有删除业务逻辑或跳过失败检查。新包仍 NotSigned，没有上传或发布。

### 11.3 新包覆盖安装保护

`5221732B…` 安装器已覆盖安装。安装的 exe、runtime DLL、Dashboard index 和公开 client config 与新 publish 摘要相同，版本 `1.2.0.0`；独立 Community 安装目录及 installer 清理范围没有变更。

安装前保存新的不可覆盖 snapshot，安装后逐项相同：

| 官方保护范围 | 文件数 | 本轮 pre = post SHA-256 |
| --- | ---: | --- |
| 官方安装目录 | 1658 | `7e854e16ecd95cf906c5b5f4ce599631fc448d8d2cce5be390ae2f6d2b257326` |
| 官方 native/WebView/cache/log | 1395 | `cf1ce68e357e1322599235cb81968ab14be5f2fafac1d00ad746c49e1beadb70` |
| 官方 CLI 数据 | 1420 | `511fed7263ba05adcac6d24bd84800709f50218889fdff9830311f8350be3669` |
| 官方 protocol/uninstall/startup | — | `48503660af843280336d53ad302c0000732f1066fc5fb435526474abb60f33d2` |

本轮 registry helper 的序列化口径独立，不把它与旧 helper 的 hash 混比；其自身 pre/post 相同。官方 provider config/hooks 保护复用第 5/10 节有效证据，没有重新安装 hooks。未重跑完整卸载/重装。

### 11.4 定向原生 OAuth 与上传证据

只使用已安装的新包和正常 Google 登录。用户第一次确认登录成功且开关仍关闭，但观察器已不在随后运行的实例中；该次不声称捕获了回调期间事件。重新启动并校验当前监听进程实际产生安全事件后，补一次相同 Google 回调，避免以事后 false 代替全过程证据。

临时观察器仅记录事件类别、pid、布尔偏好、HTTP 状态与 own-target 布尔值，不记录原始 URL、query、fragment、headers、授权码或 token，不改变请求/响应和 Auth 行为，不包含在安装包/Git 中。合成哨兵检查通过，包含 query/fragment/auth header 哨兵；临时 logger 文件锁失败不能传播到应用，最终观察要求 lostEvents=0。

**定向原生验收：PASS。** 最终有效观察中的主应用 pid 与当前安装入口一致，实际监听 Node 的 pref-read 事件已验证，不把未覆盖进程的第一次操作当作全过程证据。

| 本轮实际证据 | 结果 |
| --- | --- |
| 操作前 | 本地镜像 false，观察器确实覆盖当前监听进程；已安装 exe/index 与最终 publish 相同 |
| 正常 Google → 系统浏览器中继 → 原生应用 | 用户确认登录成功、返回后开关仍关闭；2 次 relay 请求，10 次 Auth outbound 均 own-target |
| 回调期间偏好写入 | relay 写入 0；普通页面写入 3 次，全部 `enabled=false`、HTTP 200；enabled=true 写入 0 |
| 回调及返回后的上传观察 | Node outbound ingest 请求 0；lostEvents=0。采样保留事件类型及状态，不包含原始 URL/认证 headers |
| 正常托盘退出、同一安装入口重启 | 用户确认仍已登录、开关关闭；重启镜像 false，普通页再写入 false/HTTP 200；ingest=0、lostEvents=0；用户随后正常退出 |
| 云端定向 pre/post | Community 三表 `0/0/0`，Auth 用户 `2`，hourly `1` 行、total_tokens `130`；两个 migration history 及 22/22 active Edge hash 均相同 |

Auth proxy 采样包含 200 和 logout 期间的 401；没有把所有 Auth HTTP 请求写成 200。用户完成真实 Google 登录；不索取或输出任何凭据，不改云同步开关来制造通过。

上传证据限定于该原生实例的本地 API/Node outbound 观察窗口，结合关闭门禁回归与 unchanged 130 Token；不是全部浏览器网络流量的抓包。相较单独事后读取 false，本轮实际观察了 relay 经过时不存在镜像写入、正常页持续 false 和 ingest=0；没有保存完整 callback 日志。没有新增云端 Token 样本。

只读 guard 最初使用 unrestricted SQL 入口得到 HTTP 403；改用正常受保护 rawsql SELECT 接口成功完成验收，未提升权限或修改数据库。覆盖安装辅助校验最初给公开 client config 使用了错误相对路径，安装本身已完成；核对真实 `src/lib` 路径后四项匹配全部通过，没有因此重复安装或修改产品逻辑。

### 11.5 暴露管理 key：按连带影响停止条件暂停

**状态：BLOCKED；未生成新 key、未轮换、未撤销旧 key、本机 link 未改变。** 类型是自有项目 `TokenTracker-Community` 的项目级管理 API key，曾输出有效值；不是公开 anon、JWT secret、用户 token 或 CLI 账户 user-api-key。历史工具输出不能撤回，未声称已删除其平台副本。本报告及源码不复述任何值。

本轮自有项目只读依赖检查：

- link 中的管理 key 与平台 `API_KEY` 对应值在进程内比较相同，只记录比较结果。
- 项目没有 `INSFORGE_SERVICE_ROLE_KEY`；现有 Edge resolver 通过 `API_KEY` 使用该项目服务凭据。因此撤销它会连带影响目前 22 个 Edge 的后台数据库访问。
- 平台轮换 endpoint 为 `/api/secrets/api-key/rotate`，当前 CLI 轮换命令会把新值输出，不能直接使用该输出方式。
- 对照 InsForge 官方实现：Function secrets 在部署时作为 Deno `env_vars` 注入；轮换路由没有调用现有 secrets redeployment helper。仅轮换并修改本机 link，无法保证已部署环境立即得到替代 key。该判断结合真实 own-project 依赖与官方源码；没有宣称已验证云端运行的是同一源码 revision 或已经发生中断。

依据：[secrets route](https://github.com/InsForge/InsForge/blob/main/backend/src/api/routes/secrets/index.routes.ts)、[secret service](https://github.com/InsForge/InsForge/blob/main/backend/src/services/secrets/secret.service.ts)、[function secrets](https://github.com/InsForge/InsForge/blob/main/backend/src/services/functions/function.service.ts)、[Deno deployment env](https://github.com/InsForge/InsForge/blob/main/backend/src/providers/functions/deno-subhosting.provider.ts)。

用户明确要求“若平台操作会连带影响上述配置，停止该操作，先报告具体影响和处置方案”，同时禁止部署 Edge；因此本轮停在轮换前。受保护正常只读接口仍可访问，旧 key 尚有效。没有新 key 可供“新可用/旧失效”双向验收，不能写成撤销 PASS。管理 key 不进入客户端构建，轮换本身不要求再次重建 RC。

最小追加处置方案：先确认当前平台的 key 轮换/旧 key 撤销与 deployed env 刷新契约，并取得**仅刷新 22 个现有 Edge 同源码运行环境**的授权；安全在进程内接收替代 key，按既有本机权限保存必要 link 字段，刷新所有相同 source/hash 的 Edge 环境，撤销旧 key。用同一受保护只读接口验证 new=可用、old=拒绝，再验证 22 Edge active 与必要后台只读访问。anon/JWT/user token、Auth provider、数据库和 migration 全部不轮换/修改。若平台不能在不扩大影响的情况下完成这套步骤，继续停下；不承诺尚未证明的零中断。

定向访问记录：从台北当日零点起、actor=api-key、limit=100 的只读审查返回 10 条（8 个 EXECUTE_RAW_SQL、2 个 GET_SECRET）；8 条 SQL 在进程内归类为 SELECT/WITH 只读，0 条未分类。只记录动作统计，未保存 SQL、调用详情、IP 或凭据。actor 是通用 api-key，记录不能按具体 key/调用者归因，也不能证明覆盖所有 HTTP 请求或排除其他访问；**不是完整访问审计**。

### 11.6 Git/CI 下一阶段（未执行）

先关闭管理 key 撤销阻塞，再按以下顺序推进；本轮不代替后续授权：

1. 复核本地 cutover diff、已知限制与 secrets scan；获准后在自有分支创建固定 commit，记录完整 SHA，push 并创建指向自有 main 的 PR，不合并。
2. 获准配置 GitHub repository 的 own-project Base URL Variable 和 public anon Secret，并启用经过审查的普通 CI；不读取/输出 Secret 值，也不把管理 key 用作客户端配置。
3. 在上述固定 SHA/PR 上运行普通 CI，明确记录 source SHA、PR merge SHA 与 runner 结果；若添加 dispatch，仅允许 build/test、固定 checkout，contents: read。
4. 另行授权添加三平台 build-only RC workflow：复用正式 packaging 和归属/config guard，checkout 固定 SHA；仅上传 Actions artifacts 与 SHA-256，无 tag、GitHub Release、npm/Homebrew 或自动更新发布步骤。真实验证 Windows、macOS、Linux，不把首发缩成 Windows-only。
5. 三平台结果和发布限制经 review 后，才单独授权公开发布。现有 `release-dmg.yml` 会创建 tag 并自动公开 Release，不能用于试跑；不靠临时取消 publish job 控制副作用。

已有同步、邮箱登录、Community 生命周期、Google 用户流程、重启/logout、安装共存、updater 门禁和 Real-Cloud Closure 的有效证据继续保留。真实自然 session expiry 未单独复现，review 接受的等价证据仍成立。两项全球排行榜 clean HEAD 基线失败不修复；未签名状态、macOS/Linux 未实际构建/安装、Actions 未配置/未运行，以及无 Release 时完整下载升级 NOT_TESTED 均保留。

### 11.7 当前状态与收尾

| 范围 | 当前结论 |
| --- | --- |
| 本地 Ownership Cutover / OAuth 日志补修 | PASS，复用有效证据 |
| OAuth 同步偏好最小修复 / 正式回归 | PASS，本轮新执行 |
| 最终 Windows RC 定向回调 / 重启 / 上传门禁 | PASS，`5221732B…` 包本轮真实用户与安全事件证据 |
| 项目管理 key 撤销 | BLOCKED；依赖环境刷新超出本轮不部署 Edge 边界，尚未撤销 |
| 更新源 / 安装许可门禁 | 已有 PASS；fork latest HTTP 404、手动失败 UI 已实际复现 |
| 完整真实下载升级 | NOT_TESTED，首发无已有 Release，不创建假 Release |
| Actions 配置 / 实际 CI | BLOCKED / NOT_RUN，复用本轮前序只读状态，不宣称 runner 通过 |
| macOS / Linux | 静态证据有效；正式 build/runtime NOT_TESTED，仍按三平台准备 |
| 正式发布 | BLOCKED，不创建 tag/Release 或发布自动更新 |

最终源码/报告扫描覆盖 162 个 modified/untracked 文件：既有管理 key 的内存精确匹配、user/project key 模式、完整 JWT、私钥、本机个人绝对路径均为零命中；无 backend diff、误纳入的 build/diagnostic/credential 文件，staged 为空。源码扫描不代表历史工具输出事件已经撤销处置。`git diff --check` PASS。

前序未提交 cutover 已有 157 个 modified/untracked 文件（含本报告）；本轮增加上述 3 个产品文件与 2 个正式回归测试的变更，并更新同一报告，合计 162 个。分支/HEAD 未变，没有 commit、push、merge、tag、Release、workflow dispatch、migration 或 Edge deployment。安全摘要和最终安装器保留在忽略的 RC 目录；临时观察/guard/protection helpers 在完成后清理，没有持久设置 NODE_OPTIONS，没有保存新旧管理 key。

**上一轮判断：同步偏好问题已关闭，管理 key 撤销当时尚未关闭。** 本轮追加授权及完成状态见第 12 节；11.5/11.7 中的 BLOCKED 是上一轮时点，不是当前凭据状态。


## 12. 管理 API key 定向轮换与环境切换

**凭据处置：PASS。** 本节是本轮实际云端证据；同步偏好、原生登录/重启/OAuth、Community 生命周期、安装共存、updater 的已接受证据继续有效，未重跑、未重建客户端。正式发布仍受 CI/macOS/Linux 等既有未验证项限制。

### 12.1 实际平台契约及可执行方案

目标仅为 TokenTracker-Community，project ID `a6ae494f-4e08-40b5-8985-fd69581d0409`，Base URL `https://tc79bxhm.ap-southeast.insforge.app`。真实 `/api/health` 返回平台版本 2.3.2；对照该版本固定 tag 的官方实现，并用当前项目实际刷新/HTTP 结果验证关键路径，没有仅依据源码推断操作成功。

- `POST /api/secrets/api-key/rotate` 接受非负整数小时，默认 24 小时，最大 168 小时。选择显式 **1 小时**，是最短正整数窗口；0 小时虽受支持，但会在环境刷新完成前令旧部署凭据立即失效，因此不采用。
- 旧 key 保留为平台 reserved 历史项，验证只接受 `expires_at > NOW()` 的宽限凭据。reserved 项不允许通用 PUT/DELETE，未发现独立撤销接口；本轮通过到期拒绝完成失效处置，未绕过平台直接改 secret 表。
- 平台返回旧 key 截止：**2026-10-03 16:19:55 GMT+8**（UTC：2026-10-03T08:19:55.421Z）。到期前旧 key 仍有效，未提前写成撤销 PASS。
- 轮换路由不自动刷新部署环境。使用标准 `PUT /api/secrets/COMMUNITY_MAX_MEMBERS`，把该现有配置的**当前原值**写回，触发平台 debounced 项目级 redeploy：从云端读取全部 active 源码及当前 secrets，生成一份 22-function 部署。没有逐个盲目重新部署，也没有改变 quota。
- 轮换前先验证上述刷新路径可达到实际 success，再轮换。预定恢复方式为使用替代管理 key 重试同一原值配置刷新并等待新 deployment success；不长期恢复暴露 key。本轮两次刷新均成功，没有执行失败恢复。
- 新 key 仅在控制进程内接收；未使用打印值的 CLI rotate 命令。只更新既有忽略文件 `.insforge/project.json` 的 `api_key` 字段，其他字段严格相同，原文件就地写入，不创建凭据备份。平台当前 API_KEY 与 link 在内存中比对相同。

依据：[v2.3.2 rotation schema](https://github.com/InsForge/InsForge/blob/v2.3.2/packages/shared-schemas/src/secrets-api.schema.ts)、[secrets routes](https://github.com/InsForge/InsForge/blob/v2.3.2/backend/src/api/routes/secrets/index.routes.ts)、[secret service](https://github.com/InsForge/InsForge/blob/v2.3.2/backend/src/services/secrets/secret.service.ts)、[function service](https://github.com/InsForge/InsForge/blob/v2.3.2/backend/src/services/functions/function.service.ts)。

### 12.2 同源码环境刷新和实际部署状态

| 阶段 | Deployment ID | 最终 status | function_count |
|---|---|---|---|
| 原有有效部署 | n441rg32qjaf | success | 22 |
| 轮换前标准刷新路径验证 | nvxzgxytsa87 | success | 22 |
| 轮换后替代 API_KEY 环境 | t2pkb3c1tv2y | success | 22 |

查询的是平台 `functions.deployments` 的最终状态；该状态由 provider wait-for-deployment 回写，不以 metadata active 代替。两个新部署记录均包含既有完整 22 个名称。轮换前/到期后再次逐项读取云端源码并计算 SHA-256，与两个已验收 manifest 完全相同；22/22 active。未重新生成源码、修改业务/权限/API，也没有操作官方项目。

| Edge | Source SHA-256（pre = post = manifest） | 最终状态 |
|---|---|---|
| tokentracker-accept-community-transfer | `5f2961d65218e591307a1ccc60f4822a144672b581210ce7706c58cfa29cbfad` | active / 相同 |
| tokentracker-account-daily | `ea8e3c59efd39352efd4df72e0abd9539dd32fb5850dec3448b2ca5b398fa4f9` | active / 相同 |
| tokentracker-account-devices | `796f9089a1eb2073eaa3ac1068221264f815edf61c376d06694da32db620a378` | active / 相同 |
| tokentracker-account-heatmap | `4466ae1bbd9a8834440aebbf5e2b1f5445d8ec2c7721095e2ed66c024fa6aa44` | active / 相同 |
| tokentracker-account-hourly | `c9884ee1132498f36b56b2ceb915743977608ff1dbbf78c45ae4042a49cdebbe` | active / 相同 |
| tokentracker-account-model-breakdown | `94134958d1298ef858b96b97a8cde639fc1386709a44e943b4efce82065fdf66` | active / 相同 |
| tokentracker-account-monthly | `5cb67b0e38034c86c3e53f2bd6554d70dc1e894e2d0709bb7346ff38774f19c4` | active / 相同 |
| tokentracker-account-summary | `d9701db9aeda4b3766c346314792bb738a603d269718cf757e5a969466b7e4d8` | active / 相同 |
| tokentracker-community-detail | `f889591154a818484c3e3bbc388b8a21cff373ea27e001b7eefc513cacbeb395` | active / 相同 |
| tokentracker-community-leaderboard | `8ef27e43689c2bb9caa1fdef303e71a03819c33462900f16114365d85a6598e9` | active / 相同 |
| tokentracker-create-community | `9097213fc46bc5e61db2bb283e3e1a1fc7b5d771e805dad605c150eac1b0f39c` | active / 相同 |
| tokentracker-create-community-transfer | `e377b7e80b6ecd2d63c795dfcad6be270499ccf8646b37aef6c649e6a09ddaaf` | active / 相同 |
| tokentracker-delete-community | `46e4d579f950d46a98b88de43b84984585c0d99d7191af897441c8564d02a952` | active / 相同 |
| tokentracker-device-token-issue | `b0386445843a3d6e4131f7a2a4768894f97834d47879dd6ece9e932495e6a5f2` | active / 相同 |
| tokentracker-ingest | `60c8ba1c2da774bc60a9a74f021b64187be4fa3e7276f863e47ab6bebae21be6` | active / 相同 |
| tokentracker-join-community | `f21462bc066765923dfd1781a6495d05bdb33cd3be838c2fa6993d793e72d907` | active / 相同 |
| tokentracker-leaderboard | `5a0d2c26594cb1b562ddbcfc1ca335a9cbc0b8c12c617a74bc171aaf55aa51d6` | active / 相同 |
| tokentracker-leaderboard-profile | `5d6061fde5f7fd610a460832b0ace7ef70c400401b476476ed18ffeef23cd47b` | active / 相同 |
| tokentracker-leaderboard-refresh | `bdf5c33e726c3a7f2af464462563f80e9b0daae5e301e828fc809c1b0382759f` | active / 相同 |
| tokentracker-leave-community | `9324f5fe750c0395a98e64c0cbb28f58ce23b364e35d841e9ecc9fea2a8004fd` | active / 相同 |
| tokentracker-public-visibility | `2d072cdb4d79f5f7800d604343b43300423a0caa3881c2fbfb1a4d5125fe51df` | active / 相同 |
| tokentracker-reject-community-transfer | `d2322f769ec999c0c93104f1c33f3ac65c03e7ab33c95dd2c9c6ce92b35d0097` | active / 相同 |

### 12.3 凭据 HTTP 验证及旧 key 失效后的真实用户读取

使用同一受保护只读接口 `GET /api/secrets`，新旧凭据分别在内存中请求，只记录 HTTP/code：

| 时点（台北） | 新 key | 旧 key | 结论 |
|---|---|---|---|
| 2026-10-03 15:21:34 GMT+8 | 200 | 200 | 宽限期内仍有效，未判撤销 PASS |
| 2026-10-03 16:20:42 GMT+8 | 200 | 401 / AUTH_INVALID_API_KEY | 旧 key 已明确因凭据无效被拒绝 |

最终结果为 new=200，old=401 / AUTH_INVALID_API_KEY；不是网络失败、404 或普通权限不足。过期历史项可能仍保留在平台 secrets 维护记录中，是否物理清理不影响上述实际拒绝证据。

正常用户身份为既有 User A（`260494f3-6adf-44ba-84ec-49839aa14161`）。复用已验收原生客户端的正常 Auth proxy/session-refresh 流程取得真实 access token，仅留验证进程内存；没有注入前端 JWT、管理员冒充、创建用户或强制撤销用户会话。正常 Auth 自动续期属于现有会话行为，不是轮换用户 token 配置。云同步始终关闭。

- 2026-10-03 15:18:15 GMT+8，before rotation：正常 Auth 200；Foundation total leaderboard 200，User A total_tokens="130"；Community detail/list 200，owned/joined=0/0、limits=10/20/2000。
- 2026-10-03 15:19:17 GMT+8，before rotation：正常 Auth 200；Foundation total leaderboard 200，User A total_tokens="130"；Community detail/list 200，owned/joined=0/0、limits=10/20/2000。
- 2026-10-03 15:22:06 GMT+8，new environment within grace：正常 Auth 200；Foundation total leaderboard 200，User A total_tokens="130"；Community detail/list 200，owned/joined=0/0、limits=10/20/2000。
- 2026-10-03 16:21:20 GMT+8，after confirmed old-key invalidation：正常 Auth 200；Foundation total leaderboard 200，User A total_tokens="130"；Community detail/list 200，owned/joined=0/0、limits=10/20/2000。

到期后代表性读取发生在已确认 old key 401 之后，证明替代运行环境仍能完成 Foundation 数据库读取及 Community JWT → RPC 读取，不依赖旧 key 宽限期，也不只用 OPTIONS/匿名 401 代替服务凭据验收。刻意选择只读 snapshot/list 路径，未调用会写 Foundation usage cache 的聚合接口。

### 12.4 不可覆盖业务基线与严格对照

pre：2026-10-03T07:15:14.098Z；post：2026-10-03T08:22:57.350Z。pre 使用独立唯一运行目录及 exclusive-create 文件，后续没有覆盖；raw row content 只在进程内进行稳定排序/哈希，未写入报告或安全摘要。摘要只含 count/hash/status；没有 imported helper 自动执行 CLI main。

Foundation 每表按 `to_jsonb(row)::text` 稳定排序，整个行 JSON 包含全部字段；分别计算 SHA-256，再按表名计算 aggregate。

| Foundation 表 | row_count（pre = post） | row-content SHA-256（pre = post） | 对照 |
|---|---|---|---|
| tokentracker_account_session_states | 1 | `24e0d067333d06946e0a1cea2befde48009c15cc1f8a210edfe6f91f9afb0bbd` | 相同 |
| tokentracker_account_usage_cache | 8 | `80e17c64e8de98f3428ba705d11575bb279d1cb7c074ebdded2290a0f83a35df` | 相同 |
| tokentracker_device_machine | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | 相同 |
| tokentracker_device_tokens | 2 | `c6d6d89d6c695437acc91662b2193a45b75392ddc12be1efcfef53189b9ae7e2` | 相同 |
| tokentracker_devices | 1 | `9e93f6077855ee8db81a8dded051165b05d5bc697eb2b0f58eb69d2b22c25051` | 相同 |
| tokentracker_hourly | 1 | `5d9015a259b439d1e432122ef2467834c13afec18527ac981c740a2c19b3fda2` | 相同 |
| tokentracker_leaderboard_refresh_state | 3 | `0cd65051651b734cfc97c5a17df3c45366605ac1b7528f07450a948f78181800` | 相同 |
| tokentracker_leaderboard_rollup_daily_v2 | 1 | `431c1c812c875f0802f3d937e92a9dd1a3cdfdb2e79d0893952b0b3b4613b52a` | 相同 |
| tokentracker_leaderboard_rollup_meta_v2 | 1 | `241e507cc24766ad2ec65087eb178bbae6f6b22ef18af8baf5937e0cfde8d1c2` | 相同 |
| tokentracker_leaderboard_rollup_total_v2 | 1 | `f2065faa3df18b1b1908e45097e9c309a5130526f84427fc132454ff6feb024d` | 相同 |
| tokentracker_leaderboard_snapshots | 3 | `61dc874341f6c54d89c90a1f99813eb54c4b0b161ce72c1bb56ccf46facfc929` | 相同 |
| tokentracker_user_settings | 1 | `53b3be6f0bf272c9e3bae71a901e52c5854e9479d13769483a20929268a4a67b` | 相同 |

Overall Foundation data SHA-256：`5ea89b11d122960c0b4f0a34fac9089be11cb20071024444a1a76b6d4b6065e9`，pre == post。

Schema/function/ACL 对照覆盖 public 表/列/default、constraint、index、业务 trigger、View、函数定义/owner/ACL/security/config、RLS/policies、public/auth namespace ACL、default ACL、anon/authenticated/project_admin role attributes；每组稳定排序。

| 范围 | SHA-256（pre = post） | 对照 |
|---|---|---|
| relations | `5f0a405bc1619b674138c3a5aef4a92c1eb8ea69fb4d9ccb718de6c0cc80bf10` | 相同 |
| columns | `fb881ee75e426796ec2777fb792a14fa8e30f2f907788e09188dda79c8c17686` | 相同 |
| constraints | `89f6ccdb2317affcfbff1b713ee34f1c286baab494422587bd35a4e0caac607b` | 相同 |
| indexes | `84e2e604644cb2619f07211dc1529c504b6bb5b6c55d71c5bb1b5393265aae89` | 相同 |
| triggers | `8e366e1a8ce9980acb197baa7929ec5abaefe6b893509a399e61d570f8a92c86` | 相同 |
| views | `1dd7e3cc8960ebfff1aef742184e053bcff7076d1c53a3ff764d66947976f7bb` | 相同 |
| functions | `aeedef28f4ce03b7839d65746c9e0abaf27389c53d36ce2ee5cf0565f4e12ba8` | 相同 |
| policies | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` | 相同 |
| namespace | `769e08a84e4c56f216d81582de0a6c39d5205d76e8cfaba713c09e68db9c8f1a` | 相同 |
| defaults | `fda03f4ec37c8ee26f724b129953ac13eba999c35f9ecf9b467763218f7aa79f` | 相同 |
| roles | `8e800a03dd383420c4beff3f3e34d1cdd98e10388c624a35579fbbb3667ce8d1` | 相同 |

Schema/function/ACL aggregate SHA-256：`911cc85523ad7e1acce23875d78ac93b0b0198b8257caca70901d704d6ac9cb8`，pre == post。

其余严格比较全部相同：

- migration history 仍只有 20260930000000 tokentracker-mvp-bootstrap、20261001000000 community-leaderboard-v1；版本/名称不变。该 REST 响应未提供 checksum 字段，不宣称额外取得云端 migration 内容 checksum。
- Auth 仍只有 A/B 两个既有 UUID；User B 为 `67250f1a-23ec-4790-b41b-4616400f760d`。未新增用户。
- hourly 仍 1 行、total_tokens="130"；Community 三表仍 0/0/0。
- 22 Edge 源码 hash/status 与基线一致。anon、JWT 相关平台配置、Base URL、三个 Community quota 的值仅在内存中哈希比较，全部不变；没有把它们的值写入任何摘要。
- Secrets 轮换、deployment、audit 及正常 Auth 会话续期维护记录允许变化，不与业务数据混比。没有插入 Token/Community 样本，未执行 migration/业务 DDL。

### 12.5 安全处置边界、既有证据及后续阶段

管理凭据历史暴露类型是自有项目级 API key，当时输出过有效值。当前旧 key 已实际拒绝、必要 link/Edge 环境已切换，继续有效风险已关闭；不复述任何值，不能撤回历史工具输出副本，也不声称已删除平台历史副本。上一轮定向 audit 仅提供通用 api-key actor 的动作统计，不能按具体 key/调用者完整归因；本轮没有把这项证据升级为完整访问审计。

本轮只新增本报告更新及忽略的安全操作证据，未改产品代码、backend/migration、RC 或云端业务对象。旧/新 key、认证 headers、access/refresh token、密码/验证码没有进入源码、Git、命令参数、报告、操作日志或非必要临时文件；必要本机 link 是唯一替代管理凭据持久位置，产品原有正常会话存储沿用其正常 Auth 行为。最终 secret/path scan、git diff --check 和清理结果以本节收尾补充为准。

**可以进入下一阶段 Git/CI review。** 已有同步偏好/原生/Community/安装共存/updater 证据保留，本轮未重复完整生命周期或本地测试全集。Actions 配置与实际普通 CI 尚未通过；macOS/Linux 正式 runner 构建尚未验证；Windows 未签名状态、两项已知全球排行榜基线失败、完整下载升级 NOT_TESTED 的首发限制继续保留。整体正式发布仍为 BLOCKED。

下一阶段（本轮未执行）：固定 cutover commit → push 自有分支并创建 PR → 配置自有 Base URL Variable/public anon Secret → 在明确 source SHA/PR merge SHA 上运行普通 CI → 专用三平台 build-only RC workflow（禁止 tag/Release/upload-release/homebrew/自动更新副作用，仅 Actions artifact）。创建 commit/push/PR、修改 Actions 配置/工作流及 dispatch 需要下一轮明确授权。现有 release-dmg.yml 会公开发布，不能拿它试跑；首发范围仍为 Windows/macOS/Linux，不改为 Windows-only。

本机源码核对补充：22 个 checkout 文件使用 CRLF，原始文件字节 hash 因换行与 LF 发布 manifest 不同；Git HEAD blob 的原始 hash 以及 checkout 仅统一换行后的 hash 均 22/22 等于 manifest。本轮没有转换/修改文件，没有用本机 CRLF 文件重新上传；云端源码原始字节 hash 在 pre/post 均精确等于 manifest。该区别不被当作静默修改发布产物的理由。

本轮收尾检查：162 个 modified/untracked 文件的敏感信息/个人路径扫描零命中。轮换后、到期前已在内存中对新旧管理 key 进行逐文件精确匹配，零命中；最终报告生成后再做替代 key 精确匹配及 key/JWT/private-key/path 模式检查，零命中。pre 基线文件 SHA-256 `3f5d9d3ea9a6eb7ba5f8e6bad6305357ea3095fc1fc24a4b2f4e258fb0e9b955` 与 post comparison 完成后相同，未覆盖。`git diff --check` PASS，backend diff 为空、staged 为空、云同步仍关闭。临时控制/报告 helpers 退出后清理；只保留忽略目录中的不可覆盖 count/hash/status 安全证据。分支/HEAD 未变，无 commit、push、merge、tag/Release、migration 或发布 workflow 操作。Actions/macOS/Linux 状态沿用既有证据，本轮未重新运行或声称通过。

## 13. Git / Draft PR / Ordinary CI（2026-10-03）

本阶段获授权在现有 `chore/release-ownership-cutover` 提交、push 自有 origin、创建指向自有 main 的 Draft PR、配置 Actions 并运行普通 CI。第 12 节“未提交/未配置 CI”等描述是上一阶段时点的历史记录，本节记录当前状态。没有重建 RC、重复生命周期/云端验收、轮换凭据、merge、tag、Release、Edge 部署或 migration。

### 13.1 提交范围与定向检查

- origin 精确为 `baozibao728-cmd/TokenTracker-Community`；远端 main 仍为 `6a9c47160d350bb793e9d99e2cfc3d150f69fda3`。
- 149 个 tracked 修改、13 个正式新增文件：独立安装/数据/后端/更新身份、已授权 updater/OAuth 日志/同步偏好补修、三端配置、相应测试与两份发布文档。没有 backend/community、migration、Foundation 改动；pricing/provider 相关 diff 只改变独立缓存路径，没有算法改动。没有依赖升级或再次改版本。
- 单独只读审查未发现范围外阻塞；所有 untracked 均为正式脚本/测试/报告。`.insforge`、RC 安装包、观察器、临时 GitHub helpers、安全操作摘要和本机凭据均不在提交清单中。
- `validate:versions` PASS，所有 managed locations 为 1.2.0；Dashboard typecheck PASS；新增普通 CI 的 8 个 Dashboard Auth/prefs/Context/native bridge/upload gate 文件合计 **41/41 PASS**；macOS identity / workflow / client-config 定向测试 **21/21 PASS**。
- 162 个最终文件的 key/JWT/private-key/个人路径模式与当前管理 key 精确匹配扫描零命中；`git diff --check` PASS。旧 diff 删除行内的继承公开 client credential 不进入最终源码；工具输出不复述其值。复用已接受的 Windows/updater/native/Community/管理 key 证据，不重跑本地全量。

### 13.2 普通 CI 与远端保护

普通 `ci.yml` 保留原 root tests、精选 Dashboard tests、build/copy/locale/guardrails/version/bot checks、Rust fmt/clippy/test、macOS Node/Xcode tests、Windows Node/.NET tests/build；新增 Dashboard typecheck 和上述 8 个回归文件。macOS CI 加入既有 Community identity 脚本。Windows runner 安装 .NET 8、生成仅 runner 工作区使用的 global.json 固定具体 SDK 8 且 rollForward=disable，并输出实际 SDK/runtime 信息；完整 xUnit 项目包括新增 OAuth diagnostics、实际安装许可 updater gate 及 identity tests。没有 skip、continue-on-error、删除门禁或放宽断言；没有加入已知失败的完整 Dashboard suite。

GitHub REST 重新核对发现 repository Actions 已 enabled=true，远端 11 个 workflow 全部 active，不能沿用前期页面“未启用”结论，也不能假设本地禁用已影响 main。已先在自有仓库逐项手动禁用 10 个非普通 CI workflow：CodeQL、Labeler、三个 leaderboard 运营任务、Lock closed issues、npm publish、两个 release workflows、Stale；复查全部 disabled_manually。没有正在运行的非授权 workflow 需要取消。只保留 `CI` active；不 dispatch 发布 workflow，不恢复继承定时任务。

- Repository Variable `TOKENTRACKER_COMMUNITY_INSFORGE_BASE_URL` 已设置，并 GET 确认实际值为 `https://tc79bxhm.ap-southeast.insforge.app`。
- Repository Secret `TOKENTRACKER_COMMUNITY_INSFORGE_ANON_KEY` 已从自有项目公开 ANON_KEY 安全取得，在进程内以 GitHub public encryption key/LibSodium sealed box 加密后设置；未使用管理 key 或 CLI user key作为客户端值，未输出/保存 Secret 值。Ubuntu/macOS 的实际 own client-config 校验与 Dashboard build 成功，配置有效性有 runner 证据，未仅凭 Secret metadata 判定。
- 本机 GitHub 认证复用正常 Git credential helper，值仅留进程内，不记录在参数、文件、报告或源码。

### 13.3 固定提交与实际 CI

首次源码提交：`ca9b366733fae988b7e33bbfc28182e177100080`（`chore: prepare community release ownership`），已非 force push 到自有分支。Draft PR：[baozibao728-cmd/TokenTracker-Community#1](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/1)，base=main，始终保持 Draft。

第一次普通 CI：[37112008154](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37112008154)，PR head 为上述提交，runner checkout 的真实 PR merge SHA 为 `43bfa632292fe4debcfac6138a575f1b0c2ac930`，不是 main 已合并。Windows PASS；其余三个 job FAIL，尚不宣称普通 CI 已通过。

- Windows 实际 SDK `8.0.425`，global.json rollForward=disable；64/64 xUnit PASS，包含新增 OAuth diagnostics / updater install permission gate / release identity；正式模式 `.NET 8` build PASS，0 warnings / 0 errors，没有依赖本机 .NET 9 roll-forward。
- Ubuntu 和 macOS 的 own client-config 校验与 Dashboard build 已成功，证明 repository Variable/Secret 确实进入 runner。Ubuntu typecheck、所选 Dashboard（含 41 项新增覆盖组）步骤成功。Root suite 均有 16 个失败：移除官方默认后遗漏的模拟 backend/anon 参数、禁用的官方反作弊工作流旧断言、独立 GNOME UUID 与 macOS 去除系统 CLI fallback 的旧断言。它们是本次 cutover 测试契约未对齐，不归入两项已知全球排行榜基线失败。
- Linux cargo fmt 失败明确给出 4 个文件/7 个格式差异；只按 rustfmt 输出换行/尾逗号，业务 token/权限/协议逻辑不变。
- 最小修复仅为 Rust 格式和测试夹具/契约：明确注入 mock URL/public credential 并恢复环境，保留 token/count/cache/header/error/backoff 断言；GNOME 验证文档所规定的安装 symlink destination 与独立 UUID；macOS 验证固定 7682 同端口并拒绝系统 CLI fallback；运营门禁改为明确禁止自动触发、backend URL/credentials、网络/SQL/GitHub 写入，原 upstream SQL/Edge 的原子 reconciliation 断言继续保留。没有跳过失败、重启官方任务、放宽权限或改产品算法。
- 本机定向 121 项 fixture 回归为 120 PASS/1 FAIL：Reasonix 测试读取到本机现有 DSH 样本，首次两台 clean runner 没有该失败；没有为此改 Provider。另 Windows CRLF checkout 使原未修改的 upstream total-rollup 静态断言失败，首次 clean runner 同项通过；没有转换 Foundation 源码或弱化断言。GNOME/macOS 定向 3/3 PASS。最终 gate 以修复后真实 clean runner 为准。

第一次修复提交：`a5556fd724b610a004da9ae4e7032a65d7966ae1`（`fix: align cutover CI fixtures and Rust formatting`），已非 force push。第二轮 CI：[37112511257](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37112511257)，PR head 为此 SHA，runner checkout PR merge SHA 为 `2cd2646642ec9e969836dace74a8ae54fcbfc73a`。

- Windows 再次 PASS。Ubuntu/macOS 的 root suite 原 16 个失败全部关闭，仅新增 1 个静态 identity 断言失败：`TOKENTRACKER_DATA_ROOT` 与目录须位于同一行的旧正则不适应 rustfmt 换行。Ubuntu 3207 PASS/1 FAIL/6 既有平台 skip；macOS 3211 PASS/1 FAIL/2 既有平台 skip。
- Linux fmt/clippy PASS；实际 Rust 测试暴露 2 个 AppImage 路径夹具仍使用官方 `TokenTracker` 产品目录，未对齐已确定的 `TokenTracker Community` 目录。没有将它们标为平台环境故障，也没有修改实际路径查找逻辑来兼容官方目录。
- 第二次最小修复只改测试：正则精确匹配环境变量调用及独立目录，允许格式换行；AppImage 夹具使用 Community 产品名，并增加不能自动探测官方产品目录的断言。Node identity/workflow 定向 12/12 PASS；本机没有 Rust 工具链，Rust 结果等待真实 Linux runner，不代写 PASS。

第二次修复提交：`8f7566e23443ebdba06ec9fdb353353f15e93488`（`test: align Linux runtime fixtures with community identity`）。第三轮 [37112921753](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37112921753) 的 Linux fmt 发现新增较长夹具路径还需拆行；依实际 rustfmt diff 提交 `2800a41103148fc9815577df9ea73de9396fce84`（`style: format community AppImage test path`），只改该测试行格式。

第四轮 [37113059002](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113059002)，PR head=`2800a41103148fc9815577df9ea73de9396fce84`，runner checkout=`76a7ecf52fe7cada9bf5cbffba6e404cafd3a708`：Linux Rust fmt/clippy/69 tests PASS；macOS root suite 3212 PASS/0 FAIL/2 既有平台 skip、identity 3/3、Xcode 201/201 PASS；Windows Node 37/37、xUnit 64/64、SDK 8.0.425 Release build PASS。Ubuntu root suite 3208 PASS/0 FAIL/6 既有平台 skip；后续 UI hardcode 检查失败，指出新增 Hook 测试夹具包含无用 JSX 展示文字。

第三次最小修复：`75b8d2525527645c384748253e50107a844861a3`（`test: remove unused UI text from sync preference fixture`），该测试组件只负责挂载 Hook，不测试展示文字，因此返回 null；11 项原测试断言、UI hardcode baseline 与门禁保持。定向 11/11、UI hardcode、architecture guardrails、敏感信息扫描、diff check 本地 PASS。没有为了通过检查更新 hardcode baseline 或排除该测试文件。

第五轮普通 CI **SUCCESS**：[37113419380](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113419380)。固定 source/PR head：`75b8d2525527645c384748253e50107a844861a3`；四个 runner 实际 checkout 均为 `21633c601eb9a704641a56f848221326964926d3`。这是 GitHub 为 PR 生成的测试 merge ref，不代表 main 被合并；base main 始终为 `6a9c47160d350bb793e9d99e2cfc3d150f69fda3`。

| CI job | 实际结果 | 证据 |
|---|---|---|
| Ubuntu test + validate + build | PASS；typecheck、own client-config、Dashboard build、13 Skills/32 limits/41 Auth-prefs-upload/16 bot tests；root 3208 PASS/0 FAIL/6 既有平台 skip；copy/locale/UI hardcode/architecture/version/bot frames 与附加 architecture 4/4 PASS | [job 111175542976](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113419380/job/111175542976) |
| Linux client (Rust) | PASS；fmt、clippy --all-targets -D warnings、cargo test --locked，69 PASS/0 FAIL/0 ignored | [job 111175542954](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113419380/job/111175542954) |
| macOS unit tests | PASS；own client-config 与 Dashboard build、root 3212 PASS/0 FAIL/2 既有平台 skip、identity 3/3、Xcode 201/201 | [job 111175542830](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113419380/job/111175542830) |
| Windows build | PASS；Node 37/37、完整 xUnit 64/64（含日志/updater/identity）、实际 SDK 8.0.425 与 Release build；0 warnings/0 errors | [job 111175542940](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37113419380/job/111175542940) |

原有平台条件 skip 数量保持，没有新增 skip、continue-on-error 或放宽/删除门禁。完整 Dashboard suite 未加入本轮 CI；两项已接受全球排行榜基线失败（period changes cache timeout、Preloaded User missing）保留，未修改它们。普通 CI 不包含 backend redeploy/migration，不将它等同三平台正式 release packaging 或完整安装升级验收。

收尾文档提交只更新本报告，具有不同的 PR head SHA，会由同一普通 CI 自动独立检查。上表固定记录已通过的**源码提交**；最终文档 head、其实际 runner checkout/run URL/status 将记录在同一 [Draft PR 验证摘要](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/1)及交付回复。不会用源码提交的绿色结果代替新文档 head 的结果；无 force push、rebase 或 squash。

Git 阶段无已知阻塞，可交 review。171 个 PR 变更文件的 key/JWT/private-key/个人路径扫描零命中，版本仍为 1.2.0，diff check PASS；backend diff 为空，没有临时 helpers、RC 产物或凭据进入 Git。报告收尾后再次核对 remote branch 与本地一致、working tree clean；只有普通 CI active，其余 10 个继承 workflow disabled_manually。正式发布仍 BLOCKED，下一阶段范围如下。

### 13.4 下一阶段边界

普通 CI 全绿后停止交 review。下一阶段在获授权的固定 commit 上新增专用三平台 build-only RC：验证 required client config，复用现有正式 Windows/macOS/Linux 包装流程，输出 installer/DMG/AppImage/deb/rpm 与 SHA-256 为 Actions artifacts；禁止创建 tag/Release、上传 release assets、公开发布、npm/Homebrew 通知或自动更新副作用。不会使用现有自动公开 release workflow 试跑，不将首发范围缩为 Windows-only。Windows 未签名、完整下载升级链 NOT_TESTED、两项已知全球排行榜基线失败继续保留；三平台正式包装/运行验收尚未通过。

具体实施范围（本轮仅计划，未添加或运行）：

1. Review 当前 Draft PR 与固定 source commit。新增独立 build-only workflow，使用手动输入的完整 40 位 commit SHA，checkout 后核对实际 HEAD；只在自有仓库运行，contents:read。构建与其校验均固定在同一 source SHA，不在 job 内 pull/rebase 最新分支。
2. 三个 job 先执行现有 version/client-config guard，公开客户端配置来自已验证的 repository Variable/Secret。Windows 使用 .NET 8 正式 self-contained win-x64 publish、既有 bundle-node.ps1 与 Inno Setup；macOS 使用既有 bundle-node.sh、xcodegen/icon patch、Release Xcode build、现有 ad-hoc sign 与 create-dmg；Linux 使用现有 bundle:node、Tauri build 与包内容校验，产出 x86_64 AppImage/deb/rpm。
3. 复用打包脚本与原 release workflow 的构建步骤，不能直接调用有 tag/Release 上传副作用的 release-windows.yml。仅以 Actions artifacts 收集三平台产物、大小/架构/SHA-256 和构建日志，不授予 contents:write，不设置 publish job，不调用 gh release/git tag/npm publish/Homebrew 或自动更新渠道。
4. 等三个 build-only job 完成后单独 review 产物及平台安装/运行验证范围；macOS ad-hoc 签名不等于 Apple Developer 签名/notarization，Windows 未签名不改写成已签名。正式 tag/Release、资产上传、自动更新及任何签名凭据配置仍需后续明确授权。

## 14. Three-platform Build-only RC（2026-10-03）

**普通 CI：PASS；三平台正式 BUILD/PACKAGE：PASS；上传后下载回核：PASS。正式发布仍为 BLOCKED。** 本节取代第 13.4 节尚未执行的计划状态。已验收基线为 `43b84199484d401ee3213551a455937007902ecd`，继续在 `chore/release-ownership-cutover` 和 [Draft PR #1](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/1) 工作，没有 merge main。已有 Community、Auth、同步偏好、安装隔离及管理 key 处置证据保持有效，本轮未重跑生命周期或云端验证，未重建/安装本机 RC。

### 14.1 Workflow、范围及远端保护

新增 `.github/workflows/rc-build-only.yml`，只允许自有仓库的同仓库 `pull_request` 指向 main；权限仅 `contents: read`。没有 dispatch 现有 release workflows，也没有调用它们作为 reusable workflow。Windows/macOS/Linux 复用已有正式 bundle、编译、签名及打包步骤，新增检查作用于实际产物。

触发范围限定为构建相关 workflow、版本/client-config 脚本、依赖清单、CLI/Dashboard 与三端源文件。由于 PR paths 会比较整个 PR，另有轻量 candidate job 对本次 synchronize 的 before/head 范围做检查；仅更新报告时应跳过三个打包 job。candidate、三个平台与 delivery 均显式 checkout `github.event.pull_request.head.sha`，由 `checkout.cjs` 检查实际完整 40 位 SHA，禁止在 job 内 pull/rebase。

本阶段源码范围只新增以下 11 个文件（731 行）；收尾另更新本报告：

| 文件 | 目的 |
|---|---|
| `.github/workflows/rc-build-only.yml` | 三平台正式 build-only、配置/版本门禁及六包 artifact 汇总 |
| `scripts/rc/checkout.cjs` | 自有仓库与候选完整 SHA 核对 |
| `scripts/rc/changes.cjs` | 本次改动范围判断，避免报告更新重复打包 |
| `scripts/rc/windows.ps1` | win-x64 正式 publish、ZIP/Setup 与实际 payload 检查 |
| `scripts/rc/macos.sh` | universal Release、完整 ad-hoc 签名、DMG 挂载检查 |
| `scripts/rc/linux.sh` | 三种 Linux 格式分别严格解包及内容检查 |
| `scripts/rc/verify-runtime.cjs` | 实际嵌入 runtime、版本、自有配置和 updater 归属核对 |
| `scripts/rc/linux-package.cjs` | deb/rpm 实际包名、版本、架构校验 |
| `scripts/rc/pick-one.cjs` | 每种正式格式必须恰好一个产物 |
| `scripts/rc/artifacts.cjs` | 实际字节 checksum/size、汇总及下载回核 |
| `test/rc-build-only.test.js` | workflow/触发范围/格式清单、配置、元数据及防篡改回归 |

没有修改产品功能、Auth/同步偏好、Parser/Cost Engine/Provider、Community/Foundation、Edge、schema 或 migration；没有依赖升级或改版本。`ci.yml` 沿用第 13 节已通过覆盖，root suite 会实际执行新增 RC 测试。

远端复查：Actions enabled；仅 `CI` 和 `Community build-only RC` active。CodeQL、Labeler、三个 leaderboard 运营 workflow、Lock closed issues、npm publish、release-dmg、release-windows、Stale 共 10 个仍为 `disabled_manually`。main 保持 `6a9c47160d350bb793e9d99e2cfc3d150f69fda3`，PR 始终 Draft。没有 tag/Release/release asset、npm/Homebrew 通知、自动更新发布、云端部署、migration 或凭据轮换。

各平台首先执行 `validate-versions.cjs` 和 `prepare-release-client-config.cjs`。Repository Variable 的实际值仍为 `https://tc79bxhm.ap-southeast.insforge.app`；public anon Secret 沿用上一阶段安全配置。本轮不读取/输出 Secret 值。所有实际包均检查 staged CLI 配置与构建注入值相同、Dashboard 含自有 client config、runtime resolution 指向自有项目，并检查 native binary 不含官方 backend/updater repo。客户端仅使用公开 anon 配置，没有管理凭据。Linux 没有应用内自动更新器，检查范围为独立包身份/协议和实际 runtime；不宣称其升级链已通过。

### 14.2 固定源码与普通 CI

**最终打包候选、三个平台及 delivery 的实际 checkout 均为：**

`0a143a05b975854365294201d9f690f6f70c0059`

对应普通 [CI run 37119385289](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289)，attempt 1 全部 SUCCESS。普通 CI 使用 PR merge ref，四个 runner 实际 checkout 均为 `359c80ff102dcb234e748d7266c668777dbabc5b`；这是测试 merge ref，不是 main 已合并。不可将它与上述正式包的 source/checkout SHA 混用。

| 普通 CI job | 结果 | 实际证据 |
|---|---|---|
| test + validate + build | PASS；root RC 测试、既有精选 Dashboard/Auth/prefs/upload gate、typecheck/build/copy/i18n/guardrails 等原门禁保留 | [111192377928](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289/job/111192377928) |
| Windows build | PASS；实际 SDK 8.0.425、原日志/Auth/updater/identity tests 与 .NET 8 build | [111192377921](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289/job/111192377921) |
| macOS unit tests | PASS；既有 Node/identity/Xcode tests，未修复 notify 产品逻辑 | [111192377819](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289/job/111192377819) |
| Linux client (Rust) | PASS；既有 fmt/clippy/test 门禁保留 | [111192377940](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289/job/111192377940) |

本机新增 RC 与 release-client-config 定向测试 15/15 PASS；版本仍全部为 1.2.0；Bash syntax 和 PowerShell parser 检查 PASS。没有新增 skip、continue-on-error、删除失败检查或放宽产品权限。Node 测试日志中的 `aaaaaaaa...` SHA 属于合成防篡改夹具，不能用作真实 artifact 证据；真实证据来自下一节固定候选的打包/delivery 与下载字节。

### 14.3 三平台实际打包与内容检查

[Build-only RC run 37119385283](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283)，attempt 1，candidate、Windows、macOS、Linux、delivery 全部 SUCCESS。

| 平台/job | 实际 BUILD/PACKAGE 结果与检查范围 |
|---|---|
| [Windows 111192403724](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/job/111192403724) | PASS；固定实际 SDK 8.0.425/rollForward=disable；既有 bundle-node.ps1；正式 self-contained win-x64 publish；Inno Setup。展开实际 ZIP，在隔离 runner 目录静默安装实际 Setup，不启动 GUI；逐文件比较 ZIP 与安装 payload 的全部相同字节，检查 x64 PE、coreclr/hostfxr/System.Private.CoreLib/WebView2Loader、版本/product/publisher/独立 uninstall identity。两份实际 runtime 均检查 Node 22.22.2、CLI/Dashboard、自有 backend/updater。runner 静默安装属于包内容验证，不代替本机新包 GUI 验收。 |
| [macOS 111192403683](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/job/111192403683) | PASS；既有 bundle-node.sh、xcodegen/icon patch、Release Xcode universal build。完整按内层 Node/dylib/so/node → widget（既有 entitlements）→ app（既有 entitlements）ad-hoc 签名；deep/strict 验证签名，widget sandbox=true。create-dmg 后只读挂载实际 DMG，核对 app/widget/Node 均 arm64+x86_64、1.2.0、bundle `com.tokentracker.community` / widget 独立 ID、`tokentracker-community` 协议、自有配置与 updater。实际 `Signature=adhoc`，没有 Developer ID 或 notarization。 |
| [Linux 111192403692](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/job/111192403692) | PASS；既有 bundle:node/Tauri 正式 build。AppImage、deb、rpm 三个实际文件分别解包验证 x86_64 native executable、原始可执行权限、Node 22.22.2、CLI/Dashboard runtime、1.2.0、自有 backend及独立身份。deb/rpm 元数据严格为 `token-tracker-community`、1.2.0、amd64/x86_64，desktop Exec `%u` 与 `x-scheme-handler/tokentracker-community` 验证通过；rpm 以 libarchive 成功解包，不忽略退出码，不 chmod 修补提取出的权限。AppImage 的 Tauri desktop 不包含 deb/rpm 模板，检查实际二进制中的独立协议注册声明与 desktop 名称；实际启动注册尚 NOT_TESTED。没有用 AppImage 通过代替 deb/rpm。 |
| [delivery 111194071651](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/job/111194071651) | PASS；下载三个已经上传的 Actions artifacts，拒绝容器 digest mismatch，重新核对每个实际安装包的 size/hash/source/checkout/version 和格式清单，再汇总六包。产出 SHA256SUMS/RC_MANIFEST.json，最终再次核对实际字节，仅上传 Actions artifact。 |

### 14.4 六个正式交付物与上传后回核

全部版本 **1.2.0**，source_sha = checkout_sha = `0a143a05b975854365294201d9f690f6f70c0059`。最终 [六包 Actions artifact 11272578871](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283/artifacts/11272578871)，名称 `community-rc-0a143a05b975854365294201d9f690f6f70c0059`；保留 30 天，下载通常需要 GitHub 登录。其内容为以下六个正式包、`SHA256SUMS` 和 `RC_MANIFEST.json`。

| filename | architecture | bytes | 安装包本身 SHA-256 |
|---|---|---:|---|
| TokenTrackerCommunity.dmg | arm64+x86_64 | 61,896,126 | `5c850f0dba9d72d8cbe544cf244b8b2985c8783386ef27e73e50ef448e177441` |
| TokenTracker-Community-win-x64.zip | x86_64 | 114,892,518 | `2e913bb78c18aec0f1b96d71edf9854521e4d678a842eed9e29619dd751c4f4e` |
| TokenTracker-Community-Setup.exe | x86_64 | 80,741,452 | `9660c2ddeda46f88f9da10329560a393dfe284ff9615fbdeca77af13acfb008d` |
| TokenTracker-Community-linux-x86_64.AppImage | x86_64 | 127,486,456 | `aabac8decd202a9f3d3c41048508daca324ed4acd412e15699da5d09ed8fdc63` |
| TokenTracker-Community-linux-x86_64.deb | x86_64 | 56,989,076 | `39ce996cbf1982f0b0e0a254a85a561c4e1e064c98e8c28298598f9967241add` |
| TokenTracker-Community-linux-x86_64.rpm | x86_64 | 56,975,561 | `d14b8c7e763d812f10504b011080840cc403a9778b1cbdeccbd24a8ab6150125` |

已从 GitHub 下载最终上传的 artifact，外层容器 498,984,638 bytes/digest 核对成功；解开后运行 `node scripts/rc/artifacts.cjs verify <download-directory> 0a143a05b975854365294201d9f690f6f70c0059`，六个实际安装包的 size/SHA-256、版本、source/checkout SHA、完整格式清单及 SHA256SUMS 一致，**上传后本机回核 PASS**。上表 checksum 来自实际安装包字节，绝非 Actions 外层下载 ZIP 的 checksum。下载与安全证据只留忽略目录，不提交 RC 产物、临时 helper 或本机路径。

### 14.5 失败、修复与候选记录

所有候选的普通 CI 均 attempt 1 全部 PASS；以下失败来自真实打包检查，逐项保留，没有把它们当作已知 Dashboard 基线或掩盖失败。

| 候选/source SHA | 普通 CI / build-only RC | 实际失败及最小处理 |
|---|---|---|
| `2f32839fd9446dbbeff4fde46317ec9fab82b391` | [37116591750](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37116591750) PASS / [37116591853](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37116591853) FAIL | Windows PASS。macOS 签名后 codesign entitlement 默认输出不是 XML，PlistBuddy 拒绝；改用明确 `--xml`。Linux payload checker 错要求 Windows opt-in quota.html；核对既有 Vite 实际输入后，main/share 全平台、pet/quota 仅 Windows，未删除真实平台必需入口。 |
| `2b4dcc4049a0b19a66952642b6d5b1cb33f6ad2b` | [37117351215](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37117351215) PASS / [37117351211](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37117351211) FAIL | Windows/macOS PASS；Linux AppImage PASS 后 deb 包名检查失败。原 checker 错把 Cargo 可执行文件名当包名；按实际 metadata 与 locked Tauri CLI 2.11.3 productName→kebab-case 契约严格校验 `token-tracker-community`，没有改产品名或包身份。此候选包含 `859bd8e3efba7d58dc1cd9e2405b9de3a2a8847a` 的触发/entitlement 修复。 |
| `56b0006b883378ec51904e90990d54f35b763d50` | [37118344116](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37118344116) PASS / [37118344166](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37118344166) FAIL | Windows/macOS、Linux AppImage/deb PASS；rpm metadata PASS 后检查步骤 exit 1，旧日志未定位 GNU extraction 或紧接的 executable 检查哪一步失败，不声称已证明底层原因。改用严格 libarchive 解包，新增原始 mode 错误诊断；禁止沿用旧 workflow 的 extractor-warning 后继续策略。另将单格式恰好一包改为明确失败校验。新候选真实 rpm 解包和原始权限/runtime/protocol 全部 PASS。 |
| `0a143a05b975854365294201d9f690f6f70c0059` | [37119385289](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385289) PASS / [37119385283](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37119385283) PASS | 三平台、六种交付、delivery 与下载回核全部 PASS；未 rerun-failed、未跳过任何格式或降低门禁。 |

相关正式依据：[Apple codesign XML entitlement 格式](https://developer.apple.com/documentation/xcode/creating-distribution-signed-code-for-the-mac/)、locked [Tauri CLI 2.11.3 deb 包名](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.3/crates/tauri-bundler/src/bundle/linux/debian.rs) / [rpm 包名](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.3/crates/tauri-bundler/src/bundle/linux/rpm.rs)。没有改变产品业务行为来规避上述检查。

### 14.6 交 review 状态与限制

本阶段 **BUILD/PACKAGE PASS**，可交 review；正式发布 **BLOCKED**。Windows 未签名；macOS 仅 ad-hoc，未配置 Developer ID/notarization。macOS/Linux 正式包的实际安装、真实 GUI/Auth/本地采集/重启/协议回调尚 **NOT_TESTED**；AppImage 实际启动后的协议注册亦未验收。Windows runner 静默安装/内容校验不代表本机最终六包候选重新完成原生验收；此前已接受 Windows 原生、共存、updater 与 OAuth 证据保留，未无理由重复。

完整下载升级链仍 **NOT_TESTED**，不创建临时 Release 取得升级证据。Dashboard 两个既有全球排行榜失败（period changes cache timeout、Preloaded User missing）仍单独保留，没有运行完整 Dashboard suite 或修复它们。macOS notify 已知不稳定性仍保留，本阶段各候选普通 CI 首次均 PASS，不据此宣称该问题被修复。

收尾只提交本报告，形成与打包候选不同的最终 PR head；该文档 head 必须独立等待普通 CI，不能把 `0a143a...` 的绿色结果代替新 head。报告固定记录已验证的 source/checkout SHA 与包字节；最终文档 head、普通 CI run/merge checkout 及报告-only 打包跳过的实际结果记录在 [Draft PR #1](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/1) 和交付回复，避免自引用 commit SHA。12 个本阶段最终文件的 key/JWT/private-key/个人路径 scan 零命中，版本检查 1.2.0 和 git diff --check PASS；product/backend diff 为空。远端 branch/head 与 clean 工作区在文档 push 后复核；临时 credential-handling helpers 清理，安全 count/hash/status 与下载产物保留在忽略目录。

第 15 节继续对这些固定字节完成了 Windows 实机定向验收。下一阶段待 review 决定 macOS/Linux 安装和真实运行验收及正式签名策略，不会擅自收缩为 Windows-only；merge、tag/Release、资产上传及自动更新发布仍需后续明确授权。

## 15. 最终 CI Windows 实机定向验收（2026-10-03，原生与 portable smoke PASS）

固定 source SHA `0a143a05b975854365294201d9f690f6f70c0059`，artifact `11272578871`。本轮直接使用第 14.4 节下载回核的实际字节，不重建、不重新打包。Setup SHA-256 `9660c2ddeda46f88f9da10329560a393dfe284ff9615fbdeca77af13acfb008d`；portable ZIP SHA-256 `2e913bb78c18aec0f1b96d71edf9854521e4d678a842eed9e29619dd751c4f4e`，版本均 1.2.0。安装版及 portable 原生定向 smoke 已完成；本轮不是完整升级链或三平台 GUI 验收。

### 15.1 安装前保护与同版本覆盖

安装前两版原生应用均未运行。保存不可覆盖的 pre snapshot：逐文件相对路径、size、完整文件内容 SHA-256，稳定排序后计算 scope aggregate；原始配置/凭据值没有写入摘要或报告。另保存 protocol/uninstall/startup 注册内容，比较时只输出 count/hash/equality。

| 保护范围 | 文件/记录数 | 安装前 = 安装后、首次启动前 SHA-256 |
|---|---:|---|
| 官方安装目录 | 1658 | `e163c930abced2f6cbadf490e1b83fb69acac3a74048dacd999e984ce5ae18f9` |
| 官方 native/WebView/cache/log | 1397 | `915d67b0c41ad9aa4f47dd89c31c9c03f62e3fd82d62a2ce3bdea90bc5d4014f` |
| 官方 CLI 数据 | 1095 | `a5e025554287152e165d900d2bb2cc046eceea6d2fbe3389f67243bac75f0a1e` |
| 官方 protocol/uninstall/startup | 28 | `f47696b15e8ed6babf61e8c0f7b2424b511798054b6a388cfe9f63f693b20c20` |
| Claude/Codex/Gemini 现有配置/hooks 配置 | 4 个现有文件 | `debc94a9d55f917110ba424c5abd9e7619523aa953d8d298c30ea93b378deae5` |
| Community CLI 数据 | 15 | `cbfd436bcd80c13df5712348729c26c4ea7cc13b5bf4f03a5c76ed14314fb47e` |
| Community native/WebView/cache/log | 851 | `1327d240282dd0e05ffc19888d6b91ccca492aa34e5b00ed68dda72c368872d4` |

安装前及首次启动前 Community 云同步均 false；queue 1858 行、1769 个最新桶、total_tokens=`4263808502`，覆盖安装没有改变。官方 queue 2321 行、1739 桶、total_tokens=`3760484034`，相同。

已使用上述固定 Setup 对独立 Community 目录进行同版本覆盖，Inno exit 0。与最终 portable ZIP 的全部 944 个文件逐一 SHA-256 比较相同，包括 native exe/DLL、Node、CLI 和 Dashboard；没有启动 installer 的 postinstall GUI、没有删除用户数据。旧 dashboard/dist 清理仅作用于自己的 Community `{app}`。官方独立安装与受保护内容在覆盖安装前后、首次启动前均保持一致；当时官方卸载注册的 DisplayVersion 为 1.1.8，不能据此代替原运行进程的版本证据。

### 15.2 当前原生实机证据

用户从开始菜单启动最终安装版，确认现有账号仍已登录。实际 exe 为 `%LOCALAPPDATA%/Programs/TokenTrackerCommunity/TokenTrackerCommunity.exe`，Node 子进程为同目录 `EmbeddedServer/node.exe`，父子关系核对正常；loopback 17681 服务正常，Dashboard 与 `/communities` HTML HTTP 200。以上相对安装路径不代表 Vite 页或源码 checkout 的 Node。

实际本地 preference API HTTP 200，enabled=false、account_available=true；本地 usage-summary HTTP 200。启动后的正常原生后台采集读取真实现有工具使用记录，2026-10-03T12:29:25.894Z 本地总计为 `4342200126`；这与覆盖安装前冻结数值的差异发生在应用启动后，不归因于 installer，也不称为构造的云端样本。最终对照及 runtime 差异分类见第 15.4 节。

自有项目本轮只读 GET 均确认：hourly 1 行、total_tokens=`130`；Community 三表 0/0/0。使用必要本机管理 link 只做计数，没有用管理会话代替前端登录验收，没有上传 Token、创建社区或修改云端资源。

用户已确认最终 CI 安装版现有会话保留、云同步关闭、社区正常、刷新正常；原生截图总计显示 43.4 亿，与上述本地 API 数值的显示精度一致。随后用户通过托盘正常退出，再从开始菜单启动，确认会话、关闭偏好及页面仍正常；重启进程的实际 exe/Node 路径仍来自正式 Community 安装目录。

用户在该最终包手动检查更新，截图为“检查更新失败／无法连接到更新服务器，请稍后重试或前往 GitHub 手动下载”。已核对固定包更新目标为本 fork；单独访问本 fork releases/latest 的只读 HTTP 结果为 404。当前原生诊断日志没有本次检查的新增 HTTP 状态记录，因此不将旧日志冒充本轮请求证据，也不宣称已捕获本次原生请求的 HTTP 结果。完整 updater 下载升级仍 NOT_TESTED，同版本覆盖安装不能替代升级链验证。

本轮曾按用户要求暂停；不可覆盖的 pre 与首次启动前 post 快照、固定安装包及安全计数/hash 证据保留，恢复后沿用同一 baseline。已有 Google 回调、Community 双用户生命周期、同步偏好补修及管理 key 处置证据继续有效，未重复全流程。

2026-10-03 台北时间 22:15 恢复本轮验收：Setup 与 portable ZIP checksum 再核对一致，pre snapshot 文件 checksum 仍为 `5501278b3e38bb152ca4bb3820fec1a3b677cedb0a5b6bc589de045a9f3b49ca`。从固定 ZIP 解压目录启动 portable，实际 exe 与 Node 父子进程均来自该解压目录；Community 协议注册也已指向 portable exe。loopback 17681 的 Dashboard 和 Community HTML 均 HTTP 200，本地偏好 enabled=false、account_available=true；22:17:30 本地 usage-summary HTTP 200、total_tokens=`4347529888`。用户随后确认原生页面、会话及关闭偏好正常，portable GUI smoke PASS。

22:19 再次只读确认自有项目 hourly 1 行、total_tokens=`130`，Community 三表仍 0/0/0。官方 queue 有 2427 行、1800 桶、total_tokens=`3962932363`，安装前完整 741876 bytes 的 prefix SHA-256 严格保持，仅存在追加；最终对照见第 15.4 节。

用户确认 portable 原生仪表盘、社区、现有会话及关闭偏好正常，portable GUI smoke **PASS**；随后正常退出 portable。23:00 启动同一 CI 正式安装版，实际 exe/Node 均回到正式安装目录，`tokentracker-community` 协议严格匹配正式安装 exe；本地 preference HTTP 200、enabled=false、account_available=true。协议恢复 **PASS**。清理临时 portable 解压目录时首次遇到 `mscordbi.dll` 文件被占用，未停止其他程序或修改权限；重新检查无 portable 进程且正式协议已恢复后重试，第二次删除成功。固定六包与快照证据保留，用户数据未删除。

23:03 最终云端只读核对仍为 hourly 1 行、total_tokens=`130` 与 Community 0/0/0。用户确认恢复后的正式安装版正常，并通过托盘退出。随后确认两版原生程序均已停止，23:14 生成不可覆盖的全范围 post fingerprint 并完成下述差异分类。本轮没有修改产品代码、重建包、重跑完整双用户或全量本地测试；收尾只提交本报告及更新原 Draft PR 的验证摘要。

### 15.3 固定 macOS/Linux 包的交接验收清单

当前只有 Windows 桌面。本节四种包的 **BUILD/PACKAGE PASS** 沿用第 14 节；对应安装、GUI/RUNTIME 仍全部 **NOT_TESTED**。不得以 Windows 结果、解包检查或无界面测试代替。测试者使用 artifact `11272578871` 中的原文件，先按第 14.4 节核对各文件 SHA-256，记录硬件架构、OS/发行版版本与测试时间，不重建或虚构 Release。

**macOS — TokenTrackerCommunity.dmg（arm64+x86_64）：**

1. 核对 DMG SHA-256；挂载并确认产品名 TokenTracker Community、1.2.0、bundle `com.tokentracker.community`。签名仅 ad-hoc，不等于 Developer ID/notarization；若系统阻止启动，记录实际提示及 BLOCKED，不关闭系统安全策略来取得 PASS。
2. 安装到独立 Community app，保留官方 app 和两边数据；保存官方安装/配置/协议及数据的安全 count/hash baseline。确认实际 app/内嵌 Node 来自该 DMG，menu bar、Dashboard、本地服务正常。
3. 读取已有本地用量并刷新；正常用户登录由测试者手动完成，云同步保持关闭，Community 列表页正常且只访问自有 InsForge。不保存/发送密码、授权码或 token，不构造云端样本。
4. 退出再启动，确认会话和关闭偏好；正常 logout 后 Community 登录门禁。用现有 OAuth 入口确认 `tokentracker-community://` 正常回调，记录实际结果，不新增登录方式。
5. 手动检查更新，只访问本 fork Releases；没有 Release 时记录 HTTP/UI，完整下载升级保持 NOT_TESTED。结束后比较官方保护范围并保留用户数据，汇报 GUI/RUNTIME PASS/BLOCKED 及未测项。

**Linux — 三种格式必须分别记录结果：**

| 包 | 安装/启动及身份核对 | 当前 GUI/RUNTIME |
|---|---|---|
| TokenTracker-Community-linux-x86_64.AppImage | 核对本文件 checksum；从可执行 AppImage 启动，确认实际 AppImage/extracted runtime 路径、x86_64、1.2.0。实际启动后检查独立 `tokentracker-community-appimage.desktop` 与协议注册；包内声明通过不能替代这一步。记录桌面/FUSE或运行依赖的真实失败。 | NOT_TESTED |
| TokenTracker-Community-linux-x86_64.deb | 在支持 deb 的桌面发行版安装这一个固定包；确认 package `token-tracker-community`、1.2.0、amd64、独立 executable/desktop 与 `%u` 协议入口；核对实际 installed runtime。 | NOT_TESTED |
| TokenTracker-Community-linux-x86_64.rpm | 在支持 rpm 的桌面发行版安装这一个固定包；确认 package `token-tracker-community`、1.2.0、x86_64、独立 executable/desktop 与 `%u` 协议入口；核对实际 installed runtime。不得用 deb 结果代替。 | NOT_TESTED |

每种 Linux 格式各执行：保存官方与 Community 安装/数据/配置 baseline → 启动实际包并检查 tray/Dashboard/local service → 读取已有本地用量/刷新 → 正常手动登录、保持云同步关闭、打开 Community 页 → 退出重启/会话与偏好/logout 门禁 → 在该格式上验证既有协议/OAuth 入口的实际回调 → 对照官方保护数据。没有应用内 Linux updater，不要求或宣称该能力；发布下载链接应指向自有仓库。格式冲突时分开安装或使用独立测试环境，不因一包通过填写其他两包 PASS。

全平台测试都不得上传本地用量、创建新云端样本、修改 Edge/schema/migration/credentials；只清理测试者明确产生的临时解压目录，保留原用户数据。没有对应桌面/硬件的项目保留 NOT_TESTED，三平台发布范围不缩减。

### 15.4 最终隔离对照与官方正常更新的例外

安装前快照未覆盖，checksum 仍为 `5501278b3e38bb152ca4bb3820fec1a3b677cedb0a5b6bc589de045a9f3b49ca`。最终 post 的范围、排序和算法与 pre 相同；下表直接记录实际结果，不把 runtime 变化写成 pre=post。

| 范围 | pre → final 文件数 | final scope SHA-256 | 与 pre 比较 |
|---|---:|---|---|
| 官方安装目录 | 1658 → 1709 | `fbafb4a63fa3f1a21d3ae05c8f1d5dfbc1b73770045eea2ac211f519704c5ff3` | 不同：官方自身升级至 1.1.10，68 个新增/变更文件，无删除 |
| 官方 native/WebView/cache/log | 1397 → 1399 | `e14ca440a19bfff675de94cf31523dc2d904125c651f088b22e4c061cddc6952` | 不同：更新包、native settings、日志和浏览器维护数据 |
| 官方 CLI 数据及缓存 runtime | 1095 → 1472 | `ca34fc9662ec043aabcdaae933b79ed7e1579756d439e3eb6c063596c7ab27a0` | 不同：app runtime 更新、采集追加、cursor/cache 状态；无文件删除 |
| Provider 配置/hooks 配置 | 4 → 4 | `debc94a9d55f917110ba424c5abd9e7619523aa953d8d298c30ea93b378deae5` | 完全相同 |
| Community CLI 数据 | 15 → 17 | `f85988bcd395987cff5fa2bb982cde8ce472bd8d7160d8e6e1431e18c11599b2` | 正常本地采集/偏好镜像与缓存变化；无文件删除 |
| Community native/WebView/cache/log | 851 → 880 | `3fc960193a426cfd48f67e6f641fff8e4d02d1f146a08624b1c0944c1d65dd55` | 原生启动、页面刷新、会话及浏览器维护变化 |

官方更新的直接本地证据（台北时间）：20:36:53 官方更新器记录 current=1.1.9、latest=1.1.10；20:37:32 下载 `TokenTracker-Setup-1.1.10.exe`；20:37:34 校验成功，并记录启动官方 silent installer、relaunch `TokenTracker.exe`；20:37:55 原官方进程记录 current=latest=1.1.10。最终官方 exe 版本为 1.1.10.0。读取日志时只提取事件、时间及版本，不输出原始日志、URL 或凭据。这个独立官方更新流程解释了安装目录/runtime 与 uninstall 注册的变化，不能算作 Community updater 下载升级通过，也不需要回滚或重新操作官方版。

官方 uninstall 的 24 个字段中只发现 DisplayVersion、EstimatedSize、InstallDate 三项变化：注册版本由 1.1.8 变为 1.1.10；该旧注册值不等于日志中原运行版本 1.1.9。独立安装身份、安装路径、publisher 等其余字段不变。官方协议 3 条记录的 pre=final SHA-256 为 `35784ae1b63d87977f6d67bbf9042de84d4ea4cbf98c9224559cc38145e8c8da`；官方启动项 pre=final 为 `f5c1aeb1f7b22df9de3a3108a910045d6245c37d7e2776c56956e3755d9266a5`。Community 协议恢复后 3 条记录与原正式安装版相同，SHA-256 为 `b61f51eb5950aa53a037ec88ebee7fd0cd03e6dccad2e0aababe06f23a63dba4`。

两边旧 Token 数据前缀均严格保留：官方 queue 原 741876 bytes SHA-256 为 `a96dd6c9a58eccabe19e9b730606803e9d664c7e85233552743a4e84cb8b7e5e`，final 前缀一致；Community queue 原 599868 bytes SHA-256 为 `7176f72c0798c3eb7bc1f68a7c0e49ce183ff1b7fc0253ff1c131db17802a6ab`，final 前缀一致。官方最终 queue 2427 行、1800 桶、total_tokens=`3962932363`；Community 最终 queue 1908 行、1801 桶、total_tokens=`4353645478`、云同步 false。总量增加来自正常现有工具采集，原记录未被改写或删除，不是人为云端样本。

隔离结论：Community 覆盖安装的即时全范围对照完全一致；本轮启动、portable 切换和清理均限定在 Community 路径，协议已恢复，Provider 配置/hooks 不变。全时段官方文件完全不变这一条件**不成立**，已单独保留官方自身更新/runtime 的差异。包括 `native-settings.json` 在内的官方维护文件只保存过完整 hash，没有字段级旧值，因此不宣称所有官方设置字段语义逐项不变。助手没有执行官方 installer、直接修改官方 registry/hooks 或调用官方后端；未尝试用覆盖安装恢复旧版本。最终云端只读计数仍为自有项目原 130 Token、Community 0/0/0。

### 15.5 本轮交付与剩余未验证项

| 项目 | 状态与证据边界 |
|---|---|
| 最终 CI Setup 同版本覆盖安装 | PASS；固定安装器 hash、Inno exit 0、944 个安装文件与 CI ZIP 全部字节一致 |
| 安装版原生 tray/Dashboard/本地服务、已有用量读取/刷新 | PASS；真实安装路径/内嵌 Node、HTTP 200、用户原生 UI 确认 |
| 现有会话、Community 页面、同步关闭及退出重启 | PASS；用户确认、preference API false；未重新收集登录凭据或重跑社区生命周期 |
| portable ZIP 解压启动及 GUI | PASS；独立进程路径、本地服务、用户确认；正式协议恢复及临时目录清理完成 |
| 安装即时保护及全时段差异对照 | 完成；即时保护 PASS，官方自身更新/runtime 例外如第 15.4 节，不伪造全时段一致 |
| 自有更新源与无正式 Release 时 UI | 固定包自有仓库指向已核对；手动 UI 检查失败；独立 releases/latest GET 404。本次原生请求 HTTP 状态未单独捕获 |
| 完整 updater 下载升级 | NOT_TESTED；同版本安装、官方自更新和 404 UI 均不替代此项 |
| macOS DMG / Linux AppImage、deb、rpm GUI/RUNTIME | NOT_TESTED；固定包简短人工清单见第 15.3 节，三平台发布范围保留 |

Windows 未签名、macOS ad-hoc 与 Developer ID/notarization 的区别、macOS notify 不稳定性以及两个既有 Dashboard 全球排行榜基线失败继续保留。本轮无产品改动，复用固定 source `0a143a05b975854365294201d9f690f6f70c0059` 已通过的普通 CI 与三平台 BUILD/PACKAGE 证据，没有重跑全量本地测试或重新打包。报告提交会形成新的文档 head；其普通 CI/实际 checkout 与 report-only RC gate 状态在 Draft PR #1 和交付回复另行记录，不能把打包 source 的绿色结果代替新 head。

本轮仅报告更新可 commit/push；原 Draft PR 保持 Draft。RC 产物、快照和安全状态证据留在忽略目录，临时 helpers 清理；敏感信息/path scan 和 git diff --check 通过后提交。main、云端资源、凭据与发布工作流保持本轮授权边界。正式发布仍 **BLOCKED**，交 review，不执行 merge、tag、Release 或发布资产上传。
