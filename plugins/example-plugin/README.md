# example-plugin

[中文文档](./README_CN.md)

A minimal template plugin for the ZCode plugins marketplace. Copy this directory when you start a new plugin.

Aligned with the ZCode recommended layout (see [the development tutorial](../../docs/PLUGIN_DEVELOPMENT.md)): use `.zcode-plugin/plugin.json`, keep optional components under standard paths, and put long-lived data in `ZCODE_PLUGIN_DATA` (never write back into the install root).

## Structure

```text
example-plugin/
├── .zcode-plugin/
│   └── plugin.json          # Recommended manifest location (required)
├── commands/
│   └── hello.md             # Optional slash command
├── skills/
│   └── example-skill/
│       └── SKILL.md         # Optional skill triggered by context
├── hooks/
│   ├── hooks.json           # Auto-loaded hooks config (do not also point at it from the manifest)
│   ├── session-start.mjs    # SessionStart sample: inject additionalContext
│   └── pre-tool-use.mjs     # PreToolUse sample: note tool name only
├── mcp/
│   └── hello-server.mjs     # Minimal stdio MCP server (no third-party deps)
├── .mcp.json                # MCP server declaration (stdio only)
├── README.md
└── README_CN.md
```

Optional components you can add later: `agents/*.md` (subagents). Component fields in the manifest (`commands` / `skills` / `hooks` / `mcpServers` / `agents`) are optional when you use the standard paths above.

## Hooks sample

`hooks/hooks.json` registers:

| Event | Matcher | What it does |
| --- | --- | --- |
| `SessionStart` | `startup\|clear\|compact` | Runs `hooks/session-start.mjs`, injects a short `additionalContext` |
| `PreToolUse` | `Bash\|Write\|Edit` | Runs `hooks/pre-tool-use.mjs`, appends a note about the tool name |

Prefer `type: "process"` + `node` for cross-platform scripts. Use `${ZCODE_PLUGIN_ROOT}` in args.

**Important:** plugin hooks are snapshotted when a session starts. After editing hooks or enabling/disabling the plugin, open a **new session**. Review `hooks/` before enabling third-party plugins — hooks can run local code.

Manual smoke test:

```shell
printf '%s\n' '{"hook_event_name":"SessionStart","session_id":"manual","source":"startup"}' \
  | node hooks/session-start.mjs
```

Stdout must be a single JSON object starting with `{`. Put diagnostics on stderr only.

## MCP sample

Root `.mcp.json` declares:

| Server | Type | Default | Purpose |
| --- | --- | --- | --- |
| `example-hello` | `stdio` | enabled | Local Node server exposing tool `example_hello` |

`userConfig` in the manifest drives substitution:

- `${user_config.greeting}` → env `EXAMPLE_GREETING` for the stdio server

ZCode namespaces plugin MCP keys automatically to avoid clashes. Enable the plugin, then check **Settings → MCP** (shown as plugin-bundled).

The stdio server speaks newline-delimited JSON-RPC (one message per line) — the MCP stdio framing. Manual smoke:

```shell
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
  | node mcp/hello-server.mjs
```

## Checklist for a New Plugin

1. Copy this directory to `plugins/<your-plugin-name>/`.
2. Edit `.zcode-plugin/plugin.json`. `name` must match the directory name, be kebab-case, and be unique in the marketplace.
3. Keep `description` as the English fallback and fill `description_i18n.en` plus `description_i18n.zh-CN`.
4. Add your commands, skills, agents, hooks, or MCP servers. Delete template files you do not need.
5. **Do not** set manifest `hooks` to `./hooks/hooks.json` if that standard file already exists — it is auto-loaded and a duplicate path only creates diagnostics.
6. Write both `README.md` and `README_CN.md`.
7. Register the plugin in the root `marketplace.json` with the same `name`, `version`, and localized description fields.
8. Bump `version` in both the plugin manifest and `marketplace.json` whenever installable content changes.
9. Run `python3 scripts/validate.py` and `python3 scripts/build_dist.py` from the repository root.
10. Open a merge request.

## Localization Notes

- User-facing documentation should exist in English and Chinese.
- Prompt files and skill instructions should answer in the user's language when possible.
- The English description is the compatibility fallback for clients that do not read `description_i18n`.
- Do not make different capability promises in different languages.
