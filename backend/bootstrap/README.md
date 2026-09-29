# Backend MVP Schema Baseline

本目录只提供**空库 SQL 基线和本地验证**。没有部署脚本，不读取 `.insforge`、`.env` 或本机凭据，不连接任何 InsForge 项目。当前不是完整后端发布包。

基于仓库提交 `619acd46208f5b5da0cd03dd05208ea656588e43` 提取最终有效定义；不机械重放历史 migrations，不包含官方生产数据、封禁名单、历史修复或备份表。

## 当前结论

- 本地 PostgreSQL 17.5（PGlite）验证：32 项通过。
- 现有 `test/edge-pricing-parity.test.js`：11 项通过；首次运行被沙箱的子进程权限阻止，获准重跑后完整通过，没有改动测试或价格代码。
- 实际创建：12 张表、1 个 View、21 个函数（含 4 个 Trigger 函数）、4 个业务 Trigger、23 个索引（含 PK/UNIQUE 自动索引）。
- 13 个目标 Edge 的完整依赖检查：9 个通过、4 个失败。**失败项没有跳过，完整 `verify` 命令退出码为 1。**
- 尚不能宣称全部目标 Edge 已就绪，也不建议现在直接进行第一次云端 bootstrap；详见下面的阻塞项。

## 文件及执行顺序

将以下 12 个 SQL 按文件名顺序，在**同一个事务**中由 `project_admin` 执行；这是供后续审批执行的约束，本阶段没有执行云端 SQL。

| 文件 | 内容 |
| --- | --- |
| `000_preflight.sql` | 检查平台角色、`auth.users` 及投影权限；拒绝覆盖已有 TokenTracker 对象 |
| `001_core_tables.sql` | 设备、设备 Token、小时桶、设备别名映射、更新时间 Trigger |
| `002_device_identity.sql` | 上游设备身份收敛 RPC |
| `003_account_session_states.sql` | 上游会话快照表、索引、严格 LWW 写入 RPC |
| `004_account_usage_rpc.sql` | 缓存表及最终账号聚合、summary/daily/heatmap/model RPC |
| `005_user_profiles.sql` | 用户设置、资料 View、排行榜快照、刷新限流状态 |
| `006_leaderboard_tables.sql` | 含价格时段的 daily rollup 表和价格时段辅助函数 |
| `006a_leaderboard_upstream.sql` | 上游 meta/total 表、小时去重、三个 total 维护 Trigger |
| `006b_leaderboard_daily_replace.sql` | 按 UTC 日重算，保留价格时段、同步 total |
| `007a_leaderboard_rpc.sql` | 上游 advance/grouped/total shard/metadata RPC |
| `007b_refresh_claim.sql` | 原子刷新限流 RPC |
| `008_permissions.sql` | RLS、权限收紧、固定函数 search_path 与日汇总 UTC 时区 |

其他文件：

- `provenance.json`：每个直接提取对象的源文件、名称和定义 SHA-256。
- `extract-upstream.mjs`：只提取指定最终定义；不执行 SQL。未来 merge upstream 后审查来源变化，再显式运行，不能无审查覆盖。
- `lib.mjs`、`validate.mjs`：本地 PostgreSQL 初始化和行为验证。
- `edge-contracts.mjs`、`check-edge-contracts.mjs`：解析实际 Edge TypeScript，核对表/View、查询字段、冲突字段及 RPC 命名参数；动态或无法解析的契约会报错。
- `test-platform.sql`：**仅限本地测试**的 InsForge 平台最小契约（角色和 `auth.users`），不属于可部署 SQL。业务对象全部由真实 baseline 创建，没有用空函数或模拟表替代缺失依赖。
- `package.json`、`package-lock.json`：隔离的验证依赖，未改变根项目或 Dashboard 依赖。

## 数据库对象及来源

`UPSTREAM` 注释对应直接提取的定义；`INFERRED_COMPATIBILITY_IMPLEMENTATION` 对应缺失 DDL 的兼容实现或基线权限调整。所有函数最后统一收紧权限和 search_path；两个日汇总函数额外固定 UTC。

