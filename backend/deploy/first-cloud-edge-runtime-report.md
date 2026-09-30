# First Cloud Edge Runtime Report

**状态：13 个 MVP Edge 部署、标准 Auth、Device Token、ingest 重放、7 个 Account Usage 与 week/month/total 排行榜的真实云端闭环均已通过。**

本报告仅记录实测结果，不将部署成功视为完整 MVP 闭环成功。测试日期：2026-09-30。

## 1. 目标与部署前 Guard

- Project：TokenTracker-Community
- Project ID：`a6ae494f-4e08-40b5-8985-fd69581d0409`
- Base URL：https://tc79bxhm.ap-southeast.insforge.app
- migration history 仍仅有 `20260930000000_tokentracker-mvp-bootstrap`。
- 云端数据库依赖 13/13 通过；manifest entry/upstream hash 和 13 个发布 source hash 均匹配。
- 统一 resolver 保留 `INSFORGE_SERVICE_ROLE_KEY → API_KEY`，不使用 ANON_KEY 作为管理凭据。
- 未修改数据库 schema、平台 Auth 配置、Secret、Parser、Cost Engine、Provider integrations 或 upstream Edge。

## 2. 13 个 Edge 的实际部署结果

实际文件均来自 `backend/edge/manifest.json`，没有部署 `dashboard/edge-patches/`。平台共享 Runtime URL：`https://tc79bxhm.function2.insforge.app`。调用路由使用自有 base URL 的 `/functions/<function-name>`。

