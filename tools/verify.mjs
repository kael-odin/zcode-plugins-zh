#!/usr/bin/env node
/**
 * Gate: the tree on disk must match what the tooling says it does.
 *
 * Every check below is a claim the README makes. If one fails the README is
 * lying, so this exits non-zero and CI refuses the push.
 *
 *   1  every mirrored plugin carries a Claude manifest
 *   2  upstream's own 26 variants are byte-untouched
 *   3  our 28 generated variants are byte copies of the ZCode manifest
 *   4  both marketplaces parse, agree on counts, and point at real dirs
 *   5  catalog counts agree with the portability analysis
 *   6  README numbers agree with the catalog
 *   7  no build junk, no tracked .upstream, no seed files, no EOL drift,
 *      mirrored bytes identical to upstream, platform-neutral path refs,
 *      executable bits intact
 *   8  the two hand-picked decisions still hold (github renamed, example-plugin hidden)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, UPSTREAM_DIR, DATA_DIR, loadConfig, readJson, sha256File, pluginDirs, hasGit, git } from './lib.mjs';

const cfg = loadConfig();
const portability = readJson(path.join(DATA_DIR, 'portability.json'));
const catalog = readJson(path.join(DATA_DIR, 'catalog.json'));
const zcodeMarket = readJson(path.join(ROOT, 'marketplace.json'));
const claudeMarket = readJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'));

const failures = [];
const notes = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(detail ? `${label}: ${detail}` : label);
  else notes.push(label);
  return ok;
};

if (!portability || !catalog || !zcodeMarket || !claudeMarket) {
  console.error('[verify] missing generated files -- run tools/analyze.mjs and tools/compose.mjs first');
  process.exit(1);
}

const dirs = pluginDirs(ROOT, cfg.trees);
const names = new Set(dirs.map((d) => d.name));

// 1 -- every mirrored plugin has a Claude manifest
const noManifest = dirs.filter(({ dir }) => !fs.existsSync(path.join(dir, '.claude-plugin', 'plugin.json')));
check(noManifest.length === 0, '1 every plugin has .claude-plugin/plugin.json', noManifest.map((d) => d.name).join(', '));

// 2 -- upstream variants are untouched (compare against the pinned commit)
const tracked = new Set();
if (hasGit(UPSTREAM_DIR)) {
  for (const line of git(UPSTREAM_DIR, 'ls-files', '--full-name').split('\n')) {
    const m = /^(?:plugins|external_plugins)\/([^/]+)\/\.claude-plugin\/plugin\.json$/.exec(line);
    if (m) tracked.add(m[1]);
  }
  const dirty = [];
  for (const name of tracked) {
    const rel = dirs.find((d) => d.name === name)?.rel;
    if (!rel) { dirty.push(`${name}: tracked upstream but not mirrored`); continue; }
    const p = `${rel}/.claude-plugin/plugin.json`;
    // Compare blob hashes, not text: the `git` helper trims, which would make
    // every file look one newline short of HEAD.
    const headHash = git(UPSTREAM_DIR, 'rev-parse', `HEAD:${p}`);
    const workHash = git(UPSTREAM_DIR, 'hash-object', p);
    if (headHash !== workHash) dirty.push(`${name}: upstream working tree differs from HEAD`);
    const oursHash = git(UPSTREAM_DIR, 'hash-object', path.join(ROOT, p));
    if (oursHash !== workHash) dirty.push(`${name}: we rewrote an upstream variant`);
  }
  check(dirty.length === 0, `2 upstream variants untouched (${tracked.size})`, dirty.join('; '));
} else {
  check(false, '2 upstream variants untouched', '.upstream is not a git clone -- run tools/sync.mjs');
}

// 3 -- generated variants are byte copies
const generated = dirs.filter(({ name }) => !tracked.has(name));
const notCopy = generated.filter(({ dir }) =>
  !fs.readFileSync(path.join(dir, '.claude-plugin', 'plugin.json'))
    .equals(fs.readFileSync(path.join(dir, '.zcode-plugin', 'plugin.json'))));
check(notCopy.length === 0, `3 generated variants are byte copies (${generated.length})`, notCopy.map((d) => d.name).join(', '));

// 4 -- marketplaces
const zcodeListed = zcodeMarket.plugins ?? [];
const zcodeUnlisted = zcodeMarket.unlistedPlugins ?? [];
const claudeListed = claudeMarket.plugins ?? [];

const dup = (arr) => arr.map((e) => e.name).filter((n, i, a) => a.indexOf(n) !== i);
check(dup([...zcodeListed, ...zcodeUnlisted]).length === 0, '4a ZCode marketplace names unique', dup([...zcodeListed, ...zcodeUnlisted]).join(', '));
check(dup(claudeListed).length === 0, '4b Claude marketplace names unique', dup(claudeListed).join(', '));

const badSource = [...zcodeListed, ...zcodeUnlisted].filter((e) => {
  const rel = String(e.source ?? '').replace(/^\.\//, '');
  return !rel || !fs.existsSync(path.join(ROOT, rel, '.zcode-plugin', 'plugin.json'));
});
check(badSource.length === 0, '4c ZCode sources resolve', badSource.map((e) => `${e.name}->${e.source}`).join(', '));

const badClaudeSource = claudeListed.filter((e) => {
  const rel = String(e.source ?? '').replace(/^\.\//, '');
  return !rel || !fs.existsSync(path.join(ROOT, rel, '.claude-plugin', 'plugin.json'));
});
check(badClaudeSource.length === 0, '4d Claude sources resolve', badClaudeSource.map((e) => `${e.name}->${e.source}`).join(', '));

// Upstream publishes 53 of its 54: the template is mirrored but deliberately
// unlisted. Coverage counts are taken from the catalog's own membership flags,
// which 5g/5h then tie back to these same files. Exclusion and publication are
// independent, so the Claude set is the intersection -- the template is already
// unpublished, and subtracting it again would invent a hole.
const publishedCount = catalog.plugins.filter((p) => p.inZcodeMarket).length;
const claudeEligible = catalog.plugins.filter((p) => p.inZcodeMarket && !p.claudeExcluded).length;

check(zcodeListed.length + zcodeUnlisted.length === publishedCount,
  '4e ZCode marketplace covers every published plugin',
  `lists ${zcodeListed.length}+${zcodeUnlisted.length} of ${publishedCount}`);
check(claudeListed.length === claudeEligible,
  '4f Claude marketplace covers every published plugin except the excluded template',
  `lists ${claudeListed.length} of ${claudeEligible}`);

// 5 -- catalog agrees with the analysis
const tiers = catalog.counts ?? {};
const tierSum = tiers.clean + tiers.degraded + tiers.skillsOnly + tiers.blockedHost + tiers.blockedUnbuilt;
check(tierSum === catalog.total, '5a tier counts sum to total', `${tierSum} != ${catalog.total}`);
check(catalog.total === dirs.length, '5b catalog covers every mirrored dir', `${catalog.total} != ${dirs.length}`);
check(tiers.manifestsFromUpstream === tracked.size, '5c catalog reports the upstream manifest count', `${tiers.manifestsFromUpstream} != ${tracked.size}`);
check(tiers.manifestsGenerated === generated.length, '5d catalog reports the generated manifest count', `${tiers.manifestsGenerated} != ${generated.length}`);
check(tiers.manifestsGeneratedRewritten === 0, '5e no generated manifest was rewritten', `${tiers.manifestsGeneratedRewritten} rewritten`);
check(tiers.manifestStripped === 0, '5f no hosted MCP server was stripped', `${tiers.manifestStripped} stripped`);
check(tiers.zcodeListed === zcodeListed.length && tiers.zcodeUnlisted === zcodeUnlisted.length, '5g catalog market counts match', '');
check(tiers.claudeListed === claudeListed.length, '5h catalog Claude count matches', `${tiers.claudeListed} != ${claudeListed.length}`);
for (const p of catalog.plugins) {
  if (!names.has(p.name)) { check(false, '5i catalog name exists on disk', p.name); break; }
}

// 6 -- README numbers
const readmePath = path.join(ROOT, 'README.md');
if (fs.existsSync(readmePath)) {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const want = {
    total: catalog.total,
    clean: tiers.clean,
    degraded: tiers.degraded,
    skillsOnly: tiers.skillsOnly,
    blockedHost: tiers.blockedHost,
    blockedUnbuilt: tiers.blockedUnbuilt,
  };
  // The README states the split once, as "20 / 2 / 9 / 8 / 15"; find that row.
  const row = new RegExp(`${want.clean}\\s*\\/\\s*${want.degraded}\\s*\\/\\s*${want.skillsOnly}\\s*\\/\\s*${want.blockedHost}\\s*\\/\\s*${want.blockedUnbuilt}`);
  check(row.test(readme), '6a README tier split matches the catalog',
    `expected ${want.clean} / ${want.degraded} / ${want.skillsOnly} / ${want.blockedHost} / ${want.blockedUnbuilt}`);
  check(new RegExp(`${want.total}\\s*个插件|${want.total}\\s*plugins`, 'i').test(readme)
    || readme.includes(String(want.total)), '6b README total matches the catalog', `expected ${want.total}`);
  check(readme.includes(`${tiers.manifestsFromUpstream}`) && readme.includes(`${tiers.manifestsGenerated}`),
    '6c README manifest split matches the catalog', `expected ${tiers.manifestsFromUpstream} + ${tiers.manifestsGenerated}`);
} else {
  notes.push('6 README not written yet -- number checks skipped');
}

// 7 -- hygiene
if (hasGit(ROOT)) {
  const trackedFiles = git(ROOT, 'ls-files').split('\n');
  const leaked = trackedFiles.filter((f) => f.startsWith('.upstream/') || f.startsWith('node_modules/'));
  check(leaked.length === 0, '7a .upstream/node_modules not tracked', leaked.slice(0, 5).join(', '));
  const seed = trackedFiles.filter((f) => /(^|\/)(node_modules|dist|\.playwright-mcp)\//.test(f)
    && !f.includes('/payload/dist/'));
  check(seed.length === 0, '7b no build output tracked', seed.slice(0, 5).join(', '));
} else {
  notes.push('7 git not initialised -- hygiene checks skipped');
}
check(!fs.existsSync(path.join(ROOT, 'claude-marketplace.schema.json')), '7c no stray schema dump at repo root');
check(fs.existsSync(path.join(ROOT, 'LICENSE')), '7d LICENSE present');
check(fs.existsSync(path.join(ROOT, 'NOTICE.md')), '7e NOTICE.md present');
const attrs = fs.existsSync(path.join(ROOT, '.gitattributes'))
  ? fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8') : '';
check(/^\*\s+-text\s*$/m.test(attrs), '7f .gitattributes disables EOL rewrite (a clone must stay byte-identical)');

// 7g -- the real promise of this repo: mirrored bytes == upstream bytes. Checked
// against the upstream commit's blob ids, so a CRLF checkout or a stray edit to a
// mirrored file cannot pass. Skips only when .upstream is absent (verify-only runs).
const upstreamModes = new Map();
if (hasGit(UPSTREAM_DIR)) {
  const blobSha = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
  const upstream = new Map();
  for (const line of git(UPSTREAM_DIR, 'ls-tree', '-r', 'HEAD').split('\n')) {
    const m = line.match(/^(\d+) blob ([0-9a-f]+)\t(.+)$/);
    if (!m) continue;
    upstream.set(m[3], m[2]);
    if (m[1] === '100755') upstreamModes.set(m[3], m[1]);
  }
  const walk = (abs, rel) => fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const childAbs = path.join(abs, e.name);
    const childRel = `${rel}/${e.name}`;
    return e.isDirectory() ? walk(childAbs, childRel) : [childRel];
  });
  const drifted = [];
  let compared = 0;
  for (const tree of cfg.trees) {
    const dir = path.join(ROOT, tree);
    if (!fs.existsSync(dir)) continue;
    for (const rel of walk(dir, tree)) {
      const want = upstream.get(rel);
      if (!want) continue; // generated files (e.g. the 28 claude manifests) are not upstream
      compared++;
      if (blobSha(fs.readFileSync(path.join(ROOT, rel))) !== want) drifted.push(rel);
    }
  }
  check(compared > 0 && drifted.length === 0, `7g ${compared} mirrored files byte-identical to upstream`,
    drifted.slice(0, 5).join(', '));
} else {
  notes.push('7g .upstream absent -- byte-identity check skipped');
}

// 7h -- path extraction must be platform-neutral. A captured ref that still holds
// a backslash resolves on Windows and fails on Linux, which silently produced two
// different tier counts for the same tree.
const backslashRefs = (portability.plugins ?? []).flatMap((p) =>
  (p.reasons ?? []).filter((r) => /[A-Za-z0-9_.-]\\/.test(r)).map((r) => `${p.name}: ${r}`));
check(backslashRefs.length === 0, '7h no reason string carries a backslash path', backslashRefs.slice(0, 3).join(' | '));

// 7i -- the executable bit is part of the payload. Upstream stores 23 files as
// 100755 (installers, hooks, the mimosa dist entrypoint). fs.writeFileSync lands
// 0644, and a mode-blind mirror therefore demotes them. Windows cannot show the
// drift -- it has no exec bit and core.filemode=false -- so the only honest place
// to assert it is a POSIX working tree, which is also the tree that commits.
// Deliberately checks disk and not `git ls-files -s`: sync chmods files that are
// not staged yet, so the index still holds the pre-sync mode until `git add`.
const execInTrees = [...upstreamModes.keys()].filter((rel) => cfg.trees.some((t) => rel.startsWith(`${t}/`)));
if (hasGit(UPSTREAM_DIR) && process.platform !== 'win32') {
  const notExec = execInTrees.filter((rel) => {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) return false; // absence is 7g's finding, not this one
    return !(fs.statSync(abs).mode & 0o111);
  });
  check(notExec.length === 0, `7i ${execInTrees.length} upstream executables keep their +x`, notExec.slice(0, 5).join(', '));
} else if (process.platform === 'win32') {
  notes.push(`7i skipped on win32 (no exec bits; ${execInTrees.length} files to preserve, enforced by CI)`);
} else {
  notes.push('7i .upstream absent -- executable-bit check skipped');
}

// 8 -- the two hand-picked decisions
const gh = claudeListed.find((e) => e.name === 'zcode-github');
check(!!gh, '8a github is published to Claude as zcode-github');
check(gh?.source === './plugins/github', '8b zcode-github still points at the original dir', gh?.source);
check(!claudeMarket.renames || claudeMarket.renames.github === 'zcode-github', '8c renames map records github -> zcode-github',
  JSON.stringify(claudeMarket.renames));
check(![...zcodeListed, ...zcodeUnlisted].some((e) => e.name === 'example-plugin'),
  '8d example-plugin stays out of the ZCode marketplace, as upstream has it');
check(!claudeListed.some((e) => e.name === 'example-plugin'), '8e example-plugin stays out of the Claude marketplace');
check(names.has('example-plugin'), '8f example-plugin is still mirrored on disk');

// ---------------------------------------------------------------------------
const label = failures.length ? 'FAIL' : 'OK';
console.log(`[verify] ${label} -- ${notes.length} checks passed, ${failures.length} failed`);
for (const line of failures) console.error(`  x ${line}`);
if (failures.length) process.exit(1);
console.log(`[verify] sha ${portability.sha.slice(0, 12)} | ${catalog.total} plugins | manifests ${tracked.size} upstream + ${generated.length} copies | markets zcode ${zcodeListed.length}+${zcodeUnlisted.length} / claude ${claudeListed.length}`);
