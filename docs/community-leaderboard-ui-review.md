# Community 统一排行榜 UI Review

前面各节保留原 UI 验收记录；本轮 401 修复与已合入扫描目录的组合源码验证在最后一节单独记录，不能将原截图或原生运行证据误作组合包的安装验收。

## 实现与边界

`/leaderboard` 保留全站布局，在标题旁提供全站榜 / 社区榜切换。社区模式通过 query 保存社区、周期、页码与每页数量，例如 `/leaderboard?scope=community&community=<community-id>&period=week&page=1&size=50`；切换社区、周期或每页数量重置页码，刷新及历史导航恢复 URL 对应状态。

已加入社区选择器包含自己拥有的社区，并通过现有分页 API 读取完整成员关系。社区榜只有排名、用户、Token 三列，rank、me、成员数及 Token 均采用 Community Edge 响应，不自行重排，不借用全站费用 / Provider 数据。复用既有头像、我的排名、Token 格式及表格视觉基础；社区榜由一个 `CommunityLeaderboard` 组件呈现。全站榜保留自身展示实现。

`/communities` 和 `/communities/:id` 继续负责创建、加入、成员、邀请码、转让、退出和删除。卡片、管理详情及创建 / 加入成功状态提供直达榜单入口；管理详情不再维护另一份社区榜单。全站统计改用“全站 Token”等明确文案。配额仍来自后端，owner 操作仍由 Edge 实时鉴权。

本次只修改 Dashboard 前端、定向测试、文案、普通 CI 覆盖与本报告。数据库、migration、Edge、API 契约、权限、配额、排名算法、Parser、Cost Engine、Provider integrations、原生客户端及已发布预览资产均未修改。

## 查询与会话

- 会话内内存缓存 TTL 为 15 秒，按 user ID / session epoch / 社区 / 周期 / 分页隔离，同 key 并发 GET 去重。没有持久保存私有社区数据，HTTP `no-store` 保留。
- 首次加载显示等待状态；后台更新保留数据并使用固定高度的小提示，避免刷新时移动按钮。手动刷新绕过 TTL；离线保留数据并展示错误和重试入口。
- 登出、切号和重新登录清除旧会话缓存；generation 校验防止旧响应回填。GET 或 POST 401 清除整个当前会话的私有缓存；社区 403 / 不可用 404 清除相关社区查询。其他社区数据不会被借用展示。
- 成功创建、加入、退出、删除、转让后失效当前会话查询。POST 不自动重试，同一身份重复操作去重；旧身份未结束的 POST 不阻挡新身份操作，其结果也不回填新身份。
- 新社区尚未进入刷新中的成员关系列表时显示加载，不短暂宣称该社区不可用。

## Windows 原生联调证据

使用既有 Windows WebView2 原生宿主、当前构建的 Dashboard、自有 InsForge 和既有用户 A 的正常会话；没有 Vite mock、JWT 注入或管理员冒充用户。正式安装包未替换、未重新发布。以下是本轮实际原生操作：

| 场景 | 实际结果 |
|---|---|
| 全站 / 社区切换 | 两种模式正常；全站保持既有列，社区仅排名 / 用户 / Token |
| 临时社区 | A 创建 `UI Review A`、`UI Review B`；卡片 / 管理详情 / 创建成功入口直达榜单 |
| 多社区选择 | 同一用户 A 在两社区间切换，标题与 URL 中社区 ID 对应 |
| 周 / 月 / 总计 | 测试数据分别显示 130 / 0 / 130；rank 1、me 1、成员数 1，与真实 Edge 结果一致 |
| 直接链接与刷新 | 管理详情进入榜单；选择每页 50 后刷新保留社区、周期及 size=50 |
| 前进 / 后退 | 恢复 B / A 对应的 URL、标题和榜单，没有显示另一社区数据 |
| 空成员关系 | 无社区时显示创建 / 加入入口；清理后列表计数恢复 0 / 0 |
| 后台刷新 | 已有卡片、表单及配额保留，小型更新提示可见 |
| 离线与恢复 | DevTools 切 Offline 后真实 GET 失败，卡片保留、显示可理解的网络错误与重试入口；恢复网络后 focus 请求恢复。原生显式点击重试未另行复现，组件测试覆盖该操作 |

截图（本轮原生联调，早于最后的会话边界补修）：

