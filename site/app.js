const MARKET_REPO = 'kael-odin/zcode-plugins-zh';
const MARKET_URL = `https://github.com/${MARKET_REPO}.git`;
const REPO_TREE = `https://github.com/${MARKET_REPO}/tree/main`;

const CATEGORY_ZH = {
  finance: '金融',
  'developer-tools': '开发者工具',
  productivity: '生产力',
  '游戏/3D': '游戏 / 3D',
};

// Tier metadata: label, badge class, sort rank, and which quick-filter pill
// the tier belongs to. clean=直接可用; degraded/skills-only=部分可用;
// blocked-host/blocked-unbuilt=装了也没用.
const TIERS = {
  clean: { label: '✅ 直接可用', cls: 'ok', rank: 0, pill: 'ok' },
  degraded: { label: '⚠️ 降级可用', cls: 'warn', rank: 1, pill: 'warn' },
  'skills-only': { label: '⚠️ 仅技能可用', cls: 'warn', rank: 2, pill: 'warn' },
  'blocked-host': { label: '❌ 受阻于宿主', cls: 'bad', rank: 3, pill: 'bad' },
  'blocked-unbuilt': { label: '❌ 受阻于未构建', cls: 'bad', rank: 4, pill: 'bad' },
};
const PILL_OF = { all: '全部', ok: '直接可用', warn: '部分可用', bad: '装了也没用' };

const state = { q: '', cat: null, quick: 'all', sort: 'default', theme: 'light', selected: null };
let CATALOG = null;
let ITEMS = [];

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => (s ?? '').toLowerCase();
const fmt = (n) => n.toLocaleString('en-US');

function colorFor(key) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 45% 45%)`;
}

const catZh = (slug) => CATEGORY_ZH[slug] ?? slug ?? '';
const tierOf = (p) => TIERS[p.tier] ?? { label: p.tier ?? '未判定', cls: '', rank: 9, pill: 'warn' };

function buildItems() {
  ITEMS = CATALOG.plugins.map((p) => {
    const tier = tierOf(p);
    return {
      key: p.name,
      color: colorFor(p.name),
      initial: p.name[0].toUpperCase(),
      name: p.name,
      version: p.version ?? '',
      desc: p.descriptionZh || p.descriptionEn || '',
      descEn: p.descriptionEn || '',
      category: catZh(p.category),
      tier,
      badges: [
        { text: tier.label, cls: tier.cls },
        ...(p.inClaudeMarket ? [{ text: '一键市场', cls: 'new' }] : []),
      ],
      search: [p.name, p.descriptionZh, p.descriptionEn, catZh(p.category), p.tier, ...(p.keywords ?? [])],
      raw: p,
    };
  });
}

function match(it) {
  if (state.quick !== 'all' && it.tier.pill !== state.quick) return false;
  if (state.cat && it.category !== state.cat) return false;
  if (!state.q) return true;
  const q = norm(state.q);
  return it.search.some((v) => norm(v).includes(q));
}

function sorted(list) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (state.sort === 'az') return [...list].sort(byName);
  if (state.sort === 'za') return [...list].sort((a, b) => byName(b, a));
  // Default: usable first, then by tier rank -- the ordering a reader needs when
  // deciding what to install.
  return [...list].sort((a, b) => a.tier.rank - b.tier.rank || byName(a, b));
}

// Local icon first (site/appicons, committed); on 404 fall back to the remote
// CDN URL from the catalog, then to the monogram tile.
function iconHTML(it, size) {
  const s = `style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px;background:${esc(it.color)}"`;
  const local = `./appicons/${esc(it.raw.name)}.png`;
  if (it.raw.icon) {
    return `<img class="icon" loading="lazy" src="${local}" alt="${esc(it.name)}" ${s}
      onerror="if(this.src!=='${esc(it.raw.icon)}'){this.src='${esc(it.raw.icon)}'}else{this.classList.add('hide');this.nextElementSibling.classList.remove('hide')}">
      <div class="tile hide" ${s}>${esc(it.initial)}</div>`;
  }
  return `<img class="icon" loading="lazy" src="${local}" alt="${esc(it.name)}" ${s}
    onerror="this.classList.add('hide');this.nextElementSibling.classList.remove('hide')">
    <div class="tile hide" ${s}>${esc(it.initial)}</div>`;
}

