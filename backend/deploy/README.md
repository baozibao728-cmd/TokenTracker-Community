# First Cloud Bootstrap Readiness Report

本目录准备首次自有空项目 SQL 初始化材料，不执行 migration、Edge 部署、Secret 写入或项目配置修改。业务基线仍来自 `backend/bootstrap/`，不包含平台账号、官方数据或官方凭据。

## 实测结论

已达到**可进入首次自有空项目 SQL Bootstrap**的准备条件；这不是云端执行成功或生产上线证明。本阶段停止于本地验证，不执行 migration 或 Edge 部署。未来执行前仍须重新核对 link 与空库状态，防止环境在 Preflight 后变化。

| 门禁 | 本次结果 |
| --- | --- |
| 完整 `npm --prefix backend/bootstrap run verify` | exit 0 |
| 单 migration 正文/顺序/hash、适配生成与 TypeScript | 全部通过 |
| PostgreSQL 17.5 / 15.18 SQL 行为 | 各 32 项通过 |
| PG15 发布等价、整体回滚与 generated/expression TEMP 探针 | 5 项通过 |
| MVP Edge 数据库依赖 | 两种引擎均 13/13 |
| Edge 请求：PG17 legacy、PG17 API_KEY-only、PG15 API_KEY-only | 各 20 项，分别执行 123 次真实本地数据库请求 |
| 原项目 pricing parity | 11/11，无跳过 |
| secret/path scan | 50 份 backend 文本产物未发现匹配项 |
| `git diff --check` | exit 0 |

SQL 发布准备无剩余阻塞；真实登录、网关/运行时构建、Secret 注入和云端调用留给授权后的契约验证。Git 分支 `chore/backend-bootstrap`，17 个已跟踪文件修改、15 个未跟踪新增文件，全部位于 `backend/`；未暂存、未提交、未 push。原 12 份可部署源 SQL、provenance、upstream Edge、Parser、Cost Engine、Provider integrations 和历史 migrations 没有修改。

## 单事务发布产物

正式文件：`migrations/20260930000000_tokentracker-mvp-bootstrap.sql`。时间戳与小写连字符名称符合 InsForge CLI migration 命名要求；不是直接执行 `0001_...` 形式。

生成及检查（仓库根目录）：

```powershell
node backend/deploy/build-migration.mjs
node backend/deploy/build-migration.mjs --check
```

脚本固定依赖顺序，核对原目录确实只有这 12 份有序 SQL；每段添加相对来源路径和 SHA-256 注释，正文仅统一 CRLF/LF，不改写 SQL。所有 upstream provenance 与 `INFERRED_COMPATIBILITY_IMPLEMENTATION` 标记保留。`test-platform.sql` 不进入发布文件。生成文件漂移会失败，不能手改生成结果。

顺序为 000、001、002、003、004、005、006、006a、006b、007a、007b、008。没有新增顶层事务语句；函数和 DO 内部的 BEGIN 是原有 PL/pgSQL 语法，不能删除。

InsForge 对**每个 migration 文件**开启独立事务；未来发布应在受控的 migration 目录中应用这一个文件，不能将 12 个源文件逐个提交，也不能对仓库历史 `migrations/` 执行批量 up。本阶段没有生成或运行云端执行脚本。

## PostgreSQL 15 验证

```powershell
# Windows 无可用 Docker 引擎时，下载官方 EDB 15.18 便携运行时；不安装系统服务。
powershell -NoProfile -ExecutionPolicy Bypass -File backend/bootstrap/prepare-pg15.ps1
npm --prefix backend/bootstrap run verify
node --test test/edge-pricing-parity.test.js
git diff --check
```

`test:pg15` 不接受数据库 URL，不读取 `.insforge`、`.env` 或云端凭据。Windows 优先使用忽略的 `node_modules/.cache/` 便携包；其他环境使用本地 Docker daemon 的 `postgres:15.18-bookworm`。数据库绑定随机回环端口，每次创建独立空集群，结束时删除集群/测试容器。引擎不可用或版本不是 15.18 时明确失败，不跳过。

平台 fixture 对齐 Cloud Preflight：`project_admin NOSUPERUSER BYPASSRLS`；`auth.users` 的 `profile` / `metadata` 均为可空 JSONB。它只用于本地测试，绝不部署。所有业务操作仍以 `project_admin` 执行，anon/authenticated 的拒绝用例实际切换角色执行。