| 表 / View | 来源 |
| --- | --- |
| `tokentracker_devices` | 推导；设备签发/身份收敛契约，含两个 active 唯一索引 |
| `tokentracker_device_tokens` | 推导；SHA-256 Token 查找、撤销及设备归属契约 |
| `tokentracker_hourly` | 推导；ingest 冲突键、计数维度、身份合并字段及更新时间 |
| `tokentracker_device_machine` | 推导；真实可写的稀疏别名表，缺映射时沿用上游 device_id fallback |
| `tokentracker_account_session_states` | 上游 `20260817120000` 原定义 |
| `tokentracker_account_usage_cache` | 上游 `20260718071507` 原定义，UNLOGGED |
| `tokentracker_user_settings` | 推导；public-visibility 读写契约 |
| `tokentracker_user_profiles` **View** | 推导；上游注释明确的 `auth.users LEFT JOIN settings`；avatar JSON key 待实测 |
| `tokentracker_leaderboard_snapshots` | 推导；refresh 写入的全部字段及四列冲突键 |
| `tokentracker_leaderboard_refresh_state` | 新的内部兼容存储，支持缺失的 refresh claim；不是 Community 表 |
| `tokentracker_leaderboard_rollup_daily_v2` | 上游原表加推导的 `pricing_tier` 维度及复合 PK；最终 reader 已依赖该维度 |
| `tokentracker_leaderboard_rollup_meta_v2` | 上游 `20260804043427` 原定义 |
| `tokentracker_leaderboard_rollup_total_v2` | 上游 `20260904064000` 原定义 |

直接复用的函数：

- `refresh_tokentracker_device_identity`：`20260719152022`，不提取同文件后面的生产修复 DML。
- `tokentracker_upsert_account_session_states`、`leaderboard_hourly_dedup_v2`、`leaderboard_rollup_daily_advance_v2`：`20260817120000`。
- `account_usage_grouped`：`20260904083630` 的 single-scan candidate 函数体，按 `20260904090000` 的 promotion 使用正式名称；没有恢复旧版函数。
- `account_usage_grouped_v2`：`20260904090000`；`account_usage_grouped_cached`：`20260821173500`。
- `account_summary_compact`、`account_heatmap_compact`：`20260918041500`；`account_model_breakdown_compact`：`20260918043000`；`account_daily_compact`：`20260918050000`。
- 三个 `leaderboard_rollup_total_v2_after_*` Trigger 函数及对应 Trigger、`leaderboard_usage_grouped`：`20260904064000`。
- `leaderboard_usage_grouped_total_shard`：`20260904064500`；`leaderboard_user_metadata`：`20260717013000`。

推导兼容函数：

- `tokentracker_hourly_stamp`：ingest 不传更新时间；常规 UPDATE 由服务器填充。保留显式传入的合并时间戳。
- `leaderboard_pricing_tier`：逐字保留账号聚合中 DeepSeek 时段 CASE 的语义；不计算价格，不改 Cost Engine。
- `leaderboard_rollup_daily_replace_v2`：保留上游逐日重建方式，补齐最终 reader 所需的 tier 维度，并序列化重建操作。空范围正常返回。
- `leaderboard_refresh_try_claim`：单语句 `INSERT ... ON CONFLICT ... WHERE` 实现时间窗限流；强制刷新 interval=0 与上游调用契约一致。它不是长任务租约。

## 不能可靠补齐 / 尚未闭合的依赖

不能靠增加禁止范围内的空表或返回空数组的假 RPC 让检查变绿。以下缺口保留为显式失败：

| 目标 Edge | 缺失对象 | 实际影响及下一阶段最小处理 |
| --- | --- | --- |
| `tokentracker-public-visibility` | `tokentracker_public_views` | GET 读取历史分享 Token；现有代码忽略该查询错误。MVP Edge 应移除分享读取并明确无分享能力，不能依赖静默失败 |
| `tokentracker-leaderboard-refresh` | `tokentracker_leaderboard_anomaly_flags`、`tokentracker_anticheat_run_state`、`leaderboard_quarantine_audit`、`reconcile_anticheat_snapshot_exclusions`、`detect_leaderboard_anomalies` | 普通刷新会尝试读取 flags 并 fail-open；反作弊/隔离专用分支会失败。后续独立 MVP Edge 需明确禁用这些分支，不能伪造其结果 |
| `tokentracker-leaderboard` | `user_badges_compact` | 普通列表 fail-soft，但依赖仍未闭合；后续移除徽章调用 |
| `tokentracker-leaderboard-profile` | `user_badges_full` | 普通资料 fail-soft，`view=badges` 分支会报错；后续移除该调用并明确不支持徽章分支 |

