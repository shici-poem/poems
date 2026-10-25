// Prerenders every page of the site into plain HTML, so search engines (and visitors, before the
// script loads) see each poem, poet, theme and era at its own address — in simplified and, under
// hant/, traditional characters. The page is drawn by the site's own js/app.js in headless Chrome,
// then saved with JSON-LD added; the script takes over again in the visitor's browser.
//
//   node tools/site.mjs           (run after tools/build.py and tools/pinyin.mjs)
//   node tools/site.mjs --og      (also redraw og.jpg, the picture shown when a link is shared)
//   node tools/site.mjs --serve   (preview the built site at http://localhost:8000/poems/)
//
// Needs Chrome or Chromium; set CHROME=/path/to/chrome if it isn't found.
// Writes: index.html, 404.html, p/ poet/ poets/ theme/ themes/ era/ about/ random/, hant/…, sitemap.xml
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://shici-poem.github.io/poems/';  // js/app.js has the same
const BASE = '/poems/';
const PORT = +process.env.PORT || 8000;
const GENERATED = ['p', 'poet', 'poets', 'theme', 'themes', 'era', 'about', 'random', 'hant'];
const ANTHOLOGIES = ['诗经', '汉乐府', '古诗十九首', '北朝民歌'];  // as in js/app.js
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.xml': 'application/xml', '.txt': 'text/plain' };
const read = f => readFileSync(join(ROOT, f), 'utf8');

// ---- a version stamp from everything the page loads, so browsers never mix old and new files ----
const ver = createHash('sha1');
for (const f of ['js/app.js', 'js/scene.js', 'css/style.css', ...readdirSync(join(ROOT, 'data')).map(f => 'data/' + f)]) ver.update(readFileSync(join(ROOT, f)));
const V = ver.digest('hex').slice(0, 10);
const shell = read('src/page.html').replace(/__V__/g, V);

// ---- a small static server for /poems/ ----
// prerendering: every page address gets the bare shell, for the script to draw;
// preview (--serve): the built files, with 404.html for anything missing, as GitHub Pages does
function serve(preview) {
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.startsWith(BASE)) { res.writeHead(302, { location: BASE }); return res.end(); }
    let rel;
    try { rel = decodeURIComponent(url.pathname.slice(BASE.length)); } catch (e) { rel = '\0'; }  // malformed: not found
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const isPage = !extname(rel) || rel.endsWith('.html');
    if (isPage && !preview) { res.writeHead(200, { 'content-type': TYPES['.html'] + '; charset=utf-8' }); return res.end(shell); }
    let f = file, status = 200;
    if (existsSync(f) && statSync(f).isDirectory()) {
      if (!rel.endsWith('/') && rel) { res.writeHead(301, { location: url.pathname + '/' }); return res.end(); }
      f = join(f, 'index.html');
    }
    if (!existsSync(f)) { f = join(ROOT, '404.html'); status = 404; }
    res.writeHead(status, { 'content-type': (TYPES[extname(f)] || 'application/octet-stream') + (/\.(html|js|css|json|svg|xml|txt)$/.test(f) ? '; charset=utf-8' : '') });
    res.end(readFileSync(f));
  });
}

if (process.argv.includes('--serve')) {
  serve(true).listen(PORT, () => console.log(`preview at http://localhost:${PORT}${BASE}`));
} else {
  await build();
}

