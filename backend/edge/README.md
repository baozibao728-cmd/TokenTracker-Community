# MVP Edge Contract Closure

本阶段完成自有后端的 **13/13 MVP Edge 数据库依赖闭合**。新增独立适配层，不修改 upstream Edge 原文件，不增加数据库对象，不读取本机凭据，不连接或部署任何云端项目。

支持链路：InsForge 平台登录 → Device Token → ingest → Account Usage → week/month/total 基础排行榜。这里的登录由 InsForge Auth 提供；本地测试从签名 JWT 开始，**没有验证真实 OAuth 登录**。

## 四个失败的根因与分类

A = MVP 正确性必须；B = 官方附加功能；C = 生产运营 / 审核能力。以下是原样 upstream 的缺失依赖，不是新的 MVP 发布清单。

| 未闭合 Edge | 缺失数据库对象及类型 | 原样代码为何调用 | 分类与处理 |
| --- | --- | --- | --- |
| `tokentracker-public-visibility` | 表 `tokentracker_public_views` | GET 除了设置，还读取已有分享 Token；上游忽略此查询错误 | **B**。移除查询；兼容字段 `share_token: null`，同时显式 `capabilities.share=false`，不模拟分享成功 |
| `tokentracker-leaderboard` | RPC `user_badges_compact` | 给列表及 `me` 附加紧凑徽章；上游查询失败时仍返回榜单 | **B**。删除徽章查询和徽章字段，显式 `capabilities.badges=false` |
| `tokentracker-leaderboard-profile` | RPC `user_badges_full` | 普通资料附加徽章；`view=badges` 是单独徽章入口 | **B**。删除普通资料徽章查询/字段；徽章入口返回 HTTP 501 `unsupported_capability` |
| `tokentracker-leaderboard-refresh` | 表 `tokentracker_leaderboard_anomaly_flags` | 正常刷新读取自动异常标记，排除 `auto_excluded` 用户；读取失败则继续刷新 | **C**。删除自动标记读取；保留手动 blocklist，响应明确披露没有自动排除 |
| 同上 | 表 `tokentracker_anticheat_run_state` | 异常扫描队列摘要、运行状态 | **C**。裁剪异常摘要与扫描入口，返回明确不支持 |
| 同上 | RPC `leaderboard_quarantine_audit` | 读取生产隔离审计记录 | **C**。裁剪审核入口，返回明确不支持 |
| 同上 | RPC `reconcile_anticheat_snapshot_exclusions` | 从自动异常标记协调、清理快照中的被排除用户 | **C**。裁剪协调入口，不伪造协调结果 |
| 同上 | RPC `detect_leaderboard_anomalies` | 运行异常检测，更新生产审核状态 | **C**。裁剪扫描入口，不伪造扫描结果 |

这些缺失对象没有 A 类项目。**A 类依赖仍全部保留**：JWT 签名校验、用户/设备归属、设备 Token 哈希/撤销、ingest 冲突键、会话纠正、跨设备去重、账号聚合、daily/total rollup、snapshot 读写、刷新授权/claim，以及现有手动封禁。对象、参数、字段及其行为由真实 Bootstrap SQL 与请求测试验证。

自动异常排除属于 C 类能力，但影响数据可信度：本 MVP 按**客户端上报的 Token**计算排名；伪造或夸大的合法上传可能进入榜单。聚合正确不等于上传真实。不能宣称与官方反作弊后的榜单一致，也不能宣传“已审核排名”。

## 裁剪后的明确契约

四个能力适配的 JSON 响应增加 `capabilities`，明确关闭 badges / likes / share / automatic_anticheat / quarantine / telemetry / community / subscription_value，并增加 `ranking_policy`：

- `basis: "client_reported_tokens"`
- `automatic_exclusion: false`
- `manual_blocklist_configured` 只说明是否配置了环境变量，不泄露封禁名单，也不意味着启用了自动审核。

删除徽章字段；不返回伪造的空徽章结果。分享字段为空是关闭能力的兼容响应，不创建分享数据库对象。

