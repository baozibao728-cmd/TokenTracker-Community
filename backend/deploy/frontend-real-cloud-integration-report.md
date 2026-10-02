# Frontend Real-Cloud Integration Report

日期：2026-10-02。分支：`feature/community-leaderboard`。联调代码基线：`62fd6792f0d62472065639a7fee480153ca459be` 加 Community 前端改动；前端改动随后提交为 `8996be0`。

## 结论

**Community Frontend Real-Cloud Closure：PASS。** A/B 两个真实账号通过正常前端登录，UI → 自有 Community Edge → RPC 的创建、加入、三周期排行、转让、拒绝、退出、重入及删除流程均实际通过。针对上一轮缺失的隔离证据，又完成了一次最小 Community 创建/删除：12 张 Foundation 表的行数和稳定排序内容指纹、整体数据指纹、函数/schema/ACL 指纹均严格 pre = post；Community 三表恢复为空。Review 已接受现有 401 等价证据，不要求人为制造或等待自然 token 过期。

本轮联调期间没有提交、push、merge、部署或执行 migration；没有修改 Community 后端契约、Foundation、Parser、Cost Engine 或 Provider integrations。

## 1. 目标、身份与会话

| 检查 | 实际结果 |
| --- | --- |
| 目标项目 | `TokenTracker-Community`，`a6ae494f-4e08-40b5-8985-fd69581d0409` |
| 本地前端 Backend Base URL | `https://tc79bxhm.ap-southeast.insforge.app`，通过本地预览进程环境显式指定；没有写 `.env` |
| Auth | 现有 `/api/auth` 代理指向同一自有项目；普通 `/login` 邮箱密码流程 |
| Community | 浏览器直接请求上述自有项目的 `/functions/tokentracker-*`，没有 mock、官方项目 fallback 或业务表直连 |
| User A | `260494f3-6adf-44ba-84ec-49839aa14161`，`b***@gmail.com`，既有测试账号 |
| User B | `67250f1a-23ec-4790-b41b-4616400f760d`，`x***@gmail.com`，既有测试账号 |
| 登录 | 两人各自由用户在正常 Reset Password 页面手动完成邮件验证和临时密码设置，再从普通登录页面进入 `/communities`；刷新后会话仍有效 |
| 退出 | A/B 均通过账户设置中的“退出登录”退出；返回 `/communities` 显示登录门禁，不发 Community 业务请求 |

没有读取邮箱、保存密码、验证码、reset token、access/refresh token 或 JWT。浏览器中只使用正常用户会话；只读云端 Guard 单独使用现有本机项目 link，未作为 Edge 或浏览器用户凭据。

开始时只读 Guard 确认：仅两条既有 migration、22/22 Edge active 且云端源码与本地 manifest hash 相同、两个已验证用户、Community 三表 0/0/0、Foundation 12 张表、原 hourly 1 行且 `total_tokens="130"`。

## 2. `/communities`：配额、创建与加入

| UI 操作 | 真实结果 |
| --- | --- |
| A 初始列表 | owned `0/10`、joined `0/20`；上限 10/20/2000 来自真实 detail/list 响应，没有前端硬编码 |
| A 创建一个带长名称的测试社区 | `tokentracker-create-community` HTTP 201；owner 为 A，owner membership 自动存在；列表随即变为 owned `1/10`、joined `1/20` |
| 邀请码隐私 | 仅 A 的 owner 详情 UI 显示；没有把邀请码写入报告 |
| B 首次使用邀请码加入 | `tokentracker-join-community` HTTP 200，`already_member=false`；列表 joined `1/20` |
| B 重复加入 | HTTP 200，`already_member=true`；UI 进入既有社区，没有重复成员 |
| B 详情 | member_count=2，成员列表 A/B 各一条；看不到邀请码与 owner 删除控件 |

只创建这一处临时社区。配额上限确实来自 Edge；由于只有两名用户，本轮没有用云端样本撞满 10/20/2000 边界，配额竞争与容量仍由 Community PG15 和 Edge 测试覆盖。

