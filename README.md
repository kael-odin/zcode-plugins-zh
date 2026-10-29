# zcode-plugins-zh

[![sync-upstream](https://github.com/kael-odin/zcode-plugins-zh/actions/workflows/sync.yml/badge.svg)](https://github.com/kael-odin/zcode-plugins-zh/actions/workflows/sync.yml)

**ZCode 官方插件的跨 agent 移植层。** 上游 [zai-org/zcode-plugins](https://github.com/zai-org/zcode-plugins)（Apache-2.0）的 **54 个插件源码逐字保留**，这里补上让 Claude Code、Codex 也能识别安装所需要的东西——以及一份**实测过的可移植性矩阵**，告诉你哪个插件装过去还能用、哪个装了等于没装。**一键市场只收录「直接可用」的 20 个**，其余 33 个按实测缺口标注原因、作为原始资料保留在仓库里。在线浏览：**https://kael-odin.github.io/zcode-plugins-zh/**

> 本仓不是「再汉化一遍」。ZCode 插件自带中文元数据，中文不是缺口；缺口是**上游只为 54 个插件中的 26 个写了 Claude 清单**，其余 28 个在别的 agent 里连识别都做不到。可移植性才是这个仓要解决的问题。

## 一分钟安装

**Claude Code**

```bash
claude plugin marketplace add kael-odin/zcode-plugins-zh
claude plugin install zcode-github@zcode-plugins-zh
```

会话内等价写法：`/plugin marketplace add kael-odin/zcode-plugins-zh`。

**Codex**

```bash
codex plugin marketplace add https://github.com/kael-odin/zcode-plugins-zh.git
codex plugin add zcode-github@zcode-plugins-zh
codex plugin list --marketplace zcode-plugins-zh   # 核对
```

或打开 **设置 → 插件 → 添加市场**，填入仓库地址。装插件用 **`codex plugin add`**（`install` 是 Claude 的动词）；以后跟进更新用 `codex plugin marketplace upgrade`；装完**重开会话**才生效。

依据 codex-rs 源码（`marketplace.rs`、`plugin_namespace.rs`）：Codex 按 `.agents/plugins/marketplace.json` → `.claude-plugin/marketplace.json` 的顺序探测市场索引，本仓**两份都发**（前者是 Codex 原生格式、探测优先，后者兜底）；插件清单的发现顺序是 `.codex-plugin/plugin.json` → `.claude-plugin/plugin.json` → `.cursor-plugin/plugin.json`，54 个插件目录都带 `.claude-plugin/plugin.json`，无需再生成 `.codex-plugin` 变体。完整证据与命令面见 [docs/codex-contract.md](docs/codex-contract.md)。诚实声明：以上契约**读的是 codex-rs 源码，不是在本机 Codex CLI 里实测的**；矩阵那一节的能力判定按 Claude 视角测得，Codex 侧的宿主变量 / 未构建产物限制与文件同源、结论可迁移，hooks 在 Codex 里的行为未逐个实测。

**ZCode**

ZCode 自带官方市场，这些插件本来就在里面，装本仓没有额外收益。本仓的 `marketplace.json` 是上游索引的镜像（同样的 52 条在列 + 1 条 `unlistedPlugins`），只用于对照阅读，或按上游文档走**插件市场 → 新建 → 填本地路径**自建本地市场。

### 装之前先看这一列

一键市场**只列「直接可用」档的 20 个**（判定口径见下面矩阵）。这是刻意的：其它档位的插件装进别的 agent 会有明确缺口（hooks 不执行、宿主 MCP 起不来、构建产物缺失），一键装上只会制造"装了但没用"的错觉。它们**没有消失**——源码逐字保留在本仓对应目录，矩阵逐条写明缺在哪，改造即可用；站点上每个卡片也给出仓库目录直达链接。

`github` 在上游叫 `github`，但 Claude Code 已经有一个同名市场插件，所以本仓在 Claude 侧把它发布为 **`zcode-github`**（目录不动，仍是 `plugins/github`）。两个市场里的名字差异只此一处，记录在 [`.claude-plugin/marketplace.json`](.claude-plugin/marketplace.json) 的 `renames` 里。

## 可移植性矩阵

三档不是猜的：每个插件都按**它在 Claude Code 里实际生效的那份清单**判定——上游自带 `.claude-plugin/plugin.json` 就用上游的，没有就把 `.zcode-plugin/plugin.json` 逐字复制过去。判定的具体依据（MCP 启动命令是否可解、hooks 结构是否被识别、宿主变量是否硬编码）写在 `data/portability.json` 的 `reasons` 里，逐条可查。想按 **ZCode 应用内插件面板的顺序**（含 14 个仅内置、装不到的插件）逐项对照？见 [docs/app-market-map.md](docs/app-market-map.md)。

<!-- matrix:begin -->

**54 个插件 = 20 个直接可用 / 2 个降级可用 / 9 个仅技能可用 / 8 个受阻于宿主 / 15 个受阻于未构建**

口径：`20 / 2 / 9 / 8 / 15`　·　Claude 清单：26 个由上游自带，28 个由本仓库按 ZCode 清单逐字生成（改写 0 个、剥离托管 MCP 0 个）。

### ✅ 直接可用（20）

装进 Claude Code / Codex 后行为与 ZCode 下一致：技能、命令、代理、可移植 MCP 全在。

| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |
| --- | --: | --: | --: | --- | --- |
| [`accounting-and-reporting`](plugins/accounting-and-reporting) | 8 | 5 | 1 | · | — |
| [`alibaba-cloud-cli`](plugins/alibaba-cloud-cli) | 2 | · | · | · | — |
| [`blender`](plugins/blender) | 2 | · | · | · | — |
| [`cloudbase-skills`](plugins/cloudbase-skills) | 1 | · | · | `cloudbase` (stdio) | — |
| [`dingtalk-cli`](plugins/dingtalk-cli) | 2 | · | · | · | — |
| [`github`](plugins/github) | 10 | · | · | · | — |
| [`gitlab`](plugins/gitlab) | 3 | · | · | · | — |
| [`godot`](plugins/godot) | 2 | 1 | · | · | — |
| [`hyper3d-rodin`](plugins/hyper3d-rodin) | 1 | · | · | `hyper3d-rodin` (http) | — |
| [`jev-decisions`](external_plugins/jev-decisions) | 1 | · | · | `jev` (stdio) | — |
| [`lark-cli`](plugins/lark-cli) | 2 | · | · | · | — |
| [`libtv-cli`](plugins/libtv-cli) | 2 | · | · | · | — |
| [`obsidian`](plugins/obsidian) | 9 | · | · | · | — |
| [`ruic-card`](external_plugins/ruic-card) | 2 | · | · | · | — |
| [`tencent-meeting-cli`](plugins/tencent-meeting-cli) | 2 | · | · | · | — |
| [`unity`](plugins/unity) | 2 | · | · | · | — |
| [`unreal-engine`](plugins/unreal-engine) | 3 | · | · | `unreal-mcp` (http) | — |
| [`video-agent-kit`](plugins/video-agent-kit) | 5 | 2 | · | `video-edit` (stdio) | — |
| [`video2code`](plugins/video2code) | 6 | 4 | · | `runtime` (stdio)<br>`video` (stdio) | — |
| [`wecom-cli`](plugins/wecom-cli) | 2 | · | · | · | — |

### ⚠️ 部分可用（11）

插件能装、技能能跑，但下面「在 Claude Code 里」这一列写的能力拿不到。合计 = 2 个降级 + 9 个仅技能。

#### 降级可用（2）

只是个别组件撞上 ZCode 专有格式，其余照常。

| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |
| --- | --: | --: | --: | --- | --- |
| [`tripo-3d`](plugins/tripo-3d) | 2 | · | · | `tripo` (http) | hooks 使用 ZCode 专有 `type:"process"` + `args` 结构，Claude Code 只认 `type:"command"` + 单条命令字符串，这些 hook 不会执行 |
| [`zcode-mcp-app-dev`](plugins/zcode-mcp-app-dev) | 1 | · | · | · | 1 个文件硬编码 ZCode 宿主变量 |

#### 仅技能可用（9）

技能全部可用；这些插件的 MCP 由 ZCode 宿主托管、不开源，其它 agent 里没有对应实现。

| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |
| --- | --: | --: | --: | --- | --- |
| [`assess-credit`](plugins/assess-credit) | 6 | 4 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`find-clients`](plugins/find-clients) | 6 | 4 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`model-deals`](plugins/model-deals) | 6 | 4 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`pick-funds`](plugins/pick-funds) | 7 | 5 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`read-macro`](plugins/read-macro) | 6 | 4 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`run-fpa`](plugins/run-fpa) | 10 | 8 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`vet-companies`](plugins/vet-companies) | 5 | 3 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`watch-positions`](plugins/watch-positions) | 6 | 4 | 1 | · | 技能可用；宿主托管 MCP 不可用 |
| [`write-research`](plugins/write-research) | 17 | 13 | 1 | · | 技能可用；宿主托管 MCP 不可用 |