`leaderboard-profile?view=badges`、refresh 的 `?anomalies` / `?quarantine_audit` 入口，以及含 `scan_anomalies` 或 `anti_cheat_reconcile_at` 字段的刷新请求，返回 HTTP 501 `unsupported_capability`；字段即使为 `false` 也不能隐含开启官方接口。这些请求不会执行数据库查询。

正常刷新只允许 POST：匿名/anon JWT 返回 401；签名用户只能刷新 `week` 且不能强制刷新；自有服务凭据或 `x-refresh-secret` 才能刷新 month/total、全部周期及强制刷新。保留原有 30 秒 claim 限流；它不是长任务租约，claim 基础设施错误时沿用上游 fail-open 行为。

public-visibility 的核心 settings/profile 读取错误、leaderboard-profile 的核心资料读取错误返回 500，不因裁剪附加功能而掩盖数据库错误。

## 发布入口与 upstream 同步

未来发布必须使用 `manifest.json` 的 `entry`，保持原函数名称。**直接部署全部 `dashboard/edge-patches/` 原文件会重新引入四个缺口。** 当前没有部署脚本，也没有执行发布。

| 入口来源 | 数量 | 说明 |
| --- | --- | --- |
| 本目录四个能力适配 `.ts` | 4 | public-visibility、leaderboard、leaderboard-profile、leaderboard-refresh |
| 本目录两个仅类型适配 `.ts` | 2 | account-devices 的 `Uint8Array<ArrayBuffer>` 声明；account-summary 的 `cost_dims` source/model 非空声明，与 Baseline 的非空维度一致。编译后的 JavaScript 与 upstream 完全相同 |
| upstream 原文件 | 7 | device-token-issue、ingest、account-daily、account-hourly、account-monthly、account-heatmap、account-model-breakdown |

`build-adapters.mjs` 用审查过的精确片段生成六个独立文件。没有运行时包装或跨 Edge 动态 import。每个原文件及发布入口记录 SHA-256；源文件变化、锚点变化、适配漂移都会阻止检查。

后续 merge upstream：先检查原文件差异及价格变更，审查并调整生成器，更新 manifest 中的 upstream 基准提交，再运行生成器及完整 `verify`。不要手改生成文件或自动无审查覆盖。Parser、Cost Engine、Provider integrations、客户端及历史 migrations 本阶段均未修改；适配中的价格常量和计价函数逐段与原文件核对。

## 与官方排行榜的行为差异及保留限制

1. 不展示徽章，不支持徽章专用查询、Likes/Share、自动 Anticheat、Quarantine、Telemetry；Community / Subscription Value 也未实现。
2. 没有自动异常排除或隔离恢复；只有自有 `LEADERBOARD_BLOCKED_USER_IDS` 手动名单。设备签发、ingest、refresh、list、profile 必须使用一致的名单；不复制官方生产名单。
3. 仍按 Token 排序。沿用上游 UTC 周一至周日、UTC 自然月、总计 rollup/分片；保留已有 estimated cost 字段和计价逻辑，未新增 Value 排名或订阅计算。
4. 保留账号缓存、闭合日 rollup、每批 7 天历史修复、最新 total snapshot 读取、快照时间与分页语义。新空库只包含本项目用户，不迁移官方历史数据或审核状态。
5. 沿用上游公开语义：list 不按 `is_public` 过滤，profile 允许已有 snapshot 的用户被查询。**`leaderboard_public=false` 不能作为不上榜或资料不公开的保证。** anonymous 会隐藏名称/头像/GitHub；列表基于快照，设置更新可能要等刷新。没有在本阶段扩展隐私业务。
6. 手动名单新增用户后，列表会立即过滤，但 snapshot 的总人数、页数和已有 rank 在刷新之前可能保留旧值；沿用上游行为。要重排应执行有权限的正常刷新。
7. 没有部署定时调度；签名用户按上游契约只能主动刷新 week，month/total 仍需后续自有特权调度或手动触发。不会假称三个周期已在云端自动更新。
8. 未修改前端。现有徽章、分享、审核等 UI 入口未在此阶段适配；本次验收范围为 MVP Edge/SQL 契约，不是完整客户端体验或生产上线。

