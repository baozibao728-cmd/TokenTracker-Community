# TokenTracker-Community Release Notes（草稿）

> `1.2.0` Release Candidate；尚未正式发布。本文件不是已发布版本公告。

## Community Leaderboard

- 使用邀请码创建和加入私有社区，并查看社区成员列表。
- 在社区内查看本周、本月和总计 Token 排行榜，包含零 Token 成员。
- 社区 Owner 可查看邀请码、向现有成员发起所有权转让；目标成员可接受或拒绝，Owner 可在确认后删除社区。
- 当前默认配额：每位用户最多拥有 10 个社区、加入 20 个社区；每个社区最多 2000 名成员。实际限制由自有 Community 后端的环境配置决定。
- Community 通过自有 InsForge 后端提供 Auth、Edge Function 和数据库 RPC；不会复制用户 Token 数据。

排行榜依据为 `client_reported_tokens`。自动反作弊尚未启用，社区排名不等同于经过自动反作弊审核的官方排行榜。

## 独立安装与更新

原生应用以 TokenTracker Community 安装，使用独立产品标识、数据目录和 `tokentracker-community://` 回调协议。更新与下载源改为本 fork 的 GitHub Releases。正式构建必须显式配置自有 InsForge 地址和公共客户端凭据，缺失时构建失败。

本 fork 暂不发布上游 npm 包或 Homebrew tap；未包含的官方云端能力不在本版本承诺范围内。
