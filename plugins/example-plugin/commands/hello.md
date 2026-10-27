---
description: Say hello and show that the example plugin is installed correctly
---

Greet the user in their language and confirm that the `example-plugin` is installed and working.

Briefly list what this template ships:

1. Slash command `/example-plugin:hello` (this command).
2. Skill `example-skill` (auto or manual via `/`).
3. Hooks under `hooks/hooks.json` (`SessionStart`, `PreToolUse` samples).
4. MCP sample `example-hello` from `.mcp.json` (tool `example_hello`); remote HTTP/SSE entries stay disabled until configured.

If the user writes in Chinese, answer in Chinese; if the user writes in English, answer in English. Optional arguments: $ARGUMENTS
