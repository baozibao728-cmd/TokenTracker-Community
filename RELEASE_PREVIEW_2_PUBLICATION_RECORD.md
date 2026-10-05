# TokenTracker Community — v1.2.0-preview.2 实际发布记录

**preview.2 公开交付 PASS**；稳定版仍 **NOT_READY**。这是手动下载的三平台技术预览，包内版本仍为 `1.2.0`。

## 1. 实际公开与不可变来源

- [公开 Release](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.2)；同一 Release ID：`403529694`。
- GitHub 实际发布时间：`2026-10-05T09:23:03Z`（UTC），台北时间 **2026-10-05 17:23:03 UTC+08:00**。
- 本轮只 PATCH 原草稿：`draft=false`、`prerelease=true`、`make_latest="false"`（字符串）；未创建第二个 Release、替换资产或移动 tag。
- Annotated tag：`v1.2.0-preview.2`；tag object `a8a41e43002f572cc72cf9f3b60f50e91fef278d`；本地/远端 peeled、manifest source/checkout 都为 `6321b24e0c46699db2695995491fea5bae97b359`。
- 包内版本：`1.2.0`；原 artifact `11311863214`。没有重建、重签名、重压或重新生成 metadata。
- 发布前准备文档的审定 HEAD：`7bdc569d4407d8ec776b640185aab4b1880d9bc7`；当时的文档 merge/main SHA：`39f299e4c8866e9d20e45c374a8e299b7a2d22a6`；[发布前 main CI 4/4 PASS](https://github.com/baozibao728-cmd/TokenTracker-Community/actions/runs/37285841336) 复用既有结果。这是公开发布前的历史证据，不是本记录后续入库的 commit/merge 或 CI。

## 2. 公开前 Guard

- 重新读取同一草稿；Release ID/tag/target、公告正文及八个 asset ID、名称、大小、服务端摘要均与已审定草稿回核记录一致。
- 原 manifest source/checkout/version 及两份元数据自身摘要核对通过；包源码是 main 祖先，源码至 main 仅有已审定的三份文档差异。
- 公告未修改。SHA-256：`4e71b268fd9430bdf4b0c961bb93b44e7550eb00f10ae1927181bc812be0366b`。发布方案及验收记录使用固定文档 merge SHA 的 GitHub blob 绝对链接。

## 3. 无认证页面与八文件交付验收

- 使用独立无认证 HTTP 请求：不带 Authorization 或 Cookie，不读取浏览器会话；下载的公开重定向地址仅留在进程内存。
- 指定 tag 页面 HTTP **200**，Pre-release 标记、公告全部 39 个有效行、公开 API 完整正文和八个资产下载入口核对通过。
- 公告两条文档链接匿名 HTTP **200**：
  - [RELEASE_PREVIEW_2_PLAN.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/39f299e4c8866e9d20e45c374a8e299b7a2d22a6/RELEASE_PREVIEW_2_PLAN.md)。
  - [windows-combined-rc-acceptance.md](https://github.com/baozibao728-cmd/TokenTracker-Community/blob/39f299e4c8866e9d20e45c374a8e299b7a2d22a6/docs/windows-combined-rc-acceptance.md)。

八文件从公开 Release 下载到新的独立目录，逐一比对名称/大小/SHA-256；不是使用本机原件或服务器摘要代替下载回核：

| 原上传资产 | Asset ID | Bytes | SHA-256 | 匿名下载回核 |
|---|---:|---:|---|---|
| `TokenTracker-Community-win-x64.zip` | 612028923 | 114910002 | `576e5d72f69c2d031bc2f59c6b91b35784fa2661cc9d5be10622f3bffd502703` | HTTP 200 / PASS |
| `TokenTracker-Community-Setup.exe` | 612030819 | 80754105 | `e2996f510dfc6c8d4fee9bd57f5b24d2e68a55d40de2a264b4ddbdb056b1958b` | HTTP 200 / PASS |
| `TokenTrackerCommunity.dmg` | 612032332 | 61953630 | `c0d73971b7f4a640b2a052b59c52514b9e34e85e7db8547c95d10f1beaf7eb4e` | HTTP 200 / PASS |
| `TokenTracker-Community-linux-x86_64.AppImage` | 612033584 | 127502840 | `dcac2b0898266a7a74fd24bb1b0c756c2ca3dbf57165cbdca2c669f9eee3aa89` | HTTP 200 / PASS |
| `TokenTracker-Community-linux-x86_64.deb` | 612036050 | 57011188 | `f0b72ac0fb0ccebcf2fbfbb2fe1e93c962df90b37c0f4028148a8a49346942c6` | HTTP 200 / PASS |
| `TokenTracker-Community-linux-x86_64.rpm` | 612037135 | 56992428 | `9c6e5c847b6cae2e052df87aabf257e279da90d2baaf22363eff951d093c0205` | HTTP 200 / PASS |
| `SHA256SUMS` | 612038069 | 615 | `04c74fed3cc2453c60b8edb9a9e288000fb6a91573883aec9cac522dfb4392ee` | HTTP 200 / PASS |
| `RC_MANIFEST.json` | 612038256 | 1598 | `29e42ff60c9a9ef3c9e2808f7aaeba8387fb491b0d464aaf3c5ae8120c7d348f` | HTTP 200 / PASS |

- `RC_MANIFEST.json` source/checkout=`6321b24e0c46699db2695995491fea5bae97b359`、version=`1.2.0`；六包实际摘要与原 `SHA256SUMS` 一致。
- 原 `SHA256SUMS`（615 bytes）与 `RC_MANIFEST.json`（1598 bytes）自身摘要也分别通过；没有改写元数据。
- GitHub 自动生成的源码 ZIP/TAR **另计**，不是这八个上传资产，未作为安装包交付或安装验证。

### 验收器修正与重试

- 公开前检查最初把 GitHub 草稿的 `untagged-*` 下载路径当作差异；按原草稿实际路径核对后通过，审定的 asset ID、名称、大小和摘要没有变化。
- 公开页面下载入口使用相对链接，最初的绝对字符串检查未通过；按页面地址解析后，八个入口与公开 API 一致。
- 八文件实际无认证下载均为 HTTP 200，大小和摘要通过；随后验收器错误要求网页 latest 直接返回 404，导致该次汇总未完成。读取实际跳转后修正判据，再对同一独立下载目录的八文件重新计算摘要并完成最终检查，没有重复下载或修改交付物。
- 这些失败属于验证工具的路径/响应格式假设，历史输出保留；没有为取得 PASS 修改公告、tag、资产或产品。最终页面检查覆盖公告全部 39 个有效行。

## 4. latest 与首次预览保护

- 无认证 Releases latest API HTTP **404**，没有稳定 Release；网页 `/releases/latest` HTTP **302**，跳转到发行列表后 HTTP **200**。最终目标为 `https://github.com/baozibao728-cmd/TokenTracker-Community/releases`，未跳转或选中 preview.2 tag。API 404 与网页跳转是不同结果，均已按实际响应记录。
- preview.1 的同一 Release ID `402619253`、tag/peeled `0a143a05b975854365294201d9f690f6f70c0059`、公告及八资产 IDs/名称/大小/摘要 before/post 一致，未修改或替换。
- 十个继承 workflow 仍 `disabled_manually`；两个发布 workflow 未 dispatch，本轮没有新增继承发布/运营/npm/Homebrew工作流运行。
- 本轮只发布原草稿并读取 GitHub；不修改产品、版本、云端、migration、Edge、凭据或工作流开关，不重复实机验收或开始新功能。

## 5. 验证限制保持

- Windows 未签名；macOS 仅 ad-hoc，非 Developer ID/notarization；macOS/Linux **GUI/RUNTIME NOT_TESTED**。BUILD/PACKAGE 或 Windows 结果不替代其他平台实机验收。
- 真实 WSL、完整更高版本自动下载/安装/重启升级链 **NOT_TESTED**；Linux 没有应用内 updater。同版本覆盖安装、手动下载与匿名交付不构成自动升级证据。
- 旧 metadata 迁移限制、Codex 配置差异未归因、既有 Dashboard/扫描基线失败、Grok slash 断言及 macOS notify 不稳定性继续保留。
- 部分旧 metadata 仅保存全局目录指纹，无法判定消失目录所属根。已经缩小扫描范围时，应先恢复原范围完成一次扫描、建立分根记录，再移除额外根；不能删除旧清单或强制部分刷新来绕过历史保护。旧重叠 WSL 来源标记还需一次成功 WSL 发现建立，不能从旧 explicit 标签推断。
- 活动 Codex 配置整文件指纹存在差异，变更键名、hook/notify 和写入者无法可靠归因；不据此宣称 Community 改写配置，也不声称已排除所有写入者。
- 完整 Dashboard suite 的 `period changes cache timeout`、`Preloaded User missing` 两个既有基线失败及扫描/Windows 路径/fixture 基线失败继续保留，普通 CI 必要检查 PASS 不等于完整测试全绿。
- 真实完整离线及原生历史快捷键逐步恢复不计全部 PASS；初次未缓存读取仍可能等待，短时缓存不代表后端变快，不是全社区预读或私有数据持久离线缓存。
- 本地登出持久性 PASS 不等于云端会话撤销已验证；上游 logout 403 的实际状态和响应语义保持。
- 扫描/统一榜单原生证据仍归属旧组合候选；本包只复用未改代码的已验结果及其已完成的 Windows 登出持久性实机验收，不伪造本轮重跑。
- 排名基于 `client_reported_tokens`，automatic anticheat 未启用。包内仍 1.2.0，不宣称 preview tag 是更高应用版本或完整自动更新已通过。

## 6. 发布操作结束时的记录与状态

- 初次公开参数、实际发布时刻、八个资产 ID 与匿名实际字节回核结果已记录；公开前草稿报告保留，第一次发布历史未覆盖。
- 上一轮发布操作结束时，本记录是当轮唯一新增仓库文档，尚未 commit/push；产品源码与 main 引用未变。原公告正文、前/后只读状态和匿名验证 JSON 保留在本机安全证据目录。
- 当时发布记录的凭据/本机绝对路径扫描、新文件行尾空白检查及 `git diff --check` 通过，工作区只有本记录未跟踪；发布操作当轮未提交或 push。
- 后续发布记录入库的文档 commit、PR、合并及 CI 结果记录在对应 PR 收尾摘要，不在本文循环追加自身 SHA；不改变上面的发布源码、时间或资产归属。
- **发布操作结束时的结论：preview.2 公开交付 PASS；稳定版仍 NOT_READY。**
