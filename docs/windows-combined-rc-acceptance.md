# Windows 组合 RC 实机验收

本报告记录固定组合包的原生验收，不替代先前的 CI、三平台打包或原 UI 验证。本轮收尾完成，结论为 **BLOCKED**：正常退出登录后跨进程自动恢复会话。另保留官方 CLI 动态数据及 Codex 配置差异的归因限制；其余结果分别列明，不用已通过项覆盖失败或证据缺口。

## 被测产物与来源

- 仓库 main：`f0ce7c43d549f3636771799cb99f41f7119182f5`。
- 包内版本：`1.2.0`；实际 ProductVersion：`1.2.0+d294c2e4dd9ef11b31eb34709c084d3e388a7bb0`。
- 固定 source / checkout SHA：`d294c2e4dd9ef11b31eb34709c084d3e388a7bb0`。
- [组合 RC run 37181882488](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37181882488)，[原 artifact 11295596917](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37181882488/artifacts/11295596917)。
- 使用此前下载回核的原件；本轮未重建、重新压缩、签名或重新生成 manifest。

| 实际被测文件 | 字节数 | SHA-256 |
|---|---:|---|
| TokenTracker-Community-Setup.exe | 80756362 | `dad9aab12cfa8c5a0a264ba2f8db82c1b5272ff42223f7a60ea9b24759841804` |
| TokenTracker-Community-win-x64.zip | 114909372 | `352ff6039ecf384917c15073fe50c9c22528cf9744c1e09df3bb7a63a215fa9d` |

新证据归属上述 d294 源码。原 [UI 报告及截图](community-leaderboard-ui-review.md) 保持原候选的证据范围，不能改标为本组合包截图。

## 备份、覆盖安装与隔离

覆盖安装前保存 Community CLI 数据、原生配置及原安装文件的独立恢复副本；副本位于被忽略的本机验收目录，限制为当前用户和 SYSTEM 访问。可能包含会话数据，不提交副本或文件内容。

| 恢复副本 | 文件数 | 与安装前原件逐字节一致 |
|---|---:|---|
| Community CLI 数据 | 17 | PASS |
| Community 原生配置与 WebView 数据 | 1078 | PASS |
| Community 原安装目录 | 947 | PASS |

恢复路径：先正常退出 Community，保留当前目录副本，再恢复对应 CLI / 原生配置目录；若需恢复旧程序，同时恢复原安装目录或使用保留的旧安装原件。不得恢复到官方版目录。当前安装正常，尚未执行恢复。

原 Setup 覆盖安装退出码 0。安装后、首次启动前：原 Community 数据和配置内容指纹完全一致；正式安装目录中的 944 个包文件与原便携 ZIP payload 逐文件匹配，0 个差异。

| 官方版受保护范围 | 文件数 | 安装前指纹 | 安装后首次启动前 |
|---|---:|---|---|
| 安装目录 | 1709 | `fbafb4a63fa3f1a21d3ae05c8f1d5dfbc1b73770045eea2ac211f519704c5ff3` | 完全一致 |
| 原生配置 / 数据 | 1399 | `e14ca440a19bfff675de94cf31523dc2d904125c651f088b22e4c061cddc6952` | 完全一致 |
| CLI 数据 | 1472 | `ca34fc9662ec043aabcdaae933b79ed7e1579756d439e3eb6c063596c7ab27a0` | 完全一致 |

Provider 配置和官方协议 / 安装注册表值在覆盖安装前后完全一致。验收结束后的独立最终比较见下节，不用安装后即时比较替代全程证据。

### 全程最终保护对照

正式安装版及便携版均正常退出后保存唯一最终快照（2026-10-05 01:12:48 台北时间），没有覆盖 pre 或安装后快照。

| 范围 | 最终比较 |
|---|---|
| 官方安装目录 | 1709 文件，完整指纹与 pre 相同 |
| 官方原生配置 / 数据 | 1399 文件，完整指纹与 pre 相同 |
| 官方协议 / 安装注册表 | 与 pre 相同 |
| 官方 CLI 数据 | 1472 → 1474 文件，完整指纹有变化，不计为全程完全一致 |
| Provider 配置 | 两份配置指纹相同；活动 Codex 配置指纹不同，未取得写入者证据 |

官方 CLI 差异仅涉及 `tracker/queue.jsonl`、`cursors.json`、`telemetry.heartbeat.json`，新增 `notify.signal` 和 `sync.throttle`。官方原始 queue 的全部 779499 字节前缀 SHA-256 仍为 `d831999dbca07313a406f74dd1ef5a65760a00fa5ce8919ce21427db9782896d`，与 pre 一致；最终快照增加 950 字节，历史没有被改写或清空。Community 退出后，官方 queue / cursor 仍继续更新，说明存在独立后台采集活动；该行为与现有通知采集相符，但未取得文件写入者审计，不能唯一归因或宣称全程官方 CLI 整库不变。

活动 Codex 配置最后写入时间为 2026-10-05 00:32:14 台北时间；此前安装后即时比较相同。本轮未执行修改该配置的操作，但仅凭这一点不能证明差异来源，也不能把整份配置或 hook 的最终一致性判为 PASS。不读取或输出配置中的凭据，不恢复旧配置来覆盖用户后续修改。该项作为证据缺口交 review，未认定为 Community 安装器改写配置。

