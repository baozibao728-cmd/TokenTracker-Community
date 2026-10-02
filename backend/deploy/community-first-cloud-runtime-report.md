# Community First Cloud Runtime Report

**本报告记录的 Two-User Community 云端阶段（2026-10-02）：核心生命周期验证通过。两个真实用户 JWT、9 个 Community Edge、创建/加入、三种排行榜、转让/拒绝/重放、退出和删除均有实际 HTTP 与数据库核对证据。12 项检查全部通过；测试社区及其关系已清理，两个已验证账号和原有 130 Token 保留。自然等待 7 天的过期路径及大规模配额/数值边界未做云端实测，详见第 13 节；不能宣称所有边界已完成云端验证。该阶段未开发前端、修改 Foundation/migration、commit/push 或 merge main；后续前端联调另见 `frontend-real-cloud-integration-report.md`。**

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

### 7.1 报告 checkpoint 与部署前 Guard

`docs: record community cloud migration`：`62fd6792f0d62472065639a7fee480153ca459be`，已成功 push 到 `origin/feature/community-leaderboard`。没有 merge main。该提交只包含更新后的 migration 报告；本节后续部署结果保留为工作区报告更新，尚未再次 commit/push。

部署前重新核对自有项目 ID、名称和 URL 全部一致；migration history 恰好为 Foundation 与 Community 两条；Community 3 表、9 RPC、4 辅助函数存在；Foundation 12 表和 13 active Edge 正常；Community Edge 为 0。还逐个下载原 13 个 Foundation 云端源码，在内存中计算 hash，全部与本地 manifest 发布 entry 一致。

本地 Community source/entry hash 与严格类型检查实际通过。没有修改 Foundation manifest、原 13 个 Edge、已执行的 Community migration、Parser、Cost Engine、Provider integrations 或前端。

### 7.2 Runtime Config

| 变量 | 实际操作 | 结果 |
| --- | --- | --- |
| COMMUNITY_MAX_OWNED | InsForge 正常 Secret / Runtime Env 接口创建 | 成功，active 名称检查通过 |
| COMMUNITY_MAX_JOINED | InsForge 正常 Secret / Runtime Env 接口创建 | 成功，active 名称检查通过 |
| COMMUNITY_MAX_MEMBERS | InsForge 正常 Secret / Runtime Env 接口创建 | 成功，active 名称检查通过 |

配置按本次授权的目标下发，值未写进源码、数据库、Git 或报告。没有创建本机 env/secret 文件。

只读名称检查确认 `INSFORGE_BASE_URL`、`JWT_PUBLIC_KEY` 和 `API_KEY` 存在；`INSFORGE_SERVICE_ROLE_KEY` 未配置。源码 resolver 仍为 `INSFORGE_SERVICE_ROLE_KEY → API_KEY`，仅通过 Deno 环境读取；不使用 ANON_KEY、CLI user-api-key 或本机 credentials 作为 Edge 管理凭据。没有读取或输出平台 Secret 值。

**Community Runtime 的 resolver 成功解析及 SDK/RPC 调用尚未实测。** 部署失败后未执行 Smoke，更没有真实用户 JWT；Secret 名称存在和本地 resolver 测试不能冒充云端服务凭据/RPC 闭环通过。

### 7.3 九个入口的部署记录

只使用 `backend/community/manifest.json` 指定的生成 `.js` 发布 entry，没有部署 `src/` 或 upstream Edge 作为替代。发布 entry SHA-256 按既有生成器的 LF 规范化算法检查；前三个已写入平台的源码 hash 已只读核对，均匹配 manifest，但 hash 匹配不等于部署成功。

共享 Runtime URL（前两次成功响应）：https://tc79bxhm.function2.insforge.app。各计划调用 route 为自有 Base URL 下的 `/functions/<function-name>`，见表；本次没有调用这些 route 做 Smoke。

| Function | Build / deployment | Deployment ID | Active 元数据 | Route |
| --- | --- | --- | --- | --- |
| tokentracker-create-community | success / success | `fxrsgje4rta8` | active | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-create-community) |
| tokentracker-join-community | success / success | `kb9d1v2985at` | active | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-join-community) |
| tokentracker-leave-community | 日志 build finished / failed | `rjxxa1wx9c4s` | active（部署失败，不计通过） | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-leave-community) |
| tokentracker-community-detail | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-community-detail) |
| tokentracker-community-leaderboard | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-community-leaderboard) |
| tokentracker-create-community-transfer | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-create-community-transfer) |
| tokentracker-accept-community-transfer | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-accept-community-transfer) |
| tokentracker-reject-community-transfer | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-reject-community-transfer) |
| tokentracker-delete-community | 未执行 | — | 不存在 | [计划 route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-delete-community) |

| Function | Manifest entry | Entry SHA-256 |
| --- | --- | --- |
| tokentracker-create-community | `backend/community/edge/tokentracker-create-community.js` | `9097213fc46bc5e61db2bb283e3e1a1fc7b5d771e805dad605c150eac1b0f39c` |
| tokentracker-join-community | `backend/community/edge/tokentracker-join-community.js` | `f21462bc066765923dfd1781a6495d05bdb33cd3be838c2fa6993d793e72d907` |
| tokentracker-leave-community | `backend/community/edge/tokentracker-leave-community.js` | `9324f5fe750c0395a98e64c0cbb28f58ce23b364e35d841e9ecc9fea2a8004fd` |
| tokentracker-community-detail | `backend/community/edge/tokentracker-community-detail.js` | `f889591154a818484c3e3bbc388b8a21cff373ea27e001b7eefc513cacbeb395` |
| tokentracker-community-leaderboard | `backend/community/edge/tokentracker-community-leaderboard.js` | `8ef27e43689c2bb9caa1fdef303e71a03819c33462900f16114365d85a6598e9` |
| tokentracker-create-community-transfer | `backend/community/edge/tokentracker-create-community-transfer.js` | `e377b7e80b6ecd2d63c795dfcad6be270499ccf8646b37aef6c649e6a09ddaaf` |
| tokentracker-accept-community-transfer | `backend/community/edge/tokentracker-accept-community-transfer.js` | `5f2961d65218e591307a1ccc60f4822a144672b581210ce7706c58cfa29cbfad` |
| tokentracker-reject-community-transfer | `backend/community/edge/tokentracker-reject-community-transfer.js` | `d2322f769ec999c0c93104f1c33f3ac65c03e7ab33c95dd2c9c6ce92b35d0097` |
| tokentracker-delete-community | `backend/community/edge/tokentracker-delete-community.js` | `46e4d579f950d46a98b88de43b84984585c0d99d7191af897441c8564d02a952` |