function renderRail() {
  const counts = new Map();
  for (const it of ITEMS) {
    if (state.quick !== 'all' && it.tier.pill !== state.quick) continue;
    counts.set(it.category, (counts.get(it.category) ?? 0) + 1);
  }
  const cats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const total = [...counts.values()].reduce((x, y) => x + y, 0);
  $('#rail').innerHTML = [{ key: null, label: '全部', count: total }]
    .concat(cats.map(([label, count]) => ({ key: label, label, count })))
    .map((c) => `<button class="side-btn ${state.cat === c.key ? 'active' : ''}" data-cat="${esc(c.key ?? '')}">
        <span>${esc(c.label)}</span><span>${fmt(c.count)}</span></button>`)
    .join('');
  $('#rail').querySelectorAll('.side-btn').forEach((el) =>
    el.addEventListener('click', () => {
      state.cat = el.dataset.cat || null;
      renderAll();
    }),
  );
  const sel = $('#f-cat');
  sel.innerHTML = `<option value="">全部分类</option>` +
    cats.map(([label, count]) => `<option value="${esc(label)}"${label === state.cat ? ' selected' : ''}>${esc(label)} (${count})</option>`).join('');
}

function renderPills() {
  const countOf = (pill) => (pill === 'all' ? ITEMS.length : ITEMS.filter((i) => i.tier.pill === pill).length);
  const defs = ['all', 'ok', 'warn', 'bad'].map((k) => [k, `${PILL_OF[k]} ${fmt(countOf(k))}`]);
  $('#pills').innerHTML = defs
    .map(([k, label]) => `<button class="quick-btn ${state.quick === k ? 'active' : ''}" data-k="${k}">${esc(label)}</button>`)
    .join('');
  $('#pills').querySelectorAll('.quick-btn').forEach((el) =>
    el.addEventListener('click', () => {
      state.quick = el.dataset.k;
      state.cat = null;
      renderAll();
    }),
  );
}

function renderGrid() {
  const list = sorted(ITEMS.filter(match));
  $('#grid').innerHTML = list
    .map(
      (it) => `<div class="card ${state.selected === it.key ? 'selected' : ''}" data-key="${esc(it.key)}" role="button" tabindex="0">
        ${iconHTML(it, 58)}
        <h3>${esc(it.name)}</h3>
        <div class="en">${esc(it.category)}${it.version ? ` · v${esc(it.version)}` : ''}</div>
        <p class="desc">${esc(it.desc)}</p>
        <div class="badges">${it.badges.map((b) => `<span class="badge ${b.cls || ''}">${esc(b.text)}</span>`).join('')}</div>
      </div>`,
    )
    .join('');
  $('#grid').querySelectorAll('.card').forEach((el) => {
    const open = () => openDetail(el.dataset.key);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
  });
  const inMarket = CATALOG.plugins.filter((p) => p.inClaudeMarket).length;
  $('#count').textContent = `显示 ${fmt(list.length)} / ${fmt(ITEMS.length)} 个插件 · 一键市场 ${inMarket} 个（只列「直接可用」） · 数据每日自动同步`;
}

function capRow(label, value) {
  if (value === null || value === undefined) return '';
  return `<div class="cap"><span>${esc(label)}</span><b>${esc(String(value))}</b></div>`;
}

function installHTML(p) {
  const claudeName = p.claudeName ?? p.name;
  const block = (label, cmd) =>
    `<div class="cmd-line"><span>${esc(label)}</span><button class="copybtn" data-copy="${esc(cmd)}">${esc(cmd)}</button></div>`;
  return `<div class="block"><strong>一键安装（该插件在「直接可用」档）</strong>
    ${block('Claude Code', `claude plugin install ${claudeName}@zcode-plugins-zh`)}
    ${block('Codex', `codex plugin add ${claudeName}@zcode-plugins-zh`)}
    <p class="dim">第一次使用先加市场：<code>claude plugin marketplace add ${MARKET_REPO}</code>（Codex 见页脚）。装完重开会话。</p>
  </div>`;
}

function rawMaterialHTML(p) {
  return `<div class="block"><strong>不在一键市场 —— 仓库原始资料</strong>
    <p class="detail-desc" style="margin:10px 0">这个插件在其它 agent 里有实测确认的缺口（见上），所以不进一键安装市场。
    源码仍逐字保留在本仓库 <code>${esc(p.source ?? `plugins/${p.name}`)}/</code>，可以取用与改造；缺口逐条写在上方，改造即可用。</p>
    <a class="link" href="${REPO_TREE}/${esc(p.source ?? `plugins/${p.name}`)}" target="_blank" rel="noopener">在 GitHub 打开插件目录 ↗</a>
  </div>`;
}