| Function name | Entry | Deployment ID | 部署/构建 | 状态/启动 | 调用 route |
| --- | --- | --- | --- | --- | --- |
| tokentracker-device-token-issue | backend/edge/tokentracker-device-token-issue.ts | jv16ft3d94yg | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-device-token-issue) |
| tokentracker-ingest | backend/edge/tokentracker-ingest.ts | 2vvnkcmgv2rp | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-ingest) |
| tokentracker-account-summary | backend/edge/tokentracker-account-summary.ts | rg2t6m4ar9r9 | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-summary) |
| tokentracker-account-daily | backend/edge/tokentracker-account-daily.ts | 7vra5a0gcqgg | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-daily) |
| tokentracker-account-hourly | backend/edge/tokentracker-account-hourly.ts | 37qgq9y598vx | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-hourly) |
| tokentracker-account-monthly | backend/edge/tokentracker-account-monthly.ts | trathxj7ybrh | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-monthly) |
| tokentracker-account-heatmap | backend/edge/tokentracker-account-heatmap.ts | rj3gjez4wze5 | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-heatmap) |
| tokentracker-account-model-breakdown | backend/edge/tokentracker-account-model-breakdown.ts | 2e831mppaz3q | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-model-breakdown) |
| tokentracker-account-devices | backend/edge/tokentracker-account-devices.ts | 5rz5wekm347w | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-account-devices) |
| tokentracker-public-visibility | backend/edge/tokentracker-public-visibility.ts | 6sqkgfqq8pfs | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-public-visibility) |
| tokentracker-leaderboard-refresh | backend/edge/tokentracker-leaderboard-refresh.ts | eqzhcg604wtp | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-leaderboard-refresh) |
| tokentracker-leaderboard | backend/edge/tokentracker-leaderboard.ts | gdfy7wq3zjnx | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-leaderboard) |
| tokentracker-leaderboard-profile | backend/edge/tokentracker-leaderboard-profile.ts | 4cjmkrp3vwz8 | success | active / OPTIONS 204 | [route](https://tc79bxhm.ap-southeast.insforge.app/functions/tokentracker-leaderboard-profile) |

所有 13 个部署响应均为 success，deployment.status 为 success；随后函数列表 13/13 为 active。逐个 OPTIONS 检查均为 204。构建与运行日志的只读检查未发现 error/failed/exception；日志结论仅覆盖原部署查询窗口；后续真实用户路径的结果见下文。

## 3. Secret 注入与无用户 Runtime Smoke

平台 active Secret 名称包括 API_KEY、ANON_KEY、INSFORGE_BASE_URL、JWT_PUBLIC_KEY，以及平台自身的 JWT 签名配置。名称只用于确认存在；没有修改 Secret，也没有将任何 Secret 值写入源码、Git、报告、日志文件或 .env。

Edge 管理凭据 resolver 仍为 INSFORGE_SERVICE_ROLE_KEY → API_KEY。云端未配置前者，本次实际使用平台 Runtime 注入的 API_KEY。真实 ingest、Account Usage、刷新和公开榜单数据库访问均成功，未出现 Secret/import/SDK 错误。没有用 CLI user-api-key 充当 Edge 服务凭据。

标准 Auth 请求另按 SDK 契约携带项目公开 ANON_KEY，仅在验证进程内存中使用；它没有作为数据库管理或刷新凭据。刷新使用自有项目 API_KEY，按现有受保护刷新契约执行。

部署时的无用户 Smoke 共 43 项通过：13 次 OPTIONS 204；11 个受保护入口分别缺少 JWT/无效 JWT，22 次 401；3 个未支持能力 501；不存在 profile 404；三周期空榜单 200；Auth 和 12 张业务表零数据检查。该零数据状态是注册前的历史验收状态，最终数据见第 10 节。

未支持能力明确为 badges、likes/share、automatic anticheat、Quarantine、Telemetry、Community 和 Subscription Value。anomalies=1、quarantine_audit=1、view=badges 返回 501 unsupported_capability。

## 4. 标准 Auth 与真实 JWT

标准注册邮箱为 b***@gmail.com。只创建一个测试账号，通过正常邮箱验证接口验证；没有关闭邮箱验证，没有管理端直接创建或确认用户，没有自行签造 JWT。

- 测试用户 UUID：260494f3-6adf-44ba-84ec-49839aa14161。
- auth.users 最终为 1 行，email_verified=true。
- 平台 access credential 的实际算法为 RS256；claims.sub 与数据库用户 UUID 一致。
- 有效用户凭据成功调用 Device Token、7 个用量接口和 public-visibility，证明实际 Edge RS256 验签和用户关联通过。
- 本地结果文件占用导致首次验证进程退出后，使用平台正常的邮箱 OTP 登录同一已验证账号。send-otp 返回 202，随后 method=otp 的标准 sessions 请求成功；没有注册第二个用户。
- 验证码由用户在可见终端手动输入，隐藏回显；未读取邮箱。验证码、随机注册密码、JWT、access/refresh credential 和 opaque device token 仅在进程内存中使用，进程结束后未保留。

平台公开 Auth 配置仍为 disableSignup=false、requireEmailVerification=true、verifyEmailMethod=code、passwordMinLength=6。未修改或使用 GitHub/Google OAuth 配置。

## 5. Auth profile / metadata / email 实际结构

本次用户数据库 JSON 结构实测：profile={name: string}，name 与 TokenTracker MVP Runtime Test 标记一致；metadata={}。profile 中没有 avatar 或 email 键，metadata 也没有 name/avatar/email 键。邮箱位于 auth.users.email 顶层，本报告仅记录脱敏邮箱。

数据库允许 profile/metadata 为 NULL 的既有平台契约仍保留。本次非 NULL 对象不能代替所有登录方式、特别是 OAuth 的字段结构验证。

## 6. Device Token 签发

两次真实用户 JWT 签发都成功，相同 machine_id 复用同一个设备：a6712634-fb66-4438-a1b0-91a3c5536c01。

- devices=1，device_tokens=2；两条 Token 都关联同一用户和设备。
- opaque token 为 64 字符；数据库仅存 SHA-256 hash，首次 Token 的本地计算 hash 与数据库匹配。没有存储明文。
- 设备和两条 Token 的 revoked_at 均为 NULL。
- 重复签发会新增一条有效 Token，并不自动撤销上一条。这是现有实现的行为，本次没有增加第三条 Token。

## 7. 首次 ingest 与完全相同请求重放

仅一个 source、model、时间桶，原始 hourly 和 account canonical session 描述同一份使用量：

| 字段 | 实测值 |
| --- | --- |
| source / model | trae-cn / gpt-5 |
| hour_start / bucket_start | 2026-09-29T00:00:00.000Z |
| session_id | mvp-runtime-20260930 |
| input_tokens | 100 |
| output_tokens | 20 |
| cached_input_tokens | 10 |
| cache_creation_input_tokens | 0 |
| reasoning_output_tokens | 5 |
| total_tokens / billable_total_tokens | 130 / 130 |
| conversation_count | 1 |
| total_cost_usd | 0.00037625 |

首传与完全相同请求重放均 HTTP 200，响应 ok=true、inserted=1、skipped=0。inserted 表示本次提交的 upsert 数量，不能据此认定新增了一行。

两次请求后 hourly 都只有一行、SUM(total_tokens)=130，session state 也只有一行；相同 snapshot_verified_at 下整条 state 包括 updated_at 保持不变。用户、设备、source、model、时间桶及六个 Token 字段均逐项核对。成本与未修改的本地 Pricing Engine 对同一明细的计算一致。

**样本局限：构造 fixture 时声明 total_tokens=130，但五类明细数值加和为 135。现有 ingest 按客户端 total_tokens 保存，成本另按明细计算。本次证明这六个字段分别原样落库、重放与聚合一致，没有证明客户端总量与明细的归一化一致性，也没有验证 Parser 的真实输出。此不一致如实保留，未为了通过检查修改数据库或弱化断言。**

## 8. 七个 Account Usage API 的实际结果

查询时区为 UTC；日期参数 from=to=day=2026-09-29。heatmap 额外指定 compact、weeks=1。所有接口都使用真实用户 JWT。

| API | HTTP | 实际响应与数值核对 |
| --- | --- | --- |
| account-summary | 200 | total=130；六字段匹配；billable=130；conversation=1；cost 字符串 0.000376；7/30 天 active_days=1 |
| account-daily | 200 | 2026-09-29 一行；total=130；六字段匹配；cost=0.00037625；gpt-5=130 |
| account-hourly | 200 | 2026-09-29T00:00:00 一行；total=130；六字段匹配；gpt-5=130 |
| account-monthly | 200 | 2026-09 一行；total=130；六字段匹配；gpt-5=130 |
| account-heatmap | 200 | active_days=1、max_value=130；唯一非零日期 2026-09-29，130；日期窗口 09-23 至 09-29 |
| account-model-breakdown | 200 | 唯一 source=trae-cn、model=gpt-5；total=130；六字段匹配；cost 字符串 0.000376 |
| account-devices | 200 | 一个设备，设备 total=0；account_sources=[{source:trae-cn,total_tokens:130}] |

trae-cn 属于账号级来源，devices 按现有规则从单设备总量中排除，另列 account_sources；不是数据丢失。其 canonical session 与 hourly 同时存在时，账号聚合与榜单仍为 130，未双算成 260。

实际 model-breakdown 对同日起止返回 days=0，而 summary 返回 days=1；Token 与成本正确，但日期展示字段存在既有差异，本阶段没有修改 upstream 业务逻辑。

## 9. week / month / total Leaderboard

先通过真实用户调用 public-visibility，enabled=true、anonymous=false、display_name=MVP Runtime Test 20260930；随后使用有权限的刷新流程依次刷新三周期。每周期 refresh.results[period].upserted=1。list、本人 profile、公开 profile 都实际成功。

| Period | list from / to（UTC） | HTTP / entries | total_tokens / rank | generated_at |
| --- | --- | --- | --- | --- |
| week | 2026-09-28 / 2026-10-04 | 200 / 1 | 130 / 1 | 2026-09-30T08:57:55.383+00:00 |
| month | 2026-09-01 / 2026-09-30 | 200 / 1 | 130 / 1 | 2026-09-30T08:58:03.049+00:00 |
| total | 1970-01-01 / 2026-09-30 | 200 / 1 | 130 / 1 | 2026-09-30T08:58:11.508+00:00 |

三条数据库 snapshot 的用户 UUID、周期、日期、rank=1、total_tokens=130、generated_at 与响应一致。

- closed-day daily rollup=1 行，日期 2026-09-29，六字段与样本匹配；total rollup=1 行，六字段同样匹配，total_tokens=130。
- list/snapshot estimated_cost_usd=0；原因是沿用现有两位小数 rounding，0.00037625 四舍五入为 0。
- 本人和公开 profile totals.estimated_cost_usd 均为 0.00037625，total_tokens 均为 130。
- total list 使用最新 lifetime snapshot，from=1970-01-01；无 snapshot 时原空榜单 fallback 是 2024-01-01。本次没有改动这个行为。
- total profile 的统计范围仍为最近 365 天，即 2025-10-01 至 2026-09-30，不能将它描述为与 lifetime list 永远同范围。本样本位于两个范围内，数字一致。
- trae-cn 在基础排行榜 provider 分类中归入 other_tokens=130。本次没有新增 Provider 分类榜。

实际响应 ranking_policy.basis=client_reported_tokens，automatic_exclusion=false、manual_blocklist_configured=false；capabilities.automatic_anticheat=false。没有自动异常排除或 Quarantine，不能宣称等同官方反作弊榜。

## 10. 最终数据库测试记录与保留策略

实测完成后又执行了一次独立只读核对，Auth、hourly 六字段与成本、daily/total rollup、三份 snapshot 和全部表行数均与完成记录一致。最终核对时间：2026-09-30T09:05:18.711Z。

| 对象 | 行数 |
| --- | ---: |
| auth.users | 1 |
| public.tokentracker_devices | 1 |
| public.tokentracker_device_tokens | 2 |
| public.tokentracker_hourly | 1 |
| public.tokentracker_device_machine | 0 |
| public.tokentracker_account_session_states | 1 |
| public.tokentracker_account_usage_cache | 8 |
| public.tokentracker_user_settings | 1 |
| public.tokentracker_leaderboard_snapshots | 3 |
| public.tokentracker_leaderboard_refresh_state | 3 |
| public.tokentracker_leaderboard_rollup_daily_v2 | 1 |
| public.tokentracker_leaderboard_rollup_meta_v2 | 1 |
| public.tokentracker_leaderboard_rollup_total_v2 | 1 |

账号、一个小规模时间桶、一个 canonical session 和三份排行榜 snapshot 均保留，供后续复验。cache、settings、refresh state、rollup/meta 是这些正常接口产生的配套记录，并非额外用户或大量测试数据。tokentracker_user_profiles 是 View，不列为业务表。

未删除测试用户或数据，没有第二个用户，没有 Community 表、记录或函数。

## 11. 本地测试与真实云端差异及本次中断

1. 本地 fixture/内存签名不能代替平台 Auth。本次完成真实注册、用户手动邮箱验证，以及同一账号 OTP 登录；真实 RS256 凭据通过受保护 Edge。
2. 标准 Auth 注册未携带项目公开 credential 时曾返回 401 AUTH_INVALID_CREDENTIALS；只读确认用户数为 0 后按 SDK 请求头契约修正，正常注册成功。未将 ANON_KEY 作为 server credential。
3. 首次隐藏输入程序没有完整接收输入，平台验证返回 400 INVALID_INPUT。修复粘贴和六位长度检查后，原账号邮箱验证通过；没有重复注册。
4. 本地脱敏结果文件遇到 EBUSY，脚本在 ingest 重放通过后退出。改为原子写入和有界重试，再正常登录原账号，从 Account Usage 恢复。未重做 ingest 或创建额外设备 Token。
5. 若干只读请求遇到网络重置，临时检查增加有限重试；注册、OTP 提交与 ingest 没有网络自动重试。
6. 真实金额精度、账号来源设备分组、total profile 的 365 天范围、model-breakdown days=0 及 fixture 总量/明细差异均已记录。没有以 HTTP 200 替代这些具体数值核对。

## 12. 是否达到自有 MVP 完整闭环

**已达到本阶段基础运行闭环：标准 Auth → Device Token → ingest → 完全相同请求重放 → 7 个 Account Usage → week/month/total refresh/rollup/snapshot/list/profile。**

18 项有用户检查全部通过，另有原部署阶段 43 项无用户 Smoke；独立最终只读复核通过。此结论限于一个测试用户、一个账号级来源、一个 model、一个已结束 UTC 日的最小样本。不是全部 Provider、跨用户权限、时区边界、Parser 或自动反作弊的完整验收。正常解析数据的字段一致性仍需使用合法 fixture 单独复验，见第 7 节。

## 13. Community 开发前的状态

当前未发现 Auth/Edge 构建、服务凭据或数据库契约的基础运行阻塞，具备继续规划 Community 的后端基础。本阶段按要求停止，未创建 Community。

已知限制保持可见：榜单依据客户端声明总量；没有自动反作弊、Quarantine 或配置好的人工 blocklist；total profile 与 lifetime list 范围不同；model-breakdown 的同日 days 字段不同；本次 fixture 总量与明细不一致。后续数值验收应补一个归一化一致的合法样本，不应将当前样本当成该项证明。本阶段不扩展部署或修改稳定核心模块来处理这些差异。

## 14. 执行边界与 Git

当前分支 chore/backend-bootstrap；HEAD 仍为 f8696488c6e193df3e28c2881800c1e730c2bc58。本次只更新既有 backend/deploy/first-cloud-edge-runtime-report.md，没有另建重复报告，没有提交或 push，没有 merge main。

未修改 Parser、Cost Engine、Provider integrations、upstream Edge、Bootstrap migration、平台 Secret 或 OAuth 配置。没有操作官方 TokenTracker 后端，也没有扩展 13 个 manifest 部署入口的范围。临时输入/网络 Guard/脱敏验证材料在报告检查后清理，不进入 Git。
