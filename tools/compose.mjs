#!/usr/bin/env node
/**
 * Materialise the marketplace files.
 *
 * Two hosts, two manifests, one mirrored tree:
 *
 *   marketplace.json                  ZCode reads this (upstream's shape, our identity)
 *   .claude-plugin/marketplace.json   Claude Code reads this
 *   .agents/plugins/marketplace.json  Codex reads this (also its legacy-first path)
 *   <plugin>/.claude-plugin/plugin.json   created only where upstream ships none
 *
 * The plugin payload is never rewritten. Where upstream already ships a Claude
 * variant (26 of 54) those bytes are the authority and are left alone; the other
 * 28 get a byte-for-byte copy of their ZCode manifest. `tools/analyze.mjs`
 * explains per plugin why a copy is enough or what the host cannot provide.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, UPSTREAM_DIR, DATA_DIR, loadConfig, readJson, writeJson, sha256File, pluginDirs, claudeView } from './lib.mjs';

const cfg = loadConfig();
const upstreamMarketplace = readJson(path.join(UPSTREAM_DIR, 'marketplace.json'), {});
const portability = readJson(path.join(DATA_DIR, 'portability.json'));
if (!portability) throw new Error('data/portability.json missing -- run tools/analyze.mjs first');

const portabilityByName = new Map(portability.plugins.map((p) => [p.name, p]));
const upstreamEntry = new Map();
for (const entry of [...(upstreamMarketplace.plugins ?? []), ...(upstreamMarketplace.unlistedPlugins ?? [])]) {
  upstreamEntry.set(entry.name, entry);
}

const exclude = new Set(cfg.claudeExclude ?? []);
const renames = cfg.claudeRenames ?? {};
// One-click markets carry only the tiers that behave identically outside ZCode
// (default: clean). Everything else stays mirrored on disk as source material;
// the matrix explains what breaks and docs/ keeps the raw pointers.
const marketTiers = cfg.marketTiers ?? ['clean'];

const dirs = pluginDirs(ROOT, cfg.trees);

// Upstream mirrors one plugin it deliberately never lists: `example-plugin`, the
// template. It stays on disk and in the catalog, but no marketplace lists it --
// same as upstream -- so catalog metadata falls back to its own manifest
// instead of treating the absence as drift.
const unlistedUpstream = dirs.filter(({ name }) => !upstreamEntry.has(name)).map(({ name }) => name);

/** Upstream marketplace entry, or a stand-in derived from the plugin's own manifest. */
function metaFor(name) {
  const entry = upstreamEntry.get(name);
  if (entry) return entry;
  const { dir } = dirs.find((d) => d.name === name);
  const manifest = readJson(path.join(dir, '.zcode-plugin', 'plugin.json'), {});
  return {
    name,
    description: manifest.description ?? '',
    description_i18n: manifest.description_i18n ?? {},
    version: manifest.version,
    author: manifest.author,
    keywords: manifest.keywords ?? [],
  };
}

/** Upstream publishes these; a plugin missing from markets is intentional, not drift. */
const published = (name) => upstreamEntry.has(name);

// ---------------------------------------------------------------------------
// 1. Per-plugin Claude manifests
// ---------------------------------------------------------------------------

const generated = [];
const upstreamVariants = [];

