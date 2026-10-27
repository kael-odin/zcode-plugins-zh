# Codex 市场契约（源码证据）

本文记录「Codex 怎么读本仓」的结论与出处，写于 2026-10-27。依据是 **openai/codex 仓库 main 分支的 Rust 源码**，不是任何官方文档，也**没有在本机 Codex CLI 里实测**——本机未装 Codex。结论的可信边界：读的是 main 分支，发布版行为以各版本源码为准；两条硬规则（`./` 路径前缀、插件名唯一）之外一切形状错误都是 warn+drop，不会炸掉解析。

## 一、市场索引（`codex plugin marketplace add`）

来源：`codex-rs/core-plugins/src/marketplace.rs`。

- 探测顺序（`MARKETPLACE_MANIFEST_RELATIVE_PATHS`）：`.agents/plugins/marketplace.json` → `.agents/plugins/api_marketplace.json` → `.claude-plugin/marketplace.json` → `.cursor-plugin/marketplace.json`。**本仓前者和后者都发**：`.agents` 是 Codex 原生格式、探测优先，兜住只认 `.agents` 的旧版本；两份内容同构。
- 顶层只强制两个字段：`name`（市场注册名，`validate_marketplace_root` 返回的就是它）和 `plugins[]`。其余字段（`$schema`、`owner`、`description`、`renames`…）不认识就忽略，没有 `deny_unknown_fields`。
- 条目只强制 `name` + `source`。`source` 接受两种形：字符串路径，或 `{source:"local", path}` / `{source:"url", url, path, ref, sha}` / `{source:"git-subdir", …}` / `{source:"npm", …}` 对象。本仓用对象形，逐字镜像 openai/plugins 官方仓的条目形状。
- 两条**硬规则**（违者整条跳过）：本地路径字符串必须以 `./` 开头且规范化（不能 `..`、不能空段）；条目 `name` 全市场唯一。

## 二、插件清单（安装时怎么找到每个插件）

来源：`codex-rs/utils/plugins/src/plugin_namespace.rs`（`find_plugin_manifest_path`）、`codex-rs/exec-server-protocol/src/protocol.rs`（`DISCOVERABLE_PLUGIN_MANIFEST_PATHS`）、`codex-rs/core-plugins/src/manifest.rs`（解析）。

- 发现顺序：`plugin.json`（agent-plugins v1 规范，`$schema: https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`）→ `.codex-plugin/plugin.json` → **`.claude-plugin/plugin.json`** → `.cursor-plugin/plugin.json`。
- 所以本仓 54 个插件目录自带的 `.claude-plugin/plugin.json`（26 上游 + 28 生成字节副本）**Codex 直接认**，无需生成任何 `.codex-plugin` 变体。
- `RawPluginManifest` 全字段 `#[serde(default)]`、无 `deny_unknown_fields`：Claude 方言里的 `author`/`homepage`/`license`/`repository` 等字段被静默忽略；`description`/`keywords`/`skills`/`mcpServers`/`interface` 按 Codex 语义解析。
- 形状错误的容错（全部 warn+drop，不影响清单本身）：`skills` 路径不以 `./` 开头 → 忽略该指针（Codex 对技能另有目录递归发现兜底）；`mcpServers` 既不是字符串也不是对象 → 忽略；`interface` 空 → 置 None。

## 三、CLI 命令面

来源：`codex-rs/cli/src/plugin_cmd.rs`。装插件用 **`add`**（`install` 是 Claude 的动词）：

```bash
codex plugin marketplace add https://github.com/kael-odin/zcode-plugins-zh.git
codex plugin add zcode-github@zcode-plugins-zh          # 或 --marketplace zcode-plugins-zh
codex plugin list --marketplace zcode-plugins-zh        # 核对
codex plugin marketplace upgrade                        # 跟上游/本仓更新
codex plugin remove zcode-github@zcode-plugins-zh
```

注册名来自索引里的 `name`（本仓是 `zcode-plugins-zh`），不是 GitHub 仓库名；装完/切开关后需重开会话。

## 四、本仓的落地

- `.agents/plugins/marketplace.json` 由 `tools/compose.mjs` 生成，与 `.claude-plugin/marketplace.json` 同一套条目（53 条）。
- `tools/verify.mjs` 的 4g-4j 把本文件第一节的硬规则钉进门禁：名字一致、条目唯一、`./` 规范化路径且目标目录带 `.claude-plugin/plugin.json`、与 Claude 条目集全等。
