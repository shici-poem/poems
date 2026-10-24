/* 诗词 — single-page app: hash router, search, views. No dependencies. */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const PAGE = 24;
  const PUNCT = /[，。？！、；：“”‘’《》·—…（）\s]/g;
  const CJK = /[㐀-鿿]/;

  let DB = null;          // data/poems.json
  let HANT = null;        // data/hant.json (traditional text), loaded on demand
  let T2S = null;         // traditional → simplified char map (from HANT)
  let lastList = null;    // ids of the most recent result list, for prev/next
  let settings = loadSettings();
  const scrollMemo = {};

  /* ---------------- utils ---------------- */
  function loadSettings() { try { return JSON.parse(localStorage.getItem('poems.settings') || '{}'); } catch (e) { return {}; } }
  function saveSettings() { try { localStorage.setItem('poems.settings', JSON.stringify(settings)); } catch (e) { } }
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
  const A = a => (settings.hant && HANT && HANT.a[a]) || a;

  /* ---------------- data ---------------- */
  function prepare(data) {
    DB = data;
    DB.byId = {};
    DB.tagInfo = {};
    DB.dynEn = Object.fromEntries(DB.dynasties);
    DB.tagCount = {};
    DB.poetCount = {};
    DB.formCount = {};
    DB.tags.forEach(([zh, en, syn]) => { DB.tagInfo[zh] = { en, syn }; DB.tagCount[zh] = 0; });
    DB.poems.forEach((p, i) => {
      DB.byId[p.id] = p;
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
        te: new Set(words(p.te)),
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
    if (hasWord(p._w.a, w)) s += 14;
    if (hasWord(p._w.g, w)) s += 9;
    if (hasWord(p._w.te, w)) s += 7;
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
    const scored = [];
    for (const p of list) {
      let total = 0, ok = true;
      for (const t of terms) {
        const s = termScore(p, t);
        if (!s) { ok = false; break; }
        total += s;
      }
      if (ok) scored.push([total, p]);
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
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || '/';
    const qi = h.indexOf('?');
    const path = qi >= 0 ? h.slice(0, qi) : h;
    const params = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
    const parts = path.split('/').filter(Boolean).map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } });
    return { parts, params };
  }

  let currentKey = null;
  function route() {
    if (currentKey) scrollMemo[currentKey] = Object.assign(scrollMemo[currentKey] || {}, { y: window.scrollY });
    const { parts, params } = parseHash();
    currentKey = location.hash || '#/';
    stopSpeech();
    const v = parts[0] || '';
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('on',
      (a.dataset.nav === 'home' && (v === '' || v === 'p')) || (a.dataset.nav === 'poets' && (v === 'poets' || v === 'poet')) || (a.dataset.nav === 'themes' && v === 'themes')));
    switch (v) {
      case '': viewHome(params); break;
      case 'p': viewPoem(parts[1]); break;
      case 'poets': viewPoets(); break;
      case 'poet': viewPoet(parts[1]); break;
      case 'themes': viewThemes(); break;
      case 'about': viewAbout(); break;
      case 'random': location.replace('#/p/' + DB.order[Math.floor(Math.random() * DB.order.length)]); return;
      default: viewNotFound();
    }
    const memo = scrollMemo[currentKey];
    window.scrollTo(0, memo && memo.y ? memo.y : 0);
  }

  /* ---------------- lazy thumbnails ---------------- */
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { paintThumb(e.target); io.unobserve(e.target); } });
  }, { rootMargin: '400px 0px' }) : null;
  function paintThumb(el) {
    const p = DB.byId[el.dataset.id];
    if (p) el.innerHTML = Scene.paint(p.s, p.id, {});
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
    return `<a class="card" href="#/p/${p.id}">
      <div class="thumb" data-id="${p.id}"></div>
      <div class="card-body">
        <h3 class="card-title" lang="zh-CN">${esc(T(p))}</h3>
        <div class="card-meta"><span class="a" lang="zh-CN">〔${esc(au.d)}〕${esc(A(p.a))}</span> · ${esc(au.en)}</div>
        <p class="card-line" lang="zh-CN">${segs(line)}</p>
        <p class="card-en">${esc(p.te)}</p>
      </div></a>`;
  }
  function tagChip(t, on, count) {
    const info = DB.tagInfo[t];
    return `<a class="chip${on ? ' on' : ''}" href="#/?tag=${enc(t)}" data-tag="${esc(t)}"><span class="z" lang="zh-CN">${esc(t)}</span>${esc(info.en)}${count != null ? `<span class="c">${count}</span>` : ''}</a>`;
  }
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
  function homeHash() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.tag) p.set('tag', state.tag);
    if (state.poet) p.set('poet', state.poet);
    if (state.dyn) p.set('d', state.dyn);
    if (state.form) p.set('f', state.form);
    const s = p.toString();
    return '#/' + (s ? '?' + s : '');
  }
  function syncHash() {
    const h = homeHash();
    if (h !== (location.hash || '#/')) {
      history.replaceState(null, '', h);
      currentKey = h;
    }
  }

  function viewHome(params) {
    state = {
      q: params.get('q') || '', tag: params.get('tag') || '', poet: params.get('poet') || '',
      dyn: params.get('d') || '', form: params.get('f') || '', shown: PAGE,
    };
    const memo = scrollMemo[location.hash || '#/'];
    if (memo && memo.shown) state.shown = memo.shown;
    document.title = '诗词 · Classical Chinese Poems';
    const tagsSorted = Object.keys(DB.tagCount).filter(t => DB.tagCount[t]).sort((a, b) => DB.tagCount[b] - DB.tagCount[a]);
    const dyns = DB.dynasties.filter(([d]) => DB.poems.some(p => DB.authors[p.a].d === d));
    const forms = Object.keys(DB.forms).filter(f => DB.formCount[f]);
    const poetsByDyn = dyns.map(([d, de]) => {
      const ps = Object.keys(DB.authors).filter(a => DB.authors[a].d === d && DB.poetCount[a]);
      return `<optgroup label="${esc(d)} ${esc(de)}">${ps.map(a => `<option value="${esc(a)}"${state.poet === a ? ' selected' : ''}>${esc(A(a))} ${esc(DB.authors[a].en)} (${DB.poetCount[a]})</option>`).join('')}</optgroup>`;
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
        <div class="chiprow" id="dynrow"><span class="lbl">朝代 Era</span>
          <button type="button" class="chip${state.dyn ? '' : ' on'}" data-dyn=""><span class="z">全部</span>All</button>
          ${dyns.map(([d, de]) => `<button type="button" class="chip${state.dyn === d ? ' on' : ''}" data-dyn="${esc(d)}"><span class="z" lang="zh-CN">${esc(d)}</span>${esc(de)}</button>`).join('')}
        </div>
        <div class="chiprow" id="tagrow"><span class="lbl">题材 Theme</span>
          ${tagsSorted.map(t => tagChip(t, state.tag === t, DB.tagCount[t])).join('')}
        </div>
        <div class="selrow">
          <select id="psel" aria-label="Poet"><option value="">诗人 · All poets</option>${poetsByDyn}</select>
          <select id="fsel" aria-label="Form"><option value="">体裁 · All forms</option>${forms.map(f => `<option value="${esc(f)}"${state.form === f ? ' selected' : ''}>${esc(f)} · ${esc(DB.forms[f])} (${DB.formCount[f]})</option>`).join('')}</select>
          <button type="button" class="more-tags" id="tagwrap">Show all themes</button>
        </div>
      </section>
      <div id="feat"></div>
      <section id="results" aria-live="polite"></section>`;

    const input = document.getElementById('q');
    const clear = document.getElementById('qclear');
    const onInput = debounce(() => { state.q = input.value; state.shown = PAGE; syncHash(); renderResults(); }, 160);
    input.addEventListener('input', () => { clear.hidden = !input.value; onInput(); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { input.blur(); document.getElementById('results').scrollIntoView({ behavior: 'smooth' }); } });
    clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; state.q = ''; syncHash(); renderResults(); input.focus(); });
    app.querySelectorAll('.hint button').forEach(b => b.addEventListener('click', () => {
      input.value = b.dataset.q; clear.hidden = false; state.q = b.dataset.q; state.shown = PAGE; syncHash(); renderResults();
    }));
    app.querySelector('#dynrow').addEventListener('click', e => {
      const b = e.target.closest('[data-dyn]'); if (!b) return;
      state.dyn = b.dataset.dyn; state.shown = PAGE;
      app.querySelectorAll('#dynrow .chip').forEach(c => c.classList.toggle('on', c === b));
      syncHash(); renderResults();
    });
    app.querySelector('#tagrow').addEventListener('click', e => {
      const b = e.target.closest('[data-tag]'); if (!b) return;
      e.preventDefault();
      state.tag = state.tag === b.dataset.tag ? '' : b.dataset.tag; state.shown = PAGE;
      app.querySelectorAll('#tagrow .chip').forEach(c => c.classList.toggle('on', c.dataset.tag === state.tag));
      syncHash(); renderResults();
    });
    app.querySelector('#psel').addEventListener('change', e => { state.poet = e.target.value; state.shown = PAGE; syncHash(); renderResults(); });
    app.querySelector('#fsel').addEventListener('change', e => { state.form = e.target.value; state.shown = PAGE; syncHash(); renderResults(); });
    app.querySelector('#tagwrap').addEventListener('click', e => {
      const row = app.querySelector('#tagrow');
      row.classList.toggle('wrap');
      e.target.textContent = row.classList.contains('wrap') ? 'Fewer themes' : 'Show all themes';
    });
    if (state.tag) { const on = app.querySelector('#tagrow .chip.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
    renderResults();
  }

  function dayPoem() {
    const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
    return DB.poems[(day * 37) % DB.poems.length];
  }

  function renderResults() {
    const filtered = DB.poems.filter(p => (!state.tag || p.g.includes(state.tag)) && (!state.poet || p.a === state.poet) &&
      (!state.dyn || DB.authors[p.a].d === state.dyn) && (!state.form || p.f === state.form));
    const list = state.q.trim() ? search(filtered, state.q) : filtered;
    lastList = list.map(p => p.id);
    const anyFilter = state.q.trim() || state.tag || state.poet || state.dyn || state.form;

    const feat = document.getElementById('feat');
    if (!anyFilter) {
      const p = dayPoem(), au = DB.authors[p.a];
      const z = Z(p);
      feat.innerHTML = `<a class="featured" href="#/p/${p.id}">
        <div class="thumb" data-id="${p.id}"></div>
        <div class="fbody">
          <div class="kicker"><b lang="zh-CN">今日一诗</b>Poem of the day</div>
          <h3 lang="zh-CN">${esc(T(p))}</h3>
          <div class="by"><span lang="zh-CN">〔${esc(au.d)}〕${esc(A(p.a))}</span> · ${esc(au.en)}</div>
          <div class="lines" lang="zh-CN">${z.filter(Boolean).slice(0, 2).map(segs).join('<br>')}</div>
          <div class="en">${p.e.filter(Boolean).slice(0, 2).map(esc).join('<br>')}</div>
        </div></a>`;
      observeThumbs(feat);
    } else feat.innerHTML = '';

    const active = [];
    if (state.q.trim()) active.push(`<button type="button" class="chip" data-clear="q">“${esc(state.q.trim())}” ✕</button>`);
    if (state.tag) active.push(`<button type="button" class="chip" data-clear="tag"><span class="z">${esc(state.tag)}</span>${esc(DB.tagInfo[state.tag] ? DB.tagInfo[state.tag].en : '')} ✕</button>`);
    if (state.dyn) active.push(`<button type="button" class="chip" data-clear="dyn"><span class="z">${esc(state.dyn)}</span>${esc(DB.dynEn[state.dyn] || '')} ✕</button>`);
    if (state.poet) active.push(`<button type="button" class="chip" data-clear="poet"><span class="z">${esc(A(state.poet))}</span>✕</button>`);
    if (state.form) active.push(`<button type="button" class="chip" data-clear="form"><span class="z">${esc(state.form)}</span>✕</button>`);

    // poet banner when the query is a poet's name
    let banner = '';
    const qn = norm(state.q.trim()).replace(/\s+/g, '');
    if (qn) {
      const hit = Object.keys(DB.authors).find(a => DB.poetCount[a] && (a === toSimplified(state.q.trim()) || norm(DB.authors[a].en).replace(/\s+/g, '') === qn));
      if (hit) {
        const au = DB.authors[hit];
        banner = `<a class="poet-banner" href="#/poet/${enc(hit)}"><span class="pz" lang="zh-CN">${esc(A(hit))}</span>
          <span><b>${esc(au.en)}</b><br><span class="pe">${esc(au.d)} · ${esc(DB.dynEn[au.d])} · ${esc(au.y)}</span></span><span class="go">Poet page →</span></a>`;
      }
    }

    const res = document.getElementById('results');
    const shown = list.slice(0, state.shown);
    res.innerHTML = `
      <div class="reshead">
        <h2>${anyFilter ? '搜索结果<small>Results</small>' : '全部诗词<small>All poems</small>'}</h2>
        <span class="count">${list.length} ${list.length === 1 ? 'poem' : 'poems'}</span>
      </div>
      ${active.length ? `<div class="active">${active.join('')}${active.length > 1 ? '<button type="button" class="chip" data-clear="all">Clear all</button>' : ''}</div><div style="height:12px"></div>` : ''}
      ${banner}
      ${list.length ? `<div class="grid">${shown.map(p => card(p, state.q)).join('')}</div>` :
        `<div class="empty"><div class="big" lang="zh-CN">无处觅</div><p>No poems found. Try another word — English or Chinese — or clear the filters.</p></div>`}
      ${list.length > shown.length ? `<button type="button" class="showmore" id="more">更多 · Show more (${list.length - shown.length})</button>` : ''}`;
    observeThumbs(res);
    const memoKey = homeHash();
    scrollMemo[memoKey] = Object.assign(scrollMemo[memoKey] || {}, { shown: state.shown });
    res.querySelectorAll('[data-clear]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.clear;
      if (k === 'all') { state.q = state.tag = state.poet = state.dyn = state.form = ''; } else state[k] = '';
      if (k === 'q' || k === 'all') { const i = document.getElementById('q'); i.value = ''; document.getElementById('qclear').hidden = true; }
      if (k === 'dyn' || k === 'all') app.querySelectorAll('#dynrow .chip').forEach(c => c.classList.toggle('on', c.dataset.dyn === ''));
      if (k === 'tag' || k === 'all') app.querySelectorAll('#tagrow .chip').forEach(c => c.classList.remove('on'));
      if (k === 'poet' || k === 'all') document.getElementById('psel').value = '';
      if (k === 'form' || k === 'all') document.getElementById('fsel').value = '';
      state.shown = PAGE; syncHash(); renderResults();
    }));
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
  function zhLines(lines) {
    return lines.map(l => {
      if (!l) return '<p class="gap"></p>';
      return '<p>' + segs(l) + '</p>';
    }).join('');
  }
  function segs(l) {
    return (l.match(/[^，。？！；：、]+[，。？！；：、”’」]*/g) || [l]).map(s => `<span class="seg">${esc(s)}</span>`).join('');
  }
  function enLines(lines) { return lines.map(l => l ? `<p>${rich(l)}</p>` : '<p class="gap"></p>').join(''); }

  function viewPoem(id) {
    const p = DB.byId[id];
    if (!p) return viewNotFound();
    const au = DB.authors[p.a];
    const list = lastList && lastList.includes(id) ? lastList : DB.order;
    const i = list.indexOf(id);
    const prev = DB.byId[list[i - 1]], next = DB.byId[list[i + 1]];
    const vertical = !!settings.vertical;
    const chars = p._z.length;
    document.title = `${p.t} · ${p.a} — ${p.te}`;
    app.innerHTML = `
      <article class="poem">
        <div class="crumbs"><a href="#/">诗词</a><span>›</span><a href="#/poet/${enc(p.a)}" lang="zh-CN">${esc(A(p.a))}</a><span>›</span><span lang="zh-CN">${esc(T(p))}</span></div>
        <figure class="painting" id="painting"></figure>
        <div class="ptools">
          <button type="button" class="pbtn" id="b-vert" aria-pressed="${vertical}">${ICON.vert}<span class="z">竖排</span> Vertical</button>
          ${'speechSynthesis' in window ? `<button type="button" class="pbtn" id="b-zh">${ICON.speak}<span class="z">朗读</span></button>
          <button type="button" class="pbtn" id="b-en">${ICON.speak}English</button>` : ''}
          <button type="button" class="pbtn" id="b-share">${ICON.share}Share</button>
          <a class="pbtn" href="#/random">${ICON.dice}<span class="z">随机</span> Random</a>
        </div>
        <div class="duo">
          <section class="zh${vertical ? ' vertical' : ''}${chars > 120 ? ' long' : ''}" lang="zh-CN"><div class="vwrap">
            <h1>${esc(T(p))}</h1>
            <div class="byline"><a href="#/poet/${enc(p.a)}">〔${esc(au.d)}〕${esc(A(p.a))}</a></div>
            <div class="text">${zhLines(Z(p))}</div>
          </div></section>
          <section class="en" lang="en">
            <h2>${esc(p.te)}</h2>
            <div class="byline">${esc(au.en)} · ${esc(DB.dynEn[au.d])} · ${esc(DB.forms[p.f])}</div>
            <div class="text">${enLines(p.e)}</div>
          </section>
        </div>
        <section class="note"><h3>About this poem</h3><p>${rich(p.n)}</p></section>
        <div class="ptags">${p.g.map(t => tagChip(t, false)).join('')}</div>
        <div class="pmeta"><span lang="zh-CN">${esc(p.f)}</span> · ${esc(DB.forms[p.f])} · <a href="#/poet/${enc(p.a)}">More by ${esc(au.en)} (${DB.poetCount[p.a]})</a></div>
        <nav class="pager" aria-label="More poems">
          ${prev ? `<a class="prev" href="#/p/${prev.id}"><span class="dir">← 上一首 Previous</span><span class="pt" lang="zh-CN">${esc(T(prev))}</span></a>` : ''}
          ${next ? `<a class="next" href="#/p/${next.id}"><span class="dir">下一首 Next →</span><span class="pt" lang="zh-CN">${esc(T(next))}</span></a>` : ''}
        </nav>
      </article>`;
    document.getElementById('painting').innerHTML = Scene.paint(p.s, p.id, { detail: true, title: T(p), seal: p.a, label: 'Ink painting for ' + p.te });

    const zh = app.querySelector('.zh');
    const bv = document.getElementById('b-vert');
    bv.addEventListener('click', () => {
      settings.vertical = !settings.vertical; saveSettings();
      zh.classList.toggle('vertical', settings.vertical);
      bv.setAttribute('aria-pressed', settings.vertical);
      if (settings.vertical) { const w = zh.querySelector('.vwrap'); w.scrollLeft = w.scrollWidth; }
    });
    if (vertical) { const w = zh.querySelector('.vwrap'); w.scrollLeft = w.scrollWidth; }
    const bz = document.getElementById('b-zh'), be = document.getElementById('b-en');
    if (bz) bz.addEventListener('click', () => speak([T(p), au.d + '，' + A(p.a)].concat(Z(p).filter(Boolean)).join('。'), 'zh-CN', bz));
    if (be) be.addEventListener('click', () => speak([p.te, 'by ' + au.en].concat(p.e.filter(Boolean)).join('\n'), 'en', be));
    document.getElementById('b-share').addEventListener('click', () => {
      const url = location.href;
      if (navigator.share) navigator.share({ title: `${p.t} · ${p.te}`, text: `${p.t} — ${p.a}\n${p.z[0]}`, url }).catch(() => { });
      else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied · 链接已复制'), () => toast(url));
      else toast(url);
    });
    pagerNav = { prev: prev && prev.id, next: next && next.id };
  }
  let pagerNav = null;

  /* ---------------- speech ---------------- */
  let speaking = null;
  function stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (speaking) speaking.setAttribute('aria-pressed', 'false');
    speaking = null;
  }
  function speak(text, lang, btn) {
    if (speaking === btn) { stopSpeech(); return; }
    stopSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    u.rate = lang === 'en' ? 0.92 : 0.72;
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.replace('_', '-').toLowerCase().startsWith(lang === 'en' ? 'en' : 'zh-cn')) ||
      voices.find(v => v.lang.toLowerCase().startsWith(lang === 'en' ? 'en' : 'zh'));
    if (v) u.voice = v;
    u.onend = u.onerror = () => { if (speaking === btn) { btn.setAttribute('aria-pressed', 'false'); speaking = null; } };
    speaking = btn;
    btn.setAttribute('aria-pressed', 'true');
    speechSynthesis.speak(u);
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  /* ---------------- poets ---------------- */
  function viewPoets() {
    document.title = '诗人 Poets · 诗词';
    const groups = DB.dynasties.map(([d, de]) => {
      const ps = Object.keys(DB.authors).filter(a => DB.authors[a].d === d && DB.poetCount[a]);
      if (!ps.length) return '';
      return `<section class="dyn"><h2><span lang="zh-CN">${esc(d)}</span><small>${esc(de)}</small></h2><div class="poets">
        ${ps.map(a => { const au = DB.authors[a]; return `<a class="poet" href="#/poet/${enc(a)}"><span class="pz" lang="zh-CN">${esc(A(a))}</span>
          <span class="pe"><b>${esc(au.en)}</b> · ${DB.poetCount[a]} ${DB.poetCount[a] === 1 ? 'poem' : 'poems'}</span><span class="py">${esc(au.y)}</span></a>`; }).join('')}
      </div></section>`;
    }).join('');
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">诗人</h1><p>${Object.keys(DB.poetCount).length} poets, from the Book of Songs to the last dynasty</p></div>${groups}`;
  }

  function viewPoet(a) {
    const au = DB.authors[a];
    if (!au) return viewNotFound();
    document.title = `${a} ${au.en} · 诗词`;
    const ps = DB.poems.filter(p => p.a === a);
    lastList = ps.map(p => p.id);
    app.innerHTML = `
      <div class="crumbs" style="margin-top:18px"><a href="#/poets">诗人 Poets</a><span>›</span><span lang="zh-CN">${esc(A(a))}</span></div>
      <header class="poethead">
        <div class="big" lang="zh-CN">${esc(A(a))}</div>
        <div><div class="en">${esc(au.en)}</div><div class="meta"><span lang="zh-CN">${esc(au.d)}</span> · ${esc(DB.dynEn[au.d])} · ${esc(au.y)} · ${ps.length} ${ps.length === 1 ? 'poem' : 'poems'}</div>
        <p class="bio">${rich(au.b)}</p></div>
      </header>
      <div class="reshead"><h2>作品<small>Poems</small></h2></div>
      <div class="grid">${ps.map(p => card(p)).join('')}</div>`;
    observeThumbs(app);
  }

  /* ---------------- themes ---------------- */
  function viewThemes() {
    document.title = '题材 Themes · 诗词';
    const used = new Set();
    const tags = Object.keys(DB.tagCount).filter(t => DB.tagCount[t]).sort((a, b) => DB.tagCount[b] - DB.tagCount[a]);
    const tiles = tags.map(t => {
      const cands = DB.poems.filter(p => p.g.includes(t));
      const rep = cands.find(p => !used.has(p.id) && p.g[0] === t) || cands.find(p => !used.has(p.id)) || cands[0];
      used.add(rep.id);
      return `<a class="theme" href="#/?tag=${enc(t)}"><div class="thumb" data-id="${rep.id}"></div>
        <div class="tl"><span class="tz" lang="zh-CN">${esc(t)}</span><span class="te">${esc(DB.tagInfo[t].en)}</span><span class="tc">${DB.tagCount[t]}</span></div></a>`;
    }).join('');
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">题材</h1><p>Browse by what the poems are about</p></div><div class="themes">${tiles}</div>`;
    observeThumbs(app);
  }

  /* ---------------- about / 404 ---------------- */
  function viewAbout() {
    document.title = 'About · 诗词';
    app.innerHTML = `<div class="pagehead"><h1 lang="zh-CN">关于</h1><p>About this collection</p></div>
      <div class="prose">
        <p>This is a free, open collection of ${DB.poems.length} of the best-loved poems in the Chinese language, from the <em>Book of Songs</em>
        (c. 1000 BC) through the Tang and Song dynasties — the golden age of Chinese verse — to the Qing.</p>
        <h2 lang="zh-CN">译 · Translations</h2>
        <p>Every poem has an English verse translation that tries to do two things at once: keep the images, allusions and turns of thought
        of the original, and still read as a poem — with rhyme and a steady beat wherever that can be done without betraying the sense.
        Classical Chinese packs an extraordinary amount into very few characters, so each poem also has a short note on its background
        and the meanings that a translation alone cannot carry.</p>
        <h2 lang="zh-CN">画 · Paintings</h2>
        <p>The ink-wash pictures are not image files. Each poem carries a few words describing its scene — <code>night moon river boat</code> —
        and the page paints it on the spot as a tiny SVG. The whole gallery costs about as much bandwidth as a single photograph.</p>
        <h2 lang="zh-CN">搜 · Search</h2>
        <p>Search in Chinese or English: a poet (<em>李白</em> or <em>Li Bai</em>), a line or a word (<em>明月</em>), or what a poem is about
        (<em>moon</em>, <em>wine</em>, <em>homesick</em>, <em>frontier</em>, <em>autumn</em>). Combine words to narrow down: <em>Du Fu autumn</em>.</p>
        <h2 lang="zh-CN">字 · Fonts</h2>
        <p>Poems are set in 霞鹜文楷 LXGW WenKai, titles in 马善政 Ma Shan Zheng brush script; the 字 button in the top bar switches to
        Song, brush or cursive faces. 繁 shows traditional characters, and 竖排 sets a poem vertically, right to left, as it would appear on a scroll.</p>
      </div>`;
  }
  function viewNotFound() {
    document.title = '诗词';
    app.innerHTML = `<div class="empty" style="padding:80px 0"><div class="big" lang="zh-CN">云深不知处</div><p>“Deep in the clouds — who knows where.” This page could not be found.</p><p><a href="#/">Back to all poems</a></p></div>`;
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

    const bs = document.getElementById('btn-script');
    const paintScript = () => { bs.textContent = settings.hant ? '简' : '繁'; bs.setAttribute('aria-pressed', !!settings.hant); };
    paintScript();
    bs.addEventListener('click', () => {
      settings.hant = !settings.hant; saveSettings(); paintScript();
      ensureHant().then(rerender);
    });
  }
  function ensureHant() {
    if (!settings.hant || HANT) return Promise.resolve();
    return fetch('data/hant.json').then(r => r.json()).then(h => {
      HANT = h;
      T2S = {};
      DB.poems.forEach(p => {
        const t = HANT.p[p.id]; if (!t) return;
        const s = [p.t].concat(p.z).join(''), tt = t.join('');
        if (s.length === tt.length) for (let i = 0; i < s.length; i++) if (s[i] !== tt[i]) T2S[tt[i]] = s[i];
      });
    }).catch(() => { settings.hant = false; toast('Traditional text unavailable'); });
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
    if (e.key === '/') { const q = document.getElementById('q'); if (q) { e.preventDefault(); q.focus(); } else { location.hash = '#/'; setTimeout(() => { const q2 = document.getElementById('q'); if (q2) q2.focus(); }, 50); e.preventDefault(); } }
    if (pagerNav && location.hash.startsWith('#/p/')) {
      if (e.key === 'ArrowLeft' && pagerNav.prev) location.hash = '#/p/' + pagerNav.prev;
      if (e.key === 'ArrowRight' && pagerNav.next) location.hash = '#/p/' + pagerNav.next;
    }
  });
  let touch = null;
  document.addEventListener('touchstart', e => {
    if (!location.hash.startsWith('#/p/') || e.touches.length !== 1 || e.target.closest('.vertical')) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (!touch || !pagerNav) return;
    const dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 2 && Date.now() - touch.t < 600) {
      const id = dx > 0 ? pagerNav.prev : pagerNav.next;
      if (id) location.hash = '#/p/' + id;
    }
    touch = null;
  }, { passive: true });

  /* ---------------- boot ---------------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  setupTools();
  fetch('data/poems.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => { prepare(data); return ensureHant(); })
    .then(() => { window.addEventListener('hashchange', route); route(); })
    .catch(err => {
      console.error(err);
      app.innerHTML = '<div class="empty" style="padding:80px 0"><div class="big">载入失败</div><p>Could not load the poems. Please refresh the page.</p></div>';
    });
})();
