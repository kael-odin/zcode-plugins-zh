#!/usr/bin/env node
// Classify every mirrored plugin by how far it can run outside ZCode.
// Rules are measured from the copied tree, not hand-written: a plugin is only
// "clean" if nothing in its runtime surface mentions a ZCode-only variable.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, loadConfig, readJson, writeJson, listFiles, pluginDirs, claudeView, mcpServersOf, isHostedServer } from './lib.mjs';

const cfg = loadConfig();
const lastSha = readJson(path.join(DATA_DIR, 'last-sha.json'), { sha: 'unknown', syncedAt: null });

const ZCODE_VAR = /\$\{(ZCODE_[A-Z_]+)\}/g;
// The backslash is excluded from the capture class on purpose: a ref that sits
// inside a JSON string ends at `\"`, and without this the captured path keeps
// that backslash. Windows' existsSync silently tolerates it, Linux does not, so
// the same tree used to classify differently on CI than on a developer box.
const ROOT_REF = /\$\{(?:ZCODE|CLAUDE)_PLUGIN_ROOT\}\/([^"'\s,)\\]*)/g;
const TEXT_EXT = /\.(json|md|mdx|mjs|cjs|js|ts|sh|py|yaml|yml|toml)$/;

/** Ref paths are repo-relative and forward-slashed regardless of captured form. */
function refRel(m) {
  return m[1].replace(/[.,;:]+$/, '').replace(/\\/g, '/');
}

function classifyServer(server, dir) {
  const text = JSON.stringify(server);
  const unreachable = [];
  if (server.url && /\$\{ZCODE_BASE_URL\}/.test(server.url)) return { kind: 'hosted', missing: [] };
  if (server.auth?.type === 'zcode_official') return { kind: 'hosted', missing: [] };
  for (const m of text.matchAll(ROOT_REF)) {
    const rel = refRel(m);
    if (!fs.existsSync(path.join(dir, rel))) unreachable.push(rel);
  }
  if (unreachable.length) return { kind: 'unbuilt', missing: unreachable };
  if (/\$\{ZCODE_[A-Z_]+\}/.test(text)) return { kind: 'host-vars', missing: [] };
  return { kind: 'portable', missing: [] };
}

/** True when every ZCode variable in this server has an exact Claude Code twin. */
function renameOnly(row, servers) {
  const text = JSON.stringify(servers[row.name] ?? {});
  const renamed = text
    .replaceAll('${ZCODE_PLUGIN_ROOT}', '${CLAUDE_PLUGIN_ROOT}')
    .replaceAll('${ZCODE_PROJECT_DIR}', '${CLAUDE_PROJECT_DIR}');
  return !/\$\{ZCODE_[A-Z_]+\}/.test(renamed);
}

function readHooks(manifest, dir) {  const candidates = [];
  if (typeof manifest.hooks === 'string') candidates.push(manifest.hooks);
  else if (manifest.hooks) candidates.push('hooks/hooks.json');
  if (fs.existsSync(path.join(dir, 'hooks', 'hooks.json'))) candidates.push('hooks/hooks.json');
  const found = [];
  for (const rel of [...new Set(candidates)]) {
    const p = path.join(dir, rel);
    if (fs.existsSync(p)) found.push({ rel, text: fs.readFileSync(p, 'utf8') });
  }
  return found;
}

function countComponents(manifest, dir) {
  const skillsDir = path.join(dir, 'skills');
  const agentsDir = path.join(dir, 'agents');
  const commandsDir = path.join(dir, 'commands');
  const countDirs = (p) => (fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0);
  const countMd = (p) => (fs.existsSync(p) ? listFiles(p).filter((f) => f.endsWith('.md')).length : 0);
  const declared = Array.isArray(manifest.componentTypes) ? manifest.componentTypes : [];
  return {
    declared,
    skills: countDirs(skillsDir),
    agents: countMd(agentsDir),
    commands: countMd(commandsDir),
    hooks: fs.existsSync(path.join(dir, 'hooks')) || Boolean(manifest.hooks),
    ui: declared.includes('ui') || Boolean(manifest.ui),
  };
}

const rowFor = (dir) => ([serverName, server]) => ({
  name: serverName,
  transport: server.type ?? (server.command ? 'stdio' : server.url ? 'http' : 'unknown'),
  command: typeof server.command === 'string' ? server.command : null,
  ...classifyServer(server, dir),
});

const plugins = [];
for (const { name, tree, dir } of pluginDirs(ROOT, cfg.trees)) {
    const row = rowFor(dir);
    const manifest = readJson(path.join(dir, '.zcode-plugin', 'plugin.json'));
    // The Claude-effective manifest: upstream's own variant when it ships one,
    // otherwise the ZCode manifest with hosted servers dropped. Tiering must read
    // this view, not the ZCode one, or the finance family misreports as blocked.
    const view = claudeView(dir);
    const reasons = [];

    const servers = mcpServersOf(view.manifest, dir);
    const serverRows = Object.entries(servers).map(row);
    const zcodeRows = Object.entries(mcpServersOf(manifest, dir)).map(row);
    const zcodeHosted = zcodeRows.filter((s) => s.kind === 'hosted');
    const plainMcp = path.join(dir, '.mcp.json');
    // A hosted server living in a root .mcp.json survives manifest stripping,
    // so it stays a real block rather than a generation-time fix.
    const sticky = fs.existsSync(plainMcp)
      ? Object.entries(readJson(plainMcp)?.mcpServers ?? {}).filter(([, s]) => isHostedServer(s)).map(([n]) => n)
      : [];
    const hosted = serverRows.filter((s) => s.kind === 'hosted');
    const hostVars = serverRows.filter((s) => s.kind === 'host-vars');
    const unbuilt = serverRows.filter((s) => s.kind === 'unbuilt');
    if (hosted.length) reasons.push(`${hosted.length} 个 MCP 服务走 \`\${ZCODE_BASE_URL}\` + ZCode 官方 JWT 鉴权（${hosted.map((s) => s.name).join('、')}）`);
    if (unbuilt.length) reasons.push(`MCP 启动脚本不存在：${[...new Set(unbuilt.flatMap((s) => s.missing))].join('、')}（上游未提交构建产物）`);
    if (hostVars.length) reasons.push(`MCP 依赖 ZCode 宿主变量启动（${hostVars.map((s) => s.name).join('、')}）`);
    if (sticky.length) reasons.push(`宿主托管 MCP 声明在根目录 \`.mcp.json\` 里（${sticky.join('、')}），删掉它要改上游字节，本仓库不做`);
    if (zcodeHosted.length && !hosted.length) {
      const by = view.source === 'upstream' ? '上游自带的 Claude 变体' : '本仓库生成清单时';
      reasons.push(`ZCode 版靠 ${zcodeHosted.length} 个宿主托管 MCP（${zcodeHosted.map((s) => s.name).join('、')}）提供数据，${by}已把这层移除：技能照常可用，托管数据能力不可用`);
    }

    const hooks = readHooks(manifest, dir);
    const hookMissing = [];
    let hookNeedsHost = false;
    let hookZcodeFormat = false;
    for (const hook of hooks) {
      for (const m of hook.text.matchAll(ROOT_REF)) {
        const rel = refRel(m);
        if (!fs.existsSync(path.join(dir, rel))) hookMissing.push(rel);
      }
      if (/\$\{ZCODE_[A-Z_]+\}/.test(hook.text)) hookNeedsHost = true;
      // Claude Code hook entries are {type:"command", command:"..."}; ZCode uses
      // {type:"process", command, args, timeoutMs}. The array form is not runnable there.
      if (/"type"\s*:\s*"process"/.test(hook.text) || /"args"\s*:\s*\[/.test(hook.text)) hookZcodeFormat = true;
    }
    if (hookMissing.length) reasons.push(`hooks 引用的脚本不存在：${[...new Set(hookMissing)].join('、')}（上游未提交构建产物）`);
    // Hooks never carry a plugin on their own outside ZCode; they are an add-on layer,
    // so their problems degrade the plugin instead of blocking it.
    if (hookZcodeFormat) reasons.push('hooks 使用 ZCode 专有 `type:"process"` + `args` 结构，Claude Code 只认 `type:"command"` + 单条命令字符串，这些 hook 不会执行（技能/命令/MCP 不受影响）');
    if (hookNeedsHost) reasons.push('hooks 命令里写死 `${ZCODE_PLUGIN_ROOT}`，其它 agent 不会展开该变量');

    // Free-text coupling: only matters when the file has no cross-agent fallback.
    const coupledFiles = [];
    for (const rel of listFiles(dir)) {
      if (!TEXT_EXT.test(rel)) continue;
      const abs = path.join(dir, rel);
      if (abs.endsWith(`${path.sep}.zcode-plugin${path.sep}plugin.json`)) continue;
      let text;
      try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
      if (!ZCODE_VAR.test(text)) continue;
      ZCODE_VAR.lastIndex = 0;
      const dual = /CLAUDE_PLUGIN_ROOT/.test(text) || /CLAUDE_PROJECT_DIR/.test(text);
      if (!dual) coupledFiles.push(rel);
    }

    // Would a pure variable rename unblock it? ZCODE_PLUGIN_ROOT / ZCODE_PROJECT_DIR have
    // exact Claude Code counterparts; ZCODE_BASE_URL + the official JWT do not.
    const rewriteable = serverRows.every((s) => s.kind === 'portable' || s.kind === 'host-vars')
      && !serverRows.some((s) => s.kind === 'host-vars' && !renameOnly(s, servers));
    const portableAfterRewrite = rewriteable && !unbuilt.length;

    let tier;
    if (unbuilt.length || hookMissing.length) tier = 'blocked-unbuilt';
    else if (hosted.length || hostVars.length) tier = 'blocked-host';
    else if (zcodeHosted.length || view.stripped.length) tier = 'skills-only';
    else if (coupledFiles.length || hookZcodeFormat || hookNeedsHost) tier = 'degraded';
    else tier = 'clean';
    if (tier === 'degraded' && coupledFiles.length) {
      reasons.push(`${coupledFiles.length} 个文件硬编码 ZCode 宿主变量（${coupledFiles.slice(0, 3).join('、')}${coupledFiles.length > 3 ? ' 等' : ''}）`);
    }

    const deps = [...new Set(serverRows.map((s) => s.command).filter(Boolean))];
    plugins.push({
      name,
      dir: `${tree}/${name}`,
      version: manifest.version ?? null,
      displayName: manifest.displayName_i18n?.['zh-CN'] ?? manifest.displayName ?? name,
      descriptionZh: manifest.description_i18n?.['zh-CN'] ?? manifest.description ?? '',
      descriptionEn: manifest.description_i18n?.en ?? manifest.description ?? '',
      category: manifest.category ?? null,
      requiresPaidPlan: Boolean(manifest.requiresPaidPlan),
      tier,
      portableAfterRewrite,
      reasons,
      claude: {
        source: view.source,
        identical: view.identical,
        stripped: view.stripped,
        plainMcp: fs.existsSync(plainMcp),
        sticky,
        mcpServers: serverRows.map((s) => s.name),
      },
      zcodeMcpServers: zcodeRows.map((s) => s.name),
      components: countComponents(manifest, dir),
      hookFormat: hooks.length ? { files: hooks.map((h) => h.rel), zcodeProcessType: hookZcodeFormat, needsHost: hookNeedsHost, missing: [...new Set(hookMissing)] } : null,
      mcpServers: serverRows,
      mcpDeps: deps,
    });
}

const byTier = (t) => plugins.filter((p) => p.tier === t).length;
const upstreamNames = new Set(plugins.map((p) => p.name));
const counts = {
  total: plugins.length,
  clean: byTier('clean'),
  degraded: byTier('degraded'),
  skillsOnly: byTier('skills-only'),
  blockedHost: byTier('blocked-host'),
  blockedUnbuilt: byTier('blocked-unbuilt'),
  portableAfterRewrite: plugins.filter((p) => p.portableAfterRewrite && p.tier !== 'clean').length,
  usableNow: plugins.filter((p) => ['clean', 'degraded', 'skills-only'].includes(p.tier)).length,
  bundledOnly: (cfg.bundledPlugins ?? []).filter((n) => !upstreamNames.has(n)).length,
  manifestUpstream: plugins.filter((p) => p.claude.source === 'upstream').length,
  manifestGenerated: plugins.filter((p) => p.claude.source === 'generated').length,
  manifestStripped: plugins.filter((p) => p.claude.stripped.length > 0).length,
};

writeJson(path.join(DATA_DIR, 'portability.json'), {
  upstream: cfg.upstreamRepo,
  sha: lastSha.sha,
  syncedAt: lastSha.syncedAt,
  counts,
  rules: {
    clean: '运行时表面完全不引用 ZCode 专属变量，可直接复制到其它 agent 使用。',
    degraded: '核心组件（技能/命令/MCP）可用，但 hooks 或个别脚本写死了 ZCode 专有格式/变量，这层能力会丢失。',
    'skills-only': '上游的 Claude 清单已经移除了宿主托管 MCP：插件能装、技能能用，靠托管服务提供的数据能力不可用。',
    'blocked-host': 'MCP 服务必须由 ZCode 宿主提供 `${ZCODE_BASE_URL}` 或 ZCode 官方 JWT 才能启动，其它 agent 无法连接。',
    'blocked-unbuilt': '清单指向的 `dist/` 构建产物未提交到上游，仓库里没有可执行的 server，任何 agent 都跑不起来。',
    portableAfterRewrite: '把 `${ZCODE_PLUGIN_ROOT}`/`${ZCODE_PROJECT_DIR}` 逐字替换成 `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PROJECT_DIR}` 后即可用，但需要改动上游字节，本仓库默认不做。',
  },
  plugins: plugins.sort((a, b) => a.name.localeCompare(b.name)),
});

console.log(`[analyze] ${counts.total} plugins: clean=${counts.clean} degraded=${counts.degraded} skills-only=${counts.skillsOnly} blocked-host=${counts.blockedHost} blocked-unbuilt=${counts.blockedUnbuilt} (+${counts.portableAfterRewrite} 改名即通)`);
console.log(`[analyze] Claude manifests: upstream=${counts.manifestUpstream} generated=${counts.manifestGenerated} (stripped hosted MCP in ${counts.manifestStripped})`);
for (const p of plugins.filter((p) => p.tier !== 'clean')) {
  console.log(`  ${p.tier.padEnd(16)} ${p.name}`);
}