### ❌ 装了也没用（23）

仍然收录（源码逐字保留，方便你对照阅读或自己补环境），但不建议装进非 ZCode 的 agent。合计 = 8 个受阻于宿主 + 15 个受阻于未构建。

#### 受阻于宿主变量（8）

MCP 配置里引用了只有 ZCode 宿主才会展开的变量，换 agent 直接起不来。

| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |
| --- | --: | --: | --: | --- | --- |
| [`anet`](external_plugins/anet) | 2 | 1 | · | `anet` (stdio) | MCP `anet` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`autoresearch`](external_plugins/autoresearch) | 2 | 5 | · | `autoresearch` (stdio) | MCP `autoresearch` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`example-plugin`](plugins/example-plugin) | 1 | 1 | · | `example-hello` (stdio) | MCP `example-hello` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`finance-search`](plugins/finance-search) | · | · | · | `sec-search` (http)<br>`finance-search` (http) | MCP `sec-search、finance-search` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`hexin`](plugins/hexin) | · | · | · | `hexin-stock` (http)<br>`hexin-global-stock` (http)<br>`hexin-index` (http)<br>`hexin-fund` (http)<br>`hexin-bond` (http) | MCP `hexin-stock、hexin-global-stock、hexin-index、hexin-fund、hexin-bond` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`mimosa`](plugins/mimosa) | · | · | · | `mimosa` (stdio) | MCP `mimosa` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`tianyancha`](plugins/tianyancha) | · | · | · | `tianyancha` (http) | MCP `tianyancha` 依赖 ZCode 宿主变量，其它 agent 起不来 |
| [`wind`](plugins/wind) | · | · | · | `wind-stock` (http)<br>`wind-index` (http)<br>`wind-fund` (http)<br>`wind-bond` (http)<br>`wind-economic` (http)<br>`wind-docs` (http)<br>`wind-global-stock` (http) | MCP `wind-stock、wind-index、wind-fund、wind-bond、wind-economic、wind-docs、wind-global-stock` 依赖 ZCode 宿主变量，其它 agent 起不来 |