其余九个 Edge 的**数据库对象与命名参数契约**通过，不等于 HTTP 端到端测试通过。

其他不能从仓库证明的部分：

1. 上游历史机器 value-based clustering 的完整构建算法缺失。新安装依赖 machine_id 身份收敛；不声称能重建官方历史别名。稀疏映射的实际去重和删除路径已验证。
2. 自有 InsForge 的实际角色、`auth.users` 列/权限、OAuth metadata 中头像字段尚未查询确认。测试 fixture 只验证这份明确的平台契约，不证明平台已匹配。
3. 多连接并发、InsForge Edge SDK/网关行为、真实 JWT 登录与设备 Token 签发仍需后续在自有测试项目验证。当前 Token 测试验证存储及归属约束，不声称已执行 HTTP 签发。
4. 保留上游 30 秒账号缓存和 7 天逐批历史修复语义；修正历史汇总不是全部即时完成。
5. 上游排行榜 list 不按 `is_public` 过滤，profile 以存在 snapshot 为公开入口；因此设置 `leaderboard_public=false` **不能解释为不上榜/不公开**。本阶段没有改变此业务契约，后续 MVP Edge 适配需明确展示/隐私语义后再公开服务。

没有创建 Community、Subscription Value、徽章、点赞、Skills 同步、分享、遥测、反作弊或 Quarantine 对象。

## 本地复现

在仓库根目录：

```powershell
npm --prefix backend/bootstrap ci --ignore-scripts --no-audit --no-fund
npm --prefix backend/bootstrap test
npm --prefix backend/bootstrap run check:edges
# 完整门禁；目前应非零退出，不能作为绿色发布门禁：
npm --prefix backend/bootstrap run verify
# 原项目价格一致性回归：
node --test test/edge-pricing-parity.test.js
```

验证只启动内存 PostgreSQL，无数据库连接 URL 参数，不接收云端凭据。退出时数据库销毁。PGlite 为真实 PostgreSQL 的 WASM 构建，相关限制见 [官方说明](https://pglite.dev/docs/about)；这里仍不是 InsForge 平台集成测试。

32 项覆盖：空库创建/防覆盖、对象来源 hash、字段与命名参数、索引/Trigger、RLS/EXECUTE 拒绝、唯一约束/设备归属、重复上传、跨设备 MAX/SUM、会话 LWW 与纠正、小时/日/月/时区、价格时段、缓存命中/过期、compact RPC、公开资料投影、daily/total Trigger、历史修复、三周期查询、总计分片、快照写入、刷新限流、旧设备合并、非 UTC 会话 DST 回归。

独立审查发现的 DST 问题已通过失败用例复现（预期 150、实得 50），修复后为 150，并完成独立复查。没有通过跳过断言处理失败。

## 第一次云端 bootstrap 的判断

**当前结论：暂不执行。** SQL 基线已通过本地验证，但 13 个原样 Edge 的完整依赖还未全部满足，平台契约也尚未实测。数据库 baseline 与 Edge 发布是两个不同门槛。

下一阶段最小顺序：

1. 本地准备隔离的 MVP Edge 适配，只移除本阶段明确排除的功能调用，保留 Auth 校验、Token 校验、原始聚合/计价逻辑；继续保持上游原文件便于 merge。
2. 完整 Edge 门禁转绿；补充 MVP HTTP 流程测试和明确公开语义。
3. 获准后，只读检查自有空项目的平台契约和目标 project id/base URL，审查最终 SQL 清单与权限。
4. 获准后才在自有空项目执行一次事务化 bootstrap，随后单独部署/验证 MVP Edges。

本阶段没有进行第 3、4 步，也没有改动任何 `src/`、`dashboard/`、历史 migration 或客户端配置。

## 本次 Git 状态

- 分支：`chore/backend-bootstrap`，从 clean `main` 创建。
- origin：`https://github.com/baozibao728-cmd/TokenTracker-Community.git`。
- upstream：`https://github.com/xiufengsun/TokenTracker.git`。
- 交付时 `git status --short`：`?? backend/`，全部新增文件都在本目录；已跟踪文件没有改动。
- 未提交、未推送、未部署；Git 当前因新增交付文件而不再 clean。
