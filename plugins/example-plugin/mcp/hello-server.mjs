#!/usr/bin/env node
/**
 * Minimal stdio MCP server for the example-plugin template.
 *
 * No third-party deps. Implements enough of the MCP JSON-RPC surface for
 * initialize / tools/list / tools/call so the sample can load in ZCode.
 *
 * MCP stdio framing is newline-delimited JSON (one JSON-RPC message per line),
 * NOT LSP-style Content-Length framing.
 *
 * Manual smoke (one JSON line per request on stdin):
 *   printf '%s\n' \
 *     '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"manual","version":"0"}}}' \
 *     '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 *     '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 *     '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"example_hello","arguments":{"name":"ZCode"}}}' \
 *     | node mcp/hello-server.mjs
 */

import { createInterface } from "node:readline";

const SERVER_INFO = {
  name: "example-hello",
  version: "0.3.0",
};

const GREETING =
  process.env.EXAMPLE_GREETING || "hello from example-plugin";

const TOOLS = [
  {
    name: "example_hello",
    description:
      "Return a greeting from the example-plugin sample MCP server. Useful to verify plugin MCP loading.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Optional name to greet.",
        },
      },
    },
  },
];

function writeMessage(message) {
  // One JSON-RPC message per line — what MCP stdio clients expect.
  process.stdout.write(JSON.stringify(message) + "\n");
}

function ok(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

function handleRequest(msg) {
  const { id, method, params } = msg;

  // Notifications (no id) — ignore.
  if (id === undefined || id === null) return;

  switch (method) {
    case "initialize":
      ok(id, {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
      return;
    case "ping":
      ok(id, {});
      return;
    case "tools/list":
      ok(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments || {};
      if (name !== "example_hello") {
        fail(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      const who = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "world";
      const text = `${GREETING}, ${who}! (example-plugin MCP)`;
      ok(id, {
        content: [{ type: "text", text }],
        isError: false,
      });
      return;
    }
    default:
      fail(id, -32601, `Method not found: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (Array.isArray(msg)) {
      for (const item of msg) handleRequest(item);
    } else {
      handleRequest(msg);
    }
  } catch (err) {
    process.stderr.write(`[example-hello] bad JSON: ${err}\n`);
  }
});
rl.on("close", () => process.exit(0));

process.stderr.write("[example-hello] stdio MCP server ready\n");