#### 受阻于未构建（15）

上游把 `ui-plugins/` 当 pnpm workspace 管理却没提交 `dist/`，MCP 入口文件缺失。

| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |
| --- | --: | --: | --: | --- | --- |
| [`cadcraft`](external_plugins/cadcraft) | · | 1 | · | `cadcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`deckcraft`](external_plugins/deckcraft) | · | 1 | · | `deckcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`designcraft`](external_plugins/designcraft) | · | 1 | · | `designcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`excalidraw`](external_plugins/excalidraw) | 1 | · | · | `excalidraw` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`gridcraft`](external_plugins/gridcraft) | · | 1 | · | `gridcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`jupyter-notebook`](plugins/jupyter-notebook) | 1 | · | · | `jupyter-notebook` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`kicad`](external_plugins/kicad) | 1 | · | · | `kicad` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`openpencil`](external_plugins/openpencil) | 1 | · | · | `design` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`pdfcraft`](external_plugins/pdfcraft) | · | 1 | · | `pdfcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`photocraft`](external_plugins/photocraft) | · | 1 | · | `photocraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`soundcraft`](external_plugins/soundcraft) | · | 1 | · | `soundcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`typst-workbench`](plugins/typst-workbench) | 1 | · | · | `typst` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`vectorcraft`](external_plugins/vectorcraft) | · | 1 | · | `vectorcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`wordcraft`](external_plugins/wordcraft) | · | 1 | · | `wordcraft` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |
| [`zotero`](plugins/zotero) | 1 | · | · | `zotero` (stdio) | 缺上游未提交的构建产物 `dist/server.mjs` |

<!-- matrix:end -->

**为什么没有「剥离托管 MCP」这一档？** 因为量出来是 0。原本的计划是：生成清单时把「只有 ZCode 宿主才能提供的托管 MCP」删掉，好让插件在别的 agent 里干净地降级。实际检查发现**没有任何插件把托管 server 内联声明在清单里**——它们全走宿主发现，改清单删不掉，删了也是幻觉。所以 28 份生成清单是**逐字复制**，改写 0 份，托管能力该缺就诚实地缺。

## 这个仓多了什么

