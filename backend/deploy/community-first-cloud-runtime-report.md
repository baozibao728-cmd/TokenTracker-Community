# Community First Cloud Runtime Report

**状态：PROJECT_NOT_LINKED 阻塞已解决，Community migration 已成功提交并完成云端只读验收。Community Edge 部署与 Smoke 待本阶段执行；两用户业务闭环尚未验证。**

验证日期：2026-10-01（Asia/Taipei）。Community migration 提交时间：2026-10-01T03:35:35.902Z。

## 1. Git checkpoint 与本地门禁

| Checkpoint | Commit |
| --- | --- |
| `feat: add community database foundation` | `1879d9e4a834089156665ee1ed0f5ac9231631a2` |
| `feat: add community edge api` | `e96d52ddc42559df044b1dd1e0e39e8fb456445d` |

两份 checkpoint 已 push 到自有 `origin/feature/community-leaderboard`，没有 merge main。

提交前完整门禁实际通过：Community 3 个 config tests、32 个 PG15 数据库检查、22 个 Runtime 检查（50 次实际本地 SDK 数据库请求）、9/9 数据库契约、严格类型和 source/entry hash；Foundation 完整 verify、PG15 空库发布 migration、13/13 Edge 契约与 hash/type；pricing parity 16/16；secret/path scan 和 git diff 检查。

Foundation 两个测试工具改动只涉及 SQL 行尾归一化及隔离 PG15 的额外连接，没有改变 Foundation 业务 SQL、原 13 个 Edge、Parser、Cost Engine、Provider integrations 或前端。

## 2. 自有项目与成功后的 Cloud Guard

| 项目 | 实测 |
| --- | --- |
| Project | TokenTracker-Community |
| Project ID | `a6ae494f-4e08-40b5-8985-fd69581d0409` |
| Base URL | https://tc79bxhm.ap-southeast.insforge.app |
| Project status | active |
| Migration history | Foundation 与 Community 两条，见下节 |
| Foundation | 12 表、1 View、21 函数、4 业务 Trigger、23 索引 |
| Foundation Edge | 13/13 active |
| Community | 3 表、9 业务 RPC、4 辅助函数、9 索引 |
| Community Edge | 此次 migration 验收结束时为 0 |
| Auth 用户 | 1，已验证 |
| 原 hourly / session-state | 各 1 行 |
| 原 hourly total_tokens | 130 |
| 原全球 snapshots | 3 |

只连接此自有项目，没有操作官方 TokenTracker 后端。

## 3. Community migration 与已解决的 CLI 阻塞

唯一应用的文件：`backend/deploy/migrations/20261001000000_community-leaderboard-v1.sql`。

| Migration version | Migration name | 状态 |
| --- | --- | --- |
| `20260930000000` | `tokentracker-mvp-bootstrap` | 既有 Foundation，未重放 |
| `20261001000000` | `community-leaderboard-v1` | 本次成功提交 |

InsForge 使用 version 标识本次 migration；响应没有额外独立 ID。没有使用 `--all`，没有重放 upstream 历史 SQL，也没有修改已执行的 migration 文件。

CLI 0.2.8 只从当前工作目录读取 `.insforge/project.json`，同时从当前目录的 `migrations/` 读取发布 SQL。此前在 `backend/deploy/` 执行时返回 PROJECT_NOT_LINKED，属于提交前失败。

解决方式是仅本机临时运行目录：以目录映射引用根目录已有 `.insforge`，并放入唯一批准的发布 SQL；比对发布文件 hash 后重新执行 Guard，再应用单 migration target。没有创建项目，没有重新 link，没有复制 credentials 或 API key，没有修改原项目 link。临时运行目录、映射及本机验证文件均已清理。

事务已成功提交，无需 rollback。本次未人为注入云端 SQL 失败，因此不宣称对云端失败回滚进行了实测。平台 unrestricted SQL 禁用，所有目录验收使用正常允许的只读 SELECT，没有放宽权限。

## 4. 云端对象、约束与权限验收

| 对象 | 实际结果 |
| --- | --- |
| communities / community_members / community_transfer_requests | 3 表，均为空 |
| 业务 RPC | 9，全部存在 |
| 内部辅助函数 | 4，全部存在 |
| 索引（含 PK / unique） | 9 |
| 新自定义业务 Trigger | 0；FK 使用 PostgreSQL 内部约束 Trigger |
| RLS | 三表均启用 |
| anon / authenticated | 无三表 CRUD 或 13 个函数 EXECUTE 权限 |
| project_admin | 所需 CRUD / EXECUTE 权限通过 |
| owner-member FK | DEFERRABLE INITIALLY DEFERRED，通过 |
| pending transfer | 每社区最多一个 pending 的部分唯一索引，通过 |

没有伪造对象或降低权限。创建/加入/转让/排行榜等 RPC 的真实用户路径尚待后续阶段。

## 5. Foundation 与既有测试记录保留

迁移前后对全部 21 个 Foundation 函数定义/ACL、Foundation 列定义、索引、约束、RLS/ACL 及 Auth users 列定义进行 fingerprint 比较，全部一致。目录数量保持 12 表、1 View、21 函数、4 Trigger、23 索引；原 13 个 Foundation Edge 均 active。

最后只读检查仍为：1 个已验证 Auth 用户，1 行 hourly（total_tokens=130），1 行 account_session_states，3 份全球 snapshot；三张 Community 表的业务行数均为 0。没有创建第二个用户、Community 或新增 Token 数据。

原测试用户 UUID：`260494f3-6adf-44ba-84ec-49839aa14161`。没有读取邮箱、发送验证码或保存密码/JWT 等凭据。原 total=130、明细相加=135 的 fixture 保留，但不能作为后续合法 Token 归一化样本。

## 6. 尚未执行的业务闭环

创建、邀请码加入/幂等、owner 隐私权限、week/month/total 社区榜单、转让 accept/reject/expire、退出/重新加入/删除及对应 Foundation HTTP 数值回归仍待 Two-User Community Runtime Closure。

已提交社区榜单 RPC 使用成员过滤、零填充、dense rank、UUID 同分稳定排序、独立 me 和 decimal-string Token；复用既有聚合，不复制 Token。当前返回 UTC `from` / `to_exclusive` 和日期窗口，没有独立 `calculated_at` 字段，不能把客户端时间冒充该响应字段。

`basis=client_reported_tokens`、`automatic_anticheat=false`，不宣称等同官方反作弊榜。暂不开发 Community 前端或 Subscription Value。

## 7. Community Edge Cloud Deployment & Smoke

本阶段开始时尚未部署九个 Community Edge，也未设置 Community 配额 Runtime Config。只检查平台 Secret 名称，不记录值。服务凭据继续为 `INSFORGE_SERVICE_ROLE_KEY → API_KEY`，禁止 ANON_KEY、CLI user-api-key 或本机凭据充当 Edge 管理凭据。

部署入口必须来自 `backend/community/manifest.json` 的生成发布 entry。构建、部署、active、无业务数据 Smoke 和 Foundation 回归结果将在执行后更新本节，不将本地验证结果冒充云端通过。

**尚未达到 Community Backend MVP Cloud Closure。** SQL foundation 已完成；需要完成本阶段部署与 Smoke，再进入两用户真实业务验收。没有 merge main 或扩大部署范围。