## 3. `/communities/:id`：实际 API 与 UI 排行对照

A 的既有 Foundation Token 数据仅 2026-09-29 所在周有 130；B 为 0。没有上传或修改 Token 样本。以下是 B 的真实 Edge 响应与浏览器可见表格逐项核对后的值：

| 周期 | API 日期范围（UTC） | API 与 UI：A | API 与 UI：B | B 的 `me` |
| --- | --- | --- | --- | --- |
| week | 2026-09-28 至 2026-10-04 | `total_tokens="130"`、rank 1 | `"0"`、rank 2 | rank 2、`"0"` |
| month | 2026-10-01 至 2026-10-31 | `"0"`、rank 1 | `"0"`、rank 1 | rank 1、`"0"` |
| total | 1970-01-01 至 2026-10-02 | `"130"`、rank 1 | `"0"`、rank 2 | rank 2、`"0"` |

每种周期的 `member_count=2`、`ranked_count=2`，UI 行数、排名、当前用户位置与 Edge 一致。月榜零 Token 并列 dense rank 1，成员顺序以 UUID 稳定排序，A 在 B 前。后端以十进制字符串返回总量；UI 没有自行重算排名。页面显示 `basis=client_reported_tokens` 且明确未启用自动反作弊。

真实双用户榜和成员列表均显示“第 1/1 页 · 共 2 条”，前后翻页禁用；真实数据无法覆盖第二页。分页请求和超出 JavaScript 安全整数的文本渲染由本地测试覆盖，**不宣称已在这次云端双用户 UI 中实测**。排行榜读取期间可见 loading 状态。

## 4. Owner 生命周期与权限刷新

| 操作 | 真实 Edge 与 UI 结果 |
| --- | --- |
| A 发起转让给 B | `tokentracker-create-community-transfer` HTTP 201；B 看见待处理请求 |
| B 接受 | `tokentracker-accept-community-transfer` HTTP 200；B 立即成为 owner、显示邀请码和 owner 控件，不能再作为普通成员退出 |
| A 在旧详情页 | 原页面曾保留旧 owner 控件，直至重新获取详情。这是本轮发现的前端缓存问题；已在 Community 查询 hook 中加入窗口重新聚焦时刷新，新增测试确认 owner 权限和邀请码随服务端变化而撤销 |
| B 发起转让给 A，A 拒绝 | `tokentracker-reject-community-transfer` HTTP 200；请求从待处理列表移除，B 保持 owner |
| B 再发起转让给 A，A 接受 | HTTP 200；owner 恢复为 A，双方成员关系没有重复 |
| 旧页面中的 A 尝试退出 | A 已是 owner，服务端返回 HTTP 409 `OWNER_CANNOT_LEAVE`；确认弹窗展示可理解的说明，不泄露 SQL 或内部诊断 |
| 普通成员 B 退出、再加入 | `tokentracker-leave-community` HTTP 200；B 列表立即为 0/20，随后原邀请码重新加入 HTTP 200、`already_member=false` |
| 非 owner 删除 | B 页面没有删除入口；owner 权限只取自后端响应，未依赖客户端输入的 user_id |
| A 删除 | 使用精确 `confirmation_name` 经过确认弹窗，`tokentracker-delete-community` HTTP 200；A 导航回空列表 |

删除前只读检查是 1 个社区、2 条成员关系、3 条转让记录。删除后 B 的旧详情页刷新得到 HTTP 404 `COMMUNITY_UNAVAILABLE`，UI 显示“社区不存在或你没有访问权限”；B 的列表亦显示 0/20。没有删除 A/B 用户和原有 Token 数据。

## 5. 响应式与异常状态

