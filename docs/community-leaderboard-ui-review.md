# Community 统一排行榜 UI Review

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

## Review 状态

功能与定向本地 / 原生证据已整理供 Draft PR review。提交 SHA、PR 链接、实际普通 CI 状态以 PR 最终摘要为准，避免为记录自身 SHA 反复提交。普通 CI 未完成前不声称通过；专用 build-only RC 若由既有 PR 触发规则运行，仅产生 Actions artifacts，不替换公开资产。本轮不 merge、部署或发布。
