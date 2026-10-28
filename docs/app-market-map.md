# ZCode 应用内「插件市场」逐项可移植性对照

对照对象：ZCode 桌面端 **插件市场** 面板（2026-10-27 截图），顺序与面板一致（分类内自左向右、自上而下）。判定口径与 [README 可移植性矩阵](../README.md#可移植性矩阵) 完全同源（`data/portability.json`，按 Claude 生效视角分档；Codex 侧契约见 [codex-contract.md](codex-contract.md)）。

图例：

- ✅ **完全可用** —— 装进 Claude Code / Codex 后技能、命令、代理、MCP 与 ZCode 下一致（clean 档）
- ⚠️ **部分可用** —— 能装能用，但有明确缺口（degraded / skills-only 档，缺口在判定列写明）
- ❌ **不能用了** —— 装了也起不来核心能力（blocked-host / blocked-unbuilt 档）
- ➖ **仅 ZCode 内置** —— 这 14 个不在任何公开仓库、只随 ZCode 应用分发，本仓无法收录，其它 agent 装不到

| # | 面板里的插件 | 分类 | 仓内对应 | 在其它 agent（Claude Code / Codex）里 |
| --: | --- | --- | --- | --- |
| 1 | PDF | 应用插件 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 2 | 演示文稿 | 应用插件 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 3 | 电子表格 | 应用插件 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 4 | Word文档 | 应用插件 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 5 | Jupyter Notebook | 应用插件 | `jupyter-notebook` | ❌ 缺上游未提交的构建产物 `dist/server.mjs`，MCP 起不来 |
| 6 | Typst 工作台 | 应用插件 | `typst-workbench` | ❌ 缺构建产物 `dist/server.mjs`，MCP 起不来 |
| 7 | Zotero | 应用插件 | `zotero` | ❌ 缺构建产物 `dist/server.mjs`，MCP 起不来 |
| 8 | Github | 开发者工具 | `github`（Claude 侧发布为 `zcode-github`） | ✅ 完全可用（已实测装进 Claude Code，17/17 文件逐字节相同） |
| 9 | Gitlab | 开发者工具 | `gitlab` | ✅ 完全可用 |
| 10 | 阿里云 CLI | 开发者工具 | `alibaba-cloud-cli` | ✅ 完全可用 |
| 11 | Cloudbase Skills | 开发者工具 | `cloudbase-skills` | ✅ 完全可用（MCP `cloudbase` 可移植） |
| 12 | 悦动安全防护 | 开发者工具 | `mimosa` | ❌ MCP 依赖 ZCode 宿主变量，其它 agent 起不来 |
| 13 | Android 模拟器 | 开发者工具 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 14 | iOS 模拟器 | 开发者工具 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 15 | ZCode MCP App Dev | 开发者工具 | `zcode-mcp-app-dev` | ⚠️ 可装可用，1 个文件硬编码 ZCode 宿主变量 |
| 16 | 插件创建器 | 实用工具 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 17 | 技能创建器 | 实用工具 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 18 | ZCode 使用指南 | 实用工具 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 19 | Video2code | 生产力 | `video2code` | ✅ 完全可用 |
| 20 | 飞书 CLI | 生产力 | `lark-cli` | ✅ 完全可用 |
| 21 | 腾讯会议 CLI | 生产力 | `tencent-meeting-cli` | ✅ 完全可用 |
| 22 | Video Agent Kit | 生产力 | `video-agent-kit` | ✅ 完全可用（MCP `video-edit` 可移植） |
| 23 | 钉钉 CLI | 生产力 | `dingtalk-cli` | ✅ 完全可用 |
| 24 | 企业微信 CLI | 生产力 | `wecom-cli` | ✅ 完全可用 |
| 25 | 电脑控制 | 生产力 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 26 | 交互视图 | 生产力 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 27 | 浏览器操作 | 生产力 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 28 | 截图 | 生产力 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 29 | LibTV CLI | 生产力 | `libtv-cli` | ✅ 完全可用 |
| 30 | Obsidian | 生产力 | `obsidian` | ✅ 完全可用 |
| 31 | 天眼查 | 金融 | `tianyancha` | ❌ MCP 依赖 ZCode 宿主变量，其它 agent 起不来 |
| 32 | Wind 万得 | 金融 | `wind` | ❌ 7 个 MCP 全依赖宿主变量，起不来 |
| 33 | 金融聚合搜索 | 金融 | `finance-search` | ❌ MCP 依赖 ZCode 宿主变量，其它 agent 起不来 |
| 34 | 同花顺 | 金融 | `hexin` | ❌ 5 个 MCP 全依赖宿主变量，起不来 |
| 35 | 交易测算 | 金融 | `model-deals` | ⚠️ 技能/命令/代理可用；数据 MCP 由宿主托管，其它 agent 没有 |
| 36 | 经营分析 | 金融 | `run-fpa` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 37 | 核算与报告 | 金融 | `accounting-and-reporting` | ✅ 完全可用 |
| 38 | 权益研究 | 金融 | `write-research` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 39 | 宏观策略 | 金融 | `read-macro` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 40 | 择仓择股 | 金融 | `watch-positions` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 41 | 对公获客 | 金融 | `find-clients` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 42 | 固收研究 | 金融 | `assess-credit` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 43 | 基金履职 | 金融 | `pick-funds` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 44 | 企业尽调 | 金融 | `vet-companies` | ⚠️ 技能/命令/代理可用；宿主托管 MCP 没有 |
| 45 | Node Repl Host | 其他 | ➖ 仅内置 | 内置专有插件，未随仓库分发，装不到 |
| 46 | Blender | 游戏/3D | `blender` | ✅ 完全可用 |
| 47 | Godot | 游戏/3D | `godot` | ✅ 完全可用 |
| 48 | Hyper3D Rodin | 游戏/3D | `hyper3d-rodin` | ✅ 完全可用（MCP `hyper3d-rodin` 可移植） |
| 49 | Tripo 3D | 游戏/3D | `tripo-3d` | ⚠️ 可装可用；hooks 用 ZCode 专有格式，其它 agent 里 hook 不执行 |
| 50 | Unity | 游戏/3D | `unity` | ✅ 完全可用 |
| 51 | Unreal Engine | 游戏/3D | `unreal-engine` | ✅ 完全可用（MCP `unreal-mcp` 可移植） |

**汇总（面板 51 项）：** ✅ 完全可用 18　·　⚠️ 部分可用 11　·　❌ 不能用了 8　·　➖ 仅 ZCode 内置 14。

两点说明：

1. **不在上表的仓内插件**：截图 51 项之外，本仓还镜像着 `example-plugin`（模板，上游就不上架）、`openpencil`（上游 unlisted）以及 `jev-decisions`、`ruic-card`、`anet`、`autoresearch` 和 `*-craft` 系列——它们没有出现在这张截图里（面板按分类聚合、或有折叠/分页），判定一律以 README 主矩阵为准。
2. **「完全可用」的口径**：判定按 Claude 生效视角实测形成；Codex 侧读的是同一批清单文件（见 [codex-contract.md](codex-contract.md)），宿主变量/构建产物两条限制与文件同源，结论可迁移，hooks 在 Codex 里的行为未逐个实测。