Community 原 queue 的 686569 字节、project queue 的 90828 字节前缀均与 pre SHA-256 相同，新增内容是追加记录；既有历史保留。Community 游标、限额缓存、WebView 缓存、同步偏好时间及 relay 会话文件在正常采集 / 页面 / 登录状态操作后变化，未以整目录哈希一致作为通过标准。持久会话的实际问题单独列明。

## 安装版原生运行

实际运行 exe 来自 Community 正式安装目录，Node 来自该目录的 `EmbeddedServer`；没有使用 Vite、源码 runtime 或 JWT 注入。安装入口指向同一 exe，版本与固定源码一致。

用户确认托盘打开 Dashboard、原有账号会话可用、云同步关闭；正常退出后从同一安装入口重新启动仍可登录并保持关闭。原生页面观察到全站榜原测试用户 130 Token，社区入口及空态正常。

安装后本地安全摘要快照获得总量 `4578761912`（2026-10-04 16:37:30 台北时间），并确认同步偏好 `enabled=false`、已有账号可用。后续本地偏好只读接口仍为 HTTP 200 / enabled=false / account_available=true。用户持续使用 Codex，活跃本地桶允许产生新用量；不以整库总量不变作为保留历史的证明。安装前后严格内容比较证明覆盖安装本身没有改写原数据。

被忽略的安全观察器仅保存事件时间、方法、scheme / host / path，以及明确允许的榜单数字和导航参数；不保存认证 headers、原始敏感 URL、授权码、密码、JWT 或邀请码。Node 请求观察与 WebView 请求观察分别记录，不能以其中一条链路代替另一条。观察器准备阶段的 preload 路径和 debug port 冲突已纠正，属于仪器配置重试，没有修改产品包。

## 统一排行榜与加载体验

用户经正常 owner UI 创建两社区 `RC Combined A 20261004`、`RC Combined B 20261004`。只读云端确认 2 个社区、2 个 owner membership、0 个 transfer，原两位 Auth 用户及原 130 Token 保留。

| 已取得的组合包证据 | 结果 |
|---|---|
| 管理列表“查看排行榜”进入统一入口 | PASS，实际导航到 `/leaderboard?scope=community&community=...` |
| 多社区及周期切换 | 请求分别携带对应社区和周期，没有借用全站费用 / Provider 数据 |
| week / month / total | 用户确认 130 / 0 / 130；真实 Edge 响应为同值，rank=1、me.rank=1、member_count=1 |
| 日期范围 | week：2026-09-28 至 2026-10-04；month：2026-10-01 至 2026-10-31；total：1970-01-01 至 2026-10-04 |

用户反馈首次访问新榜单显示“正在读取社区”，加载过一次后无需相同等待。源码核对：缓存按会话、社区、周期、每页数量及 offset 隔离，TTL 15 秒；未访问组合没有结果可复用，显示通用加载文案。已观察新查询响应约 1.8–2.9 秒。这不是已加载缓存持续失效或重复渲染的证据。

可审查的最小后续改善范围：当前社区的其他周期按需预读，配合榜单专用加载提示；继续沿用私有会话隔离、HTTP no-store 和权限失效清理，不拿其他周期旧值充当新结果。本轮固定包保持不变，尚未实现或验证此改善。

### 本轮后台更新实测

原生窗口中已加载的社区管理列表手动刷新时，卡片、配额和表单保留，顶部仅显示小型“正在更新”。一次真实 GET 为 5250ms / HTTP 200。A 周榜手动刷新时保留 130 Token、rank / me #1 和表格；一次 GET 为 5264ms / HTTP 200，另一次为 3295ms / HTTP 200。过期缓存返回时也观察到原表格与数值保留、小型更新提示，两个请求分别刷新成员关系和榜单，没有把社区列表的响应混入榜单。

一次自动全站→社区切回发生于榜单上次响应约 25 秒后，超过 15 秒 TTL；新增成员关系 GET 和榜单 GET 各 1，耗时 1895ms 和 2150ms，内容保留。该次只能算过期后台刷新，不能用作 TTL 内无新增 GET 的证明。请求耗时是当次网络观测，不代表服务端变快。

用户截图另记录管理列表及新周期首次读取时的完整等待态。截图不能确定其是否为同 key 的 TTL 内返回。用户随后明确确认：同一 A 周榜刷新完成、5 秒内全站→社区切回，立即显示原榜单。早一段观察未完整捕获返回动作；本轮后续完整片段已补齐严格证据：台北时间 2026-10-05 00:11:41.119 更新结束、00:11:43.315 切全站、00:11:44.527 返回同一 A / week / 20，表格与 130 保留且没有更新状态，至 00:11:52.700 没有新增 Community GET。TTL 内短时切回：PASS。

用户确认 A / total / size=10 在 Ctrl+R 后保持；原生请求与导航记录同样保留上述 URL 参数，重新加载得到 HTTP 200 / 130。刷新会重建内存缓存并重新请求，不能将 Ctrl+R 判为零请求复用。该场景的页面恢复：PASS。

