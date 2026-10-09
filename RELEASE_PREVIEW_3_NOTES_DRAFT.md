# TokenOrbit 1.2.0 — 三平台技术预览 3（公告草稿）

> 本文件为准备材料，尚未执行 `v1.2.0-preview.3` 发布。包内版本仍是 `1.2.0`，这是手动下载技术预览。发布时删除“公告草稿”和本提示，将拟用下载说明改为实际说明；文档链接使用审定文档 merge SHA 的绝对链接，保留全部验证限制。参数、原八文件摘要及待授权步骤见 [发布方案](RELEASE_PREVIEW_3_PLAN.md)。

**TokenTracker Community 的对外产品名现在是 TokenOrbit。** TokenOrbit 是基于 MIT 开源项目 [TokenTracker](https://github.com/xiufengsun/TokenTracker) 的独立衍生项目，提供本地 AI Token 用量查看与私有社区排行。这次三平台技术预览更新品牌名称和图标，保留 Community 既有功能与兼容身份；Windows 本候选定向覆盖安装验证了原账号和本地数据保留，macOS/Linux 实机范围见下文。**稳定版仍 NOT_READY。**

[preview.1](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1) 和 [preview.2](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.2) 及其原公告、资产继续保留。

## 相比 preview.2

### 新圆环图标

应用使用黑色圆角底、白色圆环与倾斜轨道相连的图标，右上保留断口和圆点。网页标识、favicon、安装器 / exe、平台应用资源统一从 SVG 母版生成；静态托盘 / 菜单栏使用同一造型的透明单色版本，真实宠物动画和第三方 Provider 图标保持。

品牌图片引用使用图片内容 hash，解决同为 `1.2.0` 的候选之间旧图片缓存继续显示的问题。Windows 的“保留旧图片缓存、正常启动显示新图标”及透明静态托盘有已接受的实机证据；深色任务栏变体未实际切换验收，macOS/Linux GUI 也不据此判 PASS。

### 对外名称 TokenOrbit

页头、登录、设置 / 关于、分享、多语言、原生窗口 / 菜单 / 托盘产品提示和安装显示名使用 **TokenOrbit**；Widget 使用 **TokenOrbit Widgets**。Windows 覆盖安装保留原账号与本地数据、云同步关闭状态，本产品卸载列表只有一个 TokenOrbit 入口；旧 Community 快捷方式仅在确认指向本产品时迁移，不操作官方 TokenTracker 入口。

为延续既有 Community 安装与数据，AppId / bundle ID、内部 executable、数据目录、协议、自启动和更新来源保持。Linux 的包身份与 Tauri 内部资源路径仍为既有 Community 契约，用户看到的 launcher / 窗口名是 TokenOrbit；macOS 新应用名为 `TokenOrbit.app`，bundle 身份保留。GitHub 仓库暂不改名，下载文件仍使用下表的 **TokenTracker-Community** 技术文件名，避免破坏校验、资产匹配和安装连续性。少量 README/tagline 及 Linux 故障提示仍有旧名，后续清理；上游归属与许可证说明保留。

扫描目录与来源去重 / 历史保护、全站 / 社区统一排行榜、Windows 登出持久性继续保留，已接受证据不重复宣称为本次新功能。此次不改变排名、权限、配额、Token 解析或费用算法。

## 社区与云同步

创建社区会生成邀请码，其他用户凭邀请码加入；左侧「社区」负责成员、邀请码、退出、Owner 转让与确认名称删除。「排行榜」提供全站 / 社区切换、已加入社区选择、周 / 月 / 全部、我的排名及分页。owned 10、memberships 20、单社区 2000 人的实际限制以自有后端返回为准。

**社区榜使用已同步到自有云端的用量。** 希望榜单反映最新本地用量，需要在设置中主动开启云同步并等待同步完成；登录、改名或加入社区不代表已上传。关闭云同步仍可查看本地记录和原已同步榜单。排行榜依据为 `client_reported_tokens`，automatic anticheat 未启用；不宣称提供 Subscription Value / Value Ratio。

已有数据的后台刷新保留内容，短时会话内缓存减少重复 GET；首次未缓存的社区 / 周期 / 页码仍可能等待。这不代表后端变快，也不是预读全部社区或持久离线缓存。

## 手动下载与安装归属

拟用下载入口：[`v1.2.0-preview.3` 页面](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.3)，仅在后续批准公开后可用。请按平台选择原资产，并以 SHA256SUMS / 发布方案核对包文件摘要；覆盖安装前备份 Community 数据。

preview.1、preview.2 和本次的包内版本都为 **1.2.0**。**请手动下载，不承诺自动升级。** 同版本覆盖安装通过不等于完整 updater 下载 → 安装 → 重启链通过。现有稳定更新入口不会提供这次同版本预览；没有稳定 Release 时，检查更新可能显示失败。macOS 新客户端的旧安装路径选择策略不代表旧客户端已成功自动升级，相关链路仍未验收。

应用继续使用独立 Community 安装 / 数据目录、`tokentracker-community://` 协议、自有 InsForge 后端和 `baozibao728-cmd/TokenTracker-Community` 更新仓库，可与官方 TokenTracker 共存。Community 不回退官方后端；官方数据不会因改名自动迁入本产品。本 fork 不提供 npm / Homebrew 发布渠道。

## 六包与实际验证范围

| 平台 / 格式 | 原文件名 | 实际验证边界 |
|---|---|---|
| Windows Setup，x86_64 | `TokenTracker-Community-Setup.exe` | 本固定包 BUILD/PACKAGE、下载回核、覆盖安装 / 品牌 / 账号和数据保留实机 **PASS**；同版本安装，不是更高版本 updater 验收 |
| Windows portable，x86_64 | `TokenTracker-Community-win-x64.zip` | 本固定包 BUILD/PACKAGE、下载回核及与 Setup payload 一致性 **PASS**；portable 原生 smoke / 登出证据复用先前候选，不宣称本包重复实测 |
| macOS，arm64+x86_64 | `TokenTrackerCommunity.dmg` | BUILD/PACKAGE、DMG 内 runtime / 独立身份 / 图标资源 / ad-hoc 检查 **PASS**；**GUI/RUNTIME NOT_TESTED** |
| Linux AppImage，x86_64 | `TokenTracker-Community-linux-x86_64.AppImage` | BUILD/PACKAGE、该格式独立解包 / runtime / 包身份 / 协议检查 **PASS**；**GUI/RUNTIME NOT_TESTED** |
| Linux deb，amd64 | `TokenTracker-Community-linux-x86_64.deb` | BUILD/PACKAGE、该格式独立解包 / runtime / 元数据 / 协议检查 **PASS**；**GUI/RUNTIME NOT_TESTED** |
| Linux rpm，x86_64 | `TokenTracker-Community-linux-x86_64.rpm` | BUILD/PACKAGE、该格式独立解包 / runtime / 元数据 / 协议检查 **PASS**；**GUI/RUNTIME NOT_TESTED** |

六包固定 source / checkout：**`04842178b611f52c3a6180fbd27b089e0737bccf`**，原 artifact **`11527574101`**，包内版本 `1.2.0`。附原 `SHA256SUMS` 和 `RC_MANIFEST.json`，共八文件；没有重建、重签、重压或重写元数据。两份元数据自身摘要也固定在[发布方案](RELEASE_PREVIEW_3_PLAN.md)中。

TokenOrbit 品牌与此次 Windows 安装证据见[改名验证记录](docs/tokenorbit-brand-name-validation.md)；图标、保留缓存启动、透明托盘及桌面截图见[图标验证记录](docs/brand-icon-validation.md)，这些图标实机证据属于此前已接受的 `7e7b63d…`。其他扫描 / 榜单 / 登出证据保持[原候选归属](docs/windows-combined-rc-acceptance.md)，本次没有重复完整生命周期或把旧失败改写成 PASS。

## 已知限制

- **Windows 未签名**，可能出现未知发布者 / SmartScreen 提示。**macOS 仅 ad-hoc**，无 Developer ID / notarization；macOS/Linux 安装、桌面运行及 GUI 尚未验收。编译后 macOS 图标像素 / GUI 对照、Windows 深色任务栏托盘变体实际切换也未验收。包检查和 Windows 结果不替代对应平台 GUI。
- **旧客户端自动升级、真实 WSL、完整更高版本升级链 NOT_TESTED**；Linux 没有应用内 updater。macOS 新安装落点策略的测试只覆盖新客户端逻辑，旧客户端不会自动获得它。不要把改名或同版本覆盖理解为旧客户端自动迁移通过。
- 旧 metadata 的全局指纹缺少分根归属：已缩小扫描范围时，需恢复原范围成功扫描建立分根记录，再移除额外根；旧重叠 WSL 来源还需一次成功 WSL 发现。不要删除清单或强制部分刷新绕过历史保护。
- 既有 Codex 配置指纹差异及变更键 / hook / notify 的写入者缺乏可靠证据，保留 **未归因 / NOT_TESTED**，不宣称本产品改写或已排除全部写入者。
- 精选普通 CI PASS 不等于所有测试全绿。完整 Dashboard suite 两个既有基线失败（`period changes cache timeout`、`Preloaded User missing`），扫描 / Windows 路径及 Kiro fixture 基线失败、Grok slash 断言和 macOS notify 不稳定性继续保留。完整离线及原生历史快捷键逐步恢复未全部验收。
- 本次仅为三平台技术预览。稳定版仍需补齐平台、升级及相关风险 review，**稳定版仍 NOT_READY**。

## 反馈

请通过[本仓库 Issues](https://github.com/baozibao728-cmd/TokenTracker-Community/issues)提供系统 / 架构、原资产文件名、包内版本及复现步骤。不要上传密码、验证码、Cookie、JWT、认证 headers、带授权参数的回调 URL 或真实配置文件。遇到问题保留本地数据与备份，不通过删除历史取得表面正常。
