#!/usr/bin/env node
/**
 * SessionStart hook sample for example-plugin.
 *
 * Protocol (ZCode):
 * - Read one JSON event object from stdin
 * - Write a single JSON object to stdout (must start with `{`)
 * - Put diagnostics on stderr only (never secrets / full prompts)
 *
 * Manual smoke test:
 *   printf '%s\n' '{"hook_event_name":"SessionStart","session_id":"manual","source":"startup"}' \
 *     | node hooks/session-start.mjs
 */

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch (err) {
  process.stderr.write(`[example-plugin] invalid SessionStart stdin: ${err}\n`);
  process.exit(1);
}

const eventName = input.hook_event_name || input.hookEventName || "SessionStart";
const greeting =
  process.env.EXAMPLE_GREETING ||
  process.env.ZCODE_USER_CONFIG_GREETING ||
  "hello from example-plugin";

process.stderr.write(
  `[example-plugin] SessionStart source=${input.source || "unknown"} session=${input.session_id || "?"}\n`,
);

// Prefer hookSpecificOutput so the runtime can attribute the context to this event.
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext:
        `example-plugin is enabled (${greeting}). ` +
        "Prefer small, reversible edits; keep secrets out of hook stdout.",
    },
  }),
);