网络失败的定向验证：仅在原生 WebView 中阻断自有 Community GET（保持正常 Auth / 本地通道可用），真实榜单请求和成员关系请求分别失败于 3ms / 1ms。页面保留 130 Token、rank / me #1 和原表格，显示可理解的错误及“重试”，没有输出 SQL / 凭据。显式点榜单“重试”新增 1 个榜单 GET，再次失败；该间隔没有自动重复请求。解除阻断后正常刷新返回 HTTP 200。这里验证的是 Community 请求网络失败；此前整个 WebView 离线片段遭遇观察器 EBUSY，不能将其计为完整离线验收。

后一轮在线榜单刷新为 14324ms / HTTP 200，原内容持续保留。真实请求耗时存在明显波动；短时内容复用与服务端响应时间应分别评价。

用户认为 Alt+左 / 右不直观、不能用于选择月。该快捷键属于网页访问历史导航，不是周期切换；本轮不要求用户继续按快捷键，也不把“随机感”当作已定位产品缺陷。实际导航记录经过曾访问的不同周期、每页数量和全站 / 社区状态。只读核对固定源码：社区、周期、每页数量和页码控件均 push 历史，自动选择默认社区才 replace；全站 / 社区切换也 push。该行为解释了用户观感，并有既有路由 Back / Forward 测试支持；自动化路由测试不等同 Windows 快捷键实测。用户应通过周 / 月 / 全部控件选择周期。

保留现有全站榜差异：全站 period 更新使用 replace，页码是组件状态、每页数量保存在本地偏好；不能宣称全站每一次周期变更都可用历史逐项回退。本轮不修改这一继承行为。社区刷新恢复已通过；原生历史有手动往返证据，但没有重新构造完整逐步历史断言，不额外计为严格逐步快捷键 PASS。

用户操作期间另出现两次真实浏览器请求失败（total 3501ms、week 1128ms），榜单保留并显示错误。随后 month / total 请求分别 HTTP 200，最新 A 周榜刷新也为 HTTP 200。没有取得平台错误原因，不能归因于历史快捷键或宣称修复了后端故障。

用户确认正常退出登录后显示社区登录提示、没有旧榜单。实际原生导航记录为 `/communities`，无表格，显示“登录后查看社区”；当次 logout 私有内容 UI 清理：PASS。安全请求记录同时保留本地 `/api/auth/logout` 两次 HTTP 403，前端门禁通过不等于退出登录持久性通过；跨进程恢复缺陷见下节。

### 新发现：退出登录后跨进程恢复会话（BLOCKED）

复现步骤为正式安装版正常退出登录 → Community 页面显示登录提示 → 托盘正常退出 → 从固定 ZIP 启动便携版。便携版设置截图显示同一 User A 已登录、云同步关闭，用户明确确认没有手动重新登录；排行榜和社区页也可正常打开。该问题不是仅凭 `account_available=true` 推测。

本地 `/api/auth/logout` 两次响应为 HTTP 403（台北时间 2026-10-05 00:30:53.899、00:30:56.141）。便携版安全 Node 观察随后记录 `/api/auth/refresh`；没有保存请求 body、认证 headers、Cookie 或凭据。403 的具体错误码及平台拒绝原因没有取得，不归因于 CSRF。

固定源码与 main 的 Auth / 本地代理实现相同：SDK 1.4.5 的 `signOut()` 吞掉 logout 请求异常后清除当前实例内存会话并返回 `{error:null}`；`InsforgeAuthContext` 随后清前端用户状态，因此出现登录门禁。本地 `src/lib/local-api.js` 仅在 logout 返回 2xx 时清除持久 relay cookies，403 的 Set-Cookie 不会改写 relay map；新进程启动 hydrate / refresh 可以再次使用保留的 relay 会话来源。该链路与本轮实际自动恢复相符，Native OAuth callback bridge 不属于这条恢复路径。

影响：当前窗口退出后私有内容虽清除，但退出登录意图未可靠跨进程生效。云同步仍为关闭，不能据此声称完整登出通过；不涉及本轮 Token 重复计数或社区权限被绕过。

最小后续修复建议：在本地 Auth proxy 对明确 logout 意图清除 relay 内存与持久文件，并保留原响应状态；不要扩大为所有 Auth 4xx 清空会话。定向回归覆盖 logout 403 清理 / 403 原样返回、logout 2xx 清理、其他 Auth 403 仍保留既有 relay 语义，之后复验正常 logout → 退出 → 新进程仍显示登录门禁。本轮只定位和记录，未修改产品代码、SDK 或当前产物。

## 云端终态

开始和暂停后恢复的只读基线均为：Auth 用户 2，hourly 1 行，total_tokens=`130`，hourly 行内容指纹 `dad542fc78704f5f54220ca7e30850f3`，Community 三表 0 / 0 / 0。创建临时社区后前述 Foundation 内容指纹不变。

用户经正常 owner UI 删除本轮两个社区；只读验收（2026-10-05 00:34:55 台北时间）为 Community 三表 0 / 0 / 0、Auth 两用户、hourly 一行、total_tokens=`130`，hourly 内容指纹与 baseline 完全一致。没有删除 Auth 用户或原 Token 数据。

所有应用正常退出后的再次只读确认（2026-10-05 01:13:38 台北时间，HTTP 200）：上述两用户、1 行 hourly、`130`、同一行内容指纹及 Community 三表 0 / 0 / 0 全部保留。安装版、便携版及恢复正式入口三段 Node 观察分别为 588 / 27 / 15 个安全请求事件，三段 ingest 均为 0，也没有其他 InsForge 项目请求；观察范围内没有用量上传。既有 WebView 观察作为独立页面请求证据保留，未以 Node 事件数量代替全部浏览器请求数量。

