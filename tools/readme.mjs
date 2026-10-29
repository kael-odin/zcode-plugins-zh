#!/usr/bin/env node
/**
 * Render the portability matrix into README.md from data/catalog.json.
 *
 * The matrix is the repository's lead artifact and it makes 54 individual
 * claims, so it is generated rather than typed: `tools/verify.mjs` already
 * compares the README's headline numbers against the catalog, and this closes
 * the same loop for the per-plugin rows. Prose stays handwritten; only the
 * block between the markers is owned here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, readJson, writeText } from './lib.mjs';

const BEGIN = '<!-- matrix:begin -->';
const END = '<!-- matrix:end -->';

const catalog = readJson(path.join(DATA_DIR, 'catalog.json'));
const portability = readJson(path.join(DATA_DIR, 'portability.json'));
const c = catalog.counts;

/** Compact, honest gap label -- what a reader loses, not why we tiered it. */
function gap(p) {
  if (p.tier === 'clean') return '—';
  if (p.tier === 'skills-only') {
    const hosted = p.reasons.join(' ').match(/([a-z0-9-]+(?:、[a-z0-9-]+)*)\s*提供数据/);
    return hosted ? `技能可用；宿主托管 MCP（${hosted[1]}）不可用` : '技能可用；宿主托管 MCP 不可用';
  }
  if (p.tier === 'blocked-host') {
    const names = p.mcpServers.map((m) => m.name).join('、');
    return names ? `MCP \`${names}\` 依赖 ZCode 宿主变量，其它 agent 起不来` : '依赖 ZCode 宿主';
  }
  if (p.tier === 'blocked-unbuilt') {
    const missing = [...new Set(p.mcpServers.flatMap((m) => m.missing ?? []))];
    return missing.length ? `缺上游未提交的构建产物 \`${missing.join('`、`')}\`` : '缺上游未提交的构建产物';
  }
  // degraded -- report the first concrete defect, trimmed of the long tail
  const r = p.reasons[0] ?? '与 ZCode 环境有耦合';
  return r.replace(/（[^）]*）$/, '').replace(/，其它 agent 不会展开该变量/, '');
}

const cell = (s) => String(s ?? '').replace(/\|/g, '\\|');
const num = (n) => (n ? String(n) : '·');

function table(rows) {
  const head = '| 插件 | 技能 | 命令 | 代理 | MCP | 在 Claude Code 里 |\n| --- | --: | --: | --: | --- | --- |';
  const body = rows.map((p) => {
    const mcp = p.mcpServers.length
      ? p.mcpServers.map((m) => `\`${m.name}\`${m.transport ? ` (${m.transport})` : ''}`).join('<br>')
      : '·';
    return `| [\`${p.name}\`](${p.source.slice(2)}) | ${num(p.components.skills)} | ${num(p.components.commands)} | ${num(p.components.agents)} | ${cell(mcp)} | ${cell(gap(p))} |`;
  });
  return [head, ...body].join('\n');
}

const byTier = (tier) => catalog.plugins.filter((p) => p.tier === tier);
const clean = byTier('clean');
const degraded = byTier('degraded');
const skillsOnly = byTier('skills-only');
const blockedHost = byTier('blocked-host');
const blockedUnbuilt = byTier('blocked-unbuilt');
const partial = [...degraded, ...skillsOnly];
const blocked = [...blockedHost, ...blockedUnbuilt];