## 新增与修改的文件

本目录新增：六个 `tokentracker-*.ts`；`build-adapters.mjs`；`manifest.json`；`check-types.mjs`；`runtime-env.d.ts`；`test-transport.mjs`；`validate.mjs`；本报告 `README.md`。

`backend/bootstrap/` 仅修改：`lib.mjs`（按 manifest 核对实际入口及 hash）；`check-edge-contracts.mjs`（MVP / upstream 两种检查）；`package.json` / `package-lock.json`（隔离 SDK 测试依赖及门禁）；`README.md`（更新阶段状态）。**全部 SQL、provenance 及原有 SQL 行为测试未修改。**

## 本地验证与复现

在仓库根目录执行：

```powershell
npm --prefix backend/bootstrap ci --ignore-scripts --no-audit --no-fund
npm --prefix backend/bootstrap run verify
# 对原样 upstream 进行独立诊断：应真实报告 9/13 并退出 1
npm --prefix backend/bootstrap run check:upstream
# 原项目价格回归
node --test test/edge-pricing-parity.test.js
```

完整 `verify` 包含：32 项原有 SQL 验证；六个适配和 13 组源 hash；13 个入口的严格 TypeScript 检查；13/13 MVP 数据库依赖；18 项实际 Edge 请求测试。原样 upstream 的四个缺口还会在请求测试中断言，没有跳过失败项。

本次实测：`verify` 退出 0；18 项请求测试执行了 121 次真实本地数据库请求；原有价格回归 11/11 通过。价格回归首次被沙箱子进程权限阻止，获准重跑后完整通过。`check:upstream` 如实显示四个失败并退出 1。18 个变更/新增文件的范围、凭据/本机路径扫描及 `git diff --check` 通过。

请求测试使用 **真实 InsForge SDK 1.4.5 + 真实 Bootstrap PostgreSQL 17.5（PGlite）**。本地严格 HTTP 传输适配器将 SDK 请求转换为实际 SQL：所有业务表/RPC 来自 Bootstrap，没有补建空壳。未知请求/字段不模拟成功。失败注入只用于验证核心错误能正常传播。测试凭据和 RSA/HMAC 密钥每次在内存生成，禁止访问外部网络，不读取 `.env` / `.insforge`。

覆盖空库刷新/空榜单、HMAC/RSA JWT 验证、无效/过期签名、真实 opaque Token 签发、设备身份重复、ingest 重放、七个 Account Usage 入口、visibility 设置、刷新授权/限流、三周期快照及手动封禁、匿名资料、计价与类型适配不改变运行代码、核心失败传播、禁止能力不访问数据库。

## 首次自有项目契约验证是否具备条件

**具备本地材料和门禁条件，可进入自有空项目的首次 Bootstrap / Edge 契约验证阶段；尚不能宣称云端已经跑通或生产可用。** 本阶段未连接、修改或部署任何 InsForge 项目。

执行前仍需只读核实：目标确实是用户自有空项目；`000_preflight.sql` 要求的角色、`auth.users` 结构/权限真实存在；自有 JWT 验签配置、Edge 服务角色和 Auth metadata 投影一致。未来部署使用 manifest 的 13 个实际入口，在自有环境验证真实登录、网关、SDK、设备 Token、写入和查询。头像字段、平台权限、真实 OAuth 回调、云端构建/超时、多连接并发都不能由本地 fixture 证明。

SQL 清单未变，后续 Bootstrap 应按顺序、同一事务执行；不会自行补齐缺失平台角色、覆盖已有库，或连接官方生产后端。后续执行范围和结果应单独报告。

当前分支 `chore/backend-bootstrap`。本阶段变更未提交、未推送、未部署，Git 工作区包含上述本地交付内容。
