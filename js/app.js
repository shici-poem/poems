/* 诗词 — single-page app: path router, search, views. No dependencies.
   Every page also exists as prerendered HTML (tools/site.mjs) for search engines and a fast first paint;
   this script then takes over and renders the same view. */
(function () {
  'use strict';

  const SITE = 'https://shici-poem.github.io/poems/';  // the canonical address (tools/site.mjs has the same)
  const BASE = new URL(document.baseURI).pathname;     // '/poems/', from <base>
  // the build stamps every file with its own content hash; this script's tag carries the data files'
  // (data-v="poems.json:1a2b… pinyin.json:…"), so a page never pairs with old cached data
  const DATA_V = Object.fromEntries(((document.currentScript && document.currentScript.dataset.v) || '').split(' ').filter(Boolean).map(s => s.split(':')));
  const dataUrl = name => 'data/' + name + (DATA_V[name] ? '?v=' + DATA_V[name] : '');
  const app = document.getElementById('app');
  const PAGE = 24;
  const TAGS_SHOWN = 14;  // theme chips visible before "+N more"
  const PUNCT = /[，。？！、；：“”‘’《》·—…（）\s]/g;
  const CJK = /[㐀-鿿]/;

  let DB = null;          // data/poems.json
  let HANT = null;        // data/hant.json (traditional text), loaded on demand
  let hantFailed = false; // hant.json could not be loaded: traditional pages fall back to simplified text
  let T2S = null;         // traditional → simplified char map (from HANT)
  let PY = null;          // data/pinyin.json, loaded when pinyin is first shown
  let lastList = null;    // ids of the most recent result list, for prev/next
  let settings = loadObj('poems.settings');
  let READ = loadObj('poems.read');  // poems this browser has opened: { id: time first read } — kept only in localStorage
  const scrollMemo = {};

  /* ---------------- utils ---------------- */
  // whatever an older version (or anything else) left in storage, only a plain object is used
  function loadObj(key) {
    try { const v = JSON.parse(localStorage.getItem(key) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
  }
  function saveSettings() { try { localStorage.setItem('poems.settings', JSON.stringify(settings)); } catch (e) { } }
  function markRead(id) {
    if (READ[id]) return;
    READ[id] = Date.now();
    try { localStorage.setItem('poems.read', JSON.stringify(READ)); } catch (e) { }
  }
  function readCount(list) { return list.reduce((n, p) => n + (READ[p.id] ? 1 : 0), 0); }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function norm(s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, ''); }
  function stem(w) { return w.length > 4 ? w.replace(/'s$/, '').replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '') : w.replace(/'s$/, ''); }
  function words(s) { return norm(s).split(/[^a-z0-9]+/).filter(Boolean).map(stem); }
  function rich(s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>'); }
  function enc(s) { return encodeURIComponent(s); }
  function debounce(fn, ms) { let t; return function () { clearTimeout(t); const a = arguments; t = setTimeout(() => fn.apply(null, a), ms); }; }
  const ICON = {
    search: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    speak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 13v6h14v-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/></svg>',
    vert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M12 4v16M17 4v10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  // display helpers (traditional-aware)
  const T = p => (settings.hant && HANT && HANT.p[p.id]) ? HANT.p[p.id][0] : p.t;
  const Z = p => (settings.hant && HANT && HANT.p[p.id]) ? HANT.p[p.id].slice(1) : p.z;
  const NZ = p => (settings.hant && HANT && HANT.n && HANT.n[p.id]) || p.nz;  // Chinese note
  const A = a => (settings.hant && HANT && HANT.a[a]) || a;
  const G = t => (settings.hant && HANT && HANT.g && HANT.g[t]) || t;  // theme
  const D = d => (settings.hant && HANT && HANT.d && HANT.d[d]) || d;  // dynasty
  const F = f => (settings.hant && HANT && HANT.f && HANT.f[f]) || f;  // form
  const H = (s, t) => settings.hant ? t : s;                            // a fixed phrase, 简 or 繁
  // title with any （其一）-style suffix set smaller
  const TH = p => esc(T(p)).replace(/（[^）]*）$/, m => `<small>${m}</small>`);
  const ERA = { '先秦': 'Pre-Qin', '魏晋': 'Wei and Jin dynasties', '南北朝': 'Southern and Northern Dynasties', '五代': 'Five Dynasties', '近代': 'late Qing' };
  const eraEn = d => ERA[d] || DB.dynEn[d] + ' dynasty';
  const eraZh = d => D(d) + (d.length === 1 ? '代' : '');
  const plain = s => String(s).replace(/\*/g, '');

  // page addresses, relative to BASE: p/jing-ye-si/, poet/li-bai/, theme/moon/, era/tang/ (hant/… for traditional)
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const pUrl = p => 'p/' + (p.u || p.id) + '/';
  const aUrl = a => 'poet/' + (DB.authors[a].u || enc(a)) + '/';
  const tUrl = t => 'theme/' + slug(DB.tagInfo[t].en) + '/';
  const dUrl = d => 'era/' + slug(DB.dynEn[d]) + '/';
  const rel = path => (settings.hant ? 'hant/' : '') + path;
  const href = path => rel(path) || './';

  /* ---------------- data ---------------- */
  function prepare(data) {
    DB = data;
    // lookup tables without a prototype, so an address like p/constructor/ finds nothing
    const map = () => Object.create(null);
    DB.byId = map();
    DB.tagInfo = map();
    DB.dynEn = Object.assign(map(), Object.fromEntries(DB.dynasties));
    DB.tagCount = map();
    DB.poetCount = map();
    DB.formCount = map();
    DB.bySlug = map(); DB.poetBySlug = map(); DB.tagBySlug = map(); DB.dynBySlug = map();
    DB.tags.forEach(([zh, en, syn]) => { DB.tagInfo[zh] = { en, syn }; DB.tagCount[zh] = 0; DB.tagBySlug[slug(en)] = zh; });
    DB.dynasties.forEach(([zh, en]) => { DB.dynBySlug[slug(en)] = zh; });
    Object.keys(DB.authors).forEach(a => { if (DB.authors[a].u) DB.poetBySlug[DB.authors[a].u] = a; });
    DB.poems.forEach((p, i) => {
      DB.byId[p.id] = p;
      if (p.u) DB.bySlug[p.u] = p;
      p.i = i;
      const au = DB.authors[p.a];
      p.g.forEach(t => DB.tagCount[t]++);
      DB.poetCount[p.a] = (DB.poetCount[p.a] || 0) + 1;
      DB.formCount[p.f] = (DB.formCount[p.f] || 0) + 1;
      p._z = p.z.join('').replace(PUNCT, '');
      p._t = p.t.replace(PUNCT, '');
      p._g = p.g.join(' ');
      p._m = au.d + p.f;
      const aw = words(au.en);
      p._w = {
        a: new Set(aw.concat([aw.join('')])),
        g: new Set(words(p.g.map(t => DB.tagInfo[t].en + ' ' + DB.tagInfo[t].syn).join(' '))),
        te: new Set(words(p.te + ' ' + (p.y || ''))),
        e: new Set(words(p.e.join(' '))),
        n: new Set(words(p.n)),
        m: new Set(words(DB.dynEn[au.d] + ' ' + DB.forms[p.f])),
      };
    });
    DB.order = DB.poems.map(p => p.id);
  }

  function hasWord(set, w) {
    if (set.has(w)) return true;
    if (w.length < 3) return false;
    for (const t of set) if (t.startsWith(w)) return true;
    return false;
  }

  function termScore(p, term) {
    if (CJK.test(term)) {
      const t = term.replace(PUNCT, '');
      if (!t) return 0;
      let s = 0;
      if (p.a === t) s += 30; else if (p.a.includes(t)) s += 12;
      if (p._t === t) s += 25; else if (p._t.includes(t)) s += 12;
      if (p._g.includes(t)) s += 9;
      if (p._z.includes(t)) s += 5 + Math.min(3, t.length);
      if (p._m.includes(t)) s += 3;
      return s;
    }
    const w = stem(norm(term));
    if (!w) return 0;
    let s = 0;
    if (hasWord(p._w.a, w)) s += 25;
    if (hasWord(p._w.g, w)) s += 9;
    if (hasWord(p._w.te, w)) s += 9;
    if (hasWord(p._w.e, w)) s += 3;
    if (hasWord(p._w.m, w)) s += 3;
    if (hasWord(p._w.n, w)) s += 1;
    return s;
  }

  function toSimplified(q) {
    if (!T2S) return q;
    return Array.from(q).map(c => T2S[c] || c).join('');
  }

  function search(list, q) {
    q = toSimplified(q.trim());
    // split Latin words on spaces; keep CJK runs whole, but split a CJK run that
    // is clearly "poet + word" style only via spaces the user typed
    const terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length) return list;
    // relevance only sorts into coarse bands (poet/title hit > theme hit > a word in the text);
    // within a band the most famous poems come first (DB.poems is in popularity order)
    const band = s => s >= 25 ? 3 : s >= 9 ? 2 : 1;
    const scored = [];
    for (const p of list) {
      let b = 3, ok = true;
      for (const t of terms) {
        const s = termScore(p, t);
        if (!s) { ok = false; break; }
        b = Math.min(b, band(s));
      }
      if (ok) scored.push([b, p]);
    }
    scored.sort((a, b) => b[0] - a[0] || a[1].i - b[1].i);
    return scored.map(x => x[1]);
  }

  function matchedLine(p, q) {
    const terms = toSimplified(q).split(/\s+/).filter(t => CJK.test(t));
    if (!terms.length) return null;
    const z = Z(p);
    for (let i = 0; i < p.z.length; i++) {
      const plain = p.z[i].replace(PUNCT, '');
      if (terms.some(t => plain.includes(t.replace(PUNCT, '')))) return z[i];
    }
    return null;
  }

  /* ---------------- router ---------------- */
  function parseLoc() {
    const parts = location.pathname.slice(BASE.length).split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    const hant = parts[0] === 'hant';
    if (hant) parts.shift();
    return { parts, params: new URLSearchParams(location.search), hant };
  }
  const here = () => location.pathname + location.search;
  function go(path, replace) {  // path is below BASE, already through rel()
    history[replace ? 'replaceState' : 'pushState'](null, '', BASE + path);
    route();
  }
  function canonicalize(path) {  // an old or alternative address for this page: show the proper one
    if (location.pathname !== BASE + rel(path)) history.replaceState(null, '', BASE + rel(path) + location.search);
    currentKey = here();
  }
  // links written before the site had real addresses: #/p/9e9228, #/poet/李白, #/?tag=月 …
  function fromHash() {
    const h = location.hash;
    if (!h.startsWith('#/')) return;
    const qi = h.indexOf('?'), path = (qi >= 0 ? h.slice(2, qi) : h.slice(2)).replace(/\/?$/, '/');
    history.replaceState(null, '', BASE + (path === '/' ? '' : path) + (qi >= 0 ? h.slice(qi) : ''));
  }

  let currentKey = null, curView = '';
  function route() {
    if (currentKey) scrollMemo[currentKey] = Object.assign(scrollMemo[currentKey] || {}, { y: window.scrollY });
    const { parts, params, hant } = parseLoc();
    if (hant !== !!settings.hant) { settings.hant = hant; saveSettings(); }
    if (settings.hant && !HANT && !hantFailed) { ensureHant().then(route); return; }
    paintScript();
    currentKey = here();
    stopSpeech();
    const v = curView = parts[0] || '';
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on',
      (a.dataset.nav === 'home' && (v === '' || v === 'p' || v === 'era')) || (a.dataset.nav === 'poets' && (v === 'poets' || v === 'poet')) || (a.dataset.nav === 'themes' && (v === 'themes' || v === 'theme'))));
    document.querySelectorAll('[data-href]').forEach(a => a.setAttribute('href', href(a.dataset.href)));
    try {
      switch (v) {
        case '': viewHome(params); break;
        case 'theme': DB.tagBySlug[parts[1]] ? viewHome(params, { tag: DB.tagBySlug[parts[1]] }) : viewNotFound(); break;
        case 'era': DB.dynBySlug[parts[1]] ? viewHome(params, { dyn: DB.dynBySlug[parts[1]] }) : viewNotFound(); break;
        case 'p': viewPoem(parts[1]); break;
        case 'poets': viewPoets(); break;
        case 'poet': viewPoet(parts[1]); break;
        case 'themes': viewThemes(); break;
        case 'about': viewAbout(); break;
        case 'random': { // a poem not read yet, while there are any
          const unread = DB.order.filter(id => !READ[id]), pool = unread.length ? unread : DB.order;
          go(rel(pUrl(DB.byId[pool[Math.floor(Math.random() * pool.length)]])), true);
          return;
        }
        default: viewNotFound();
      }
    } catch (err) { recover(err); return; }
    const memo = scrollMemo[currentKey];
    window.scrollTo(0, memo && memo.y ? memo.y : 0);
  }
  // A page that fails to draw must never leave a blank screen, whatever an older version left in this
  // browser: first forget the saved settings, then the reading history, then say so plainly.
  let recovered = 0;
  function recover(err) {
    console.error(err);
    recovered++;
    if (recovered === 1) { settings = { hant: settings.hant }; try { localStorage.removeItem('poems.settings'); } catch (e) { } route(); return; }
    if (recovered === 2) { READ = {}; try { localStorage.removeItem('poems.read'); } catch (e) { } route(); return; }
    app.innerHTML = '<div class="empty" style="padding:80px 0"><div class="big" lang="zh-CN">出错了</div><p>Something went wrong showing this page. <a href="./">Back to all poems</a></p></div>';
  }

  /* ---------------- lazy thumbnails ---------------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { paintThumb(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '400px 0px' }) : null;
  function paintThumb(el) {
    const p = DB.byId[el.dataset.id];
    if (p) el.innerHTML = Scene.paint(p.s, p.id, { era: DB.authors[p.a].d });
  }
  function observeThumbs(root) {
    root.querySelectorAll('.thumb[data-id]').forEach(el => {
      if (el.firstChild) return;
      io ? io.observe(el) : paintThumb(el);
    });
  }

  /* ---------------- shared bits ---------------- */
  function card(p, q) {
    const au = DB.authors[p.a];
    const line = (q && matchedLine(p, q)) || Z(p)[0];
    return `<a class="card${READ[p.id] ? ' read' : ''}" href="${href(pUrl(p))}">
      ${READ[p.id] ? '<span class="readmark" title="You have read this poem"><span lang="zh-CN">已读</span> Read</span>' : ''}
      <div class="thumb" data-id="${p.id}"></div>
      <div class="card-body">
        <h3 class="card-title" lang="zh-CN">${TH(p)}</h3>
        <div class="card-meta"><span class="a" lang="zh-CN">〔${esc(D(au.d))}〕${esc(A(p.a))}</span> · ${esc(au.en)}</div>
        <p class="card-line" lang="zh-CN">${segs(line)}</p>
        <p class="card-en">${esc(p.te)}</p>
      </div></a>`;
  }
  // a filter row's label doubles as its fold toggle; a folded row still shows what is selected
  function foldLabel(key, zh, en) {
    return `<button type="button" class="lbl fold" data-fold="${key}" aria-expanded="${!settings[key]}" title="Show or hide">` +
      `<span class="z" lang="zh-CN">${zh}</span>${en}<span class="chev" aria-hidden="true"></span></button>`;
  }
  function tagChip(t, on, count, extra) {
    const info = DB.tagInfo[t];
    return `<a class="chip${on ? ' on' : ''}${extra ? ' extra' : ''}" href="${href(tUrl(t))}" data-tag="${esc(t)}"><span class="z" lang="zh-CN">${esc(G(t))}</span>${esc(info.en)}${count != null ? `<span class="c">${count}</span>` : ''}</a>`;
  }
  const ANTHOLOGIES = ['诗经', '汉乐府', '古诗十九首', '北朝民歌'];
  function topPoets() { return Object.keys(DB.authors).filter(a => DB.poetCount[a] > 1 && !ANTHOLOGIES.includes(a)).slice(0, 12); }
  function toast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:8px 16px;border-radius:999px;font-size:14px;z-index:60;transition:opacity .3s;pointer-events:none';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
  }

  /* ---------------- home / search ---------------- */
  let state = {};
  // one theme or one era alone has its own page (theme/moon/, era/tang/); anything else is the home page's query
  const landing = () => !state.q && !state.poet && !state.form && !state.unread && !state.read && !!state.tag !== !!state.dyn;
  function homeRel() {
    if (landing()) return rel(state.tag ? tUrl(state.tag) : dUrl(state.dyn));
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tag) p.set('tag', state.tag);
    if (state.poet) p.set('poet', state.poet);
    if (state.dyn) p.set('d', state.dyn);
    if (state.form) p.set('f', state.form);
    if (state.unread) p.set('u', '1');
    if (state.read) p.set('r', '1');
    const s = p.toString();
    return rel('') + (s ? '?' + s : '');
  }
  function syncUrl() {
    const h = BASE + homeRel();
    if (h !== here()) {
      history.replaceState(null, '', h);
      currentKey = h;
    }
    headHome();
  }
  function headHome() {
    const n = DB.poems.length;
    const some = list => list.slice(0, 3).map(p => `${T(p)} (${p.te})`).join(', ');
    if (landing() && state.tag) {
      const t = state.tag, en = DB.tagInfo[t].en, list = DB.poems.filter(p => p.g.includes(t));
      return setHead(`${H('关于', '關於')}${G(t)}${H('的古诗词', '的古詩詞')} · ${en} in classical Chinese poetry`,
        `${list.length} classical Chinese poems on ${en.toLowerCase()} (${G(t)}), each in Chinese with an English verse translation, pinyin and a note. Including ${some(list)}.`, tUrl(t));
    }
    if (landing() && state.dyn) {
      const d = state.dyn, list = DB.poems.filter(p => DB.authors[p.a].d === d);
      return setHead(`${eraZh(d)}${H('诗词', '詩詞')} · ${eraEn(d)} poems in Chinese and English`,
        `${list.length} poems of the ${eraEn(d)} (${eraZh(d)}), each in Chinese with an English verse translation, pinyin and a note. Including ${some(list)}.`, dUrl(state.dyn));
    }
    setHead(`${H('诗词', '詩詞')} · Classical Chinese Poems with English Translations | ${H('古诗词中英对照', '古詩詞中英對照')}`,
      `The ${n} best-loved classical Chinese poems — Li Bai, Du Fu, Wang Wei, Su Shi, Li Qingzhao and more — in Chinese with rhymed English translations, pinyin, notes and ink paintings. ${H('唐诗宋词，中英对照，附拼音与注解。', '唐詩宋詞，中英對照，附拼音與注解。')}`,
      '', here() !== BASE + rel(''));
  }

  function viewHome(params, preset) {
    preset = preset || {};
    state = {
      q: params.get('q') || '', tag: preset.tag || params.get('tag') || '', poet: params.get('poet') || '',
      dyn: preset.dyn || params.get('d') || '', form: params.get('f') || '', unread: params.get('u') === '1', shown: PAGE,
    };
    state.read = !state.unread && params.get('r') === '1';
    // a hand-typed or outdated address may name a theme, poet or form that isn't there
    if (!DB.tagInfo[state.tag]) state.tag = '';
    if (!DB.dynEn[state.dyn]) state.dyn = '';
    if (!DB.poetCount[state.poet]) state.poet = '';
    if (!DB.formCount[state.form]) state.form = '';
    syncUrl();
    const memo = scrollMemo[here()];
    if (memo && memo.shown) state.shown = memo.shown;
    const tagsSorted = Object.keys(DB.tagCount).filter(t => DB.tagCount[t]).sort((a, b) => DB.tagCount[b] - DB.tagCount[a]);
    const dyns = DB.dynasties.filter(([d]) => DB.poems.some(p => DB.authors[p.a].d === d));
    const forms = Object.keys(DB.forms).filter(f => DB.formCount[f]);
    const poetOpt = a => `<option value="${esc(a)}"${state.poet === a ? ' selected' : ''}>${esc(A(a))} ${esc(DB.authors[a].en)} (${DB.poetCount[a]})</option>`;
    const poetsByDyn = `<optgroup label="名家 Best-loved">${topPoets().map(poetOpt).join('')}</optgroup>` + dyns.map(([d, de]) => {
      const ps = Object.keys(DB.authors).filter(a => DB.authors[a].d === d && DB.poetCount[a]);
      return `<optgroup label="${esc(D(d))} ${esc(de)}">${ps.map(poetOpt).join('')}</optgroup>`;
    }).join('');
    const hints = ['李白', 'moon', 'wine', '思乡', 'farewell', '春风', 'Su Shi', 'frontier'];
    app.innerHTML = `
      <section class="hero">
        <h1 lang="zh-CN">诗词</h1>
        <p class="sub">${DB.poems.length} famous poems across three thousand years — in Chinese and English verse</p>
        <div class="search" role="search">
          <span class="icon">${ICON.search}</span>
          <input id="q" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
            placeholder="搜索 Search poets, lines or themes…" aria-label="Search poems" value="${esc(state.q)}">
          <button type="button" class="clear" id="qclear" aria-label="Clear search"${state.q ? '' : ' hidden'}>✕</button>
        </div>
        <div class="hint">Try ${hints.map(h => `<button type="button" data-q="${esc(h)}">${esc(h)}</button>`).join(' ')}</div>
      </section>
      <section class="filters" aria-label="Filters">
        <div class="fbody">
          <div class="chiprow${settings.dynShut ? ' shut' : ''}" id="dynrow">${foldLabel('dynShut', '朝代', 'Era')}
            <button type="button" class="chip${state.dyn ? '' : ' on'}" data-dyn=""><span class="z">全部</span>All</button>
            ${dyns.map(([d, de]) => `<a class="chip${state.dyn === d ? ' on' : ''}" href="${href(dUrl(d))}" data-dyn="${esc(d)}"><span class="z" lang="zh-CN">${esc(D(d))}</span>${esc(de)}</a>`).join('')}
          </div>
          <div class="chiprow${settings.allTags ? ' all' : ''}${settings.tagShut ? ' shut' : ''}" id="tagrow">${foldLabel('tagShut', '题材', 'Theme')}
            <button type="button" class="chip${state.tag ? '' : ' on'}" data-tag=""><span class="z">全部</span>All</button>
            ${tagsSorted.map((t, i) => tagChip(t, state.tag === t, DB.tagCount[t], i >= TAGS_SHOWN)).join('')}
            <button type="button" class="chip more" id="tagmore" aria-expanded="${!!settings.allTags}">${settings.allTags ? 'Fewer' : `+${tagsSorted.length - TAGS_SHOWN} more`}</button>
          </div>
          <div class="selrow">
            <select id="psel" aria-label="Poet"><option value="">诗人 · All poets</option>${poetsByDyn}</select>
            <select id="fsel" aria-label="Form"><option value="">体裁 · All forms</option>${forms.map(f => `<option value="${esc(f)}"${state.form === f ? ' selected' : ''}>${esc(f)} · ${esc(DB.forms[f])} (${DB.formCount[f]})</option>`).join('')}</select>
          </div>
        </div>
      </section>
      <div id="feat"></div>
      <section id="results" aria-live="polite"></section>`;

    const input = document.getElementById('q');
    const clear = document.getElementById('qclear');
    const onInput = debounce(() => { state.q = input.value; state.shown = PAGE; syncUrl(); renderResults(); }, 160);
    input.addEventListener('input', () => { clear.hidden = !input.value; onInput(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.blur(); document.getElementById('results').scrollIntoView({ behavior: 'smooth' }); } });
    clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; state.q = ''; syncUrl(); renderResults(); input.focus(); });
    app.querySelectorAll('.hint button').forEach(b => b.addEventListener('click', () => {
      input.value = b.dataset.q; clear.hidden = false; state.q = b.dataset.q; state.shown = PAGE; syncUrl(); renderResults();
    }));
    app.querySelector('#dynrow').addEventListener('click', e => {
      const b = e.target.closest('[data-dyn]'); if (!b) return;
      e.preventDefault();
      state.dyn = b.dataset.dyn; state.shown = PAGE;
      app.querySelectorAll('#dynrow .chip').forEach(c => c.classList.toggle('on', c === b));
      syncUrl(); renderResults();
    });
    app.querySelector('#tagrow').addEventListener('click', e => {
      const b = e.target.closest('[data-tag]'); if (!b) return;
      e.preventDefault();
      state.tag = state.tag === b.dataset.tag ? '' : b.dataset.tag; state.shown = PAGE;  // a second tap on a theme clears it, like 全部
      app.querySelectorAll('#tagrow .chip').forEach(c => c.classList.toggle('on', c.dataset.tag === state.tag));
      syncUrl(); renderResults();
    });
    app.querySelector('#psel').addEventListener('change', e => { state.poet = e.target.value; state.shown = PAGE; syncUrl(); renderResults(); });
    app.querySelector('#fsel').addEventListener('change', e => { state.form = e.target.value; state.shown = PAGE; syncUrl(); renderResults(); });
    app.querySelector('#tagmore').addEventListener('click', e => {
      e.stopPropagation();
      settings.allTags = !settings.allTags; saveSettings();
      app.querySelector('#tagrow').classList.toggle('all', settings.allTags);
      e.currentTarget.textContent = settings.allTags ? 'Fewer' : `+${tagsSorted.length - TAGS_SHOWN} more`;
      e.currentTarget.setAttribute('aria-expanded', settings.allTags);
    });
    app.querySelectorAll('[data-fold]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const k = b.dataset.fold;
      settings[k] = !settings[k]; saveSettings();
      b.closest('.chiprow').classList.toggle('shut', settings[k]);
      b.setAttribute('aria-expanded', !settings[k]);
    }));
    renderResults();
  }

  function dayPoem() {
    // the same poem all day for everyone, picked at random from the best-known 200: each 200-day cycle
    // walks through a fresh shuffle of them, so none repeats within a cycle and the order can't be guessed
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    const n = Math.min(DB.poems.length, 200), order = [...Array(n).keys()];
    let s = Math.floor(day / n) * 2654435761 >>> 0;
    const rand = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return DB.poems[order[day % n]];
  }

  function renderResults() {
    const filtered = DB.poems.filter(p => (!state.tag || p.g.includes(state.tag)) && (!state.poet || p.a === state.poet) &&
      (!state.dyn || DB.authors[p.a].d === state.dyn) && (!state.form || p.f === state.form) && (!state.unread || !READ[p.id]) && (!state.read || READ[p.id]));
    if (state.read) filtered.sort((a, b) => READ[b.id] - READ[a.id]);  // the most recently read first
    const list = state.q.trim() ? search(filtered, state.q) : filtered;
    lastList = list.map(p => p.id);
    const anyFilter = state.q.trim() || state.tag || state.poet || state.dyn || state.form || state.unread || state.read;
    const nRead = readCount(DB.poems);

    const feat = document.getElementById('feat');
    if (!anyFilter) {
      const p = dayPoem(), au = DB.authors[p.a];
      const z = Z(p);
      feat.innerHTML = `<a class="featured" href="${href(pUrl(p))}">
        <div class="thumb" data-id="${p.id}"></div>
        <div class="fbody">
          <div class="kicker"><b lang="zh-CN">今日一诗</b>Poem of the day</div>
          <h3 lang="zh-CN">${TH(p)}</h3>
          <div class="by"><span lang="zh-CN">〔${esc(D(au.d))}〕${esc(A(p.a))}</span> · ${esc(au.en)}</div>
          <div class="lines" lang="zh-CN">${z.filter(Boolean).slice(0, 2).map(segs).join('<br>')}</div>
          <div class="en">${p.e.filter(Boolean).slice(0, 2).map(esc).join('<br>')}</div>
        </div></a>`;
      observeThumbs(feat);
    } else feat.innerHTML = '';

    const active = [];
    if (state.q.trim()) active.push(`<button type="button" class="chip" data-clear="q">“${esc(state.q.trim())}” ✕</button>`);
    if (state.tag) active.push(`<button type="button" class="chip" data-clear="tag"><span class="z">${esc(G(state.tag))}</span>${esc(DB.tagInfo[state.tag] ? DB.tagInfo[state.tag].en : '')} ✕</button>`);
    if (state.dyn) active.push(`<button type="button" class="chip" data-clear="dyn"><span class="z">${esc(D(state.dyn))}</span>${esc(DB.dynEn[state.dyn] || '')} ✕</button>`);
    if (state.poet) active.push(`<button type="button" class="chip" data-clear="poet"><span class="z">${esc(A(state.poet))}</span>✕</button>`);
    if (state.form) active.push(`<button type="button" class="chip" data-clear="form"><span class="z">${esc(F(state.form))}</span>✕</button>`);
    if (state.unread) active.push(`<button type="button" class="chip" data-clear="unread"><span class="z">未读</span>Unread ✕</button>`);
    if (state.read) active.push(`<button type="button" class="chip" data-clear="read"><span class="z">已读</span>Read ✕</button>`);

    // poet banner when the query is a poet's name
    let banner = '';
    const qn = norm(state.q.trim()).replace(/\s+/g, '');
    if (qn) {
      const hit = Object.keys(DB.authors).find(a => DB.poetCount[a] && (a === toSimplified(state.q.trim()) || norm(DB.authors[a].en).replace(/\s+/g, '') === qn));
      if (hit) {
        const au = DB.authors[hit];
        banner = `<a class="poet-banner" href="${href(aUrl(hit))}"><span class="pz" lang="zh-CN">${esc(A(hit))}</span>
          <span><b>${esc(au.en)}</b><br><span class="pe">${esc(D(au.d))} ·${esc(DB.dynEn[au.d])} · <span class="nw">${esc(au.y)}</span></span></span><span class="go"><span class="gt">Poet page </span>→</span></a>`;
      }
    }

    const res = document.getElementById('results');
    const shown = list.slice(0, state.shown);
    res.innerHTML = `
      <div class="reshead">
        <h2>${landing() ? (state.tag ? `${esc(G(state.tag))}<small>${esc(DB.tagInfo[state.tag].en)}</small>` : `${esc(eraZh(state.dyn))}<small>${esc(eraEn(state.dyn))}</small>`)
          : anyFilter ? '搜索结果<small>Results</small>' : '全部诗词<small>All poems</small>'}</h2>
        <span class="count">${list.length} ${list.length === 1 ? 'poem' : 'poems'}${nRead ? ` · <span class="readn">read ${nRead} of ${DB.poems.length}</span>
          <button type="button" class="chip unread${state.unread ? ' on' : ''}" id="unread" aria-pressed="${state.unread}"><span class="z">未读</span>Unread only</button>
          <button type="button" class="chip unread${state.read ? ' on' : ''}" id="readonly" aria-pressed="${state.read}"><span class="z">已读</span>Read</button>` : ''}</span>
      </div>
      ${active.length ? `<div class="active">${active.join('')}${active.length > 1 ? '<button type="button" class="chip" data-clear="all">Clear all</button>' : ''}</div><div style="height:12px"></div>` : ''}
      ${banner}
      ${list.length ? `<div class="grid">${shown.map(p => card(p, state.q)).join('')}</div>` :
        `<div class="empty"><div class="big" lang="zh-CN">无处觅</div><p>No poems found. Try another word — English or Chinese — or clear the filters.</p></div>`}
      ${list.length > shown.length ? `<button type="button" class="showmore" id="more">更多 · Show more (${list.length - shown.length})</button>` : ''}`;
    observeThumbs(res);
    const memoKey = BASE + homeRel();
    scrollMemo[memoKey] = Object.assign(scrollMemo[memoKey] || {}, { shown: state.shown });
    res.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.clear;
      if (k === 'all') { state.q = state.tag = state.poet = state.dyn = state.form = ''; state.unread = state.read = false; } else state[k] = k === 'unread' || k === 'read' ? false : '';
      if (k === 'q' || k === 'all') { const i = document.getElementById('q'); i.value = ''; document.getElementById('qclear').hidden = true; }
      if (k === 'dyn' || k === 'all') app.querySelectorAll('#dynrow .chip').forEach(c => c.classList.toggle('on', c.dataset.dyn === ''));
      if (k === 'tag' || k === 'all') app.querySelectorAll('#tagrow .chip').forEach(c => c.classList.toggle('on', c.dataset.tag === ''));
      if (k === 'poet' || k === 'all') document.getElementById('psel').value = '';
      if (k === 'form' || k === 'all') document.getElementById('fsel').value = '';
      state.shown = PAGE; syncUrl(); renderResults();
    }));
    const ub = document.getElementById('unread');
    if (ub) ub.addEventListener('click', () => { state.unread = !state.unread; state.read = false; state.shown = PAGE; syncUrl(); renderResults(); });
    const rb = document.getElementById('readonly');
    if (rb) rb.addEventListener('click', () => { state.read = !state.read; state.unread = false; state.shown = PAGE; syncUrl(); renderResults(); });
    const more = document.getElementById('more');
    if (more) {
      more.addEventListener('click', () => { state.shown += PAGE * 2; renderResults(); });
      if (io && state.shown < 200) {
        const auto = new IntersectionObserver(es => {
          if (es[0].isIntersecting) { auto.disconnect(); state.shown += PAGE; renderResults(); }
        }, { rootMargin: '600px 0px' });
        auto.observe(more);
      }
    }
  }

  /* ---------------- poem page ---------------- */
  function zhLines(lines, py) {
    return lines.map((l, i) => {
      if (!l) return '<p class="gap"></p>';
      const syl = py && py[i] ? py[i].split(' ') : null;
      return '<p>' + segs(l, syl && syl.length === Array.from(l).filter(c => CJK.test(c)).length ? syl : null) + '</p>';
    }).join('');
  }
  function segs(l, py) {
    const parts = l.match(/[^，。？！；：、]+[，。？！；：、”’」]*/g) || [l];
    if (!py) return parts.map(s => `<span class="seg">${esc(s)}</span>`).join('');
    let k = 0;  // py: one syllable per CJK character of the line
    return parts.map(s => `<span class="seg">${Array.from(s).map(c =>
      CJK.test(c) && py[k] ? `<ruby>${esc(c)}<rt>${esc(py[k++])}</rt></ruby>` : esc(c)).join('')}</span>`).join('');
  }
  function enLines(lines) { return lines.map(l => l ? `<p>${rich(l)}</p>` : '<p class="gap"></p>').join(''); }

  function viewPoem(key) {
    const p = DB.bySlug[key] || DB.byId[key];  // an id is an older address
    if (!p) return viewNotFound();
    const id = p.id, au = DB.authors[p.a];
    canonicalize(pUrl(p));
    const list = lastList && lastList.includes(id) ? lastList : DB.order;
    const i = list.indexOf(id);
    const prev = DB.byId[list[i - 1]], next = DB.byId[list[i + 1]];
    const vertical = !!settings.vertical;
    const chars = p._z.length;
    const z2 = Z(p).filter(Boolean).slice(0, 2).join(''), e2 = p.e.filter(Boolean).slice(0, 2).map(plain).join(' ');
    setHead(`${T(p)} · ${A(p.a)} ${H('原文、英文翻译', '原文、英文翻譯')} | ${p.te} by ${au.en}`,
      `《${T(p)}》${D(au.d)}·${A(p.a)}：${z2} English translation “${p.te}”${p.y ? ` (${p.y})` : ''} by ${au.en}: ${e2} With pinyin and notes.`, pUrl(p));
    markRead(p.id);
    app.innerHTML = `
      <article class="poem">
        <div class="crumbs"><a href="${href('')}">诗词</a><span>›</span><a href="${href(aUrl(p.a))}" lang="zh-CN">${esc(A(p.a))}</a><span>›</span><span lang="zh-CN">${esc(T(p))}</span></div>
        <figure class="painting" id="painting"></figure>
        <div class="ptools">
          <button type="button" class="pbtn" id="b-py" aria-pressed="${!!settings.pinyin}"><span class="pyi" aria-hidden="true">pīn</span><span class="z">拼音</span> Pinyin</button>
          <button type="button" class="pbtn" id="b-vert" aria-pressed="${vertical}">${ICON.vert}<span class="z">竖排</span> Vertical</button>
          ${'speechSynthesis' in window ? `<button type="button" class="pbtn" id="b-zh">${ICON.speak}<span class="z">朗读</span></button>
          <button type="button" class="pbtn" id="b-en">${ICON.speak}English</button>` : ''}
          <button type="button" class="pbtn" id="b-share">${ICON.share}Share</button>
          <a class="pbtn" href="${href('random/')}">${ICON.dice}<span class="z">随机</span> Random</a>
        </div>
        <div class="duo">
          <section class="zh${vertical ? ' vertical' : ''}${chars > 120 ? ' long' : ''}" lang="zh-CN"><div class="vwrap">
            <h1>${TH(p)}</h1>
            <div class="byline"><a href="${href(aUrl(p.a))}">〔${esc(D(au.d))}〕${esc(A(p.a))}</a></div>
            <div class="text" id="zhtext">${zhLines(Z(p))}</div>
          </div></section>
          <section class="en" lang="en">
            <div class="kick"><span lang="zh-CN">英译</span> English translation</div>
            <h2>${esc(p.te)}</h2>
            ${p.y ? `<div class="tpy" lang="zh-Latn-pinyin">${esc(p.y)}</div>` : ''}
            <div class="byline">${esc(au.en)} · ${esc(DB.dynEn[au.d])} · ${esc(DB.forms[p.f])}</div>
            <div class="text">${enLines(p.e)}</div>
          </section>
        </div>
        <section class="note"><h3><span lang="zh-CN">赏析</span> <span>About this poem</span></h3>
          ${p.nz ? `<p class="zh-note" lang="zh-CN">${esc(NZ(p))}</p>` : ''}<p lang="en">${rich(p.n)}</p></section>
        ${p.c ? '<section class="classic" id="classic" aria-label="Earlier translations"></section>' : ''}
        <div class="ptags">${p.g.map(t => tagChip(t, false)).join('')}</div>
        <div class="pmeta"><span lang="zh-CN">${esc(F(p.f))}</span> · ${esc(DB.forms[p.f])} · <a href="${href(dUrl(au.d))}">${esc(eraEn(au.d))} poems</a> · <a href="${href(aUrl(p.a))}">More by ${esc(au.en)} (${DB.poetCount[p.a]})</a></div>
        <nav class="pager" aria-label="More poems">
          ${prev ? `<a class="prev" href="${href(pUrl(prev))}"><span class="dir"><span lang="zh-CN">← 上一首</span> <span>Previous</span></span><span class="pt" lang="zh-CN">${TH(prev)}</span></a>` : ''}
          ${next ? `<a class="next" href="${href(pUrl(next))}"><span class="dir"><span lang="zh-CN">下一首</span> <span>Next →</span></span><span class="pt" lang="zh-CN">${TH(next)}</span></a>` : ''}
        </nav>
      </article>`;
    document.getElementById('painting').innerHTML = Scene.paint(p.s, p.id, { detail: true, title: T(p), poet: p.a, era: au.d, label: 'Ink painting for ' + p.te });

    const zh = app.querySelector('.zh');
    const bv = document.getElementById('b-vert');
    bv.addEventListener('click', () => {
      settings.vertical = !settings.vertical; saveSettings();
      zh.classList.toggle('vertical', settings.vertical);
      bv.setAttribute('aria-pressed', settings.vertical);
      if (settings.vertical) { const w = zh.querySelector('.vwrap'); w.scrollLeft = w.scrollWidth; }
    });
    if (vertical) { const w = zh.querySelector('.vwrap'); w.scrollLeft = w.scrollWidth; }
    const text = document.getElementById('zhtext');
    const paintPinyin = () => {
      const py = settings.pinyin && PY && PY[p.id];
      zh.classList.toggle('py', !!py);
      text.innerHTML = zhLines(Z(p), py ? py.slice(1) : null);
    };
    const bp = document.getElementById('b-py');
    bp.addEventListener('click', () => {
      settings.pinyin = !settings.pinyin; saveSettings();
      bp.setAttribute('aria-pressed', settings.pinyin);
      if (settings.pinyin) ensurePinyin().then(paintPinyin); else paintPinyin();
    });
    if (settings.pinyin) ensurePinyin().then(() => { if (document.body.contains(text)) paintPinyin(); });
    if (p.c) ensureClassic().then(c => { const el = document.getElementById('classic'); if (el && c[p.id]) el.innerHTML = classicHtml(c[p.id]); });

    const bz = document.getElementById('b-zh'), be = document.getElementById('b-en');
    // the voice can't be told a reading, so where a character is read unusually the speech text swaps in a
    // same-sounding one (一骑 → 一寂); fetched ahead so speaking stays inside the click (iOS needs that)
    let say = null;
    if (bz) {
      lazyJson('speech.json').then(d => { say = d && d[p.id]; });
      bz.addEventListener('click', () => {
        const lines = [p.t].concat(p.z).map((l, i) => (say && say[i]) || l);
        speak([lines[0], au.d + '，' + p.a].concat(lines.slice(1).filter(Boolean)).join('。'), 'zh-CN', bz);
      });
    }
    if (be) be.addEventListener('click', () => speak([p.te, 'by ' + au.en].concat(p.e.filter(Boolean)).join('\n'), 'en', be));
    document.getElementById('b-share').addEventListener('click', () => {
      const url = location.href;
      if (navigator.share) navigator.share({ title: `${p.t} · ${p.te}`, text: `${p.t} — ${p.a}\n${p.z[0]}`, url }).catch(() => { });
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied · 链接已复制'), () => toast(url));
      else toast(url);
    });
    pagerNav = { prev: prev && rel(pUrl(prev)), next: next && rel(pUrl(next)) };
  }
  let pagerNav = null;

  /* ---------------- speech ---------------- */
  let speaking = null;
  function stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (speaking) speaking.setAttribute('aria-pressed', 'false');
    speaking = null;
  }
  function pickVoice(lang) {
    const all = speechSynthesis.getVoices();
    let vs = all.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'en' ? 'en' : 'zh-cn'));
    if (!vs.length) vs = all.filter(v => v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'zh'));
    if (lang === 'en') vs.sort((a, b) => (b.lang === 'en-US') - (a.lang === 'en-US'));
    const good = v => /natural|online|neural|premium|enhanced/i.test(v.name) ? 1 : 0;  // the better-sounding voices
    return vs.slice().sort((a, b) => good(b) - good(a))[0] || null;
  }
  function speak(text, lang, btn) {
    if (speaking === btn) { stopSpeech(); return; }
    stopSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    u.rate = lang === 'en' ? 0.92 : 0.72;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.onend = u.onerror = () => { if (speaking === btn) { btn.setAttribute('aria-pressed', 'false'); speaking = null; } };
    speaking = btn;
    btn.setAttribute('aria-pressed', 'true');
    speechSynthesis.speak(u);
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  /* ---------------- poets ---------------- */
  function viewPoets() {
    const n = Object.keys(DB.poetCount).length;
    setHead(`${H('诗人', '詩人')} · ${n} Chinese poets, from the Book of Songs to the Qing | ${H('诗词', '詩詞')}`,
      `${n} classical Chinese poets and their best-loved poems in Chinese and English: ${topPoets().slice(0, 8).map(a => `${A(a)} ${DB.authors[a].en}`).join(', ')} and more.`, 'poets/');
    // DB.authors is in order of fame; within each era the best-known come first
    const tile = a => {
      const au = DB.authors[a], read = readCount(DB.poems.filter(p => p.a === a));
      return `<a class="poet" href="${href(aUrl(a))}"><span class="pz" lang="zh-CN">${esc(A(a))}</span>
          <span class="pe"><b>${esc(au.en)}</b> · ${DB.poetCount[a]} ${DB.poetCount[a] === 1 ? 'poem' : 'poems'}${read ? ` <span class="readn">· ${read} read</span>` : ''}</span><span class="py">${esc(D(au.d))} · ${esc(au.y)}</span></a>`;
    };
    const section = (h, sub, ps) => `<section class="dyn"><h2><span lang="zh-CN">${h}</span><small>${sub}</small></h2><div class="poets">${ps.map(tile).join('')}</div></section>`;
    const famous = section('名家', 'Best-loved poets', topPoets());
    const groups = DB.dynasties.map(([d, de]) => {
      const ps = Object.keys(DB.authors).filter(a => DB.authors[a].d === d && DB.poetCount[a]);
      return ps.length ? section(esc(D(d)), esc(de), ps) : '';
    }).join('');
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">诗人</h1><p>${Object.keys(DB.poetCount).length} poets, from the Book of Songs to the last dynasty</p></div>${famous}${groups}`;
  }

  // links to the poet's Wikipedia articles (src/wiki.txt; only ones checked to be about this poet)
  function wikiLinks(w) {
    if (!w || !(w[0] || w[1])) return '';
    const url = (host, t) => `https://${host}/${encodeURIComponent(t.replace(/ /g, '_'))}`;
    const links = [];
    if (w[0]) links.push(`<a href="${url('zh.wikipedia.org/' + (settings.hant ? 'zh-tw' : 'zh-cn'), w[0])}" target="_blank" rel="noopener" lang="zh-CN">中文</a>`);
    if (w[1]) links.push(`<a href="${url('en.wikipedia.org/wiki', w[1])}" target="_blank" rel="noopener">English</a>`);
    return `<p class="wiki"><span><span lang="zh-CN">维基百科</span> Wikipedia:</span> ${links.join(' · ')}</p>`;
  }
  function viewPoet(key) {
    // an address may still carry the Chinese name (older links); poets without poems have no page
    const a = DB.poetBySlug[key] || (Object.prototype.hasOwnProperty.call(DB.authors, key) && DB.poetCount[key] ? key : null);
    if (!a) return viewNotFound();
    const au = DB.authors[a];
    canonicalize(aUrl(a));
    const ps = DB.poems.filter(p => p.a === a);
    setHead(`${A(a)}${H('的诗词', '的詩詞')} · ${au.en} — ${ps.length} ${ps.length === 1 ? 'poem' : 'poems'} in Chinese and English`,
      `${A(a)} ${au.en} (${D(au.d)}, ${au.y}): ${ps.slice(0, 4).map(p => `${T(p)} ${p.te}`).join(' · ')}. ${plain(au.b).slice(0, 160)}`, aUrl(a));
    lastList = ps.map(p => p.id);
    app.innerHTML = `
      <div class="crumbs" style="margin-top:18px"><a href="${href('poets/')}">诗人 Poets</a><span>›</span><span lang="zh-CN">${esc(A(a))}</span></div>
      <header class="poethead">
        <div class="big" lang="zh-CN">${esc(A(a))}</div>
        <div><div class="en">${esc(au.en)}</div><div class="meta"><a href="${href(dUrl(au.d))}"><span lang="zh-CN">${esc(D(au.d))}</span> · ${esc(DB.dynEn[au.d])}</a> · ${esc(au.y)} · ${ps.length} ${ps.length === 1 ? 'poem' : 'poems'}${readCount(ps) ? ` · <span class="readn">${readCount(ps)} read</span>` : ''}</div>
        <p class="bio">${rich(au.b)}</p>${wikiLinks(au.w)}</div>
      </header>
      <div class="reshead"><h2>作品<small>Poems</small></h2></div>
      <div class="grid">${ps.map(p => card(p)).join('')}</div>`;
    observeThumbs(app);
  }

  /* ---------------- themes ---------------- */
  function viewThemes() {
    setHead(`${H('题材', '題材')} · Classical Chinese poems by theme | ${H('诗词', '詩詞')}`,
      `Classical Chinese poems by theme — ${DB.tags.slice(0, 12).map(([t, en]) => `${G(t)} ${en.toLowerCase()}`).join(', ')} and more — each in Chinese and English.`, 'themes/');
    const used = new Set();
    const tags = Object.keys(DB.tagCount).filter(t => DB.tagCount[t]).sort((a, b) => DB.tagCount[b] - DB.tagCount[a]);
    const tiles = tags.map(t => {
      const cands = DB.poems.filter(p => p.g.includes(t));
      const rep = cands.find(p => !used.has(p.id) && p.g[0] === t) || cands.find(p => !used.has(p.id)) || cands[0];
      used.add(rep.id);
      return `<a class="theme" href="${href(tUrl(t))}"><div class="thumb" data-id="${rep.id}"></div>
        <div class="tl"><span class="tz" lang="zh-CN">${esc(G(t))}</span><span class="te">${esc(DB.tagInfo[t].en)}</span><span class="tc">${DB.tagCount[t]}</span></div></a>`;
    }).join('');
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">题材</h1><p>Browse by what the poems are about</p></div><div class="themes">${tiles}</div>`;
    observeThumbs(app);
  }

  /* ---------------- about / 404 ---------------- */
  function viewAbout() {
    setHead(`About · ${H('诗词', '詩詞')} Classical Chinese Poems`,
      `About this free collection of ${DB.poems.length} classical Chinese poems: how the English verse translations, pinyin, read-aloud and ink paintings are made, and the public-domain earlier translations it draws on.`, 'about/');
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">关于</h1><p>About this collection</p></div>
      <div class="prose">
        <p>This is a free, open collection of ${DB.poems.length} of the best-loved poems in the Chinese language, from the <em>Book of Songs</em>
        (c. 1000 BC) through the Tang and Song dynasties — the golden age of Chinese verse — to the Qing.</p>
        <h2 lang="zh-CN">译 · Translations</h2>
        <p>Every poem has an English verse translation that tries to do two things at once: keep the images, allusions and turns of thought
        of the original, and still read as a poem — with rhyme and a steady beat wherever that can be done without betraying the sense.
        Classical Chinese packs an extraordinary amount into very few characters, so each poem also has a short note on its background
        and the meanings that a translation alone cannot carry, in English and in Chinese (<span lang="zh-CN">赏析</span>).</p>
        <h2 lang="zh-CN">旧译 · Earlier translations</h2>
        <p>Where one exists, a poem also shows a classic English verse translation, credited to its translator and linked to the book it
        comes from. All are in the public domain (published before 1930, translators who died long before 1972):</p>
        <ul>
          <li>James Legge, <a href="https://archive.org/details/shekingorbookofa0000unse" target="_blank" rel="noopener"><em>The She King</em></a> (1876)</li>
          <li>Herbert A. Giles, <a href="https://archive.org/details/cu31924008867222" target="_blank" rel="noopener"><em>Chinese Poetry in English Verse</em></a> (1898) and
            <a href="https://archive.org/details/gems-of-chinese-literature" target="_blank" rel="noopener"><em>Gems of Chinese Literature: Verse</em></a></li>
          <li>L. Cranmer-Byng, <a href="https://www.gutenberg.org/ebooks/390" target="_blank" rel="noopener"><em>A Lute of Jade</em></a> (1909)</li>
          <li>W. J. B. Fletcher, <a href="https://archive.org/details/gemsofchinesever00fletiala" target="_blank" rel="noopener"><em>Gems of Chinese Verse</em></a> (1919)</li>
        </ul>
        <p>They are given exactly as printed, old spellings and all; where one reads the Chinese differently, the translation
        and note above it show what the original says.</p>
        <h2 lang="zh-CN">拼 · Pinyin and reading aloud</h2>
        <p>The 拼音 button shows the pronunciation above each character. Readings follow today's school textbooks, checked by hand
        for the many characters a classical poem reads differently from modern speech — 一骑红尘 <em>jì</em>, 鬓毛衰 <em>cuī</em>,
        明月何时照我还 <em>huán</em>. 朗读 reads the poem aloud with your device's own voice, nudged to say those characters right.</p>
        <h2 lang="zh-CN">画 · Paintings</h2>
        <p>The ink-wash pictures are not image files. Each poem carries a few words describing its scene — <code>night moon river boat</code> —
        and the page paints it on the spot as a tiny SVG: in plain ink, pale ochre or Tang-style blue-green, composed by one of
        Guo Xi's three distances (level, deep or high), signed with the title and the poet's name. The whole gallery costs about as much
        bandwidth as a single photograph.</p>
        <h2 lang="zh-CN">搜 · Search</h2>
        <p>Search in Chinese or English: a poet (<em>李白</em> or <em>Li Bai</em>), a line or a word (<em>明月</em>), or what a poem is about
        (<em>moon</em>, <em>wine</em>, <em>homesick</em>, <em>frontier</em>, <em>autumn</em>). Combine words to narrow down: <em>Du Fu autumn</em>.
        Every list puts the best-known poems and poets first.</p>
        <h2 lang="zh-CN">字 · Fonts</h2>
        <p>Poems are set in 霞鹜文楷 LXGW WenKai, titles in 马善政 Ma Shan Zheng brush script; the 字 button in the top bar switches to
        Song, brush or cursive faces. 繁 shows traditional characters, and 竖排 sets a poem vertically, right to left, as it would appear on a scroll.</p>
        <h2 lang="zh-CN">读 · Your reading</h2>
        <p>Poems you have opened are marked 已读 <em>read</em>, <em>Read</em> on the home page lists them, newest first, and <em>Unread only</em> hides them; Random picks one you
        haven't read yet. This history is kept only in your own browser — nothing is sent anywhere.
        <span id="readinfo"></span></p>
      </div>`;
    const info = document.getElementById('readinfo'), n = readCount(DB.poems);
    if (n) {
      info.innerHTML = `You have read ${n} of ${DB.poems.length}. <button type="button" class="linkbtn" id="clearread">Clear my reading history</button>`;
      document.getElementById('clearread').addEventListener('click', () => {
        READ = {};
        try { localStorage.removeItem('poems.read'); } catch (e) { }
        info.textContent = 'Reading history cleared.';
      });
    }
  }
  function viewNotFound() {
    setHead('云深不知处 · 诗词', 'This page could not be found.', '', true);
    app.innerHTML = `<div class="empty" style="padding:80px 0"><div class="big" lang="zh-CN">云深不知处</div><p>“Deep in the clouds — who knows where.” This page could not be found.</p><p><a href="${href('')}">Back to all poems</a></p></div>`;
  }

  /* ---------------- <head>: title, description, canonical and 简/繁 alternates ---------------- */
  function setHead(title, desc, path, noindex) {
    document.title = title;
    document.documentElement.lang = settings.hant ? 'zh-Hant' : 'zh-CN';
    const url = SITE + rel(path);
    const set = (id, attr, v) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, v); };
    set('m-desc', 'content', desc);
    set('m-robots', 'content', noindex ? 'noindex, follow' : 'index, follow');
    set('l-canon', 'href', url);
    set('l-hans', 'href', SITE + path);
    set('l-hant', 'href', SITE + 'hant/' + path);
    set('l-xdef', 'href', SITE + path);
    set('m-ogt', 'content', title);
    set('m-ogd', 'content', desc);
    set('m-ogu', 'content', url);
    set('m-ogl', 'content', settings.hant ? 'zh_TW' : 'zh_CN');
  }

  /* ---------------- top-bar tools ---------------- */
  const FONTS = [
    { k: '', zh: '文楷', name: 'LXGW WenKai', fam: "'LXGW WenKai Screen'" },
    { k: 'song', zh: '宋体', name: 'Noto Serif SC', fam: "'Noto Serif SC'", css: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600&display=swap' },
    { k: 'brush', zh: '毛笔', name: 'Ma Shan Zheng', fam: "'Ma Shan Zheng'" },
    { k: 'cursive', zh: '行草', name: 'Zhi Mang Xing', fam: "'Zhi Mang Xing'", css: 'https://fonts.googleapis.com/css2?family=Zhi+Mang+Xing&display=swap' },
    { k: 'system', zh: '系统', name: 'System Kai', fam: "'Kaiti SC','STKaiti','KaiTi'" },
  ];
  const loadedCss = {};
  function loadCss(href) {
    if (!href || loadedCss[href]) return;
    loadedCss[href] = 1;
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
  }
  function setupTools() {
    const menu = document.getElementById('font-menu');
    const bf = document.getElementById('btn-font');
    const f0 = FONTS.find(f => f.k === (settings.font || ''));
    if (f0) loadCss(f0.css);
    function renderMenu() {
      menu.innerHTML = FONTS.map(f => `<button type="button" role="menuitemradio" aria-checked="${(settings.font || '') === f.k}" class="${(settings.font || '') === f.k ? 'on' : ''}" data-k="${f.k}">
        <span class="fm-sample" style="font-family:${f.fam},serif" lang="zh-CN">${f.zh} 明月光</span><span class="fm-name">${f.name}</span></button>`).join('');
    }
    bf.addEventListener('click', e => {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      bf.setAttribute('aria-expanded', open);
      if (open) { FONTS.forEach(f => loadCss(f.css)); renderMenu(); }
    });
    menu.addEventListener('click', e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      settings.font = b.dataset.k; saveSettings();
      if (settings.font) document.documentElement.setAttribute('data-font', settings.font); else document.documentElement.removeAttribute('data-font');
      renderMenu();
      menu.hidden = true; bf.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('.font-wrap')) { menu.hidden = true; bf.setAttribute('aria-expanded', 'false'); } });

    document.getElementById('btn-theme').addEventListener('click', () => {
      const dark = settings.theme ? settings.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      settings.theme = dark ? 'light' : 'dark'; saveSettings();
      document.documentElement.setAttribute('data-theme', settings.theme);
    });

    // 简/繁 are separate pages (hant/… is traditional): the toggle moves to this page's other version
    document.getElementById('btn-script').addEventListener('click', () => {
      const rest = location.pathname.slice(BASE.length).replace(/^hant(\/|$)/, '');
      settings.hant = !settings.hant; saveSettings(); paintScript();
      history.replaceState(null, '', BASE + rel(rest) + location.search);
      ensureHant().then(rerender);
    });
  }
  function paintScript() {
    const bs = document.getElementById('btn-script');
    bs.textContent = settings.hant ? '简' : '繁';
    bs.setAttribute('aria-pressed', !!settings.hant);
  }
  function ensureHant() {
    if (!settings.hant || HANT) return Promise.resolve();
    return fetch(dataUrl('hant.json')).then(r => r.json()).then(h => {
      HANT = h;
      T2S = {};
      DB.poems.forEach(p => {
        const t = HANT.p[p.id]; if (!t) return;
        const s = [p.t].concat(p.z).join(''), tt = t.join('');
        if (s.length === tt.length) for (let i = 0; i < s.length; i++) if (s[i] !== tt[i]) T2S[tt[i]] = s[i];
      });
    }).catch(() => { hantFailed = true; toast('Traditional text unavailable'); });
  }
  const lazy = {};
  function lazyJson(name) {
    return lazy[name] || (lazy[name] = fetch(dataUrl(name)).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(() => { delete lazy[name]; return null; }));
  }
  function ensurePinyin() { return lazyJson('pinyin.json').then(d => { PY = d; }); }
  function ensureClassic() { return lazyJson('classic.json').then(d => d || {}); }
  function classicHtml(list) {
    return `<h3>Earlier translations <span lang="zh-CN">旧译</span></h3>` + list.map(c => {
      const year = (c.bk.match(/\((\d{4})\)/) || [])[1] || '';
      return `<details class="ctr"><summary><span class="ct">“${rich(c.t)}”</span><span class="cb">${esc(c.by)}${year ? ', ' + year : ''}</span></summary>
        <div class="cbody"><div class="text">${enLines(c.e)}</div>
        <p class="csrc">Translated by ${esc(c.by)}, from <a href="${esc(c.u)}" target="_blank" rel="noopener"><em>${esc(c.bk.replace(/\s*\(\d{4}\)$/, ''))}</em>${year ? ` (${year})` : ''}</a>
          · public domain.</p></div></details>`;
    }).join('');
  }
  function rerender() {
    const y = window.scrollY;
    currentKey = null;
    route();
    window.scrollTo(0, y);
  }

  /* ---------------- keyboard & swipe ---------------- */
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { const q = document.getElementById('q'); if (q) { e.preventDefault(); q.focus(); } else { e.preventDefault(); go(rel('')); const q2 = document.getElementById('q'); if (q2) q2.focus(); } }
    if (pagerNav && curView === 'p') {
      if (e.key === 'ArrowLeft' && pagerNav.prev) go(pagerNav.prev);
      if (e.key === 'ArrowRight' && pagerNav.next) go(pagerNav.next);
    }
  });
  let touch = null;
  document.addEventListener('touchstart', e => {
    if (curView !== 'p' || e.touches.length !== 1 || e.target.closest('.vertical')) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!touch || !pagerNav) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - touch.t < 600) {
      const to = dx > 0 ? pagerNav.prev : pagerNav.next;
      if (to) go(to);
    }
    touch = null;
  }, { passive: true });

  /* ---------------- links ---------------- */
  // a link to another page of the site is drawn here, without reloading; anything else behaves as usual
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const raw = a.getAttribute('href');
    if (raw.charAt(0) === '#') {  // an anchor on this page (the skip link): <base> would send it home
      e.preventDefault();
      const t = document.getElementById(raw.slice(1));
      if (t) t.focus();
      return;
    }
    if (a.origin !== location.origin || !a.pathname.startsWith(BASE) || /\.\w+$/.test(a.pathname)) return;
    e.preventDefault();
    if (a.pathname + a.search !== here()) go(a.pathname.slice(BASE.length) + a.search);
  });
  window.addEventListener('popstate', route);

  /* ---------------- boot ---------------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  setupTools();
  fromHash();
  // someone who chose 繁 before keeps getting the traditional pages
  if (settings.hant && !parseLoc().hant) history.replaceState(null, '', BASE + 'hant/' + location.pathname.slice(BASE.length) + location.search);
  fetch(dataUrl('poems.json'))
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => { prepare(data); return ensureHant(); })
    .then(() => route())
    .catch(err => {
      console.error(err);
      app.innerHTML = '<div class="empty" style="padding:80px 0"><div class="big">载入失败</div><p>Could not load the poems. Please refresh the page.</p></div>';
    });
})();