- [全站榜](validation/community-leaderboard-ui/global-native.png)
- [社区榜](validation/community-leaderboard-ui/community-native.png)

截图角落的其他应用通知不是产品界面。没有记录邀请码、认证 headers、Token 凭据或敏感网络响应。最后的提示固定高度、新社区刷新空态和 POST 会话边界补修通过正式回归与最终构建验证，未为此再次制造社区业务数据。

## 请求次数和加载表现对照

这是单次原生 Network 观察，不是服务端性能基准；耗时不代表云端变快。GET 和 CORS OPTIONS 分开统计，不包含其他本地页面请求或 Auth 启动耗时。

| 操作 | 原生 1.2.0 旧页面 | 本分支原生页面 |
|---|---|---|
| 首次进入空管理列表 | GET 1 次 / 2.87s；OPTIONS 480ms | GET 1 次 / 1.45s；OPTIONS 476ms |
| 手动刷新 | GET 1 次 / 2.63s；整屏清空 | GET 1 次 / 2.54s；OPTIONS 2.83s；保留内容 |
| 第二次手动刷新 | 未另测 | GET 1 次 / 2.44s；OPTIONS 525ms；手动操作不因 TTL 被跳过 |
| focus，缓存已过期 | GET 1 次 / 2.52s；整屏清空 | GET 1 次 / 2.62s；内容保留 |
| 切走超过 TTL 再返回 | GET 1 次 / 5.68s；OPTIONS 2.79s；整屏清空 | GET 1 次 / 1.47s；OPTIONS 534ms；内容保留 |
| 缓存有效时切走再返回 | 未独立记录该短间隔 | **新增 Community GET 为 0**：先 focus GET 2.58s / OPTIONS 2.84s，约响应完成后 10 秒切回，Network 仍只有该首次 Community GET |

旧页面没有社区样本，因此不虚构旧榜单周期切换耗时。并发请求去重、不同周期 / 分页隔离由定向测试补充。

## 测试与内容审查

本地 11 个定向文件合计 **95 项**测试通过：API 20、cache 6、hooks 13、session epoch 1、management 15、unified leaderboard 13、Auth 6、native OAuth 4、AccountView 3、upload gate 11、summary 3。最后的三项 mutation 补修复跑受影响四文件 **47/47 PASS**，其余文件复用本轮 92/92 时的有效结果。

另有全站定向 16/16、architecture 4/4 PASS；Dashboard typecheck、最终 production build、copy（1745）、locale、UI hardcode、architecture guardrails、版本检查及 `git diff --check` 通过。构建保留既有 SDK crypto externalization / chunk-size / static-dynamic import 警告，没有降低门禁。

账号隔离、会话重新登录、迟到响应、401 / 403 / 404、dense ties、bigint、跨页 me、分页、操作后刷新由正式自动化回归覆盖。本轮原生云端没有新增第二个账号或成员样本，因此不把这些全部声称为原生逐项复现。

完整 Dashboard suite 的两个既有 clean HEAD 基线失败（period changes cache timeout、Preloaded User missing）继续保留，不修复、不宣称完整 suite 通过。后端 / Foundation 没有相关变化，复用已有验收，不重跑完整后端或双用户生命周期。

## 清理与安全

用户通过正常 owner UI 删除本轮两社区。之后自有项目只读核对：`communities=0`、`community_members=0`、`community_transfer_requests=0`、`auth_users=2`、`tokentracker_hourly=1`、`total_tokens="130"`。未添加 Token 样本或上传本机用量，原生持久云同步偏好仍关闭。用户退出临时宿主后恢复正式安装版协议入口，并清理本轮临时宿主。

提交范围排除 `.insforge`、临时测试宿主、诊断 helper、构建产物和凭据；敏感信息 / 本机绝对路径扫描在提交前执行。继承发布 / 运营等 10 个 workflow 保持禁用，没有 dispatch 发布流程。

## 原 UI Review 状态

功能与定向本地 / 原生证据已整理供 Draft PR review。提交 SHA、PR 链接、实际普通 CI 状态以 PR 最终摘要为准，避免为记录自身 SHA 反复提交。普通 CI 未完成前不声称通过；专用 build-only RC 若由既有 PR 触发规则运行，仅产生 Actions artifacts，不替换公开资产。本轮不 merge、部署或发布。

## PR #4：401 修复及最终组合验证（2026-10-04）

### 源码与证据范围