实际记录：

- create-community：build/deployment 响应 success，deployment ID `fxrsgje4rta8`，函数元数据 active。
- join-community：build/deployment 响应 success，deployment ID `kb9d1v2985at`，函数元数据 active。
- leave-community：CLI 部署返回失败；随后只读后台和构建日志确认 deployment ID `rjxxa1wx9c4s`，最终 `status=failed`。没有重试部署，没有删除逻辑或放宽数据库权限。
- 后六个入口：未尝试部署，云端记录不存在。

**9/9 active 验收未达成。** 云端元数据中前三个 Community 函数都标为 active，但第三个实际 deployment failed，不能把这三个 metadata active 当作三个成功发布；有成功部署证据的仅为前两个。

### 7.4 第三个部署的失败证据与诊断边界

失败构建日志对应 `rjxxa1wx9c4s`，创建时间 2026-10-01T04:20:45.214Z；后台于 2026-10-01T04:22:06.494Z 记录 Deno Deploy deployment completed、status failed。

平台提供的 13 条构建日志均为 info，包含依赖缓存、上传 build artifact、`Build finished`、开始监听等步骤；没有具体编译、import 或 SDK 错误文字。**构建步骤完成与最终部署失败是不同事实；目前不能可靠断定发布失败的底层原因。** 没有证据证明是函数配额、源码语法或服务凭据问题，也没有据此更改配置、业务逻辑或数据库权限。

此平台把失败部署对应的函数记录仍标为 active，说明 active 元数据本身不足以证明可调用。需要下一次授权诊断发布/启动状态，不能通过一次 metadata list 将本次失败跳过。

### 7.5 Smoke 与真实身份路径

根据“任一核心函数 build/deploy 失败立即停止”，**本阶段所有 Cloud Runtime Smoke 均未执行**，包括前两个已部署入口；没有把部分部署的本地测试冒充云端 HTTP 成功。

| 验证项 | 本阶段状态 |
| --- | --- |
| 九个 OPTIONS / CORS | 未执行：部署停止 |
| 缺失 / 无效 JWT | 未执行：部署停止 |
| 匿名 owner 操作拒绝、统一错误结构、Secret/邀请码不泄露 | 未执行：部署停止 |
| 有效身份下错误 method 405、非法 body/query 400 | 等待后续授权阶段 |
| 有效身份下不存在 community/transfer 404 | 等待后续授权阶段 |
| server credential 实际解析 / Community RPC 调用 | 等待真实用户 JWT |

现有 handler 先验 JWT，再检查 method/config/body/query/RPC。后续无 JWT 的错误 method、非法输入或缺失资源探针应先返回 401；这些响应不能当作已覆盖有身份的 405/400/404 或 RPC 路径。

没有创建第二个用户、Community、成员关系或 transfer request，没有插入新的 Token 数据，没有发送验证码或获取用户凭据。

### 7.6 Foundation Regression

失败后只读验收于 2026-10-01T04:26:10.480Z 完成：

- 原 13 个 Foundation Edge 全部 active；逐个云端 source hash 与部署前、本地 manifest 一致，没有重新部署 Foundation。
- Foundation schema/ACL fingerprint 与部署前完全一致，覆盖全部 21 个函数、列定义、约束、索引、RLS/ACL 和 Auth users 列定义。
- 原 12 表、1 View、21 函数、4 Trigger、23 索引保持不变。
- Auth 用户仍为 1；hourly/session-state 各 1，hourly total_tokens=130；全球 snapshots 为 3。Community、members、transfer 三表业务行数仍全部为 0。

本次重新运行 `npm --prefix backend/bootstrap run verify`，exit 0：PG17/PG15 SQL、PG15 发布 migration、13/13 契约、hash/type 和两种服务凭据 Runtime 模式全部通过。

`node --test test/edge-pricing-parity.test.js` 最终 16/16 通过。首次运行因本机 sandbox 不允许创建测试子进程而出现 spawn EPERM；使用允许本地子进程的执行方式重跑原测试通过，没有修改或跳过测试。

部署阶段没有修改业务源码。阶段收尾的 secret/path scan（90 个 backend artifacts）与 git diff --check 均通过；没有检测到 Secret 值或本机绝对路径。临时执行脚本与脱敏诊断文件清理，不作为 Git 产物保留。

### 7.7 本地与真实 InsForge 的差异及下一阶段条件

1. 本地 9/9 source/type/数据库契约和 Runtime 成功不能保证 Deno Deploy 最终发布成功；第三个云端 deployment 已实际 failed。
2. 平台 metadata active 可以与 failed deployment 同时出现，验收必须同时看 deployment 状态和 HTTP Runtime，不能只数 active。
3. 当前构建日志显示 build finished，却没有提供最终 failed 的具体错误；不得推断为 SQL、权限、配额或 SDK 问题。
4. Runtime 配额已通过正常接口配置，但没有真实用户请求经过 config/RPC，不能宣称其运行时效果已闭环。

**尚不具备进入 Two-User Community Runtime Closure 的条件。** 直接阻塞项是第三个 deployment failed；其余六个入口尚未部署，九个入口 Smoke 尚未执行。需要先诊断该失败，再完成 9/9 成功部署与本阶段 Smoke。社区业务闭环及 Frontend Phase 均未开始。

已停止云端写入与部署；没有 merge main、创建新用户/社区或扩大功能范围。

## 8. leave-community 部署阻塞诊断与恢复

验证日期：2026-10-02（Asia/Taipei）。最终只读 Cloud Guard：2026-10-01T19:48:57.607Z；最新共享 revision 下 leave HTTP 复验：2026-10-01T19:50:02.807Z。

### 8.1 Guard 与三入口差异证据

