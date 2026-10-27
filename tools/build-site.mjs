#!/usr/bin/env node
/**
 * Build dist/ for GitHub Pages: one self-contained page over data/catalog.json.
 *
 * The page's job is narrower than the sibling market repos -- ZCode users
 * already have these plugins, so this is for everyone else: "which of these 54
 * still work in my agent, and what do I lose". Tier is therefore the primary
 * axis, not category, and the row renders the same gap text the README does.
 *
 * No bundler, no framework, no external asset: a single HTML file with an
 * inline filter keeps the deploy a copy step.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR, readJson } from './lib.mjs';

const SITE_URL = 'https://kael-odin.github.io/zcode-plugins-zh/';
const REPO_URL = 'https://github.com/kael-odin/zcode-plugins-zh';
const UPSTREAM_URL = 'https://github.com/zai-org/zcode-plugins';

const catalog = readJson(path.join(DATA_DIR, 'catalog.json'));
const portability = readJson(path.join(DATA_DIR, 'portability.json'));
const c = catalog.counts;

const TIERS = [
  { id: 'clean', label: '直接可用', icon: '✅', cls: 'ok' },
  { id: 'degraded', label: '降级可用', icon: '⚠️', cls: 'warn' },
  { id: 'skills-only', label: '仅技能可用', icon: '⚠️', cls: 'warn' },
  { id: 'blocked-host', label: '受阻于宿主', icon: '❌', cls: 'bad' },
  { id: 'blocked-unbuilt', label: '受阻于未构建', icon: '❌', cls: 'bad' },
];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Same rule the README generator uses: name what the reader loses. */
function gap(p) {
  if (p.tier === 'clean') return '';
  if (p.tier === 'skills-only') return '宿主托管 MCP 不可用（ZCode 侧不开源）';
  if (p.tier === 'blocked-host') {
    return `MCP ${p.mcpServers.map((m) => m.name).join('、')} 依赖 ZCode 宿主变量`;
  }
  if (p.tier === 'blocked-unbuilt') {
    return '缺上游未提交的构建产物 dist/';
  }
  return (p.reasons[0] ?? '与 ZCode 环境有耦合')
    .replace(/（[^）]*）$/, '').replace(/，其它 agent 不会展开该变量/, '');
}

const tierOf = (id) => TIERS.find((t) => t.id === id) ?? TIERS[0];

function mcpCell(p) {
  if (!p.mcpServers.length) return '<span class="dim">·</span>';
  return p.mcpServers
    .map((m) => `<code>${esc(m.name)}</code>${m.transport ? ` <span class="dim">${esc(m.transport)}</span>` : ''}`)
    .join('<br>');
}

const rows = catalog.plugins
  .slice()
  .sort((a, b) => TIERS.findIndex((t) => t.id === a.tier) - TIERS.findIndex((t) => t.id === b.tier)
    || a.name.localeCompare(b.name))
  .map((p) => {
    const t = tierOf(p.tier);
    const dir = p.source.replace(/^\.\//, '');
    return `<tr data-tier="${p.tier}" data-name="${esc(p.name)}" data-text="${esc(`${p.name} ${p.category} ${p.descriptionZh ?? ''}`.toLowerCase())}">
  <td><a href="${REPO_URL}/tree/main/${dir}" target="_blank" rel="noopener"><code>${esc(p.name)}</code></a>${p.claudeName && p.claudeName !== p.name ? `<br><span class="dim">Claude 里叫 <code>${esc(p.claudeName)}</code></span>` : ''}</td>
  <td><span class="badge ${t.cls}">${t.icon} ${t.label}</span></td>
  <td class="num">${p.components.skills || '<span class="dim">·</span>'}</td>
  <td class="num">${p.components.commands || '<span class="dim">·</span>'}</td>
  <td class="num">${p.components.agents || '<span class="dim">·</span>'}</td>
  <td>${mcpCell(p)}</td>
  <td><span class="dim">${esc(p.category ?? '')}</span></td>
  <td class="gap">${esc(gap(p))}</td>
</tr>`;
  })
  .join('\n');

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'ZCode 官方插件可移植性矩阵',
      alternateName: 'zcode-plugins-zh',
      description: `zai-org/zcode-plugins 的 ${c.total} 个官方插件在 Claude Code / Codex 等其它 agent 里的可用性矩阵；插件源码与上游逐字节一致。`,
      inLanguage: 'zh-CN',
      isBasedOn: UPSTREAM_URL,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}#catalog`,
      url: SITE_URL,
      name: `ZCode 官方插件 · ${c.total} 个`,
      inLanguage: 'zh-CN',
      isPartOf: { '@id': `${SITE_URL}#website` },
      dateModified: catalog.generatedAt,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: catalog.plugins.length,
        itemListElement: catalog.plugins.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          url: `${REPO_URL}/tree/main/${p.source.replace(/^\.\//, '')}`,
          description: p.descriptionZh ?? undefined,
        })),
      },
    },
  ],
};