### 便携版定向检查

安装版已正常退出后启动原 ZIP 解压内容，实际 exe 与子 Node 路径均位于该便携 payload，ProductVersion 为 `1.2.0+d294c2e4dd9ef11b31eb34709c084d3e388a7bb0`。原 Setup / ZIP SHA-256 再核对仍与表中一致；没有重新构建或替换产物。Community 协议此时按包内既有行为指向便携 exe，属于测试期间状态。

便携本地偏好只读接口 HTTP 200 / enabled=false；用户截图同样确认同步关闭。用户确认排行榜及社区页可打开并正常退出；启动、窗口、代表性页面和退出 smoke 为 PASS，退出登录持久性为前述 BLOCKED，不能混为整体 PASS。

便携版正常退出后，从正式安装入口启动固定安装内容。实际 exe / Node 均来自正式安装目录，开始菜单目标、Community 协议处理器已恢复到正式安装 exe，ProductVersion 仍为固定 d294 源码。该恢复只使用包内原有注册行为，没有改写源码或重建包。

恢复后的本地只读偏好仍为 HTTP 200 / enabled=false。用户再次正常退出正式安装版；进程退出后完成前述最终指纹对照。临时便携解压目录于 2026-10-05 01:21:40 台北时间清理，开始菜单与 Community 协议均指向正式安装版；原 Setup、原 ZIP、manifest / sums、不可覆盖的快照及受保护恢复副本保留。首次清理遇到观察器占用 DLL，释放本轮 JavaScript 观察器后重试成功，没有终止其他用户进程。

## 包内 runtime 的隔离扫描场景

使用固定 ZIP 中真实 Node 和 runtime，8 个关键文件的 Git blob 及 SHA-256 与 d294 源码逐项一致。隔离 HOME / 数据目录、清空继承环境、关闭云同步，不提供 device token 或 Provider 凭据；所有 fixture 未进入生产数据。

- Codex 新增 / 重叠根实际只统计 19 Token；重复同步仍为 19。移除额外根后，该根新写入的 11 Token 未被收集，剩余范围继续刷新并保留 19。
- Claude 首轮 24 Token；保留根失联时 queue 内容签名和 24 Token 不变，出现 deferred repair。恢复后两个 cursor 存在、repair 完成，计数为 34。
- 包内 CLI 直接启动 `--version` 为 v1.2.0、退出码 0。
- 峰值 4 个 fixture JSONL，网络 guard 拦截 1 次 fetch，实际允许外连 0；fixture 已清理。真实 WSL 未执行。

必须保留的 harness 限制：原自动 helper 为 **FAIL，8 PASS / 4 FAIL**，原证据未覆盖。1 项嵌套 CLI spawn 在此环境返回 EPERM；3 项 Claude cursor 断言查找旧 `cursors.json`，但该 harness 同时启用 v2 store。

随后只修正临时 harness：使用包内真实 v2 cursor summary，三项断言分别确认新增根 24 Token / cursor、失联时 queue 历史及 inode / offset 保留且 repair deferred、恢复后 34 Token / 两个 cursor / repair 完成。另直接执行固定包的 `node.exe bin/tracker.js sync --auto --from-notify --source codex`，退出码 0，实际得到预期 19 Token。四项定向验证 PASS；产品代码未改。

corrected Claude helper 的整体结果仍记录 **FAIL**：严格“零 fetch 调用”断言遇到 1 次 guard 拦截的内置匿名 daily heartbeat（`telemetry.js:135`），不属于 ingest，静态 payload 字段为 machine_hash / app_version / platform / shell，不含 fixture Token。CLI 运行也记录同类拦截。两次运行实际允许外连均为 0、fixture 上传为 0；没有删除此断言或把整体 FAIL 改写成 PASS。隔离根和 fixture 均已清理，安全结果及原失败结果保留在本机验收证据中。

真实 WSL：NOT_TESTED。本机只读 WSL 环境探测未在限定时间内完成，未将 fixture/mock 结果计为真实 WSL 通过。

## 发行限制与停止边界

本次同版本覆盖安装不等于完整更高版本 updater 下载升级。Windows 未签名、macOS ad-hoc 不等同 Developer ID / notarization、macOS/Linux GUI/RUNTIME NOT_TESTED、完整下载升级 NOT_TESTED，以及既有 Dashboard 基线失败继续保留。先前 CI / RC / 下载回核有效，本轮不重复运行。

本轮未修改产品、版本、公开预览资产、云端配置、数据库对象或 Edge；没有创建 tag / Release，没有重建包或重跑已验 CI / 全量回归。

## 收尾结论