- 桌面宽度下两个列表、详情、表格和确认流程可用。390×844 手机宽度下，长社区名换行，文档宽度为 390、没有全页横向溢出；排行榜表格在卡片内部横向滚动。成员列表、转让确认和按名称删除的弹窗均在视口内。测试后恢复桌面视口。
- 404：真实不存在/已删除社区返回 `COMMUNITY_UNAVAILABLE`，页面显示安全的用户提示及重试入口。
- 409：真实 owner 退出被服务端拒绝，弹窗显示具体可理解的限制。
- 网络失败：仅在 B 的测试标签页临时断网；UI 显示通用错误和重试，恢复网络后重试回到 2 条成员，没有暴露原始网络或数据库诊断。
- 401：A/B 登出后社区页显示登录门禁；真实自有 Community Edge 的无 JWT GET 返回 HTTP 401。本地组件测试还确认已登录视图收到 Edge 401 时显示登录提示和 `/login` 链接。**真实自然 session expiry 本身未单独复现。Review 接受真实 login/logout/session-refresh、真实无 JWT Edge 401 与已登录页面 401 UI 单测作为等价证据**，不要求额外等待或注入过期 JWT。
- 两人登录后刷新页面均保留正常用户会话；登录/登出使用现有 Auth UI，没有新增 OTP 功能、注入 JWT 或管理员冒充。

测试浏览器的翻译扩展曾改写 A 标签页的可见文字；关键 API 数值和权限以未被改写的 B 页面、真实 Edge 响应及后端状态核对。

## 6. 清理后云端只读核对

| 对象 | 最终结果 |
| --- | --- |
| `communities` / `community_members` / `community_transfer_requests` | `0 / 0 / 0` |
| Auth | A/B 两个已验证账号保留 |
| `tokentracker_hourly` | 仍 1 行，`total_tokens="130"` |
| Migration history | 仍仅 `20260930000000 tokentracker-mvp-bootstrap` 与 `20261001000000 community-leaderboard-v1` |
| Edge | 22/22 active；每个云端源码 hash 仍等于本地各自 manifest entry hash |
| Foundation schema | 12 张表；结束时重新读取函数与表权限指纹，没有 migration 或 Foundation 源码修改 |

上一轮的前置快照曾因导入临时 helper 时触发 CLI 主入口而被覆盖。因此本轮重新建立**唯一文件名、只读、不可覆盖**的 pre 快照；采集脚本独立执行，不导入带 CLI main 的 helper。pre 文件一直保留到 post 比较完成。没有重跑 Two-User 生命周期，也没有补写或伪造 Foundation 数据。

### 6.1 最小 Community Isolation Evidence Closure

pre：`2026-10-02T10:09:24.630Z`；post：`2026-10-02T10:24:25.457Z`。两次均先核对同一个自有项目 ID 和 Base URL。A 在正常浏览器用户会话中通过 `/communities` 创建一次性社区；创建后只读核对 Community 为 1、member 为 1、transfer 为 0。随后 A 通过 owner 详情页输入精确社区名称、确认删除，列表恢复 owned `0/10`、joined `0/20`。全过程仅写入并清理 Community 数据，没有 B 加入、Token 写入、转让或配额测试。

每张 Foundation 表使用 `count(*)` 和对完整行 `to_jsonb(t)` 按 JSONB 文本稳定排序后的内容 MD5。下表 hash 在 pre/post **完全相同**；只记录行数和 hash，不记录业务行内容：

| Foundation 表 | pre/post 行数 | pre = post 内容 hash |
| --- | ---: | --- |
| `tokentracker_account_session_states` | 1 | `981b67c7abe984b8f54adeb1f500ba62` |
| `tokentracker_account_usage_cache` | 8 | `dd0b3b390c7f8445d3d9511528d9570a` |
| `tokentracker_device_machine` | 0 | `d751713988987e9331980363e24189ce` |
| `tokentracker_device_tokens` | 2 | `a44d7a17c8a78e295d9fd6a471a57b50` |
| `tokentracker_devices` | 1 | `5d193eed1d1736d669e24fa464eb2e8b` |
| `tokentracker_hourly` | 1 | `8e550db203b1b17c5ef7b4a4ecfdb973` |
| `tokentracker_leaderboard_refresh_state` | 3 | `7fc8ba97445cede960ca4574afad58ad` |
| `tokentracker_leaderboard_rollup_daily_v2` | 1 | `d193512c5a311552218b395bf9756e20` |
| `tokentracker_leaderboard_rollup_meta_v2` | 1 | `eaabf39ccbb42ff7377dd78e95174c35` |
| `tokentracker_leaderboard_rollup_total_v2` | 1 | `cc9008f79fbbd5dd772552fdedfcfb4e` |
| `tokentracker_leaderboard_snapshots` | 3 | `93e921bf90339477d36080e2d7ff134b` |
| `tokentracker_user_settings` | 1 | `16ac67354d09c4981f6d69f725902841` |

