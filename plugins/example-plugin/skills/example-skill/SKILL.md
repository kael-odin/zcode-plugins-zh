---
name: example-skill
description: Example skill shipped with the example-plugin template. Use when the user asks how ZCode plugin skills work, how plugin hooks or MCP samples are structured, or wants to verify that the example plugin skill is loaded.
---

# Example Skill

This is a template skill. When triggered, answer in the user's language and explain:

1. This skill was loaded from `example-plugin` in the `zcode-plugins-official` marketplace.
2. ZCode uses the plugin manifest at `.zcode-plugin/plugin.json`.
3. A skill is a folder containing a `SKILL.md` with YAML frontmatter (`name`, `description`) followed by instructions. Clear descriptions improve auto-trigger accuracy.
4. This template also demonstrates:
   - `hooks/hooks.json` + Node scripts for `SessionStart` / `PreToolUse`
   - root `.mcp.json` with a local stdio MCP server and disabled remote HTTP/SSE samples
   - optional `userConfig` fields referenced as `${user_config.*}`
5. User-facing docs should include both `README.md` and `README_CN.md`, and metadata should include matching `description_i18n.en` / `description_i18n.zh-CN`.