| 项目 | 状态 |
|---|---|
| 固定原包哈希与正式覆盖安装 | PASS |
| 安装版 / 便携版启动、代表性页面及正常退出 | PASS |
| 全站 / 社区、多社区、周期、每页数量及刷新恢复 | 已取得前述实机证据；严格逐步原生历史快捷键验收不计 PASS |
| TTL 内复用、保留内容后台刷新、请求失败 / 显式重试 | PASS，范围限前述定向场景 |
| 正常退出登录后当前窗口私有内容清除 | PASS |
| 正常退出登录后跨进程保持未登录 | **BLOCKED，真实自动恢复已复现** |
| 云同步关闭、原云端 130 与空社区终态 | PASS |
| 官方安装 / 原生数据 / 协议保护 | PASS；官方 CLI 动态文件及活动 Codex 配置全程差异归因未闭合 |
| 包内 runtime 隔离扫描场景 | 四项纠正 harness 后的定向证据 PASS；保留原 / corrected helper 整体 FAIL，不伪报整体绿色 |
| 真实 WSL、完整离线、macOS/Linux GUI、完整更高版本更新链 | NOT_TESTED |
| 正式入口恢复及临时便携目录清理 | PASS |

下一步 review 应先处理 logout 持久性最小修复范围，并判断配置差异证据缺口的处理要求。未授权实施修复或重新出包；不把本轮固定产物结论标为整体 PASS。

本轮仅新增本报告，未 commit / push。收尾敏感信息 / 本机路径扫描 0 命中；`git diff --check` 通过，未跟踪文档的独立 whitespace 检查无错误（Git 提示后续 LF → CRLF 转换，新增文件比较退出码 1 不表示 whitespace 失败）。这些检查不替代凭据或产品运行验收。

## 退出登录持久性修复：源码与候选验证

以上为 d294 固定包的历史实机证据及当时结论，原 FAIL / BLOCKED 不覆盖。本节记录 review 随后授权的窄范围修复；新候选的安装版登出重启、安装版登出后便携版启动及重新登录实测仍等待下一轮 review，不借用旧包宣称修复包原生 PASS。

### 修复范围与正式回归

基于 main `f0ce7c43d549f3636771799cb99f41f7119182f5` 创建 `codex/fix-native-logout-persistence`。产品改动仅 `src/lib/local-api.js`：合法本地来源的明确 POST `/api/auth/logout` 在任何异步等待前建立退出边界，清除 relay 内存、磁盘文件及本地 token / in-flight 缓存。即使 map 已空也尝试删除文件；ENOENT 表示无需删除，其他 I/O 失败通过安全错误码及 `X-TokenTracker-Local-Logout: failed` 可检测。

上游 logout 403 的状态与响应原样保留，不宣称云端会话撤销成功；本地清理成功另以 `cleared` 标识。若上游 2xx 但本地持久清理失败，返回 502 / `LOCAL_LOGOUT_PERSISTENCE_FAILED`。GET logout、其他 Auth 403、正常刷新及 OAuth 维持原语义。正常新登录仍可持久化，云同步关闭偏好不被修改。

Auth proxy、账号聚合读取和本地同步 device-token 签发分别捕获退出代次。旧代响应不能写回 relay、交付旧账号数据或把迟到 token 交给同步子进程；旧 Auth 响应返回 409 / `AUTH_SESSION_SUPERSEDED`，不转发旧 cookie / token。退出意图的来源校验沿用既有 loopback-origin 规则，外站浏览器请求不能触发本地退出。

新增正式 `test/local-auth-logout-boundary.test.js`，覆盖 403 / 2xx / 空 map 清理、迟到 refresh、其他 Auth 403、合法新登录、清理失败、同目录新 handler 与实际新 Node 进程、account-view 与两段 device-token 迟到路径。所有凭据为合成 fixture，HOME / data 隔离，无真实账号或云端请求。Windows CI 显式执行本回归和既有 cookie-relay 回归；Linux / macOS 的现有 root suite 同样发现本文件。

| 验证 | 结果与范围 |
|---|---|
| 旧源码 RED | 在独立归档的 f0 源码运行同一最终 13 项：1 PASS / 12 FAIL / 0 skip；保留普通 Auth 403 的原语义用例通过，其余缺陷被检出 |
| 修复 Node 回归 | logout / relay / account-view / security / background / sync-pref 共 81/81 PASS，0 skip |
| Dashboard 受影响回归 | 偏好、OAuth 中继、Context / Auth、native bridge、上传门禁 8 文件 / 41 项 PASS |
| Dashboard typecheck | PASS |
| Dashboard build | 自有公开 client-config guard 通过，文件锁解除后的同配置定向重试 PASS；保留 SDK crypto / chunk 大小等既有 warning |
| 版本 | 所有托管版本保持 1.2.0，未改版本或依赖 |

执行记录另保留两个 harness / 环境失败：旧源码首次启动受沙箱 spawn EPERM 限制，不计为 RED；扩大回归首次外层 data-root 覆盖与既有 withHome fixture 冲突，67 PASS / 14 FAIL，不计为产品回归结果。移除冲突覆盖、仅隔离 HOME / USERPROFILE 后 81/81 通过，未改断言。首次本地 Dashboard build 缺少自有配置被 guard 拒绝，随后使用已验包内公开 client-config 在内存校验并传入；其构建遇到 dist 文件 EBUSY，单独记录，未为绕过 guard 修改配置或源码。

### 配置差异的只读复核

可信 pre 与 post-install 快照的活动 Codex 配置 SHA-256 均为 `0529a1cac9f7567419d9bfb2519b5881b61d57c8dd2b59fb3639faee2079ff30`；最终快照与当前文件均为 `c4a7c193e78daad2e5d4749d172a6f61840cebf0e53a1f23e91507d6ad5663ec`。安装前后即时配置一致，随后到 final 存在整文件变化。另两份 Provider 配置 pre / final 指纹一致。