| 范围 | 不可变源码 SHA | 证据 |
|---|---|---|
| 原审定 UI | `9146d59973cb95093ffc93be15f9a558e45a245e` | 上述原生交互、截图、请求对照及已接受的原 UI CI / RC；截图时间范围仍以原章节为准 |
| 401 最小修复 | `e7dfc084c8ca1d15da26ebd67517874928033a03` | 缓存状态、hook 自动读取门禁和四项组件回归 |
| 合入的自有 main / PR #3 | `a0d58cfc1cb192f6dd9410db709b1edc0ffea5f7` | 已审定扫描目录实现，原样保留 |
| 最终组合源码 | `d294c2e4dd9ef11b31eb34709c084d3e388a7bb0` | `--no-ff` 合并提交；本节组合前端回归、普通 CI、三平台 build-only RC 和下载回核的候选 |

原 UI [普通 CI 37178301150](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37178301150) 与 [RC 37178301157](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37178301157) 已 PASS，继续保留，不能代替组合源码的验证。未在组合包上重新执行原生安装、Community 生命周期或云端写入；组合产物仅作 BUILD/PACKAGE 与下载完整性验收。

合并保留原 UI、修复及 main 历史，没有 rebase / force push；合并后 `src/` 和根测试与 main 一致，Dashboard 与修复分支一致。未切换或修改其他会话 checkout。首次合并被本机 `ORIG_HEAD` 元数据写入失败阻止，工作树未改变；定向 `git update-ref ORIG_HEAD` 成功后重试，无冲突完成，没有变更权限或 Git 全局配置。

### 401 回归与修复

先在真实 `CommunityLeaderboardPage` 组件上补顶栏刷新回归。原实现稳定复现失败：401 后失效标记触发 hook 重复读取、通知和渲染，Profiler 超过 40 次预算。保留相同测试后修复：blocked 的非强制读取消费失效标记；hook 的所有自动读取条件受 blocked 状态统一限制。没有移除 JWT、缓存隔离或重试入口。

四项新增组件回归覆盖：401 后顶栏刷新、blocked 会话收到失效通知、显式重试恢复、重新登录的新 session epoch 恢复。前两项核对渲染稳定、focus 不触发自动请求、私有榜单不显示；后两项核对正常读取恢复及 TTL 内 focus 复用。缓存清理、迟到响应、正常手动刷新、GET 去重和 POST 不重试继续通过既有测试。

### 组合源码本地门禁

- 11 个定向 Community / cache / hooks / Auth / AccountView / upload gate / summary 文件：**99/99 PASS**，包含新增四项回归；修复前 RED 与修复后 GREEN 均实际执行。
- 合入扫描目录的四文件加 architecture / RC 既有契约：**66 PASS、0 FAIL、3 个既有 Windows 权限位不适用 skip**。没有添加 skip 或降低断言；跨平台完整根测试由普通 CI 验证。
- Dashboard typecheck、production build、copy、locale、UI hardcode、architecture guardrails、版本校验及 `git diff --check`：PASS，版本仍 `1.2.0`。
- 本次相对已合入 main 的 27 个文本文件敏感凭据 / 本机绝对路径扫描：无发现；临时 helper、下载包及构建产物排除于提交。
- 两个完整 Dashboard suite 既有基线失败、SDK crypto externalization / chunk-size / static-dynamic import 警告继续保留，没有为取得绿色修改它们。

### 组合远端与产物门禁

普通 CI：[37181882505](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37181882505)，**4/4 PASS**。run head 是组合源码 SHA；四个 runner 实际 checkout 同一个 GitHub PR merge-check SHA：`7d853668589df2915f4f59460c4c30049db7a133`，不是主分支实际 merge。

| 普通 CI job | Job ID | 结果 |
|---|---|---|
| test + validate + build | `111375934086` | PASS |
| Windows build | `111375934103` | PASS |
| macOS unit tests | `111375933985` | PASS |
| Linux client (Rust) | `111375934150` | PASS |

三平台 build-only RC：[37181882488](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37181882488)，**5/5 PASS**。candidate、windows、macos、linux、delivery 的实际 checkout 均是 `d294c2e4dd9ef11b31eb34709c084d3e388a7bb0`，与 package manifest 的源码一致。