for (const { name, dir } of dirs) {
  const view = claudeView(dir);
  if (view.source === 'upstream') {
    upstreamVariants.push(name);
    continue;
  }
  const target = path.join(dir, '.claude-plugin', 'plugin.json');
  const source = path.join(dir, '.zcode-plugin', 'plugin.json');
  const bytes = view.bytes ?? Buffer.from(`${JSON.stringify(view.manifest, null, 2)}\n`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  const sha = sha256File(target);
  if (view.identical && sha !== sha256File(source)) {
    throw new Error(`${name}: expected a byte copy of the ZCode manifest, hash differs`);
  }
  generated.push({ name, sha256: sha, identical: view.identical, stripped: view.stripped });
}

// ---------------------------------------------------------------------------
// 2. Claude Code marketplace
// ---------------------------------------------------------------------------

const claudeEntries = [];
for (const { name, rel } of dirs) {
  if (exclude.has(name) || !published(name)) continue;
  if (!marketTiers.includes(portabilityByName.get(name)?.tier)) continue;
  const src = metaFor(name);
  const claudeName = renames[name] ?? name;
  const entry = {
    name: claudeName,
    description: src.description_i18n?.['zh-CN'] ?? src.description ?? '',
    source: `./${rel}`,
    category: src.category ?? cfg.zcodeCategory,
  };
  if (src.version) entry.version = src.version;
  if (src.author) entry.author = src.author;
  if (src.homepage) entry.homepage = src.homepage;
  else entry.homepage = `https://github.com/${cfg.upstreamRepo}/tree/${portability.sha}/${rel}`;
  if (src.icon) entry.icon = src.icon;
  claudeEntries.push(entry);
}
claudeEntries.sort((a, b) => a.name.localeCompare(b.name));

const appliedRenames = Object.fromEntries(
  Object.entries(renames).filter(([from, to]) => from !== to && claudeEntries.some((e) => e.name === to)),
);

writeJson(path.join(ROOT, '.claude-plugin', 'marketplace.json'), {
  $schema: 'https://anthropic.com/claude-code/marketplace.schema.json',
  name: cfg.marketplace,
  description: 'ZCode 官方插件市场的中文/可移植镜像：同一份插件源码，ZCode、Claude Code、Codex 都能装。',
  owner: cfg.owner,
  renames: appliedRenames,
  plugins: claudeEntries,
});

// ---------------------------------------------------------------------------
// 3. Codex marketplace
// ---------------------------------------------------------------------------

// codex-rs resolves marketplaces by probing `.agents/plugins/marketplace.json`
// before `.claude-plugin/marketplace.json`, so shipping the Codex-native file
// keeps `plugin marketplace add` working on releases that predate Claude-dialect
// discovery. Entry schema is name + source (+ optional policy/category); the
// source object form mirrors openai/plugins. Entry descriptions are tolerated
// (they feed Codex's manifest fallback) but listing metadata mostly comes from
// each plugin's `.claude-plugin/plugin.json`, which Codex also discovers.
writeJson(path.join(ROOT, '.agents', 'plugins', 'marketplace.json'), {
  name: cfg.marketplace,
  plugins: claudeEntries.map(({ name, description, source, category, version }) => ({
    name,
    source: { source: 'local', path: source },
    ...(category ? { category } : {}),
    ...(description ? { description } : {}),
    ...(version ? { version } : {}),
  })),
});

// ---------------------------------------------------------------------------
// 4. ZCode marketplace (same tree, upstream identity replaced)
// ---------------------------------------------------------------------------

// Upstream keeps a second bucket for plugins it ships but hides from the UI
// (`openpencil`). Mirror that split rather than flattening it, so our file stays
// a faithful copy of upstream's listing.
const upstreamUnlisted = new Set((upstreamMarketplace.unlistedPlugins ?? []).map((e) => e.name));
const zcodeEntry = ({ name, rel }) => {
  const { source: _ignored, ...rest } = upstreamEntry.get(name);
  return { ...rest, source: `./${rel}` };
};
const zcodeListedEntries = dirs.filter(({ name }) => published(name) && !upstreamUnlisted.has(name)).map(zcodeEntry);
const zcodeUnlistedEntries = dirs.filter(({ name }) => published(name) && upstreamUnlisted.has(name)).map(zcodeEntry);

writeJson(path.join(ROOT, 'marketplace.json'), {
  name: cfg.marketplace,
  description: 'ZCode 官方插件市场镜像（源码逐字保留，附中文说明与跨 agent 可移植性标注）。',
  description_i18n: {
    en: 'A mirror of the official ZCode plugin marketplace with Chinese descriptions and cross-agent portability notes.',
    'zh-CN': 'ZCode 官方插件市场镜像（源码逐字保留，附中文说明与跨 agent 可移植性标注）。',
  },
  owner: cfg.owner,
  plugins: zcodeListedEntries,
  ...(zcodeUnlistedEntries.length ? { unlistedPlugins: zcodeUnlistedEntries } : {}),
});

// ---------------------------------------------------------------------------
// 5. Catalog for the README and the site
// ---------------------------------------------------------------------------

const catalogPlugins = dirs
  .map(({ name, rel }) => {
    const src = metaFor(name);
    const p = portabilityByName.get(name);
    return {
      name,
      claudeName: renames[name] ?? name,
      source: `./${rel}`,
      category: src.category ?? cfg.zcodeCategory,
      descriptionZh: src.description_i18n?.['zh-CN'] ?? src.description ?? '',
      descriptionEn: src.description_i18n?.en ?? src.description ?? '',
      version: src.version ?? null,
      author: src.author?.name ?? null,
      homepage: src.homepage ?? null,
      icon: src.icon ?? null,
      license: src.license ?? null,
      keywords: src.keywords ?? [],
      listed: published(name) && !(upstreamMarketplace.unlistedPlugins ?? []).some((e) => e.name === name),
      inZcodeMarket: published(name),
      inClaudeMarket: published(name) && !exclude.has(name) && marketTiers.includes(p?.tier),
      claudeExcluded: exclude.has(name),
      tier: p?.tier ?? null,
      reasons: p?.reasons ?? [],
      portableAfterRewrite: p?.portableAfterRewrite ?? false,
      claudeManifest: p?.claude?.source ?? null,
      components: p?.components ?? null,
      mcpServers: p?.mcpServers ?? [],
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

writeJson(path.join(DATA_DIR, 'catalog.json'), {
  // Same reason as sync.mjs: derived from the upstream commit, never the clock.
  // catalog.json is the input to the site build and the README matrix, and a
  // wall-clock stamp alone is enough to make the daily workflow commit nothing
  // but a timestamp.
  generatedAt: portability.syncedAt,
  upstream: cfg.upstreamRepo,
  sha: portability.sha,
  syncedAt: portability.syncedAt,
  marketplace: cfg.marketplace,
  marketTiers,
  total: catalogPlugins.length,
  counts: {
    ...portability.counts,
    claudeListed: claudeEntries.length,
    codexListed: claudeEntries.length,
    claudeExcluded: catalogPlugins.filter((p) => p.claudeExcluded).length,
    offMarketRaw: catalogPlugins.filter((p) => p.inZcodeMarket && !p.inClaudeMarket).length,
    zcodeListed: zcodeListedEntries.length,
    zcodeUnlisted: zcodeUnlistedEntries.length,
    unlistedUpstream: unlistedUpstream.length,
    manifestsFromUpstream: upstreamVariants.length,
    manifestsGenerated: generated.length,
    manifestsGeneratedRewritten: generated.filter((g) => !g.identical).length,
    manifestsGeneratedByteCopies: generated.filter((g) => g.identical).length,
  },
  rules: portability.rules,
  plugins: catalogPlugins,
});

console.log(`[compose] ${catalogPlugins.length} plugins mirrored; ZCode marketplace lists ${zcodeListedEntries.length}+${zcodeUnlistedEntries.length} unlisted; one-click markets (tiers: ${marketTiers.join('/')}) list ${claudeEntries.length} (Claude + Codex each)`);
if (unlistedUpstream.length) console.log(`[compose] mirrored but unlisted upstream (kept out of both markets): ${unlistedUpstream.join(', ')}`);
console.log(`[compose] Claude manifests: ${upstreamVariants.length} upstream + ${generated.length} generated (${generated.filter((g) => !g.identical).length} rewritten, ${generated.filter((g) => g.identical).length} byte copies)`);
if (Object.keys(appliedRenames).length) {
  console.log(`[compose] renamed for Claude: ${Object.entries(appliedRenames).map(([a, b]) => `${a}->${b}`).join(', ')}`);
}
if (exclude.size) console.log(`[compose] excluded from Claude marketplace: ${[...exclude].join(', ')}`);