快照仅保留哈希，没有可信 TOML 原件；在本机证据目录及相关配置目录核对 102 个候选文件后，未找到匹配 pre 的原件。因此**变更键名、普通设置 / hook / notify 分类及 hook 内容是否变化仍无法可靠核对，NOT_TESTED / 未归因**。不能从哈希反推键值，也没有写入者审计。其他旧包的隔离记录未包含同一目标配置哈希，不能替代本轮证据。

固定 Community 包含隔离 guard；源码检查未发现 Windows 宿主 / 安装器直接读取该配置的路径。函数存在既不是启动时改写的证据，也不是不存在其他写入者的证明。本轮未恢复或修改配置，没有输出任何配置值或凭据。

### 扫描验收工具定向收口

复用 d294 原 ZIP（SHA-256 `352ff6039ecf384917c15073fe50c9c22528cf9744c1e09df3bb7a63a215fa9d`）及包内 Node，仅重跑失败相关 Claude / CLI 场景。清空子进程继承环境后显式传入 `TOKENTRACKER_NO_TELEMETRY=1`，子进程确认值为 1 且包内 opt-out 生效；没有修改产品 telemetry。

Claude 新增根 24、失联时历史 / inode / offset 保留与 deferred repair、恢复后 34 / 两 cursor / repair 完成三项通过；包含原零网络和同步完成断言的 helper 共 5/5 PASS。包内 CLI 对隔离 Codex fixture 读入 19 Token，连同子进程 opt-out 与零网络断言共 3/3 PASS。合计 8 PASS；fetch / HTTP / socket 等 guard 计数与实际允许外连均为 0。fixture 与解压 runtime 已清理。

原 8 PASS / 4 FAIL、先前 corrected helper 的 telemetry guard FAIL 均保留；本次首轮 harness 隔离目录路径错误也保留为独立失败尝试。未放宽断言，未将旧结果改写为绿色。真实 WSL 仍 NOT_TESTED；此次旧包扫描结果不代表新 logout 候选已完成原生安装验收。

### 提交、CI 与新 RC

本修复已完成独立分支 commit / push、Draft PR、普通 CI 与新源码 build-only RC，并下载原始交付物回核。未安装新候选、未合并、未操作公开预览资产或云端。原 130 Token / Auth 两用户 / 空 Community 三表使用前节已验基线；本轮无业务写入，也不把既有只读结果冒充新查询。