function detailHTML(it) {
  const p = it.raw;
  const caps = p.components ?? {};
  const mcps = Array.isArray(p.mcpServers) ? p.mcpServers : [];
  const reasons = Array.isArray(p.reasons) ? p.reasons : [];
  return `<div style="display:flex;gap:16px;align-items:flex-start">
      ${iconHTML(it, 80)}
      <div style="min-width:0">
        <h2>${esc(p.name)}</h2>
        <div class="detail-en">${esc(p.author ?? '')}${p.author && it.category ? ' · ' : ''}${esc(it.category)}${p.version ? ` · v${esc(p.version)}` : ''}</div>
      </div>
    </div>
    <div class="badges" style="margin-top:12px">${it.badges.map((b) => `<span class="badge ${b.cls || ''}">${esc(b.text)}</span>`).join('')}</div>
    <div class="block"><strong>简介</strong><div class="detail-desc">${esc(it.desc)}</div>
      ${it.descEn ? `<details><summary style="cursor:pointer;font-size:13px">英文原文</summary><div class="original detail-desc">${esc(it.descEn)}</div></details>` : ''}</div>
    <div class="block"><strong>在其它 agent 里</strong>
      ${capRow('技能', caps.skills ?? 0)}
      ${capRow('命令', caps.commands ?? 0)}
      ${capRow('代理', caps.agents ?? 0)}
      ${capRow('MCP', mcps.length ? mcps.map((m) => (m.type ? `${m.name} (${m.type})` : m.name)).join('、') : '·')}
      ${capRow('hooks', caps.hooks ? '有（ZCode 专有格式）' : '·')}
      <div class="cap-col">${reasons.length ? reasons.map((r) => `<p class="gap">${esc(r)}</p>`).join('') : '<p class="gap ok">无缺口 —— 全部能力可用。</p>'}</div>
    </div>
    ${p.inClaudeMarket ? installHTML(p) : rawMaterialHTML(p)}
    <div class="block"><strong>链接</strong>
      ${p.homepage ? `<a class="link" href="${esc(p.homepage)}" target="_blank" rel="noopener">打开官方网站 ↗</a>` : ''}
      <p><a href="${REPO_TREE}/${esc(p.source ?? `plugins/${p.name}`)}" target="_blank" rel="noopener">仓库目录 ↗</a> ·
      <a href="https://github.com/${MARKET_REPO}#可移植性矩阵" target="_blank" rel="noopener">README 完整矩阵 ↗</a></p>
    </div>`;
}

function renderPane() {
  const it = ITEMS.find((x) => state.selected === x.key);
  $('#detailpane').innerHTML = `
    <button class="detail-close" id="dclose">关闭详情</button>
    ${it ? detailHTML(it) : `<div class="block"><strong>一键市场 · 只装「直接可用」</strong>
      <p class="detail-desc">默认收录 ${fmt(CATALOG.plugins.filter((p) => p.inClaudeMarket).length)} 个实测「直接可用」的插件；
      其余 ${fmt(CATALOG.plugins.filter((p) => p.inZcodeMarket && !p.inClaudeMarket).length)} 个有明确缺口，作为原始资料保留在仓库里。点任意卡片看详情。</p>
      <div class="cmd-line"><span>Claude Code</span><button class="copybtn" data-copy="claude plugin marketplace add ${MARKET_REPO}">claude plugin marketplace add ${MARKET_REPO}</button></div>
      <div class="cmd-line"><span>Codex</span><button class="copybtn" data-copy="codex plugin marketplace add ${MARKET_URL}">codex plugin marketplace add ${MARKET_URL}</button></div>
    </div>`}`;
  bindCopy($('#detailpane'));
}

function openDetail(key) {
  state.selected = key;
  renderGrid();
  renderPane();
  if (!window.matchMedia('(min-width: 1121px)').matches) {
    document.body.classList.add('detail-open');
  }
}

function closeDrawer() {
  document.body.classList.remove('detail-open');
}

function bindCopy(root) {
  root.querySelectorAll('.copybtn').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const old = btn.textContent;
      btn.textContent = '已复制 ✓';
      setTimeout(() => (btn.textContent = old), 1600);
    }),
  );
}

function renderAll() {
  buildItems();
  renderRail();
  renderPills();
  renderGrid();
  renderPane();
}

async function init() {
  CATALOG = await (await fetch('./catalog.json')).json();
  state.theme = localStorage.getItem('zpz-theme') ?? 'light';
  document.documentElement.dataset.theme = state.theme;
  $('#theme').textContent = state.theme === 'light' ? '🌙' : '☀️';
  $('#meta').textContent = new Date(CATALOG.generatedAt).toLocaleDateString('zh-CN');

  $('#q').addEventListener('input', (e) => { state.q = e.target.value.trim(); renderGrid(); });
  $('#clear').addEventListener('click', () => {
    state.q = ''; state.cat = null; state.sort = 'default'; state.quick = 'all';
    $('#q').value = '';
    renderAll();
  });
  $('#f-cat').addEventListener('change', (e) => { state.cat = e.target.value || null; renderAll(); });
  $('#f-sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
  $('#theme').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('zpz-theme', state.theme);
    document.documentElement.dataset.theme = state.theme;
    $('#theme').textContent = state.theme === 'light' ? '🌙' : '☀️';
  });
  $('#backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  renderAll();
}
init();
