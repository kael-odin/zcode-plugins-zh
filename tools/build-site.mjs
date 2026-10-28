// Build the static site into dist/ (hand-authored site/ shell + data/catalog.json).
//
// Same architecture as the sibling repos: site/index.html is a JS-rendered SPA
// shell; this script substitutes the crawlable counts, injects JSON-LD (the
// ItemList is what makes 54 plugins machine-readable), and emits sitemap.xml +
// robots.txt. Icons are pre-fetched into site/appicons/ by tools/fetch-icons.mjs
// and copied through as-is.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from './lib.mjs';

const SITE_URL = 'https://kael-odin.github.io/zcode-plugins-zh/';
const UPSTREAM_URL = 'https://github.com/zai-org/zcode-plugins';

const dist = path.join(ROOT, 'dist');
// Windows watchers (indexer/AV/a serving process) can hold a transient handle
// on dist and make the rm EPERM. Every write below overwrites in place, so a
// failed clear only risks stale extras locally -- CI (Linux) never sees it.
try {
  fs.rmSync(dist, { recursive: true, force: true });
} catch (err) {
  console.warn(`[build-site] could not clear dist/ (${err.code}); overwriting in place`);
}
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, '.nojekyll'), '', 'utf8');
fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><meta charset="utf-8"><title>404</title><script>location.replace("./")</' + 'script>', 'utf8');

const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'catalog.json'), 'utf8'));
const lastmod = String(catalog.generatedAt ?? '').slice(0, 10);
const total = catalog.total;
const clean = catalog.plugins.filter((p) => p.inClaudeMarket).length;

const cut = (s, n = 200) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

const itemUrl = (p) => p.homepage ?? `${SITE_URL}#${p.name}`;

const jsonld = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      url: SITE_URL,
      name: 'ZCode 官方插件 · 跨 agent 可移植版',
      alternateName: 'zcode-plugins-zh',
      description:
        `zai-org/zcode-plugins 的 ${total} 个官方插件的跨 agent 可移植性矩阵：${clean} 个直接可用插件一键装进 Claude Code / Codex，其余按实测缺口标注，源码逐字节一致。`,
      inLanguage: 'zh-CN',
      isBasedOn: UPSTREAM_URL,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
    },
    {
      '@type': 'CollectionPage',
      '@id': `${SITE_URL}#catalog`,
      url: SITE_URL,
      name: `ZCode 官方插件跨 agent 可移植性矩阵 · ${total} 个插件`,
      description: '可搜索的插件导航：真实图标、三档可移植性判定、逐条缺口原因，数据每日自动跟随上游更新。',
      inLanguage: 'zh-CN',
      isPartOf: { '@id': `${SITE_URL}#website` },
      dateModified: catalog.generatedAt,
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: total,
        itemListOrder: 'https://schema.org/ItemListOrderAscending',
        itemListElement: catalog.plugins.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          description: cut(p.descriptionZh || p.descriptionEn),
          url: itemUrl(p),
        })),
      },
    },
  ],
};

// The shell states counts in crawlable prose. Substitute them at build time so
// the static text stays true after a sync instead of drifting from the catalog
// the JS renders next to it.
const shell = fs
  .readFileSync(path.join(ROOT, 'site', 'index.html'), 'utf8')
  .replaceAll('{{TOTAL}}', String(total))
  .replaceAll('{{CLEAN}}', String(clean));
if (/\{\{[A-Z_]+\}\}/.test(shell)) {
  throw new Error(`[build-site] unsubstituted placeholder: ${shell.match(/\{\{[A-Z_]+\}\}/)[0]}`);
}
fs.writeFileSync(path.join(dist, 'index.html'), shell, 'utf8');

for (const f of ['style.css', 'app.js']) {
  fs.copyFileSync(path.join(ROOT, 'site', f), path.join(dist, f));
}
fs.copyFileSync(path.join(DATA_DIR, 'catalog.json'), path.join(dist, 'catalog.json'));

fs.writeFileSync(
  path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `  <url><loc>${SITE_URL}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n` +
    '</urlset>\n',
  'utf8',
);
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE_URL}sitemap.xml`, ''].join('\n'),
  'utf8',
);

if (fs.existsSync(path.join(ROOT, 'site', 'appicons'))) {
  fs.cpSync(path.join(ROOT, 'site', 'appicons'), path.join(dist, 'appicons'), { recursive: true });
}
console.log(`[build-site] dist/ ready — ${total} plugins, ${clean} in the one-click market, JSON-LD ItemList emitted`);