按表名、行数、表内容 hash 构造的整体 Foundation 数据 SHA-256：pre = post = `da603823a70f756b5516ecc0884fbbc931fcfe2839d9b594c88cda7e730d8856`。public catalog 的函数定义及 `proacl`、表/视图所有权与 RLS/ACL、列、约束、索引、触发器、视图定义均按稳定对象键排序比较；该范围包含全部 Foundation 对象及 Community 对象，属于更严格的整体结构对照。结构整体 SHA-256：pre = post = `0550ea76887c1cb49e491efb7c7daf74eed7a63dc83b060321d82b459e5fca02`；其中函数类别 MD5：pre = post = `446a690c3a33203bba16b4222ba6c770`，关系/RLS/ACL 类别 MD5：pre = post = `f42b394d5311410b3754164eca6648e1`。列、约束、索引、触发器和视图类别也逐项相同。对照结果：**12/12 表内容与行数相同，整体数据、结构/权限及全部 Guard 字段相同，差异 0**。

post 还确认 Community 三表 `0/0/0`，Auth 仍仅 A/B 两个已验证用户，hourly 仍 1 行且 `total_tokens="130"`；migration history 恰好保留原两条，22/22 Edge active，云端源码 hash 与本地 manifest 和 pre 快照完全相同。

## 7. 本地最终门禁

| 门禁 | 结果 |
| --- | --- |
| 原 Community 前端测试范围及新增的 owner 刷新、401 用例 | 5 个测试文件，50/50 PASS |
| Dashboard TypeScript type check | PASS |
| Dashboard production build | PASS；只生成本地构建产物，未部署 |
| copy registry / zh / zh-TW | PASS；两种中文译文各 1729/1729；仍有既有 unused-key 提示 |
| UI hardcode / architecture guardrails | PASS；架构单测 4/4 |
| Community verify | PASS：PG15 32 项、Edge Runtime 22 项、9/9 DB contracts、entry/hash/type/config |
| Foundation verify | PASS：PG17/PG15 空库、13/13 contracts、Edge Runtime 和发布 migration |
| pricing parity | 16/16 PASS |
| Secret/path scan 与 `git diff --check` | PASS；扫描 91 个 backend 产物及 17 个修改/未跟踪文件，未发现凭据值、JWT、本机绝对路径或尾随空格；`git diff --check` exit 0 |

构建有既有 SDK `crypto` external、chunk size、静态/动态 import 提示；构建本身成功，未借此修改 Foundation。

全球排行榜以下两个既有 `LeaderboardPage.test.jsx` 失败已在 clean HEAD 单独复现，本轮不修复，也不算作 Community 测试通过：

1. `does not show old context data after period changes, but reuses matching cached context when returning`：timeout。
2. `clears the visible rows instead of rendering stale data when switching to an uncached context`：找不到 `Preloaded User`。

## 8. Commit / push / merge review 前状态

**没有 Community Frontend Real-Cloud Closure 的剩余阻塞项。** Review 接受第 5 节的 401 等价证据；第 6.1 节补足了严格 Foundation 前后隔离证据。真实自然 session expiry 未单独复现，也不据此宣称已复现。全球排行榜两项 clean HEAD 基线失败继续单独记录，不归因于本功能，未为它们修改代码。

联调结束时尚未 commit、push、merge 或正式部署；保留两个 Auth 测试用户和原 130 Token Foundation 数据。后续 Git review 已单独检查前端改动，并提交为 `8996be0`；本报告本身随文档提交保存，不代表已 merge 或正式部署。
