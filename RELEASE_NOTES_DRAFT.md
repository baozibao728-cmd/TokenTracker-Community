# TokenTracker Community 1.2.0 — 三平台技术预览（公告草稿）

> 待 review，尚未发布。拟用 tag：`v1.2.0-preview.1`；六个安装包内版本均为 `1.2.0`。发布时去掉标题中的“公告草稿”、本提示行及下载入口的“目前尚未创建”说明，保留下面全部验证范围与限制。操作参数、原文件校验和与发布步骤见 [Release Readiness Plan](RELEASE_READINESS_PLAN.md)。

TokenTracker Community 是基于 MIT 开源项目 [TokenTracker](https://github.com/xiufengsun/TokenTracker) 的独立衍生项目。这次首发定位为 Windows、macOS、Linux 三平台技术预览，提供本地 AI Token 用量查看和私有 Community Leaderboard。欢迎在了解各平台验证范围后试用，并向[本仓库 Issues](https://github.com/baozibao728-cmd/TokenTracker-Community/issues)反馈问题。

## Community Leaderboard

- 创建私有社区时自动生成 Community ID 和邀请码；其他用户凭邀请码加入，不提供公开社区搜索。
- 查看社区信息、成员列表，以及本周、本月、总计 Token 排行榜；支持分页、当前用户排名和零 Token 成员。
- Owner 可以查看邀请码，向现有成员发起所有权转让；目标成员可接受或拒绝。Owner 可在输入社区名称确认后删除社区。
- 当前后端默认配额：每位用户最多拥有 10 个社区、加入 20 个社区，每个社区最多 2000 名成员；实际配额以页面显示的后端配置为准。
- 第一版只按 Token 数量排名。Subscription Value、Value Ratio 和 Provider 分类排行尚未提供。

**社区排行榜读取的是已经同步到 TokenTracker Community 自有云端的用量。** 希望榜单反映最新本地用量时，需要在设置中开启“同步到云端”，并等待同步完成。登录或加入社区本身不等于已经完成用量同步；关闭同步后仍可查看本地用量及此前已同步的排行榜数据。榜单不会在客户端重新计算，也不复制一份 Community Token 数据。

排行榜依据为 `client_reported_tokens`，automatic anticheat 尚未启用；这些排名不等同于经过官方自动反作弊审核的排行榜。

## 独立安装、数据与更新来源

应用使用独立的 TokenTracker Community 安装身份、数据目录和 `tokentracker-community://` OAuth 回调协议，可与官方 TokenTracker 共存。现有官方数据不会自动迁移到本项目；本地采集仍读取现有受支持工具的使用记录。

Auth、云同步和 Community 使用自有 InsForge 后端，Community 配置不会回退到官方项目。下载和更新源为 [baozibao728-cmd/TokenTracker-Community](https://github.com/baozibao728-cmd/TokenTracker-Community)。本预览不会通过稳定版自动更新通道推送，请使用本次预览 Release 页面中的明确资产链接下载。当前没有稳定 Release 时，“检查更新”可能显示检查失败；这不代表预览安装包损坏，也不代表完整下载升级已验证。

本 fork 暂不提供 npm/Homebrew 安装渠道，也不承诺已复制官方全部云端能力。未登录或关闭云同步仍可使用本地用量功能；OAuth 登录会保留用户明确关闭的同步偏好。

## 下载与验证范围

发布后入口：[`v1.2.0-preview.1` Release 页面](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1)（目前尚未创建）。

| 平台 | 文件 | 架构 | 实际验证范围 |
|---|---|---|---|
| Windows 安装版 | `TokenTracker-Community-Setup.exe` | x86_64 | BUILD/PACKAGE、下载回核、真实覆盖安装、原生页面/会话/同步关闭/重启验收 PASS |
| Windows 便携版 | `TokenTracker-Community-win-x64.zip` | x86_64 | BUILD/PACKAGE、下载回核、解压启动及原生 GUI smoke PASS |
| macOS | `TokenTrackerCommunity.dmg` | arm64 + x86_64 | BUILD/PACKAGE、实际 DMG 内容/身份/内嵌 runtime/签名检查 PASS；安装、GUI/RUNTIME NOT_TESTED |
| Linux AppImage | `TokenTracker-Community-linux-x86_64.AppImage` | x86_64 | BUILD/PACKAGE、独立解包/runtime/身份/协议声明检查 PASS；安装、GUI/RUNTIME NOT_TESTED |
| Linux deb | `TokenTracker-Community-linux-x86_64.deb` | amd64 | BUILD/PACKAGE、独立解包/包元数据/runtime/协议检查 PASS；安装、GUI/RUNTIME NOT_TESTED |
| Linux rpm | `TokenTracker-Community-linux-x86_64.rpm` | x86_64 | BUILD/PACKAGE、独立解包/包元数据/runtime/协议检查 PASS；安装、GUI/RUNTIME NOT_TESTED |

六包均来自源码 `0a143a05b975854365294201d9f690f6f70c0059`，包内版本 `1.2.0`。本次将原样复用已验收的 CI 产物，不重新构建、改名、重新压缩或签名。请按随附 `SHA256SUMS` 校验实际安装包文件；Actions 下载的外层 ZIP 不是安装包校验对象。`RC_MANIFEST.json` 同时记录来源、架构、大小和摘要。

## 技术预览限制

- Windows 安装包未签名；系统可能显示未知发布者或 SmartScreen 提示。
- macOS 为 **ad-hoc 签名**，并非 Developer ID 签名，也未 notarize；Gatekeeper、实际安装和桌面运行尚未验证。不建议关闭系统安全策略来取得测试通过。
- Linux 三种格式都完成独立打包检查，但尚无对应桌面验收；AppImage 实际启动后的协议注册仍未验证。Linux 目前没有应用内自动更新器。
- **完整 updater 下载升级链 NOT_TESTED**。已通过的同版本覆盖安装和 Windows 完整性拒绝测试不能代替真实版本升级。
- 普通 CI 已通过其选定门禁；完整 Dashboard suite 的两个既有全球排行榜基线失败（period changes cache timeout、Preloaded User missing）仍单独记录，不能称为全量测试通过。macOS notify 测试曾出现不稳定性，其桌面影响仍待验证。
- Community 详情在重新获得窗口焦点时会刷新；短暂“刷新中”是已记录的行为，持续无法完成时请反馈复现步骤。

这些限制不会被 Windows 的 PASS 或 runner 构建结果覆盖。本次不将 macOS/Linux 标为已完成实机验收，也不将三平台技术预览称为稳定版。

## 反馈

请在 [Issues](https://github.com/baozibao728-cmd/TokenTracker-Community/issues) 提供系统版本、架构、使用的资产文件名、包内版本和可复现步骤。不要附带密码、邮箱验证码、Token、认证 headers 或带授权参数的完整回调网址。已有数据请先保留；官方 TokenTracker 与 Community 的数据目录应分别检查。
