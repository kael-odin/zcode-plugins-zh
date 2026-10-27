import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const UPSTREAM_DIR = path.join(ROOT, '.upstream');
export const DATA_DIR = path.join(ROOT, 'data');
export const CONFIG_PATH = path.join(ROOT, 'config', 'zh-marketplace.json');
export const PLUGIN_TREES = ['plugins', 'external_plugins'];

export function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

export function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

export function hasGit(dir) {
  return fs.existsSync(path.join(dir, '.git'));
}

/** Recursively list files under `dir`, as POSIX-style paths relative to `dir`. */
export function listFiles(dir, skip = new Set(['.git', 'node_modules'])) {
  const out = [];
  const walk = (abs, rel) => {
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const childAbs = path.join(abs, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(childAbs, childRel);
      else if (entry.isFile()) out.push(childRel);
    }
  };
  if (fs.existsSync(dir)) walk(dir, '');
  return out.sort();
}

export function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

export function copyTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const rel of listFiles(src)) {
    const to = path.join(dst, rel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(src, rel), to);
  }
}

export function loadConfig() {
  return readJson(CONFIG_PATH);
}

export function relPosix(p) {
  return p.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Manifest precedence
//
// Upstream ships two manifests per plugin: the ZCode-native one and, for 26 of
// the 54, a Claude Code variant. The variants are not copies: the hosted-MCP
// plugins (finance family) drop `mcpServers` entirely in their Claude variant,
// and video-agent-kit rewrites its server to a Claude-native form. So the
// Claude-effective view is the variant when it exists, and the ZCode manifest
// otherwise -- never the ZCode manifest unconditionally.
// ---------------------------------------------------------------------------

/** Enumerate mirrored plugin dirs that carry a ZCode manifest. */
export function pluginDirs(root = ROOT, trees = PLUGIN_TREES) {
  const out = [];
  for (const tree of trees) {
    const treeDir = path.join(root, tree);
    if (!fs.existsSync(treeDir)) continue;
    for (const name of fs.readdirSync(treeDir).sort()) {
      const dir = path.join(treeDir, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      if (!fs.existsSync(path.join(dir, '.zcode-plugin', 'plugin.json'))) continue;
      out.push({ name, tree, dir, rel: `${tree}/${name}` });
    }
  }
  return out;
}

/** A server only the ZCode host can materialise: host-proxied URL or official JWT. */
export function isHostedServer(server) {
  if (!server || typeof server !== 'object') return false;
  if (typeof server.url === 'string' && server.url.includes('${ZCODE_BASE_URL}')) return true;
  return server.auth?.type === 'zcode_official';
}

/** Merge manifest-declared, referenced-file and root `.mcp.json` servers, later wins. */
export function mcpServersOf(manifest, dir) {
  const servers = {};
  const add = (obj) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const [name, server] of Object.entries(obj)) {
      if (server && typeof server === 'object') servers[name] = server;
    }
  };
  if (typeof manifest.mcpServers === 'string') {
    const p = path.join(dir, manifest.mcpServers);
    if (fs.existsSync(p)) add(readJson(p)?.mcpServers);
  } else {
    add(manifest.mcpServers);
  }
  const plain = path.join(dir, '.mcp.json');
  if (fs.existsSync(plain)) add(readJson(plain)?.mcpServers);
  return servers;
}

/**
 * Plugin dirs whose `.claude-plugin/plugin.json` upstream actually ships.
 *
 * `compose` writes generated manifests into that same path, so file existence
 * stops being the discriminator once compose has run once: re-reading would
 * claim all 54 as upstream and silently skip regeneration. Git in the pinned
 * `.upstream` clone is the authority -- one call, exact, survives reruns.
 */
let claudeVariants = null;
export function upstreamClaudeVariants() {
  if (claudeVariants) return claudeVariants;
  const set = new Set();
  if (hasGit(UPSTREAM_DIR)) {
    for (const line of git(UPSTREAM_DIR, 'ls-files', '--full-name').split('\n')) {
      const m = /^(?:plugins|external_plugins)\/([^/]+)\/\.claude-plugin\/plugin\.json$/.exec(line);
      if (m) set.add(m[1]);
    }
  }
  claudeVariants = set;
  return set;
}

/**
 * The Claude Code view of one plugin.
 *
 * - `source: 'upstream'`  upstream already ships `.claude-plugin/plugin.json`; bytes are final.
 * - `source: 'generated'` we synthesise it from the ZCode manifest.
 *     `identical: true`  nothing needed dropping, so the generated file is a byte copy.
 *     `stripped` lists hosted servers omitted so the manifest never advertises a
 *     server Claude cannot start (the same treatment upstream applied to the
 *     finance family in its own variants).
 */
export function claudeView(dir) {
  const name = path.basename(dir);
  const upstreamPath = path.join(dir, '.claude-plugin', 'plugin.json');
  const zcodePath = path.join(dir, '.zcode-plugin', 'plugin.json');
  const zcode = readJson(zcodePath);
  const tracked = upstreamClaudeVariants();
  // Without git metadata (unpacked snapshot) fall back to "differs from the ZCode
  // manifest" -- a byte-identical leftover is ours and recomputes to the same bytes.
  const isUpstream = fs.existsSync(upstreamPath)
    && (tracked.size ? tracked.has(name) : !fs.readFileSync(upstreamPath).equals(fs.readFileSync(zcodePath)));
  if (isUpstream) {
    return {
      source: 'upstream',
      path: upstreamPath,
      bytes: fs.readFileSync(upstreamPath),
      manifest: readJson(upstreamPath),
      stripped: [],
      identical: fs.readFileSync(upstreamPath).equals(fs.readFileSync(zcodePath)),
      zcode,
    };
  }
  // Only a server declared inline in the manifest can be removed by rewriting
  // the manifest. A root `.mcp.json` is discovered by the host on its own, so a
  // hosted server living there survives any manifest edit -- that stays a hard
  // block and the manifest is copied byte-for-byte rather than pretending we
  // neutralised it.
  const inline = zcode.mcpServers && typeof zcode.mcpServers === 'object' ? zcode.mcpServers : {};
  const stripped = Object.entries(inline).filter(([, s]) => isHostedServer(s)).map(([n]) => n);
  if (!stripped.length) {
    return {
      source: 'generated',
      path: upstreamPath,
      bytes: fs.readFileSync(zcodePath),
      manifest: zcode,
      stripped: [],
      identical: true,
      zcode,
    };
  }
  const kept = Object.fromEntries(Object.entries(inline).filter(([n]) => !stripped.includes(n)));
  const manifest = { ...zcode };
  if (Object.keys(kept).length) manifest.mcpServers = kept;
  else delete manifest.mcpServers;
  return {
    source: 'generated',
    path: upstreamPath,
    bytes: null,
    manifest,
    stripped,
    identical: false,
    zcode,
  };
}