| RC job | Job ID | 实际内容检查 |
|---|---|---|
| candidate | `111375934012` | 自有仓库与精确 PR head SHA |
| windows | `111375957327` | ZIP 与 Setup 安装后文件 payload 一致；self-contained x64 runtime、版本、独立安装身份、自有 backend / updater |
| macos | `111375957324` | 挂载 DMG；实际 universal app / widget / Node、版本、独立 bundle / protocol、自有 backend / updater 与 ad-hoc signature |
| linux | `111375957413` | AppImage、deb、rpm 分别解包核对 runtime、x86_64、版本、独立包 / desktop / protocol、自有 backend / updater |
| delivery | `111376924165` | 从实际上传的三平台 artifact 重新读取，既有 `artifacts.cjs` 对六包字节和元数据验收 |

此组合候选 CI / build / package 首次均成功，没有产品修复重试或降低门禁。Windows 未签名、macOS ad-hoc 不等同 Developer ID / notarization、macOS/Linux GUI/RUNTIME 未复验、完整下载升级链未验证等已有发行限制继续保留。

六包交付：[artifact 11295596917](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37181882488/artifacts/11295596917)，名称 `community-rc-d294c2e4dd9ef11b31eb34709c084d3e388a7bb0`。上传后客户端下载 **PASS**：完整 ZIP 为 `499112879` bytes，SHA-256 `ce7fd0640929cbdd0f31ac647aa23d0e9923e5b8c8ac615fce4d1778e5b2edc2`，与 GitHub artifact digest 一致。压缩目录恰为六包和两份元数据，没有额外条目；解压后使用既有 `node scripts/rc/artifacts.cjs verify <delivery> <source-sha>`，六包实际字节、大小、固定名称、manifest source / checkout / version 与 SHA256SUMS 均通过。

下载首个单连接请求超时；对同一 artifact 续传和精确分段下载后完成，拼接过程中短时 Windows `EBUSY` 经定向文件句柄重试解决。没有重新构建、压缩、签名或生成 package 元数据；最终完整 ZIP digest 与包校验消除了部分下载或拼接污染的可能。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| TokenTracker-Community-win-x64.zip | 114909372 | `352ff6039ecf384917c15073fe50c9c22528cf9744c1e09df3bb7a63a215fa9d` |
| TokenTracker-Community-Setup.exe | 80756362 | `dad9aab12cfa8c5a0a264ba2f8db82c1b5272ff42223f7a60ea9b24759841804` |
| TokenTrackerCommunity.dmg | 61938690 | `af7bd92a2d6da0b45f25a4860ee207211c329d36ad556b840112b19ca82f3125` |
| TokenTracker-Community-linux-x86_64.AppImage | 127502840 | `f6f48137e17c2c6a976fd20f0cecd3028d3bec0976c442dc2aec904aca6cadd1` |
| TokenTracker-Community-linux-x86_64.deb | 57010424 | `b4e42463d86f702e70b8666fdc39aafaac67e067451dc78808f610409d4db608` |
| TokenTracker-Community-linux-x86_64.rpm | 56991742 | `4d1b247137589c0eec8746388ade806ffe79780413036f47a23bdfa48f38f9a5` |
| RC_MANIFEST.json | 1598 | `068b7904d05ef6981f0909fed778474e2f899d1407087461955b4511550ae8d0` |
| SHA256SUMS | 615 | `d7d22e246cbc4e29de557f5a616c3e0ee8148b233deeff9530d4ed3ddfdcb2ed` |

所有包内版本 `1.2.0`；Windows / Linux 架构 x86_64，macOS arm64+x86_64。架构、独立身份和 embedded runtime 由各平台实际 payload 检查补充，不能仅凭 manifest 字段视为已验证。

结论：401 最小修复、最终组合前端回归、普通 CI、三平台 BUILD/PACKAGE 与下载回核 **PASS，提交 review**。本节后续报告 commit 仅改变此 Markdown，不是新的产品候选；组合产物继续对应上表不可变源码 SHA。最终 PR head 及报告提交自动触发的普通 CI 状态在 PR 摘要记录，避免为报告自身 SHA 反复追加提交。没有把文档-only 更新跳过三平台打包解释成新源码 RC PASS。

远端只有普通 CI 和 build-only RC active；其余 10 个工作流仍 `disabled_manually`。PR #4 保持 Draft，本轮不 merge PR、不覆盖安装、不发布、不改版本、后端、migration、Edge、云端配置或 Token 数据。已有同步关闭及原 `130` Token 基线证据保留，不重新制造云端样本。