async function build() {
  const db = JSON.parse(read('data/poems.json'));
  const hant = existsSync(join(ROOT, 'data/hant.json')) ? JSON.parse(read('data/hant.json')) : null;
  if (!db.poems[0].u) throw new Error('poems.json has no page addresses yet: run node tools/pinyin.mjs first');
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dynOf = {}; db.poems.forEach(p => { dynOf[db.authors[p.a].d] = 1; });
  const count = {}; db.poems.forEach(p => p.g.forEach(t => { count[t] = (count[t] || 0) + 1; }));
  const poetCount = {}; db.poems.forEach(p => { poetCount[p.a] = (poetCount[p.a] || 0) + 1; });

  // every page, as [kind, path below BASE, subject]
  const pages = [['home', ''], ['poets', 'poets/'], ['themes', 'themes/'], ['about', 'about/']];
  db.poems.forEach(p => pages.push(['poem', `p/${p.u}/`, p]));
  Object.keys(db.authors).filter(a => poetCount[a]).forEach(a => pages.push(['poet', `poet/${db.authors[a].u}/`, a]));
  db.tags.filter(([t]) => count[t]).forEach(([t, en]) => pages.push(['theme', `theme/${slug(en)}/`, t]));
  db.dynasties.filter(([d]) => dynOf[d]).forEach(([d, en]) => pages.push(['era', `era/${slug(en)}/`, d]));
  const jobs = [];
  for (const mode of ['', 'hant/']) for (const [kind, path, subj] of pages) jobs.push({ kind, path, subj, mode });

  const puppeteer = require('puppeteer-core');
  const server = serve(false);
  await new Promise(ok => server.listen(0, ok));  // any free port, so a running preview doesn't get in the way
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: chrome(), headless: true, args: ['--no-sandbox'] });
  const out = new Map();
  try {
    if (process.argv.includes('--og') || !existsSync(join(ROOT, 'og.jpg'))) await shareImage(browser, db);
    let next = 0, done = 0;
    const worker = async () => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.setRequestInterception(true);
      page.on('request', r => /^https?:\/\/localhost[:/]/.test(r.url()) ? r.continue() : r.abort());  // no web fonts needed
      await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { } });       // nothing "read", default settings
      page.log = [];
      page.on('console', m => { if (m.type() === 'error') page.log.push(m.text()); });
      page.on('pageerror', e => page.log.push(String(e)));
      page.on('requestfailed', r => { if (/localhost/.test(r.url())) page.log.push('failed: ' + r.url() + ' ' + r.failure().errorText); });
      while (next < jobs.length) {
        const job = jobs[next++], url = `http://localhost:${port}${BASE}${job.mode}${job.path}`;
        page.log.length = 0;
        let html;
        try { html = await snapshot(page, url, job); } catch (e) {
          console.warn(`  retrying ${url}: ${e.message}\n    ${page.log.join('\n    ')}`);
          page.log.length = 0;
          html = await snapshot(page, url, job);
        }
        out.set(job, html);
        if (++done % 100 === 0) console.log(`  ${done} / ${jobs.length}`);
      }
      await page.close();
    };
    await Promise.all(Array.from({ length: 6 }, worker));
  } finally {
    await browser.close();
    server.close();
  }

  // ---- write ----
  for (const d of GENERATED) rmSync(join(ROOT, d), { recursive: true, force: true });
  let bytes = 0;
  for (const [job, html] of out) {
    const page = html.replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld(job)).replace(/</g, '\\u003c')}</script>\n</head>`);
    const dir = join(ROOT, job.mode + job.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), page);
    bytes += Buffer.byteLength(page);
  }
  // not pages to be found: a random pick, and anything else (GitHub Pages serves 404.html, the script shows "not found")
  const noindex = shell.replace('content="index, follow"', 'content="noindex, follow"');
  for (const mode of ['', 'hant/']) { mkdirSync(join(ROOT, mode, 'random'), { recursive: true }); writeFileSync(join(ROOT, mode, 'random/index.html'), noindex); }
  writeFileSync(join(ROOT, '404.html'), noindex);

  const alt = path => ['zh-Hans', path, 'zh-Hant', 'hant/' + path, 'x-default', path];
  const urls = jobs.map(j => {
    const a = alt(j.path), links = [];
    for (let i = 0; i < a.length; i += 2) links.push(`<xhtml:link rel="alternate" hreflang="${a[i]}" href="${SITE}${a[i + 1]}"/>`);
    return `<url><loc>${SITE}${j.mode}${j.path}</loc>${links.join('')}</url>`;
  });
  writeFileSync(join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`);
  console.log(`${out.size} pages (${Math.round(bytes / 1024 / 1024 * 10) / 10} MB), sitemap.xml with ${urls.length} addresses, version ${V}`);

  // ---- structured data (JSON-LD), for search engines only ----
  function ld({ kind, path, subj, mode }) {
    const tr = (map, k) => (mode && hant && hant[map] && hant[map][k]) || k;
    const T = p => (mode && hant && hant.p[p.id] ? hant.p[p.id][0] : p.t);
    const url = SITE + mode + path, home = SITE + mode;
    const lang = mode ? 'zh-Hant' : 'zh-Hans';
    const site = { '@type': 'WebSite', '@id': SITE + '#site', name: '诗词 · Classical Chinese Poems', alternateName: ['诗词', '詩詞', 'Shici'], url: SITE, inLanguage: ['zh-Hans', 'zh-Hant', 'en'] };
    const crumbs = list => ({ '@type': 'BreadcrumbList', itemListElement: [[mode ? '詩詞' : '诗词', home]].concat(list).map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) });
    const wiki = w => (w || []).map((t, i) => t && `https://${i ? 'en' : 'zh'}.wikipedia.org/wiki/${encodeURIComponent(t.replace(/ /g, '_'))}`).filter(Boolean);
    const poet = a => {
      const au = db.authors[a], name = tr('a', a), purl = `${home}poet/${au.u}/`;
      return ANTHOLOGIES.includes(a) ? { '@type': 'Book', name, alternateName: au.en, url: purl, sameAs: wiki(au.w) }
        : { '@type': 'Person', name, alternateName: au.en, url: purl, sameAs: wiki(au.w), description: `${tr('d', au.d)} · ${au.y}` };
    };
    const graph = [site];
    if (kind === 'poem') {
      const p = subj, au = db.authors[p.a], who = poet(p.a);
      graph.push({
        '@type': 'CreativeWork', '@id': url + '#poem', url, name: T(p), alternateName: [p.te, p.y, mode ? p.t : (hant && hant.p[p.id] || [])[0]].filter((x, i, a) => x && x !== T(p) && a.indexOf(x) === i),
        genre: 'Poetry', inLanguage: lang, [who['@type'] === 'Book' ? 'isPartOf' : 'author']: who,
        keywords: p.g.map(t => tr('g', t) + ', ' + db.tags.find(x => x[0] === t)[1]).join(', '),
        workTranslation: { '@type': 'CreativeWork', name: p.te, inLanguage: 'en' },
      });
      graph.push(crumbs([[tr('a', p.a) + ' ' + au.en, `${home}poet/${au.u}/`], [T(p), url]]));
    } else if (kind === 'poet') {
      graph.push({ '@type': 'CollectionPage', url, name: tr('a', subj) + ' ' + db.authors[subj].en, about: poet(subj), isPartOf: { '@id': SITE + '#site' } });
      graph.push(crumbs([[mode ? '詩人 Poets' : '诗人 Poets', home + 'poets/'], [tr('a', subj) + ' ' + db.authors[subj].en, url]]));
    } else if (kind === 'theme' || kind === 'era') {
      const name = kind === 'theme' ? tr('g', subj) + ' ' + db.tags.find(x => x[0] === subj)[1] : tr('d', subj) + ' ' + db.dynasties.find(x => x[0] === subj)[1];
      graph.push({ '@type': 'CollectionPage', url, name, isPartOf: { '@id': SITE + '#site' } });
      graph.push(crumbs(kind === 'theme' ? [[mode ? '題材 Themes' : '题材 Themes', home + 'themes/'], [name, url]] : [[name, url]]));
    } else if (kind !== 'home') {
      graph.push({ '@type': kind === 'about' ? 'AboutPage' : 'CollectionPage', url, name: { poets: '诗人 Poets', themes: '题材 Themes', about: 'About' }[kind], isPartOf: { '@id': SITE + '#site' } });
    }
    return { '@context': 'https://schema.org', '@graph': graph };
  }
}