PG15 验证包括：单文件空库初始化；原 12 份 SQL 与产物的全部目录定义、ACL、函数正文、View、约束、索引和 Trigger 等价；事务中途故障整体回滚；32 项原有 SQL 行为验证；13/13 Edge 数据库依赖；真实 SDK 的请求链路和 API_KEY fallback。JSONB、transition tables、daily/total rollup、RLS/GRANT/REVOKE 均通过真实语句执行验证。基线没有 generated column 或 expression index；独立、明确标记的 TEMP 语法探针实际创建并使用这两个特性，随后回滚销毁，不进入 migration，也不替代任何业务依赖。已有全部索引（含 partial/unique）在 PG15 实际创建并核对。

## 服务凭据适配

`backend/edge/server-credential.ts` 是唯一 resolver 模板，通过 `Deno.env.get()` 读取：`INSFORGE_SERVICE_ROLE_KEY` → `API_KEY`。空值/空白按缺失处理。不会使用 ANON_KEY、请求头、CLI 用户凭据或本机配置；两者都缺失时，13 个受支持入口明确返回配置错误 500，且不会访问数据库。

生成器将模板原样内联到每个发布文件，保持单文件 Deno 部署格式；不添加跨 Edge 相对 import。13 个 manifest entry 现在全部指向 `backend/edge/`。Upstream 原文件和记录的来源 hash 不变。API_KEY 仅代表 InsForge Edge Runtime 提供的项目管理凭据，禁止把 CLI user-api-key 配成该变量。

保留 SDK 1.4.5 已验证的 `createClient({ edgeFunctionToken: credential })` 传输方式；该字段在真实 SDK 内映射为 accessToken 并使用 Bearer Authorization，与 `createAdminClient({ apiKey })` 的凭据传输一致。没有更改调用者 JWT 验签、设备归属检查、聚合/价格逻辑或数据库权限。

## 首次 SQL Bootstrap 将创建的对象

全部在 `public`，由 `project_admin` 管理；不创建 schema、角色、Auth 用户或平台 Secret。

12 张表：

- `tokentracker_devices`
- `tokentracker_device_tokens`
- `tokentracker_hourly`
- `tokentracker_device_machine`
- `tokentracker_account_session_states`
- `tokentracker_account_usage_cache`（UNLOGGED）
- `tokentracker_user_settings`
- `tokentracker_leaderboard_snapshots`
- `tokentracker_leaderboard_refresh_state`
- `tokentracker_leaderboard_rollup_daily_v2`
- `tokentracker_leaderboard_rollup_meta_v2`
- `tokentracker_leaderboard_rollup_total_v2`

1 个 View：`tokentracker_user_profiles`。

17 个普通函数（包含 RPC 与内部辅助函数）：

- `refresh_tokentracker_device_identity`
- `tokentracker_upsert_account_session_states`
- `account_usage_grouped`、`account_usage_grouped_v2`、`account_usage_grouped_cached`
- `account_summary_compact`、`account_heatmap_compact`、`account_model_breakdown_compact`、`account_daily_compact`
- `leaderboard_pricing_tier`、`leaderboard_hourly_dedup_v2`
- `leaderboard_rollup_daily_replace_v2`、`leaderboard_rollup_daily_advance_v2`
- `leaderboard_usage_grouped`、`leaderboard_usage_grouped_total_shard`
- `leaderboard_user_metadata`、`leaderboard_refresh_try_claim`

4 个 Trigger 函数：`tokentracker_hourly_stamp`；`leaderboard_rollup_total_v2_after_insert` / `after_delete` / `after_update`。

4 个业务 Trigger：`tokentracker_hourly_stamp`；`tokentracker_leaderboard_rollup_daily_v2_total_insert` / `total_delete` / `total_update`。另有 PostgreSQL 自动创建的 FK 内部 Trigger，不计入业务 Trigger 数。

23 个索引（含 PK/UNIQUE 自动索引）。所有 12 张表启用 RLS，客户端权限显式撤销，函数 EXECUTE 仅向项目服务角色开放，函数 search_path 固定，daily 函数固定 UTC。没有业务数据种子或 Community/Subscription/Badge/Share/Anticheat/Quarantine 对象。

## 回滚与发布边界

将整个产物作为单个 InsForge migration 应用时，任意 SQL 失败会回滚该事务中的全部业务 DDL/权限变化；不得拆分后假称整体回滚。PG15 用例在前两份建表 SQL 之后注入真实除零错误，确认全部应用表、View、函数、Trigger、索引被回滚，平台 `auth.users` 保留。

这保证 SQL 初始化的原子性，不覆盖未来单独进行的 Secret 配置或 Edge 部署。真实 OAuth 回调、用户 JWT/资料内容、InsForge 网关、Deno 构建、Secret 注入和运行预算仍须后续授权的云端契约验证，不能由本地测试宣称已完成。

本阶段修改仅在 `backend/`，不修改 Parser、Cost Engine、Provider integrations、upstream Edge 原文件或历史 migrations。没有云端操作、提交或 push。
