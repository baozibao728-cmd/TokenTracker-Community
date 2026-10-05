# TokenTracker Community 1.2.0 — 三平台技术预览 2（公告草稿）

> 准备材料，尚未创建或发布 `v1.2.0-preview.2`。包内版本仍为 `1.2.0`；本次为手动下载技术预览。发布时去掉标题“公告草稿”和本提示，保留下面的验证边界与限制。参数、八文件原件摘要及待授权步骤见 [preview.2 发布方案](RELEASE_PREVIEW_2_PLAN.md)。

TokenTracker Community 是基于 MIT 开源项目 [TokenTracker](https://github.com/xiufengsun/TokenTracker) 的独立衍生项目。技术预览 2 延续本地 AI Token 用量查看与私有社区排行，提供 Windows、macOS、Linux 六种包；**稳定版仍 NOT_READY**。第一次预览的 [v1.2.0-preview.1](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.1)及原资产继续保留。

## 相比技术预览 1

### 额外扫描目录与历史保护

支持额外扫描根和既有配置 / 环境目录；对路径别名及共享来源目录去重，避免同一来源被重叠路径重复计入。主动移除额外根后可继续刷新保留范围；仍需保留的根或目录暂时失联、无法完整读取时，保留上次完整历史并延后修复，恢复后继续刷新。强制刷新不会授权用不完整扫描清空历史。

这是发现与历史修复边界的改进，不改 Token 解析 / 归一化或费用算法。旧 metadata 的兼容迁移条件和真实 WSL 未验范围仍保留，见下面限制。

### 全站 / 社区榜统一入口

在「排行榜」标题旁切换全站榜与社区榜；社区模式可选择已加入的社区，包括自己创建的社区，并保留周 / 月 / 全部、我的排名、当前用户高亮和分页。社区榜只展示接口实际提供的排名、用户、Token，不借用全站费用 / Provider 数据。

左侧「社区」负责创建、加入、邀请码、成员、退出、转让和删除管理，并提供直达统一排行榜的入口。社区、周期和分页选择保存在链接状态中。

已有数据的后台刷新保留内容并显示小型更新提示；短时会话内缓存与同请求去重减少重复 GET。首次访问未缓存的社区 / 周期 / 页码仍需读取云端；缓存效果不代表后端响应变快。失败会显示明确错误及重试，账号切换或权限失效会清理私有缓存，POST 操作不自动重试。

### Windows 本地登出持久性

正常退出登录后，安装版重启或启动同候选便携版仍保持未登录；正常的新登录后退出应用、再重启可恢复新会话。关闭的云同步偏好持续保留。

此项修复通过 Windows 原生 WebView 实机定向验收。上游 logout 403 仍作为 403 返回，本地持久会话被清理；不把本地退出成功宣传为已证明云端会话撤销成功。

## 私有社区与云端用量

创建私有社区会生成邀请码，其他用户凭邀请码加入；不提供公开社区搜索。Owner 可查看邀请码、转让给现有成员及确认名称后删除；社区排行提供 week / month / total。默认配额为 owned 10、joined 20、单社区 2000 人，实际以页面取得的后端配置为准。

**社区榜使用已同步到本项目自有云端的用量。** 希望反映最新本地用量，需要在设置中开启云同步并等待完成；登录或加入社区不会自动证明用量已同步。关闭云同步仍可查看本地记录及原已同步榜单。榜单依据为 `client_reported_tokens`，automatic anticheat 未启用，不等同官方反作弊排行。Subscription Value、Value Ratio 等未提供。

## 手动下载与独立归属

拟定下载入口为 [`v1.2.0-preview.2` Release 页面](https://github.com/baozibao728-cmd/TokenTracker-Community/releases/tag/v1.2.0-preview.2)；该链接仅在后续批准公开后可用。

应用使用独立安装身份、数据目录、`tokentracker-community://` 协议、自有 InsForge 后端及本仓库更新源，可与官方 TokenTracker 共存。Community 配置不回退官方后端；既有官方数据不会自动迁移到本项目。可在保留云同步关闭的状态下使用本地用量。

本次包内版本与 preview.1 都为 **1.2.0**，preview.2 是发布标签，不是更高的应用内版本。请手动下载并按资产校验，覆盖安装前备份 Community 数据。稳定版更新检查不会自动提供这次预览；只有预览而无稳定 Release 时，“检查更新”可能显示失败。**不宣称完整自动下载 → 安装 → 重启升级链已经通过。** 本 fork 不提供 npm / Homebrew 发布渠道。

## 包与实际验证范围

| 平台 / 格式 | 原资产文件 | 验证边界 |
|---|---|---|
| Windows Setup，x86_64 | `TokenTracker-Community-Setup.exe` | BUILD/PACKAGE、下载回核及该原包的覆盖安装 / 三个登出和新登录重启场景 PASS |
| Windows portable，x86_64 | `TokenTracker-Community-win-x64.zip` | BUILD/PACKAGE、下载回核、真实启动 / 登出保持未登录 PASS |
| macOS，arm64+x86_64 | `TokenTrackerCommunity.dmg` | BUILD/PACKAGE、DMG 内 runtime / 独立身份 / ad-hoc 检查 PASS；GUI/RUNTIME NOT_TESTED |
| Linux AppImage，x86_64 | `TokenTracker-Community-linux-x86_64.AppImage` | BUILD/PACKAGE、该格式解包与 runtime / 身份 / 协议检查 PASS；GUI/RUNTIME NOT_TESTED |
| Linux deb，amd64 | `TokenTracker-Community-linux-x86_64.deb` | BUILD/PACKAGE、该格式解包及元数据 / runtime / 协议检查 PASS；GUI/RUNTIME NOT_TESTED |
| Linux rpm，x86_64 | `TokenTracker-Community-linux-x86_64.rpm` | BUILD/PACKAGE、该格式解包及元数据 / runtime / 协议检查 PASS；GUI/RUNTIME NOT_TESTED |

六包固定来源：`6321b24e0c46699db2695995491fea5bae97b359`，原 artifact `11311863214`。随附原 `SHA256SUMS` 和 `RC_MANIFEST.json`，请核对实际包文件摘要，而不是 Actions 外层 ZIP；不重新构建、签名、压缩或修改原 metadata。

扫描和统一榜单的已接受实机证据来自前一组合候选，修复候选保持这些代码；本次固定包完成的是 Windows 登出持久性定向复验，未重复全部扫描 / 社区双用户生命周期。原截图保留原候选归属，旧候选的登出失败不被改写。详细来源与原文件摘要见 [发布方案](RELEASE_PREVIEW_2_PLAN.md)和 [验收记录](docs/windows-combined-rc-acceptance.md)。

## 已知限制

- Windows 未签名，可能出现未知发布者 / SmartScreen 提示。macOS 只有 ad-hoc 签名，没有 Developer ID / notarization；macOS/Linux 安装及 GUI/RUNTIME 尚未验收。包内容检查和 Windows 结果不能替代实际桌面运行。
- 真实 WSL 与完整更高版本升级链 NOT_TESTED；Linux 没有应用内 updater。曾完成的同版本覆盖安装不等于完整升级验证。
- 部分旧 metadata 只保存全局目录指纹，无法判定消失目录所属根。若已经缩小扫描范围，需恢复原范围完成一次扫描，建立分根记录后再移除额外根；不要通过删除旧清单或强制部分刷新绕过历史保护。旧重叠 WSL 来源标记另需一次成功 WSL 发现建立，不能从旧 explicit 标签推断。
- 活动 Codex 配置整文件指纹存在差异；变更键名 / hook / notify 及写入者无法可靠归因。保留“未归因”，不据此宣称 Community 改写配置，也不承诺已排除所有写入者。
- 普通 CI 的必要检查通过不等于完整测试全绿。完整 Dashboard suite 两个既有基线失败（`period changes cache timeout`、`Preloaded User missing`）、扫描 / Windows 路径及 fixture 基线失败、Grok slash 断言、macOS notify 不稳定性仍保留。真实完整离线、原生历史快捷键逐步恢复不计全部 PASS。
- 初次云端读取仍可能等待；当前短时缓存不是预读全部社区或离线存储。私有社区数据不持久缓存。稳定发布仍需要补齐平台验收、升级及相关风险 review。

## 反馈

请通过 [本仓库 Issues](https://github.com/baozibao728-cmd/TokenTracker-Community/issues)反馈系统、架构、原资产文件名、包内版本与可复现步骤。不要上传密码、验证码、Cookie、JWT、认证 headers、带授权参数的回调 URL 或真实配置文件。遇到问题先保留数据与备份，不用删除历史取得表面正常。