// draw one page with the site's own script and return it as HTML
async function snapshot(page, url, job) {
  await page.goto(url, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => !document.querySelector('#app > .loading') &&
      (!document.getElementById('classic') || document.getElementById('classic').childElementCount > 0), { timeout: 20000, polling: 100 });  // not per frame: background tabs get none
  } catch (e) { throw new Error(`${url}: the page did not finish drawing`); }
  const html = await page.evaluate(() => {
    document.querySelectorAll('.thumb').forEach(t => { t.textContent = ''; });  // small pictures are painted as they scroll into view
    document.getElementById('font-menu').textContent = '';
    const toast = document.getElementById('toast'); if (toast) toast.remove();
    return '<!doctype html>\n' + document.documentElement.outerHTML + '\n';
  });
  const want = job.mode + job.path;
  if (await page.evaluate(() => location.pathname) !== BASE + want) throw new Error(`${url}: the script moved to ${await page.evaluate(() => location.pathname)}`);
  if (/\/hant\//.test(url) !== html.includes('id="l-canon" href="' + SITE + 'hant/')) throw new Error(`${url}: wrong canonical`);
  return html;
}

// og.jpg: the picture social sites show for a shared link
async function shareImage(browser, db) {
  const p = db.poems[0];
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=EB+Garamond:ital@0;1&display=block">
    <style>body{margin:0;width:1200px;height:630px;overflow:hidden;background:#f2ebdd;font-family:'EB Garamond',serif;color:#2b2724}
    #art{position:absolute;inset:0}#art svg{width:1280px;height:853px;margin:-70px 0 0 -40px;display:block}
    .card{position:absolute;left:64px;top:50%;transform:translateY(-50%);background:rgba(244,238,226,.86);padding:34px 46px 30px;border-radius:14px;box-shadow:0 8px 40px rgba(43,39,36,.18)}
    h1{font:400 128px/1 'Ma Shan Zheng',serif;margin:0;letter-spacing:.12em}
    p{margin:14px 0 0;font-size:34px;font-style:italic}small{display:block;margin-top:6px;font-size:24px;color:#6b625a;font-style:normal}</style></head>
    <body><div id="art"></div><div class="card"><h1>诗词</h1><p>Classical Chinese Poems<small>in Chinese and English verse · ${db.poems.length} poems</small></p></div>
    <script>${read('js/scene.js')}</script>
    <script>document.getElementById('art').innerHTML = Scene.paint(${JSON.stringify(p.s)}, ${JSON.stringify(p.id)}, { detail: true, title: ${JSON.stringify(p.t)}, poet: ${JSON.stringify(p.a)}, era: ${JSON.stringify(db.authors[p.a].d)} });</script>
    </body></html>`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(join(ROOT, 'og.jpg'), await page.screenshot({ type: 'jpeg', quality: 85 }));
  await page.close();
  console.log('og.jpg drawn');
}

function chrome() {
  const c = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(f => f && existsSync(f));
  if (!c) throw new Error('Chrome not found: set CHROME=/path/to/chrome');
  return c;
}