当前分支仍为 `feature/community-leaderboard`。开始时只有本报告有未提交修改，没有业务源码意外改动。项目 ID、名称和 URL 与第 2 节一致；migration history 仍恰好两条。Foundation 原 13 个云端源码 hash 匹配其 manifest，Community 三表为空。create/join 原成功 deployment 保持不动；leave 发布 hash 与第 7.3 节一致。

三个 bundle 按既有生成器的 LF 规范化方式比较：

| 项目 | create / join / leave 的实际差异 |
| --- | --- |
| Bundle | 分别 15103 / 15101 / 15102 字节，均 334 行 |
| Generated structure | 替换最后一行的 operation 字符串后，整个 bundle 完全相同 |
| Import graph | 发布入口均只有 `npm:@insforge/sdk@1.4.5`；共享 config/runtime/resolver 已内联 |
| Top-level execution | 定义常量、函数和 key 缓存；最后创建 handler 闭包，未在顶层读取 env、创建 SDK client 或访问数据库 |
| Deno / env / SDK | 相同；仅请求路径通过 Deno.env.get 读取配置，execute 内创建 admin client |
| Response / RPC client | 相同 JSON/CORS/error helpers 和服务凭据 resolver；操作分支及目标 RPC 不同 |
| Request / URL | 相同解析器；三者均 POST，create 接收 name/description，join 接收 invite_code，leave 接收 community_id |
| Crypto | 相同 Web Crypto RS256 验签，在请求时执行，未在顶层初始化 |
| Node / dynamic import | 三个发布 bundle 均没有 Node API、require 或动态 import |
| Source map / artifacts | 单文件 ESM，无 sourceMappingURL 或独立 source map；未添加诊断发布文件到 Git |

没有发现能解释旧 deployment 失败的业务源码差异。客户端请求字段和 RPC 分支不会在启动前执行，不能将其差异冒充构建失败原因。

### 8.2 真实失败证据与根因边界

对旧 deployment `rjxxa1wx9c4s` 读取了指定 ID 的 build-log API、函数元数据、平台事件和 `functions.deployments` 中的非敏感字段：

| 证据 | 实际结果 |
| --- | --- |
| Revision 创建 | 2026-10-01T04:20:45.337Z，denoStatus=building / status=pending |
| 指定 revision 构建日志 | 13 条 info，上传 2.6 MB 共享 artifact、Build finished、Listening，无 error 日志 |
| 平台完成事件 | 2026-10-01T04:22:06.494Z，status=failed，约等待 81 秒 |
| 数据库 deployment 记录 | status=failed、url=NULL、build_logs=["Deployment timed out"]、error_message=NULL |
| Build-log API 最终状态 | failed，未提供 failure_reason、独立 publish/startup/runtime 状态或 artifact 明细 |
| 函数 revision/source | 存储源码 hash 与 manifest 一致，metadata active，不能作为成功证据 |

**已确认 InsForge 记录该次失败的直接机制是 deployment 等待超时。底层为何未成功，平台未暴露进一步失败原因。** 构建步骤完成已确认；不能可靠将底层故障归类为 publish、startup 或 runtime initialization failure，也没有证据支持语法、import、JWT、SDK、数据库权限或配额导致失败。

