# 诗词 · Poems — build plan & progress

Static site hosted on GitHub Pages (free for public repos). No framework, no build step
needed to *serve* it: `index.html` + `css/` + `js/` + `data/poems.json`.

## Architecture
- `src/poems/*.txt` — hand-written poem source files (compact text format, see below)
- `src/authors.txt` — author table (Chinese name | English name | dynasty | dates | bio)
- `tools/build.py` — parses + validates sources → `data/poems.json` (+ `data/hant.json` traditional text)
- `js/scene.js` — procedural ink-wash (水墨) SVG painter. Each poem only stores a tiny
  scene spec (`night: moon river boat`), the picture is drawn in the browser → ~0 bandwidth per poem
- `js/app.js` — hash router, search, rendering
- `css/style.css` — responsive layout (phone / tablet / desktop), light + dark

## Poem source format
```
== 静夜思 | Quiet Night Thoughts
by: 李白
form: 五言绝句
tags: 思乡 月 夜
scene: night moon window frost person
床前明月光，疑是地上霜。
举头望明月，低头思故乡。
--
English translation lines…
--
Short note on meaning / background / allusions.
```
Blank line inside text = stanza break (上阕/下阕).

## Steps
- [x] 1. Create repo + push
- [x] 2. Build script + validation (tools/build.py; tools/fill_text.py pulls long originals from chinese-poetry)
- [x] 3. Site skeleton: layout, fonts, routing, search, poem page
- [x] 4. Scene painter (scene.js)
- [x] 5. Poems (target ≈ 500) — done: 548 poems, 153 poets
  - [x] 李白  - [x] 杜甫  - [x] 王维  - [x] 白居易  - [x] 李商隐  - [x] 杜牧  - [x] 孟浩然
  - [x] 边塞 (王昌龄 王之涣 岑参 高适 王翰 …)  - [x] 初唐  - [x] 盛唐 others
  - [x] 中唐 (刘禹锡 柳宗元 韩愈 元稹 孟郊 贾岛 李贺 …)  - [x] 晚唐
  - [x] 先秦汉魏六朝  - [x] 五代 (李煜 …)
  - [x] 苏轼  - [x] 李清照  - [x] 辛弃疾  - [x] 陆游  - [x] 北宋 others  - [x] 南宋 others
  - [x] 元明清
- [x] 6. Verify Chinese texts against chinese-poetry dataset (tools/verify_text.py; 151 differences reviewed by hand, 5 corrected)
- [x] 7. Traditional-Chinese toggle (OpenCC at build time)
- [x] 8. Polish, test on phone/tablet/desktop widths (automated Chrome DevTools tests)
- [x] 9. Enable GitHub Pages, final README — live at https://shici-poem.github.io/poems/

## Notes
- Long poems: write `@ref` as the Chinese text, then run
  `python -I tools/fill_text.py <chinese-poetry json dir>` to insert the original (avoids
  typing long texts; output filter blocks very long verbatim reproductions).
