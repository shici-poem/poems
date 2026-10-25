// Pinyin for every poem, with hand-checked corrections → data/pinyin.json (loaded by the site
// only when the 拼 Pinyin button is used) and data/speech.json (the read-aloud fixes below).
//
//   cd tools && npm install        (once: installs pinyin-pro)
//   node tools/pinyin.mjs          (run after tools/build.py)
//   node tools/pinyin.mjs --review (list every reading of a character that has several)
//
// pinyin-pro reads modern Chinese well but misses classical readings (一骑 jì, 鬓毛衰 cuī,
// 照我还 huán…). src/pinyin.txt fixes them; see the comments at its top.
//
// For read-aloud, the browser's voice cannot be told a pronunciation, so wherever a character is
// read other than its usual way, the speech text swaps in a common character that only has that
// reading (骑 jì → 寄). The page still shows the real character.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pinyin, polyphonic } = require('pinyin-pro');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CJK = /[㐀-鿿豈-﫿]/;
const review = process.argv.includes('--review');

const db = JSON.parse(readFileSync(join(ROOT, 'data/poems.json'), 'utf8'));
const byKey = Object.fromEntries(db.poems.map(p => [p.a + ' ' + p.t, p]));

// ---- overrides: "<poet> <title>: 词=py py 字=py" or "*: 词=py py" for every poem ----
const fixes = { '*': [] };
readFileSync(join(ROOT, 'src/pinyin.txt'), 'utf8').split(/\r?\n/).forEach((raw, n) => {
  const line = raw.replace(/#.*/, '').trim();
  if (!line) return;
  const m = line.match(/^(.+?):\s*(.+)$/);
  if (!m) throw new Error(`pinyin.txt:${n + 1}: expected "<poet> <title>: 词=py py …"`);
  const key = m[1].trim();
  if (key !== '*' && !byKey[key]) throw new Error(`pinyin.txt:${n + 1}: no such poem: ${key}`);
  const list = (fixes[key] = fixes[key] || []);
  for (const item of m[2].split(/\s+(?=\S+=)/)) {
    const [word, py] = item.split('=');
    const syl = py.trim().split(/\s+/);
    if (Array.from(word).length !== syl.length) throw new Error(`pinyin.txt:${n + 1}: ${word} has ${Array.from(word).length} characters but ${syl.length} syllables`);
    list.push({ word, syl, used: 0, line: n + 1 });
  }
});

// Classical verse is recited without the modern neutral tone: 妃子 fēi zǐ, 琵琶 pí pá.
const TONED = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ' };
const bare = s => s.replace(/./g, ch => { for (const [v, t] of Object.entries(TONED)) if (t.includes(ch)) return v; return ch; });
function fullTone(c, s) {
  if (!s || bare(s) !== s) return s;
  const cands = (polyphonic(c, { type: 'array' })[0] || []).filter(r => r !== s && bare(r) === s);
  return cands.length === 1 ? cands[0] : s;
}

function readLine(text, poemFixes) {
  const chars = Array.from(text);
  const py = pinyin(text, { type: 'array', toneSandhi: false, nonZh: 'removed' });
  const out = [];
  let k = 0;
  const base = [];  // pinyin-pro's own reading in the line, before any fix
  chars.forEach((c, i) => { if (CJK.test(c)) { base[i] = py[k] || ''; out[i] = fullTone(c, py[k++] || ''); } });
  for (const f of poemFixes) {
    const w = Array.from(f.word);
    for (let i = 0; i + w.length <= chars.length; i++) {
      if (w.every((c, j) => chars[i + j] === c)) { w.forEach((_, j) => { out[i + j] = f.syl[j]; }); f.used++; }
    }
  }
  return { chars, out, base };
}

// ---- homophones for speech: one common, single-reading character per toned syllable ----
const freq = {};
db.poems.forEach(p => Array.from(p.z.join('')).forEach(c => { if (CJK.test(c)) freq[c] = (freq[c] || 0) + 1; }));
const gb1 = [];  // GB2312 level 1: the 3755 most common characters
const dec = new TextDecoder('gb18030');
for (let a = 0xb0; a <= 0xd7; a++) for (let b = 0xa1; b <= 0xfe; b++) gb1.push(dec.decode(new Uint8Array([a, b])));
const homo = {};
for (const c of gb1.filter(c => CJK.test(c))) {
  const all = polyphonic(c, { type: 'array' })[0];
  if (!all || all.length !== 1) continue;
  const s = all[0];
  if (!homo[s] || (freq[c] || 0) > (freq[homo[s]] || 0)) homo[s] = c;
}
// The voice's idea of a character's usual reading is not always pinyin-pro's (alone, 了 is liǎo to
// pinyin-pro but le to the voice), so a reading is left to the voice only when it is the character's
// first listed reading, its reading alone and pinyin-pro's reading in the line, all at once.
const usual = (c, inLine) => {
  const all = polyphonic(c, { type: 'array' })[0] || [];
  return [all[0], pinyin(c, { toneSandhi: false }), inLine].filter(Boolean);
};
// Syllables with no single-reading common character: a character the voice reads that way nearly always.
// Not for 卷 juǎn or 参差 cēn cī, which voices already read right.
const STAND_IN = { liǎo: '蓼', nǎ: '哪', tiǎo: '窕', qiǎng: '抢', dāng: '裆', lè: '勒', kōng: '箜', há: '蛤' };

const out = {}, say = {}, missing = new Set(), rev = {};
for (const p of db.poems) {
  const poemFixes = fixes['*'].concat(fixes[p.a + ' ' + p.t] || []);
  const lines = [p.t].concat(p.z);
  const py = [], speech = [];
  lines.forEach((text, li) => {
    const { chars, out: syl, base } = readLine(text, poemFixes);
    py.push(chars.map((c, i) => syl[i]).filter(Boolean).join(' '));
    speech.push(chars.map((c, i) => {
      if (!syl[i] || usual(c, base[i]).every(s => s === syl[i])) return c;
      if (homo[syl[i]]) return homo[syl[i]];
      if (STAND_IN[syl[i]]) return STAND_IN[syl[i]];
      missing.add(c + syl[i]);
      return c;
    }).join(''));
    if (review) chars.forEach((c, i) => {
      if (!syl[i]) return;
      const all = polyphonic(c, { type: 'array' })[0] || [];
      if (all.length < 2) return;
      (rev[c] = rev[c] || []).push(`${syl[i]}\t${text}\t${p.a} ${p.t}`);
    });
  });
  out[p.id] = py;
  speech.forEach((s, i) => { if (s !== lines[i]) (say[p.id] = say[p.id] || {})[i] = s; });
}
for (const list of Object.values(fixes)) for (const f of list) if (!f.used) console.warn(`WARN pinyin.txt:${f.line}: ${f.word} not found`);
if (missing.size) console.warn('WARN no single-reading homophone for:', [...missing].join(' '));

if (review) {
  for (const [c, rows] of Object.entries(rev).sort((a, b) => b[1].length - a[1].length)) {
    const counts = {};
    rows.forEach(r => { const s = r.split('\t')[0]; counts[s] = (counts[s] || 0) + 1; });
    console.log(`\n## ${c}  ${Object.entries(counts).map(([s, n]) => s + '×' + n).join(' ')}`);
    rows.forEach(r => console.log('  ' + r));
  }
} else {
  writeFileSync(join(ROOT, 'data/pinyin.json'), JSON.stringify(out));
  writeFileSync(join(ROOT, 'data/speech.json'), JSON.stringify(say));

  // ---- page addresses: poems by their title's pinyin (p/jing-ye-si/), poets by English name (poet/li-bai/).
  // The better-known keeps the plain address when two share one. Written into poems.json as `u`, with the
  // title's pinyin for display as `y`; ids stay the key for reading history and paintings.
  const slug = s => bare(s).toLowerCase().replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const taken = new Set();
  const claim = (...cands) => { const s = cands.find(c => c && !taken.has(c)); taken.add(s); return s; };
  for (const [a, au] of Object.entries(db.authors)) {
    const base = slug(au.en);
    au.u = claim(base, base + '-' + ((au.y.match(/\d+/) || [])[0] || ''), base + '-' + slug(a));
  }
  taken.clear();
  for (const p of db.poems) {
    const base = slug(out[p.id][0]) || p.id;
    p.u = claim(base, base + '-' + db.authors[p.a].u, base + '-' + p.id);
    p.y = out[p.id][0].split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }
  writeFileSync(join(ROOT, 'data/poems.json'), JSON.stringify(db));
  console.log(`pinyin.json: ${db.poems.length} poems; speech.json: ${Object.keys(say).length} poems with read-aloud fixes; slugs written to poems.json`);
}
