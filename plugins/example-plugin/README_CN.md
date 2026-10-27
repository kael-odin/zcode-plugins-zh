# example-plugin

[English](./README.md)

这是 ZCode 插件市场的最小模板插件。新建插件时可以直接复制这个目录。

目录与约定对齐 ZCode 推荐规范（见[插件开发教程](../../docs/PLUGIN_DEVELOPMENT_CN.md)，[English tutorial](../../docs/PLUGIN_DEVELOPMENT.md)）：使用 `.zcode-plugin/plugin.json`，组件放在标准路径下；持久化数据写入 `ZCODE_PLUGIN_DATA`，不要写回安装目录。

## 目录结构

```text
example-plugin/
├── .zcode-plugin/
│   └── plugin.json          # 推荐：插件清单（必需）
├── commands/
│   └── hello.md             # 可选：斜杠命令
├── skills/
│   └── example-skill/
│       └── SKILL.md         # 可选：按上下文触发的 skill
├── hooks/
│   ├── hooks.json           # 自动加载的钩子配置（勿在 manifest 再指一次同一文件）
│   ├── session-start.mjs    # SessionStart 样例：注入 additionalContext
│   └── pre-tool-use.mjs     # PreToolUse 样例：仅记录工具名
├── mcp/
│   └── hello-server.mjs     # 最小 stdio MCP server（无第三方依赖）
├── .mcp.json                # MCP 服务声明（仅 stdio）
├── README.md
└── README_CN.md
```

后续可按需添加 `agents/*.md`（子智能体）。使用上述标准路径时，manifest 里的 `commands` / `skills` / `hooks` / `mcpServers` / `agents` 字段均可省略。

## Hooks 样例

`hooks/hooks.json` 注册了：

| 事件 | Matcher | 行为 |
| --- | --- | --- |
| `SessionStart` | `startup\|clear\|compact` | 运行 `hooks/session-start.mjs`，注入简短 `additionalContext` |
| `PreToolUse` | `Bash\|Write\|Edit` | 运行 `hooks/pre-tool-use.mjs`，追加工具名提示 |

跨平台优先 `type: "process"` + `node`。参数里使用 `${ZCODE_PLUGIN_ROOT}`。

**注意：** 插件 Hook 在 session 启动时形成快照。改配置或启停插件后请**新建 session**。第三方插件启用前请审查 `hooks/`——Hook 可执行本地代码。

手工冒烟：

```shell
printf '%s\n' '{"hook_event_name":"SessionStart","session_id":"manual","source":"startup"}' \
  | node hooks/session-start.mjs
```

stdout 必须是以 `{` 开头的单个 JSON；诊断信息只写 stderr。

## MCP 样例

根目录 `.mcp.json` 声明：

| 服务 | 类型 | 默认 | 用途 |
| --- | --- | --- | --- |
| `example-hello` | `stdio` | 启用 | 本地 Node 服务，暴露工具 `example_hello` |

manifest 的 `userConfig` 用于变量替换：

- `${user_config.greeting}` → 注入 stdio 服务的 `EXAMPLE_GREETING`

ZCode 会给插件 MCP 键名自动加命名空间。启用插件后到 **设置 → MCP** 查看（显示为插件内置）。

stdio 服务使用换行分隔的 JSON-RPC（每行一条消息），即 MCP stdio 帧格式。手工冒烟：

```shell
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node mcp/hello-server.mjs
```

## 新插件清单

1. 复制本目录到 `plugins/<你的插件名>/`。
2. 修改 `.zcode-plugin/plugin.json`。`name` 必须和目录名一致，使用 kebab-case，并在市场中唯一。
3. `description` 保持英文兜底，同时填写 `description_i18n.en` 和 `description_i18n.zh-CN`。
4. 添加 commands、skills、agents、hooks 或 MCP；不需要的模板文件直接删除。
5. 若已有标准路径 `hooks/hooks.json`，**不要**再在 manifest 的 `hooks` 字段指向同一文件（会重复加载并产生诊断）。
6. 同时编写 `README.md` 和 `README_CN.md`。
7. 在根目录 `marketplace.json` 注册插件，保持 `name`、`version` 和本地化描述一致。
8. 任何会进入安装包的内容变更，都要同步 bump 插件清单与 `marketplace.json` 的 `version`。
9. 在仓库根目录运行 `python3 scripts/validate.py` 和 `python3 scripts/build_dist.py`。
10. 提交 MR。

## 本地化说明

- 面向用户的文档应同时提供英文和中文。
- prompt 文件和 skill 指令应尽量按用户语言回答。
- 英文 `description` 是兼容兜底，供不读取 `description_i18n` 的客户端使用。
- 不同语言不要承诺不同能力。
