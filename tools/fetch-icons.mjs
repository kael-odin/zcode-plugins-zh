// Prefetch plugin icons from the catalog's CDN URLs into site/appicons/
// (committed), so the site never hotlinks z.ai at page load.
//
// The catalog carries an `icon` URL for 50 of 54 plugins (the app market's own
// assets). A download counts only if it looks like a real image: HTTP 200,
// non-trivial size, and not an HTML error page. Everything that misses (or has
// no URL at all) simply gets no file -- site/app.js falls back to a coloured
// monogram tile for those four.
//
//   node tools/fetch-icons.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_DIR } from './lib.mjs';

const force = process.argv.includes('--force');
const outDir = path.join(ROOT, 'site', 'appicons');
fs.mkdirSync(outDir, { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'catalog.json'), 'utf8'));

let fetched = 0;
let kept = 0;
let missed = [];

for (const p of catalog.plugins) {
  if (!p.icon) { missed.push(p.name); continue; }
  const ext = path.posix.extname(new URL(p.icon).pathname) || '.png';
  const file = path.join(outDir, `${p.name}${ext}`);
  if (!force && fs.existsSync(file) && fs.statSync(file).size > 0) { kept++; continue; }

  try {
    const res = await fetch(p.icon, { signal: AbortSignal.timeout(20_000) });
    const buf = Buffer.from(await res.arrayBuffer());
    const looksImage = res.status === 200
      && buf.length > 200
      && !buf.subarray(0, 64).toString('utf8').trimStart().startsWith('<');
    if (!looksImage) throw new Error(`HTTP ${res.status}, ${buf.length} bytes`);
    fs.writeFileSync(file, buf);
    fetched++;
  } catch (err) {
    fs.rmSync(file, { force: true });
    missed.push(`${p.name} (${err.message})`);
  }
}

console.log(`[fetch-icons] ${fetched} fetched, ${kept} kept from a previous run, ${missed.length} without an icon (monogram fallback): ${missed.join(', ') || 'none'}`);