- 修复源码 / RC source：`6321b24e0c46699db2695995491fea5bae97b359`（`fix: persist native logout across restarts`）。
- [Draft PR #5](https://github.com/baozibao728-cmd/TokenTracker-Community/pull/5)，base 为固定 f0；保持 Draft，不执行合并。
- [源码普通 CI 37225559795](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559795)：4/4 PASS。四 job 实际 checkout 均为 PR 测试合并 SHA `e414f6fd246551af6ae10c1b640d8430ad8dc426`，与打包源码 SHA 分开记录；Windows 新增 Node logout / relay、.NET 8 日志 / updater / identity 检查均实际成功。
- [新 RC 37225559792](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559792)：candidate、Windows、macOS、Linux、delivery 全部 PASS。五 job 的实际 checkout 和候选校验均为完整 `6321b24e0c46699db2695995491fea5bae97b359`，无打包失败或重跑。
- Windows 实际 ZIP / Setup payload 完整且逐文件一致；macOS 挂载 DMG 检查 runtime、独立 identity 与 ad-hoc 签名；Linux 分别解包 AppImage / deb / rpm 核对 runtime、独立包身份与协议。以上为 runner 的 BUILD/PACKAGE 检查，不能替代 GUI / 本机登出验收。
- 新 [delivery artifact 11311863214](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559792/artifacts/11311863214)，499127642 字节；下载后外层 ZIP 摘要与 Actions 的 `2ede3a978c2a06e61e2d3a9c82c3d050141977fb271cd4b5ceee2c7a2629d30a` 一致。包内六包的实际字节数、SHA-256、SHA256SUMS 与 manifest 全部回核 PASS，不把外层摘要当安装包摘要。交付版本为 1.2.0，source / checkout 均为上述修复源码。

只修改本地 Auth 代理、正式回归、Windows CI 覆盖及本报告四文件。Backend、migration、Edge、Dashboard 产品逻辑、Parser / Cost Engine / Provider、版本与公开资产均未改动。普通 CI 与 build-only active，其他 10 个继承 / 发布 workflow 保持 disabled_manually。

| 新候选原文件 | 字节数 | SHA-256 |
|---|---:|---|
| TokenTracker-Community-Setup.exe | 80754105 | `e2996f510dfc6c8d4fee9bd57f5b24d2e68a55d40de2a264b4ddbdb056b1958b` |
| TokenTracker-Community-win-x64.zip | 114910002 | `576e5d72f69c2d031bc2f59c6b91b35784fa2661cc9d5be10622f3bffd502703` |
| TokenTrackerCommunity.dmg | 61953630 | `c0d73971b7f4a640b2a052b59c52514b9e34e85e7db8547c95d10f1beaf7eb4e` |
| TokenTracker-Community-linux-x86_64.AppImage | 127502840 | `dcac2b0898266a7a74fd24bb1b0c756c2ca3dbf57165cbdca2c669f9eee3aa89` |
| TokenTracker-Community-linux-x86_64.deb | 57011188 | `f0b72ac0fb0ccebcf2fbfbb2fe1e93c962df90b37c0f4028148a8a49346942c6` |
| TokenTracker-Community-linux-x86_64.rpm | 56992428 | `9c6e5c847b6cae2e052df87aabf257e279da90d2baaf22363eff951d093c0205` |
| SHA256SUMS | 615 | `04c74fed3cc2453c60b8edb9a9e288000fb6a91573883aec9cac522dfb4392ee` |
| RC_MANIFEST.json | 1598 | `29e42ff60c9a9ef3c9e2808f7aaeba8387fb491b0d464aaf3c5ae8120c7d348f` |

下载后的 Windows ZIP 仅解压到本轮临时目录，没有运行安装器或桌面 exe。实际 EmbeddedServer Node v22.22.2、自有 client-config、独立 updater 指向及必需 runtime 内容再次检查 PASS。包内 `src/lib/local-api.js` 与固定提交仅有 checkout CRLF / Git LF 行尾差异，归一行尾后完全一致；包内文件 SHA-256 为 `aa40bcfd118bfaa194ae6506234e9824ff9fbe02c6858edb2e9708ded6a1423c`。在真实包内 Node 上运行同一组 13 项正式合成回归：13/13 PASS、0 skip，包含新进程在相同隔离数据目录无法恢复已登出会话。该检查不等于原生 GUI / 安装版→便携版验收。

源码候选独立审查无 P1/P2 发现；本地敏感信息 / 路径扫描及 `git diff --check` 通过。临时归档源码、测试 fixture 及新包临时解压目录清理，原失败证据、下载的八个交付原件及安全摘要保留。随后纯文档收尾只更新本报告，不改变源码 / RC；最终报告 HEAD 和其后普通 CI 结果在 PR 与交付摘要记录，不为追记文档自身 SHA 循环追加提交。

### 本次 review 停止点

修复源码、正式 RED/GREEN、普通 CI、三平台 BUILD/PACKAGE 及下载回核 **PASS，交 review**。原 d294 包的退出登录持久性 FAIL / 整体 BLOCKED 保留。新 Windows 包的安装版登出→同 exe 重启、安装版登出→便携版启动、正常重新登录且云同步持续关闭仍 **NOT_TESTED，等待审核后定向实机验收**。配置变更键名 / hook / notify 与写入者归因缺口仍未闭合，不推测也不恢复旧配置。macOS/Linux GUI、真实 WSL、完整更高版本更新链及既有 Dashboard 两个基线失败继续保留，不开始加载预读或其他功能。

## Windows 登出持久性定向实机验收（2026-10-05）

前节 NOT_TESTED 是源码 / 候选 review 时的状态。本节单独记录 review 授权后的新包实机证据，不覆盖 d294 旧包的真实自动恢复 FAIL，也不将旧截图或旧包验收改标为新源码。

### 固定候选与安装保护

- 审核 HEAD：`fdb803b21e8f480805290597e8f05e3e5455985e`。
- 实际安装版 / 便携版源码与 manifest source：`6321b24e0c46699db2695995491fea5bae97b359`，包内版本 1.2.0；原 [artifact 11311863214](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37225559792/artifacts/11311863214)。本轮未重新构建、签名、压缩或修改原件。
- Setup 原件：80754105 字节，SHA-256 `e2996f510dfc6c8d4fee9bd57f5b24d2e68a55d40de2a264b4ddbdb056b1958b`。
- ZIP 原件：114910002 字节，SHA-256 `576e5d72f69c2d031bc2f59c6b91b35784fa2661cc9d5be10622f3bffd502703`。安装前实际回核与 manifest / SHA256SUMS 一致。
- 覆盖安装前分别备份 Community CLI 数据 / 配置 17 文件、原生数据 1178 文件、安装内容 947 文件，逐文件摘要一致。备份与恢复说明仅保留在受限本机目录；含会话的备份不提交或上传。正常验收没有恢复旧 relay 或 WebView 会话。
- 原 Setup 覆盖安装 exit 0；安装后与原 ZIP 的 944 个 payload 文件逐文件比较，差异 0。实际 exe ProductVersion 为 `1.2.0+6321b24e0c46699db2695995491fea5bae97b359`，SHA-256 `8421a7022e5ab626c63cc2419cee6c620d953514f0cf033195b3de9aa1d3f791`。
- 每个场景分别核对真实运行的 exe 与其子 Node：安装版来自正式 Community 安装目录，Node 来自同目录 `EmbeddedServer/node.exe`；便携版二者均来自本轮 ZIP 临时解压目录。没有用开发服务或子进程回归替代 WebView 实测。

### 三个场景分别记录

| 场景 | 原生 UI 与持久状态证据 | 结果 |
|---|---|---|
| 安装版登出 → 同 exe 重启 | 用户正常退出登录、刷新页面并确认社区登录门禁；relay 文件由存在变为不存在。托盘正常退出后进程为 0；从同一正式安装 exe 重启，relay 仍不存在，Auth refresh 实际 401，用户确认仍未登录、社区提示正常 | PASS |
| 安装版登出 → 便携版启动 | 用户在正式安装版正常重新登录，确认同步关闭；再次登出、刷新门禁并从托盘退出。守卫确认安装版进程为 0 后启动原 ZIP；相同 Community 数据目录中 relay 不存在，refresh 实际 401，用户确认便携版没有自动恢复账号、登录提示正常 | PASS |
| 合法新登录 → 正式安装版重启 | 便携版正常退出后恢复正式安装版。用户通过现有原生入口正常新登录，同步仍关闭；合法 OAuth exchange / refresh 实际 200，relay 重新持久化。用户只退出应用而不登出，同 exe 重启后的平台 refresh 200、Community detail 200，用户确认仍登录、社区正常、同步关闭，并再次从托盘正常退出 | PASS |

2026-10-05 台北时间 12:18 的首次正常 POST `/api/auth/logout` 实际返回 **403**；WebView 观察到 `X-TokenTracker-Local-Logout: cleared`，磁盘 relay 在响应完成前已删除。第二轮观察到相继的 POST logout **403 / cleared** 与 **200 / cleared**，均按实际记录，不推测重复请求的来源。403 的云端状态未伪装为成功；本地退出边界生效与云端会话撤销是两个独立结论。

登出后同 exe / 便携版的 refresh 401、新登录的正常 exchange / refresh 200，与用户在 Settings / Community 页的确认共同作为证据。公共榜单出现用户名称不能证明当前登录，也没有以公共数据替代私有登录门禁检查。所有手动登录仅经现有原生页面；观察记录、报告与 Git 不含密码、Cookie、JWT、授权码、认证 headers 或原始回调 URL。

最后重启的 refresh 200 由该次正式安装版的本地 Node 请求观察器捕获，Community detail 200 与登录后的空社区状态由真实 WebView 观察器捕获。WebView 观察器连接前的 refresh 未被该观察器捕获，不宣称两者都记录了此请求。收尾摘要首次只查 WebView refresh，因该证据来源遗漏返回 FINAL_EVIDENCE_INCOMPLETE；核对同次启动的 Node 安全事件后补齐来源，未重跑登录、改变产品或放宽业务判断。

### 工具失败与配置限制

本轮第一次启动的临时观察器预加载路径使用反斜杠，被 Node 参数解析成不存在的路径，导致 observer MODULE_NOT_FOUND；另有一次 phase helper 的 PowerShell 参数集错误。修正仅在忽略的本机观察工具中，未改包内产品字节。故障启动不计入有效候选验收，后续同一原包正常启动完成观察。

一次用户初报退出时安装版进程尚在，守卫阻止便携版启动；再次通过托盘退出、确认进程为 0 后才继续，未强制结束其他程序。便携版退出后的目录清理首次遇到 DLL 锁，确认目录范围及便携进程为 0 后短暂等待再清理成功；未取得锁持有者证据，不归因为产品缺陷。

官方 exe、Claude settings、home Codex config 与本轮 pre 指纹相同，官方协议未改变。活动 Codex config 的整文件哈希发生变化，但缺少写入者证据及对应可信 pre 原件，键名 / hook / notify 分类仍 **NOT_TESTED / 未归因**。不能以 Community 隔离 guard 存在替代写入者证明；本轮未恢复或改写这些配置。前节配置归因缺口继续保留，不宣称全部配置严格不变。

### 本轮收尾状态

用户完成最后重启确认并正常退出，进程为 0，合法新 relay 保留、云同步仍关闭。正式开始菜单入口及 Community OAuth 协议均指向正式安装目录；临时便携目录已清理，原 Setup / ZIP、恢复备份与安全证据保留在受限本机目录。观察器已停止，本轮临时 helpers 已清理；没有将它们、备份或原安装包加入 Git。

只读云端 pre（2026-10-05 11:57 台北时间）与 post（14:24）严格比较：Auth 用户数 2、hourly 行数 1、`total_tokens="130"`、Community 三表 0/0/0 全部相同；hourly 全行内容指纹均为 `dad542fc78704f5f54220ca7e30850f3`。补充只读身份检查确认仍只有既有 User A / B，无新增用户。Node 与 WebView 安全观察器的 ingest 请求均为 0；偏好状态观察覆盖全部三个场景，记录的 6 次状态变化均为同步关闭。没有构造或上传 Token 样本，没有修改云端资源。

**新候选 Windows 登出持久性定向实机验收：PASS。** 三个场景分别取得用户原生确认及本地 / HTTP 证据；原 d294 失败记录与配置归因限制保留。本轮只补新候选 Windows 登出持久性证据，不重跑 Community 生命周期、扫描、已有 CI / RC 或全量测试。产品源码及安装包仍对应固定 `6321b24e0c46699db2695995491fea5bae97b359`；后续纯文档 HEAD 单独记录于 PR，不改写包 manifest 来源。收尾仅提交本报告并更新 Draft PR #5，继续等待 review，不执行合并。

Windows 未签名、macOS ad-hoc / GUI 未验、Linux GUI 未验、真实 WSL、完整更高版本 updater 下载升级，以及既有 Dashboard 两个基线失败继续保留。同版本覆盖安装不能计为完整升级链 PASS；本轮不 merge、发布、改版本、创建 tag / Release 或修改云端资源。