| 新增 | 说明 |
| --- | --- |
| `marketplace.json` | ZCode 视角的市场索引，镜像上游形状（含 `unlistedPlugins`） |
| `.claude-plugin/marketplace.json` | Claude Code 读的市场索引，**只列「直接可用」档 20 条** |
| `.agents/plugins/marketplace.json` | Codex 读的市场索引（Codex 原生格式、探测优先），同样 20 条 |
| 28 个 `.claude-plugin/plugin.json` | 只补上游缺的那些，**逐字复制** ZCode 清单，不改写任何字段 |
| `site/` + `dist/` | 兄弟项目同款的可检索站点：真实图标、三档筛选、逐插件缺口与安装命令 |
| `tools/analyze.mjs` | 从 Claude 生效视角给 54 个插件分档，产出 `data/portability.json` |
| `tools/compose.mjs` | 生成三份市场索引 + 28 份清单 + `data/catalog.json`（市场档位由 `config` 的 `marketTiers` 控制） |
| `tools/fetch-icons.mjs` | 把 50 个 CDN 图标抓进 `site/appicons/`（提交在库，站点不热链 z.ai） |
| `tools/verify.mjs` | 41 项断言，把本文里的每个数字钉在数据上；失败即非零退出 |
| `tools/readme.mjs` | 从 catalog 重渲染上面那张矩阵，防止正文与数据漂移 |

插件源码、上游自带的 26 份 Claude 清单、`LICENSE` 全部**字节未动**。`tools/verify.mjs` 用 git blob 哈希逐文件比对来守住这条线——不是靠人自觉。

```bash
node tools/sync.mjs         # 拉上游到 .upstream，记录 sha
node tools/analyze.mjs      # 分档 → data/portability.json
node tools/compose.mjs      # 三份市场索引 + 清单 + catalog
node tools/fetch-icons.mjs  # CDN 图标 → site/appicons/
node tools/readme.mjs       # 重渲染矩阵
node tools/build-site.mjs   # 站点 → dist/
node tools/verify.mjs       # 门禁
```

## 目录结构

```
plugins/            # 上游插件，逐字保留（含 15 个 UI 插件）
external_plugins/   # 上游外部插件，逐字保留
marketplace.json    # ZCode 市场索引（镜像上游）
.claude-plugin/     # Claude Code 市场索引（只列直接可用档）
.agents/plugins/    # Codex 市场索引（Codex 原生格式，只列直接可用档）
site/               # 站点源（壳 + 样式 + 渲染脚本 + appicons/ 图标）
config/             # 同步与发布策略（上游地址、市场档位、重命名、排除列表）
data/               # portability.json（分档依据）+ catalog.json（全量元数据）
tools/              # sync / analyze / compose / fetch-icons / build-site / readme / verify
```

## 已知限制

- **UI 插件跑不起来**：15 个插件的 `dist/` 是构建产物，上游不提交（发布流水线现build），所以它们的 MCP 启动脚本在源码里就不存在。想用就自己 `pnpm install && pnpm build`。
- **hooks 是 ZCode 专有格式**：`{type:"process", command:"node", args:[…]}`，Claude Code 只认 `{type:"command", command:"bash …"}`。涉及 6 个插件，技能不受影响，hook 不触发。
- **宿主变量不会展开**：`${ZCODE_PLUGIN_ROOT}` 这类变量只有 ZCode 会替换。
- **12 份清单的 `skills` 指针缺 `./` 前缀**：`"skills": "skills"`（blender、godot、jupyter-notebook、typst-workbench、unity、unreal-engine、zcode-mcp-app-dev、zotero、excalidraw、kicad、openpencil）和 `"payload/skills"`（mimosa）在 Codex 里会被忽略（它要求 `./` 开头，忽略后按目录约定递归发现技能，通常无损）。这些清单要么是上游自带的 Claude 变体、要么是 ZCode 清单的字节副本，受「源码逐字保留」铁律约束不改写，只在此记录。
- **UI 插件源码体积**：`ui-plugins/` 是 pnpm workspace，本仓不镜像它的源码目录，只镜像构建后的插件形态（与上游 `plugins/` 一致）。

## 上游与移除请求

镜像基准固定在 `0cc58d6aa29644f50af1d7ac2fa4c4eb7ada95d9`（2026-10-29），每日 CI 跟进。上游为 Apache-2.0，本仓新增内容同样以 Apache-2.0 发布；`ZCode`、`Z.ai` 等名称仅作事实性指代，不暗示背书。

完整来源声明、商标说明与**移除请求流程**见 [NOTICE.md](NOTICE.md)：指名路径，确认后 72 小时内删除。