InsForge 当前公开的 [Deno provider 实现](https://github.com/InsForge/InsForge/blob/main/backend/src/providers/functions/deno-subhosting.provider.ts) 在等待次数耗尽时返回 failed 与 `Deployment timed out`；[FunctionService](https://github.com/InsForge/InsForge/blob/main/backend/src/services/functions/function.service.ts) 将该结果保存到 deployment 记录。[日志服务](https://github.com/InsForge/InsForge/blob/main/backend/src/services/logs/log.service.ts) 暴露状态与构建日志，但未透出原始 revision failure_reason。公开 main 源码只用于解释机制，运行中项目的数据库记录和 API 响应才是本次证据；不宣称已核实平台运行版本的具体 timeout 参数。

通用 function.logs 此次返回的是最近成功 revision `kb9d1v2985at` 的日志，并非失败 revision 的启动日志；没有错误不能用来证明失败 revision 初始化正常。未读取 Deno 平台管理 Secret 或绕过平台 API。

### 8.3 最小隔离复现与正式恢复

先以独立临时名称 `diagnostic-community-leave-20261002`，发布原 manifest 指定的完整 leave entry。只改变函数名称，原 JWT、配置、权限验证、请求解析、SDK、RPC 及业务行为全部保留。

- 相同 hash 的完整 bundle 部署成功：`qbzc6mf77r07`，status=success、active；最小 HTTP 返回 204/401/401。
- 未复现源码问题，因此没有逐层删除逻辑，没有修改任何业务源码、共享代码、生成器或 manifest。
- 通过正常 CLI 删除唯一诊断函数；平台移除后的异步共享发布 `7ga0sc4aywf9` 成功；最终诊断函数数量为 0。
- 随后只重新部署正式 leave 原 entry：`r6maz1mrvxsp`，status=success、active；指定 ID 构建日志包含 Build finished，无 error，正式 HTTP Smoke 通过。

**采取的恢复措施是原样重新部署，而不是业务代码修复。** 同源码成功排除了“当前 bundle 必然无法部署”的判断；无法据此断言旧失败的底层原因已经定位，或未来不会再次遇到平台超时。

源码修改：无。发布 entry/hash 更新：无。仅修改本报告。没有新 commit 或 push；HEAD 仍为 `62fd6792f0d62472065639a7fee480153ca459be`。诊断脚本和脱敏证据均为本机临时产物，收尾清理，不提交 Git。

### 8.4 九个正式入口的最终发布状态

leave 成功且通过最小 HTTP 后，才严格按 manifest 顺序部署后六个入口；全部成功，没有再次出现 Build finished + failed。entry 和 SHA-256 完全沿用第 7.3 节的完整列表，最终逐个下载云端源码重新核对。

| Function | Build | Deployment ID | Deployment status | Metadata |
| --- | --- | --- | --- | --- |
| tokentracker-create-community | success | `fxrsgje4rta8`（既有，未重部署此入口） | success | active |
| tokentracker-join-community | success | `kb9d1v2985at`（既有，未重部署此入口） | success | active |
| tokentracker-leave-community | success | `r6maz1mrvxsp` | success | active |
| tokentracker-community-detail | success | `wyvpqz42wvbm` | success | active |
| tokentracker-community-leaderboard | success | `vvkjcr8y078e` | success | active |
| tokentracker-create-community-transfer | success | `9hjg8dsthvn7` | success | active |
| tokentracker-accept-community-transfer | success | `6f6tp2k86ha0` | success | active |
| tokentracker-reject-community-transfer | success | `2cwmgb4mcnfe` | success | active |
| tokentracker-delete-community | success | `n441rg32qjaf` | success | active |

9 个对应 deployment 的数据库状态与指定 ID build-log API 状态均为 success；均有 Build finished、error 日志为 0、error_message 为 NULL。**达到 9/9 deploy success 与 9/9 active**，不是仅依据 active 元数据。Route 沿用第 7.3 节的自有 Base URL `/functions/<name>`；共享 Runtime URL 沿用该节。

平台发布一个函数时会自动重新组合所有 active 函数到共享 Deno application；这与主动修改或执行 Foundation 的 deploy 命令不同。本次没有对任何 Foundation 或 create/join 调用 deploy/update，它们的 source hash、updatedAt、deployedAt 均与诊断前相同。最新共享 revision 为 `n441rg32qjaf`，包含 13 个 Foundation 与 9 个 Community 正式入口，无诊断入口。

### 8.5 leave 最小 HTTP Runtime Smoke

| Probe | 实际响应 | 结果 |
| --- | --- | --- |
| OPTIONS | 204，空 body，请求 Origin 被允许 | 通过 |
| POST，无 JWT | 401，`{ok:false,error:{code:"UNAUTHORIZED"}}` | 通过 |
| POST，格式无效的 JWT | 401，同一安全错误结构 | 通过 |
| POST，格式完整但 RS256 签名无效 | 401，同一安全错误结构 | 通过；Token 仅在内存构造，未保存 |

正式 leave 发布后先完成三项最小 Smoke；随后补验完整 RS256 拒绝路径。后六个全部发布完成后，再于最新共享 revision 下复验 leave 的 OPTIONS/无 JWT/无效 JWT，仍为 204/401/401。

本地 OPTIONS handler 返回允许 Origin `*`；真实平台 HTTP OPTIONS 回显探针 Origin，POST 401 仍返回 `*`。首次诊断探针对字面 `*` 的断言因此失败，已记录为平台 CORS 表现差异；确认回显值严格等于发送的 Origin 后，验证实际跨域许可，未改 handler 或平台 CORS 配置，204/401 和错误 body 断言保持严格。

上述响应没有泄露数据库错误、Secret 或邀请码。缺失/无效 JWT 在进入 config、SDK、RPC 前拒绝：**不能据此宣称服务凭据 resolver、配额配置或 Community RPC 云端运行时闭环通过。** 有效 JWT 下 leave 的不存在资源/owner 拒绝/退出，以及其余八个入口完整 HTTP Smoke，仍等待后续阶段。本次没有创建 Community、第二个用户或任何新 Token 记录。

### 8.6 回归与收尾

重新执行原有门禁，全部 exit 0，无跳过或伪造对象：

- `npm --prefix backend/community run verify`：3 config tests、严格类型、全部 source/entry hash、32 PG15 检查、22 Runtime 检查（50 次真实本地 SDK RPC）、9/9 Community 数据库契约、原 13 Foundation 依赖及 artifact scan。
- `npm --prefix backend/bootstrap run verify`：完整 PG17/PG15 空库与发布 migration、原 13/13 契约、类型/hash、两种服务凭据模式的实际 Runtime 检查。
- `node --test test/edge-pricing-parity.test.js`：16/16。
- 最终 secret/path scan 与 `git diff --check`：通过；只有本报告有未提交修改。

最终云端只读比较与本轮 Guard 完全一致：Foundation 21 个函数定义/ACL、列定义、索引及 RLS/ACL fingerprints 未变；Foundation 13 个 Edge active/hash 未变；migration history 仍恰好原两条。Community 3 表、13 个函数正常，业务行数均为 0。Auth 用户仍为 1，hourly/session-state 各 1，Token 总计仍为 130，全球 snapshots 仍为 3。

临时云端诊断函数和本机诊断文件已清理。没有修改已执行 migration、数据库业务对象、Foundation、Parser、Cost Engine、Provider integrations 或前端；没有修改项目 link、写入 Secret、创建用户/社区、commit/push 或 merge main。

**已具备进入完整 Cloud Smoke 的条件。** 本阶段部署阻塞已解除，但完整无业务数据 Smoke 与真实身份/RPC 验证尚未完成；不能把 9/9 deploy success 宣称为 Two-User Community Closure 通过。本次完成后停止，未开始该闭环。

## 9. Two-User Cloud Runtime Closure：准备阶段停止

验证日期：2026-10-02（Asia/Taipei）。本轮只读 Guard：2026-10-02T02:19:03.135Z；失败后只读确认：2026-10-02T02:26:27.161Z。

### 9.1 Guard 与身份准备

- 项目名称、ID、Base URL 均与第 2 节的自有项目一致；未访问官方后端。
- 分支为 `feature/community-leaderboard`，HEAD 为 `62fd6792f0d62472065639a7fee480153ca459be`；只有本报告有未提交修改。
- Migration history 仍恰好为 Foundation `20260930000000` 与 Community `20261001000000`，没有执行 migration。
- 全部 22 个正式 Edge active，云端 source hash 均匹配本地 manifest；第 8.4 节九个 Community deployment 的实际状态仍全部 success、error_message 为 NULL。没有部署或修改任何函数。
- Foundation 12 张表、21 个函数及 Community 3 张表、13 个函数正常；Community、members、transfer 的业务行数均为 0。
- 原 Auth 用户仍为 1，已验证；hourly 仍为 1 行，total_tokens 为字符串 `"130"`。

| 身份 | 邮箱（脱敏） | Auth user id | 创建 / JWT 状态 |
| --- | --- | --- | --- |
| User A | `b***@gmail.com` | `260494f3-6adf-44ba-84ec-49839aa14161` | 沿用既有已验证账号；本轮尚未登录或获取 JWT |
| User B | `x***@gmail.com` | 尚不存在 | 用户已提供实际邮箱；尚未注册、发送验证码或获取 JWT |

没有采用邮箱别名，没有读取邮箱。密码、验证码、access/refresh token、JWT 和服务凭据均未写入报告、源码、Git、日志或环境文件。

### 9.2 失败原因与实际平台证据

正常只读平台接口返回：注册未禁用，要求邮箱验证，验证方式为 `code`，最短密码长度为 6。`/api/metadata/anon-key` 的响应包含 `anonKey`，其值是单段字符串，不是三段 JWT；仅记录类型和结构，没有保存或输出 credential 值。

本机临时准备探针错误地假定 anon credential 是 JWT，尝试解析不存在的第二段，在 `Buffer.from()` 处发生 TypeError（Received undefined）。**这是本轮临时验证工具的错误假设，不是已证实的 Auth、Community Edge、SDK 或数据库故障。** 失败发生在任何注册、发送验证码、登录或 Community 业务写入之前。

遵守本阶段“失败立即停止”：没有继续真实业务测试、重试注册或修改业务逻辑。之后仅只读确认公开 credential 的实际类型，并逐项比较云端状态与本轮 Guard。

后续修正方向已经明确：公开 anon credential 应作为平台返回的不透明字符串交给正常 Auth 流程；RS256 JWT 解析和验签只针对 Auth 返回的真实用户 access token。该方向尚未重新执行验证，不宣称已修复或已通过 Auth。

### 9.3 业务验收状态

| 验证项 | 本轮实际结果 |
| --- | --- |
| 两个真实用户 / JWT | A 既有账号存在；B 未创建；未获取本轮用户 JWT |
| create / join / detail 权限 | 未执行 HTTP 业务请求，RPC 未调用 |
| week / month / total、零填充、dense rank、分页、me、字符串数值 | 未执行；不能以本地测试替代云端结果 |
| create / accept / reject / expire / 重复 accept | 未执行 |
| owner 禁止 leave、成员 leave、owner-only delete、级联清理 | 未执行 |
| 配额在真实身份下生效 | 未执行 |
| Two-User Community Runtime Closure | 未达成；停在 Auth 准备阶段 |

### 9.4 数据保留与本轮收尾

失败后的完整云端 state 比较通过：Auth 用户列表、三张 Community 表行数、Foundation 函数/列/索引/权限 fingerprints，以及既有 hourly、session-state、daily/total rollup、全球 snapshot 内容 fingerprints 均与本轮 Guard 完全相同。没有修改或追加 Token 数据，也没有创建测试社区或转让请求。

本轮仅更新现有报告。临时探针、公开 Auth 源码参考与脱敏证据文件清理后不保留为部署或 Git 产物；没有保存敏感凭据。未修改 Foundation、migration、Parser、Cost Engine、Provider integrations 或前端；未 commit、push 或 merge main。

## 10. Auth 准备流程重试：HTTP 401 后停止

验证日期：2026-10-02（Asia/Taipei）。失败记录时间：2026-10-02T02:57:55.338Z。

临时测试流程已删除 anon credential 的 JWT 解码假设，设计为直接使用平台返回的不透明字符串进行正常 Auth。没有修改 Community Edge 的 RS256 验证逻辑、数据库、migration 或 Foundation。

本轮先重新执行只读 Guard：自有项目名称/ID/appkey 匹配，第 2 节 Base URL 保持一致；migration history 恰好两条；22/22 正式 Edge active、源码 hash 与本地 manifest 一致。Auth 用户仍只有 A，Community 三表为空，hourly 仍为 1 行 / total_tokens="130"。

临时 Guard 的第一次目录查询将 PostgreSQL 聚合函数也传给 pg_get_functiondef，收到 `"avg" is an aggregate function`。已将该临时只读探针限定为普通函数后重新运行 Guard，通过；没有改动任何云端对象。这一查询准备错误发生在 Auth 请求之前，不作为 Auth 成功证据。

| 请求路径 | HTTP | 实际结果 |
| --- | --- | --- |
| GET `/api/auth/public-config` | 200 | 可读取正常注册/邮箱验证配置 |
| GET `/api/metadata/anon-key` | 401 | `AUTH_INVALID_CREDENTIALS` |

本轮 metadata 请求未携带 Authorization，被平台拒绝；没有取得 anon credential，也没有尝试解析它。不能将这个 401 归因于真实用户 JWT 或 Community Edge，因为尚未调用用户登录或任何 Community Edge。本轮没有在失败后更换凭据重试或继续写入。

遵守“Auth 流程失败立即停止”：没有发送 A 的登录验证码、注册 B、发送 B 的验证邮件、获取 access/refresh token，或进入 create/join/leaderboard/transfer/leave/delete。User A ID 仍为 `260494f3-6adf-44ba-84ec-49839aa14161`；User B 尚不存在。两人的 JWT 最小 Edge 验收及全部 Community 业务验收仍未执行。

本轮只修改此报告。临时脚本和脱敏结果已清理，没有记录密码、验证码、Token、API key 或服务凭据；没有 commit、push、merge main、开发前端或部署。**Two-User Community Runtime Closure 未完成，当前停止点为上述 metadata 请求的 401。**

## 11. 修正 metadata 凭据获取并恢复正常 Auth

验证日期：2026-10-02（Asia/Taipei）。本轮 Guard：2026-10-02T03:08:02Z；A 验证码发送及等待记录：2026-10-02T03:08:17.883Z。

第 10 节的 401 发生在获取 anon client credential 时：该 metadata 接口要求管理员认证，临时准备流程却没有发送 Authorization。它与无需认证的 `/api/auth/public-config` 不同；返回的是公开客户端凭据也不表示“获取凭据的接口”无需认证。这是测试准备流程的调用错误，尚未涉及用户 JWT、Community Edge 或数据库权限。

最小修正只在本机临时测试流程：读取现有自有项目 link 中的项目 API credential，在内存中用于只读 GET `/api/metadata/anon-key`。该读取已实测 HTTP 200，返回的不透明 anon credential 不做 JWT 解析、没有保存或输出值。项目管理员凭据不用于用户注册、用户登录或 Community 请求；也没有读取 CLI user-api-key，或将本机凭据注入 Edge。

随后按照正常 Auth 契约继续：已有 A 使用邮箱 OTP 登录；B 使用随机生成、仅在内存中的密码正常注册，手动完成邮箱验证后登录。真实用户 access token 才检查其 RS256/sub/exp 结构，并交给未修改的 Community Edge 做实际验签。没有更换或降低 Edge JWT 验证、数据库权限或 Auth 配置。

| 请求 / 检查 | 实际结果 |
| --- | --- |
| 自有项目 / 两条 migration / 22 个 Edge source hashes | Guard 通过 |
| Auth 用户 / Community / Token 初始状态 | 1 个既有用户；Community 三表为空；原 hourly 1 行，total_tokens="130" |
| GET `/api/auth/public-config` | 200 |
| 有管理员认证的 GET `/api/metadata/anon-key` | 200；仅在内存取得 client credential |
| POST `/api/auth/email/send-otp`（A 登录） | 202 |
| A 验证码输入及登录 | 暂停，等待用户在终端手动输入；没有记录验证码 |
| A / B JWT 最小 Edge 验证 | 尚未执行 |
| B 注册、邮箱验证、登录 | 尚未执行 |
| Community 业务生命周期 | 尚未执行 |

用户身份和凭据只在单个验证进程内存中流转。脱敏进度文件只记录请求路径、HTTP 状态、错误代码和可用的用户 UUID，不记录请求体、密码、验证码、access/refresh token 或任何 key。等待输入期间保留必要临时脚本；结束后清理。没有修改业务源码、Foundation、migration、数据库结构或前端；没有部署、commit、push 或 merge main。

### 11.1 邮件收件箱确认与单次重发

用户反馈未收到邮件后确认，其查看的是 User B 的邮箱；当前等待阶段是 User A 登录，B 尚未注册，因此不会收到 B 的验证邮件。只读核对 A 的既有用户记录，邮箱与原测试账号匹配，没有更改收件人或 Auth 配置，也没有读取用户邮箱。

自有项目日志显示：2026-10-02T03:08:15.605Z 创建登录验证码，expiresAt 为 2026-10-02T03:13:15.474Z；2026-10-02T03:08:16.810Z 记录 `Email sent successfully`，随后发送接口返回 202。到用户反馈时，该验证码已过期。没有读取或记录验证码值。

这组日志证明平台邮件发送调用返回成功，不能证明 Gmail 收件箱已收到。[InsForge 邮件 provider 源码](https://github.com/InsForge/InsForge/blob/f3df24d483f02c9938bdd1abb14ab9681e3545f0/backend/src/providers/email/cloud.provider.ts#L57) 只检查托管邮件服务的 success，未提供 Gmail delivery 或下游 receipt。源码只解释证据边界，不代替自有项目实际日志。

原本机验证进程已退出。新一轮只读 Guard 后，重新打开手动验证终端，仅发起一次新的 A 登录验证码请求；2026-10-02T03:24:56.943Z 记录 HTTP 202、`User A login / WAITING_CODE`。确认新进程存在，临时输入流程增加显式进程保活，避免等待输入的 Promise 本身无法保证生命周期；不将原进程退出原因未经复现地认定为该问题。

当前等待用户查看 A 的邮箱并输入最新验证码。B 未创建，真实 JWT Edge 验收和 Community 业务测试仍未执行。没有连续重发、修改 SMTP/平台配置、读取邮箱或绕过正常 Auth。

## 12. A 真实 JWT 通过，B 注册成功后恢复验证

2026-10-02T03:25:33Z，A 使用正常 OTP 登录得到真实 RS256 用户会话，`POST /api/auth/sessions?client_type=mobile` 返回 200；随后 `GET /functions/tokentracker-community-detail` 返回 200，ok=true、空社区列表、owned_count/joined_count=0，实际服务端 limits 为 10/20/2000。这条路径经过原始未修改的 Community Edge JWT 验签和真实 community_read RPC，可证明 A 的用户 JWT、服务凭据 resolver 和配额配置云端请求链路正常。

随后 B 的正常注册 `POST /api/auth/users?client_type=mobile` 返回 200。临时脚本立即要求注册响应含 user.id，导致本机 `REGISTER_CONTRACT` 断言停止；该断言错误不代表平台注册失败。只读确认 auth.users 出现且只出现新增 B，email_verified=false，未重复注册。

| 用户 | Auth UUID | 当前实测 |
| --- | --- | --- |
| A | `260494f3-6adf-44ba-84ec-49839aa14161` | 已验证；正常 OTP 登录 / JWT Edge 接受通过 |
| B | `67250f1a-23ec-4790-b41b-4616400f760d` | 正常注册 200；待手动邮箱验证 |

[InsForge 注册响应 schema](https://github.com/InsForge/InsForge/blob/f3df24d483f02c9938bdd1abb14ab9681e3545f0/packages/shared-schemas/src/auth-api.schema.ts#L222) 将 user 定义为 optional；[认证服务](https://github.com/InsForge/InsForge/blob/f3df24d483f02c9938bdd1abb14ab9681e3545f0/backend/src/services/auth/auth.service.ts#L198) 在要求邮箱验证的成功注册路径返回 accessToken=null、requireEmailVerification=true，验证成功后才返回 user 和 accessToken。未把源码参考当作已记录的云端响应全文；本轮直接证据为注册 HTTP 200、临时 user.id 检查失败及数据库中唯一待验证 B。

修正仅涉及临时测试流程：待验证注册响应不再要求 user.id；通过正常 email/verify 响应取得真实用户 UUID 和会话。恢复时使用已确认的唯一 B，等待用户输入注册邮件的验证码；不重新注册、不改验证标记、不读取或修改验证码数据。前一进程退出后内存会话已释放，因此恢复进程将在 B 验证通过后重新通过正常 A OTP 登录取得同一进程中的 A 会话。

此时未开展 Community 生命周期测试，未修改 Token 数据、Edge JWT 逻辑、Foundation 或 migration。未记录密码、验证码、access/refresh token 或其他 credential；未 commit/push/merge main。B 的真实 JWT Edge 验收和 Two-User 业务闭环仍待后续执行。

### 12.1 B 验证与 JWT Edge 最小验收通过

恢复进程使用正常 `POST /api/auth/email/verify?client_type=mobile` 完成既有 B 的手动邮箱验证，返回 200。响应建立平台正常用户会话，返回的 RS256 access token/sub 对应 `67250f1a-23ec-4790-b41b-4616400f760d`；该 token 只在内存保留。没有使用丢失的随机密码或管理员 API 代替 B 登录，也没有再次创建 B。

随后 B 的 `GET /functions/tokentracker-community-detail` 返回 200：ok=true、空社区列表、owned_count/joined_count=0、服务端 limits=10/20/2000，经过未修改的真实 Edge JWT 验签与 community_read RPC。两人的真实 JWT 最小 Edge 验收均已有云端 HTTP 成功证据。

本轮 B 注册验证码的实际日志为 2026-10-02T03:25:41.616Z 创建、expiresAt=2026-10-02T03:40:41.495Z；03:25:44.090Z 平台记录 `email-verification-code` 发送成功。没有重发 B 的邮件或读取验证码值。

2026-10-02T03:32:33.298Z，恢复进程为 A 正常请求新的登录 OTP，HTTP 202，当前等待用户手动输入；B 会话继续仅在该进程内存中保留。此步骤用于将 A/B 两人的会话放在同一个进程中，不能把此前 A 进程的已释放内存凭据取回。

临时业务测试脚本在实际执行前已进行独立只读 review，并补齐成功创建资源后立即保存其 UUID 的记录顺序，确保后续任何失败都能记录残留对象而停止云端写入。没有把 review 或本地语法检查当作云端业务通过。当前 Community 生命周期仍未开始。

## 13. Two-User Community Cloud Runtime：核心生命周期通过

验证日期：2026-10-02（Asia/Taipei）。恢复 Guard 完成于 03:29:41.682Z；两个身份准备完成于 03:37:17.020Z；业务创建首次返回于 03:42:38.235Z；最终只读回归与 `COMPLETE` 记录于 03:46:33.689Z。第 9–12 节保留各次准备阶段的历史停止点，本节为最终状态。

### 13.1 两个真实测试身份

| 身份 | 邮箱（脱敏） | Auth user id | 正常平台流程 |
| --- | --- | --- | --- |
| A，初始 owner | `b***@gmail.com` | `260494f3-6adf-44ba-84ec-49839aa14161` | 沿用既有账号；邮箱 OTP 登录，`POST /api/auth/sessions?client_type=mobile` 返回 200 |
| B，初始成员及转让目标 | `x***@gmail.com` | `67250f1a-23ec-4790-b41b-4616400f760d` | 正常注册一次；手动邮箱验证，`POST /api/auth/email/verify?client_type=mobile` 返回 200 并建立真实用户会话 |

两人的 RS256 access token 均通过未修改的 Community Edge 验签；各自 `GET /functions/tokentracker-community-detail` 返回 200、空社区列表和实际服务端 limits=10/20/2000，调用真实 `community_read` RPC。没有把不透明 anon credential 当作 JWT，也没有以管理员身份冒充测试用户。验证码手动隐藏输入，没有读取邮箱；密码、验证码、access/refresh token 与凭据值从未保存。没有创建第三个用户。

### 13.2 九个 Edge 的实际 HTTP 结果

下表统计本次恢复进程的 70 次 Community Edge 请求，包含上述两次身份最小验证；另有 5 次正常 Auth/metadata 请求。预期业务拒绝属于通过的负向检查，不是未处理失败。所有负向业务响应均逐项断言为 `{ok:false,error:{code}}`，没有 raw SQL、Secret 或邀请码泄露。

| Edge（省略 `tokentracker-` 前缀） | 请求次数 / HTTP | 实际核对 |
| --- | --- | --- |
| `create-community` | 11；201 ×10，409 ×1 | 创建与 owner membership 同时存在；拥有 10 个时第 11 个返回 `OWNED_LIMIT` |
| `join-community` | 3；200 ×3 | 首次加入、同邀请码大小写归一化重放、退出后重新加入；重复加入 `already_member=true` |
| `leave-community` | 3；200 ×2，409 ×1 | 普通成员退出；owner 返回 `OWNER_CANNOT_LEAVE` |
| `community-detail` | 14；200 ×11，404 ×3 | 用户列表、成员详情/分页、owner 可见邀请码、普通成员不可见；非成员与删除后的资源返回 `COMMUNITY_UNAVAILABLE` |
| `community-leaderboard` | 15；200 ×15 | week/month/total 数值、零填充、排名、分页、独立 `me` 与成员过滤 |
| `create-community-transfer` | 6；201 ×3，404 ×2，409 ×1 | 仅当前 owner 可发起；单 pending 限制为 `TRANSFER_PENDING`；有效期精确为 7 天 |
| `accept-community-transfer` | 4；200 ×2，404 ×1，409 ×1 | B 接受及幂等重放；错误接收人 `TRANSFER_UNAVAILABLE`；已失效请求 `TRANSFER_NOT_PENDING` |
| `reject-community-transfer` | 2；200 ×2 | A 拒绝及幂等重放；owner 不变 |
| `delete-community` | 12；200 ×10，400 ×1，404 ×1 | owner 删除生命周期社区与 9 个配额探针；错误名称 `CONFIRMATION_REQUIRED`；非 owner `COMMUNITY_UNAVAILABLE` |

业务操作全部通过真实 JWT → 已发布 Edge → 平台服务凭据 → Community RPC 执行，没有 mock、直接 SQL 写入或代用 RPC。只读 SELECT 核对 owner/member、转让状态和删除级联，最终实际云端 Edge 代码再次与两个本地 manifest 比对一致。

### 13.3 创建、配额与私有成员关系

生命周期社区 UUID 为 `ae9f108d-aff5-453c-ad64-4de496d39e65`。创建返回 201、随机邀请码（不记录值），数据库立即只有 A 一条 owner membership。B 加入前读取该社区被 404 拒绝；加入后 membership 恰好为 A/B 两条，重放未增加关系。

为实测拥有配额，A 另外创建 9 个明确命名的小型配额探针社区。服务端返回 owned_count/joined_count=10，与数据库 owned_count=10 一致；第 11 次创建返回 409 `OWNED_LIMIT`，未创建额外对象。限值取自实际运行时配置，没有客户端覆盖。本次为串行云端边界验证，不宣称已进行并发压测。

A 的 owner 详情包含邀请码；B 的普通成员详情和社区列表均不包含 invite_code。成员分页 `limit=1,offset=1` 返回一行，而 member_count 仍为 2。

### 13.4 排行榜实际 Token 数值

没有新增或修改 Token 样本。复用 A 已有唯一 hourly 行：`2026-09-29T00:00:00Z`，total_tokens=`"130"`；B 没有 Token 数据。新加入成员的历史用量按当前成员身份计入，未复制 Token 行。

| period | UTC 区间（左闭右开） | A：Token / rank | B：Token / rank |
| --- | --- | --- | --- |
| week | `2026-09-28T00:00:00Z` → `2026-10-05T00:00:00Z` | `"130"` / 1 | `"0"` / 2 |
| month | `2026-10-01T00:00:00Z` → `2026-11-01T00:00:00Z` | `"0"` / 1 | `"0"` / 1 |
| total | `1970-01-01T00:00:00Z` → `2026-10-03T00:00:00Z` | `"130"` / 1 | `"0"` / 2 |

每种 period 的 from/to_exclusive/from_day/to_day 均按 UTC 独立计算并断言；member_count/ranked_count=2、excluded_member_count=0。本月两人同分，rank 均为 1，展示顺序为 A UUID、B UUID。排名不以 UUID 打破同分，UUID 仅稳定展示顺序。

每种 period 都验证 limit=1 的两页拼接与完整榜相同；offset=2 返回空 rows，但 B 的独立 me 仍存在、total_tokens=`"0"`，rank 与完整榜一致。所有 Token 总量均为十进制字符串，没有先转换成浮点 Number。A 退出后，三种榜都只剩 B：`"0"`、rank=1、member_count=1，A 的 130 Token 未混入非成员榜单。

真实响应为 `basis=client_reported_tokens`、`automatic_anticheat=false`，不能宣称与官方自动反作弊排行榜一致。

### 13.5 转让、拒绝与失效

| 测试请求 UUID | 流程 | 实际结果 |
| --- | --- | --- |
| `7240d7cb-0944-4890-a697-5d596dfc68ba` | A → B，B 接受 | pending → accepted；owner_id 更新为 B；A/B membership 保持两条；重复接受返回 already_accepted=true |
| `17205c48-92a5-4c3a-abf3-124353b670a9` | B → A，A 拒绝 | pending → rejected；owner 仍为 B；重复拒绝返回 already_rejected=true |
| `783006a1-8d17-4845-a6be-52ebb6b02127` | B → A，A 在 pending 期间退出 | pending → expired；A 重新加入后接受仍被 409 TRANSFER_NOT_PENDING 拒绝；owner 仍为 B |

接受前错误接收人 A 被拒绝，已有 pending 时不能再发起第二条 pending。转让后原 owner A 的 is_owner=false、邀请码不再可见且不能发起转让；B 获得 owner 权限及邀请码。没有新增 role 系统、重复 membership 或直接修改转让时间戳。

**过期覆盖边界：** 实测了 expires_at-created_at 精确为 7 天，以及收件人退出导致 pending 请求失效、失效请求不能接受。没有真实等待 7 天后调用到 HTTP 410 `TRANSFER_EXPIRED`，也没有通过 SQL 改时间伪造该路径；自然到期分支仍属于未完成的云端覆盖项。

### 13.6 删除、最终状态与 Foundation 回归

B 作为最终 owner 删除生命周期社区，members 与全部 3 条 transfer requests 级联清理，之后详情为 404。A 通过正常 owner 删除接口清理 9 个配额探针，没有直接删表或 SQL DML。

最终实际只读结果：

| 项目 | 最终状态 |
| --- | --- |
| Auth 用户 | 恰好 A/B 两个，均 email_verified=true，继续保留 |
| communities / community_members / community_transfer_requests | 0 / 0 / 0 |
| 原 tokentracker_hourly | 1 行，total_tokens=`"130"`；完整行内容 fingerprint 未变 |
| session-state / daily rollup / total rollup / 全球 snapshot | 与本次恢复 Guard 的内容 fingerprints 全部相同 |
| public function 定义与 ACL / 业务表 RLS 与 ACL | fingerprints 与本次 Guard 相同 |
| Foundation 13 Edge + Community 9 Edge | 22/22 active，云端 source hashes 与本地 manifest 和本次 Guard 全部相同 |
| Migration | 本次没有执行 migration；本次 Guard 恰好原两条，未修改发布 SQL |

回归比较的基线明确为本次恢复 Guard，而非不同历史验证时刻；未把跨轮次的 snapshot 内容未经核对地宣称始终不变。没有重新部署 Foundation 或 Community Edge，没有修改 Parser、Cost Engine、Provider integrations、数据库结构、权限、运行时配置或前端。

本轮 Foundation 回归范围为持久数据、函数/权限 fingerprints 与 13 个 Edge 的 active/source hash 保留检查，没有再次执行 Foundation Account Usage 或全球排行榜的 HTTP 数值测试；不能将源码保持一致等同于本轮重新跑过全部 Foundation HTTP 用例。

### 13.7 结论与验收边界

12 项真实云端检查全部完成，进程最终返回 `COMPLETE`：创建及原子 owner membership、非成员私有访问、拥有配额、加入幂等、邀请码隐私、三种榜数值及分页、接受转让及幂等、拒绝及幂等、owner 禁止退出及 owner-only 删除、成员退出令转让失效及榜单过滤、删除级联、最终 Foundation 回归与用户保留。

**核心 Two-User Community Runtime Closure 已达成。** 下列边界不能标为云端已验证：自然等待 7 天的 HTTP 410 分支、joined=20/member=2000 满额施压、转让接受时的拥有配额满额拒绝、配额/双转让并发竞态、超过 2^53 的真实 Token 数值、需三个以上成员才能区分的更复杂 dense-rank 序列。本地测试结果不替代本次云端证据；本次没有添加第三个账号、大批成员或修改已有 Token 数据。

本报告是该阶段的唯一持久记录；本机临时验证脚本和脱敏进度文件在进程结束后清理，凭据仅在进程内存使用。在该云端验证阶段，仅此报告有未提交修改，没有 commit、push、merge main，也尚未进入前端阶段。