const block = [
  BEGIN,
  '',
  `**${c.total} 个插件 = ${c.clean} 个直接可用 / ${c.degraded} 个降级可用 / ${c.skillsOnly} 个仅技能可用 / ${c.blockedHost} 个受阻于宿主 / ${c.blockedUnbuilt} 个受阻于未构建**`,
  '',
  `口径：\`${c.clean} / ${c.degraded} / ${c.skillsOnly} / ${c.blockedHost} / ${c.blockedUnbuilt}\`　·　Claude 清单：${c.manifestsFromUpstream} 个由上游自带，${c.manifestsGenerated} 个由本仓库按 ZCode 清单逐字生成（改写 ${c.manifestsGeneratedRewritten} 个、剥离托管 MCP ${c.manifestStripped} 个）。`,
  '',
  `### ✅ 直接可用（${clean.length}）`,
  '',
  '装进 Claude Code / Codex 后行为与 ZCode 下一致：技能、命令、代理、可移植 MCP 全在。',
  '',
  table(clean),
  '',
  `### ⚠️ 部分可用（${partial.length}）`,
  '',
  '插件能装、技能能跑，但下面「在 Claude Code 里」这一列写的能力拿不到。合计 = 2 个降级 + 9 个仅技能。',
  '',
  `#### 降级可用（${degraded.length}）`,
  '',
  '只是个别组件撞上 ZCode 专有格式，其余照常。',
  '',
  table(degraded),
  '',
  `#### 仅技能可用（${skillsOnly.length}）`,
  '',
  '技能全部可用；这些插件的 MCP 由 ZCode 宿主托管、不开源，其它 agent 里没有对应实现。',
  '',
  table(skillsOnly),
  '',
  `### ❌ 装了也没用（${blocked.length}）`,
  '',
  '仍然收录（源码逐字保留，方便你对照阅读或自己补环境），但不建议装进非 ZCode 的 agent。合计 = 8 个受阻于宿主 + 15 个受阻于未构建。',
  '',
  `#### 受阻于宿主变量（${blockedHost.length}）`,
  '',
  'MCP 配置里引用了只有 ZCode 宿主才会展开的变量，换 agent 直接起不来。',
  '',
  table(blockedHost),
  '',
  `#### 受阻于未构建（${blockedUnbuilt.length}）`,
  '',
  '上游把 `ui-plugins/` 当 pnpm workspace 管理却没提交 `dist/`，MCP 入口文件缺失。',
  '',
  table(blockedUnbuilt),
  '',
  END,
].join('\n');

const readmePath = path.join(ROOT, 'README.md');
if (!fs.existsSync(readmePath)) {
  console.error('[readme] README.md not found');
  process.exit(1);
}

// The pinned-upstream sentence in README and the NOTICE table quote the synced
// commit by hand no more: any line whose context marks it as the mirror
// baseline gets the current sha and upstream commit date here, so an upstream
// bump cannot leave the prose describing the previous release.
const SHA40 = /[0-9a-f]{40}/g;
const DATE = /（\d{4}-\d{2}-\d{2}）/;
const pinSha = (line) =>
  /镜像基准|pinned to commit/.test(line)
    ? line.replace(SHA40, portability.sha).replace(DATE, `（${portability.syncedAt.slice(0, 10)}）`)
    : line;

let pinned = 0;
const applyPin = (file) => {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return 0;
  const before = fs.readFileSync(p, 'utf8');
  const after = before.split('\n').map((l) => {
    const next = pinSha(l);
    if (next !== l) pinned++;
    return next;
  }).join('\n');
  if (after !== before) writeText(p, after);
};
applyPin('README.md');
applyPin('NOTICE.md');

const readme = fs.readFileSync(readmePath, 'utf8');
const start = readme.indexOf(BEGIN);
const end = readme.indexOf(END);
if (start === -1 || end === -1) {
  console.error(`[readme] markers missing -- expected ${BEGIN} and ${END}`);
  process.exit(1);
}
const next = readme.slice(0, start) + block + readme.slice(end + END.length);
if (next !== readme) writeText(readmePath, next);
if (pinned) {
  console.log(`[readme] pinned-commit refs updated (${pinned} line(s)) + matrix ${next !== readme ? 'rewritten' : 'already current'} (${catalog.plugins.length} rows, sha ${portability.sha.slice(0, 9)})`);
} else if (next !== readme) {
  console.log(`[readme] matrix rewritten (${catalog.plugins.length} rows, sha ${portability.sha.slice(0, 9)})`);
} else {
  console.log(`[readme] matrix already current (${catalog.plugins.length} rows, sha ${portability.sha.slice(0, 9)})`);
}
