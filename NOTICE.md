# 来源声明 / NOTICE

本仓库是 [zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins) 的**中文镜像与跨 agent 移植层**，不是上游的 fork，也不代表 Z.ai / ZCode 官方立场。

## 上游

| 项目 | 值 |
| --- | --- |
| 仓库 | `zai-org/zcode-plugins` |
| 分支 | `main` |
| 许可 | Apache License 2.0（见 [LICENSE](LICENSE)，与上游逐字相同） |
| 镜像基准提交 | `d5690038b1e36293ee684a49de12ae41084e25e8`（2026-10-27） |

`plugins/`、`external_plugins/` 下的插件源码**逐字保留**：本仓库不修改任何一个上游文件的内容，包括插件自身的 `.zcode-plugin/plugin.json` 与上游自带的 `.claude-plugin/plugin.json`。`tools/verify.mjs` 会逐文件比对 blob 哈希来守住这条约束。

## 本仓库新增的内容

- `marketplace.json` —— ZCode 视角的市场索引（上游索引的镜像，含 `unlistedPlugins` 分组）。
- `.claude-plugin/marketplace.json` —— Claude Code 视角的市场索引，供 `/plugin marketplace add` 使用。
- 28 个**补写**的 `.claude-plugin/plugin.json` —— 上游只为 54 个插件中的 26 个提供了 Claude 变体；其余 28 个缺失，本仓库按「ZCode 清单原样复制」补齐，字节完全相同，不含任何手工编造字段。补齐的目的是让插件能在 Claude Code 里被识别和安装。
- `config/`、`data/`、`tools/` —— 同步、分析、组装、校验工具与可移植性分析结果。
- 中文说明文档（README 等）。

## 许可与再分发

上游为 Apache-2.0，允许再分发与修改，前提是保留版权与许可声明。本仓库：

- 保留上游 `LICENSE` 原文，未作改动；
- 在每个插件目录内保留上游的许可与元数据文件；
- 新增内容（工具、索引、文档）同样以 Apache-2.0 发布。

Apache-2.0 不授予商标使用权。`ZCode`、`Z.ai` 及相关名称为其各自权利人的商标，本仓库仅作**事实性指代**（说明这些插件来自何处、面向哪个宿主），不暗示任何背书、赞助或官方关联。

## 移除请求 / Takedown

如果你是上游作者或权利人，认为本仓库的某项内容不应被镜像，请在本仓库提 issue（或直接联系仓库 owner），说明具体路径与理由。**我们会在确认后的 72 小时内删除对应内容或整个仓库**，无需额外辩论。

同理，若某个插件包含你不希望被跨 agent 分发的资源，告之路径即可，我们会将整个插件目录从镜像中摘除（并在 `config/zh-marketplace.json` 的排除列表里标注，防止下次同步又带回来）。

---

## English summary

This repository is a Chinese-language mirror and cross-agent port layer for [`zai-org/zcode-plugins`](https://github.com/zai-org/zcode-plugins) (Apache-2.0), pinned to commit `d5690038b1e36293ee684a49de12ae41084e25e8`.

Plugin source files are reproduced byte-for-byte and are never edited. What this repository adds: two marketplace indices (ZCode and Claude Code), 28 generated `.claude-plugin/plugin.json` files for plugins upstream does not ship a Claude variant for (byte copies of the ZCode manifest), Chinese documentation, and the tooling that produces and verifies all of it.

`ZCode` and `Z.ai` are trademarks of their respective owners; their use here is descriptive only and implies no endorsement. To request removal of any mirrored content, open an issue naming the path — we will remove it within 72 hours of confirming the request.