const filters = TIERS
  .map((t) => `<button class="chip ${t.cls}" data-filter="${t.id}">${t.icon} ${t.label} <b>${catalog.plugins.filter((p) => p.tier === t.id).length}</b></button>`)
  .join('\n      ');

const html = `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ZCode 官方插件可移植性矩阵 · ${c.total} 个插件在 Claude Code / Codex 里能用多少</title>
<meta name="description" content="zai-org/zcode-plugins 的 ${c.total} 个官方插件，逐个标注在其它 agent 里的可用性：${c.clean} 个直接可用、${c.degraded + c.skillsOnly} 个部分可用、${c.blockedHost + c.blockedUnbuilt} 个装了也没用。插件源码与上游逐字节一致。">
<link rel="canonical" href="${SITE_URL}">
<meta property="og:type" content="website">
<meta property="og:title" content="ZCode 官方插件可移植性矩阵">
<meta property="og:description" content="${c.total} 个官方插件在 Claude Code / Codex 里的可用性，逐条标注缺口。">
<meta property="og:url" content="${SITE_URL}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>
  :root{
    --bg:#05070c; --panel:#0d131c; --line:#1c2635; --fg:#e8eef7; --dim:#7d8ba1;
    --ok:#34d399; --warn:#fbbf24; --bad:#f87171; --accent:#22d3ee;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);
    font:15px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI","Noto Sans SC",sans-serif}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  code{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
    background:#111a26;border:1px solid var(--line);border-radius:5px;padding:1px 5px}
  .wrap{max-width:1180px;margin:0 auto;padding:48px 20px 80px}
  header h1{font-size:30px;line-height:1.25;margin:0 0 12px;letter-spacing:-.02em}
  header p.lead{color:var(--dim);margin:0 0 22px;max-width:76ch}
  .stats{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 26px}
  .stat{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 14px;min-width:112px}
  .stat b{display:block;font-size:22px;line-height:1.2}
  .stat span{color:var(--dim);font-size:12px}
  .stat.ok b{color:var(--ok)} .stat.warn b{color:var(--warn)} .stat.bad b{color:var(--bad)}
  .install{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:0 0 28px}
  .install h2{font-size:14px;margin:0 0 10px;color:var(--dim);font-weight:600;letter-spacing:.04em;text-transform:uppercase}
  .install p{margin:6px 0}
  .controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}
  .chip{background:var(--panel);border:1px solid var(--line);color:var(--fg);
    border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer}
  .chip b{color:var(--dim);font-weight:400;margin-left:2px}
  .chip[aria-pressed="true"]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
  input[type=search]{flex:1 1 220px;min-width:180px;background:var(--panel);color:var(--fg);
    border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:13px}
  input[type=search]:focus{outline:none;border-color:var(--accent)}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  thead th{text-align:left;color:var(--dim);font-weight:600;font-size:12px;letter-spacing:.04em;
    text-transform:uppercase;padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--bg)}
  tbody td{padding:9px 10px;border-bottom:1px solid #101720;vertical-align:top}
  tbody tr:hover{background:#0a111b}
  td.num{text-align:right;font-variant-numeric:tabular-nums;width:52px}
  .badge{display:inline-block;white-space:nowrap;border-radius:999px;padding:2px 9px;font-size:12px;border:1px solid}
  .badge.ok{color:var(--ok);border-color:#14532d;background:#052e1a}
  .badge.warn{color:var(--warn);border-color:#533f0d;background:#2a1f05}
  .badge.bad{color:var(--bad);border-color:#5a1d1d;background:#2a0f0f}
  .dim{color:var(--dim)}
  td.gap{color:#b9c5d6;font-size:12.5px;min-width:220px}
  footer{margin-top:36px;padding-top:20px;border-top:1px solid var(--line);color:var(--dim);font-size:13px}
  .empty{display:none;padding:28px 4px;color:var(--dim)}
  @media(max-width:860px){
    thead th:nth-child(3),thead th:nth-child(4),thead th:nth-child(5),thead th:nth-child(7),
    tbody td:nth-child(3),tbody td:nth-child(4),tbody td:nth-child(5),tbody td:nth-child(7){display:none}
    td.gap{min-width:0}
  }
</style>
<div class="wrap">
<header>
  <h1>ZCode 官方插件，在别的 agent 里还剩多少</h1>
  <p class="lead"><a href="${UPSTREAM_URL}" target="_blank" rel="noopener">zai-org/zcode-plugins</a> 的 ${c.total} 个插件全部镜像在此，源码逐字节未改。这一页只回答一件事：装进 Claude Code 或 Codex 之后，哪些能力还在、哪些会静默失效。</p>
  <div class="stats">
    <div class="stat ok"><b>${c.clean}</b><span>直接可用</span></div>
    <div class="stat warn"><b>${c.degraded + c.skillsOnly}</b><span>部分可用</span></div>
    <div class="stat bad"><b>${c.blockedHost + c.blockedUnbuilt}</b><span>装了也没用</span></div>
    <div class="stat"><b>${c.total}</b><span>镜像插件</span></div>
  </div>
</header>

<section class="install">
  <h2>装之前</h2>
  <p>Claude Code：<code>claude plugin marketplace add kael-odin/zcode-plugins-zh</code>，然后 <code>claude plugin install zcode-github@zcode-plugins-zh</code>。</p>
  <p>Codex：<code>codex plugin marketplace add https://github.com/kael-odin/zcode-plugins-zh.git</code>。</p>
  <p class="dim">ZCode 自带官方市场，这个仓库对 ZCode 本身没有增量；它的价值在另外两个 agent 里。</p>
</section>

<div class="controls">
  <button class="chip" data-filter="all" aria-pressed="true">全部 <b>${c.total}</b></button>
  ${filters}
  <input type="search" id="q" placeholder="搜插件名 / 分类 / 描述…" aria-label="搜索插件">
</div>

<table>
  <thead><tr>
    <th>插件</th><th>结论</th><th style="text-align:right">技能</th><th style="text-align:right">命令</th>
    <th style="text-align:right">代理</th><th>MCP</th><th>分类</th><th>缺口</th>
  </tr></thead>
  <tbody>
${rows}
  </tbody>
</table>
<p class="empty" id="empty">没有匹配的插件。</p>

<footer>
  上游 <a href="${UPSTREAM_URL}" target="_blank" rel="noopener">zai-org/zcode-plugins</a>，Apache-2.0，镜像自
  <code>${esc(portability.sha.slice(0, 12))}</code>。本仓库的补充内容与移除流程见
  <a href="${REPO_URL}/blob/main/NOTICE.md" target="_blank" rel="noopener">NOTICE.md</a>。
  ZCode、Z.ai 为描述性提及，不代表任何背书。
</footer>
</div>
<script>
(function () {
  var chips = [].slice.call(document.querySelectorAll('.chip'));
  var rows = [].slice.call(document.querySelectorAll('tbody tr'));
  var q = document.getElementById('q');
  var empty = document.getElementById('empty');
  var tier = 'all';
  function apply() {
    var text = (q.value || '').trim().toLowerCase();
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (tier === 'all' || r.dataset.tier === tier) &&
               (!text || r.dataset.text.indexOf(text) !== -1);
      r.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    empty.style.display = shown ? 'none' : 'block';
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      tier = c.dataset.filter;
      chips.forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      apply();
    });
  });
  q.addEventListener('input', apply);
})();
</script>
</html>
`;

const dist = path.join(ROOT, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(dist, '.nojekyll'), '', 'utf8');
fs.writeFileSync(path.join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}sitemap.xml\n`, 'utf8');
fs.writeFileSync(path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${SITE_URL}</loc><lastmod>${String(catalog.generatedAt ?? '').slice(0, 10)}</lastmod></url>\n</urlset>\n`,
  'utf8');

console.log(`[site] dist/index.html built (${catalog.plugins.length} rows, ${(html.length / 1024).toFixed(0)} KB)`);
