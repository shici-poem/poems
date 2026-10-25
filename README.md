# 诗词 · Classical Chinese Poems

**Live site:** https://shici-poem.github.io/poems/

The 378 best-loved poems in the Chinese language, from the *Book of Songs* to the Qing. Each poem has:

- the original text (simplified or traditional, horizontal or vertical) with optional **pinyin**
- an English **verse translation** that keeps the images and rhymes where it can, plus a short note
- where one exists, a classic **earlier translation** (public domain, credited and linked)
- an **ink-wash painting** drawn in the browser
- read-aloud in Chinese or English

Poet pages link to the poet's Chinese and English Wikipedia articles where one exists.
Every list puts the best-known poems and poets first. Poems you have opened are marked *read* (kept only in your browser).
Works on phones, tablets and desktops, light and dark. No framework, no server: plain HTML/CSS/JS on GitHub Pages.

## Layout

```
src/page.html, css/, js/app.js the site: one page shell, path router (p/jing-ye-si/, poet/li-bai/, theme/moon/, era/tang/), search, views
js/scene.js                    ink-wash painter: "night moon river boat" → SVG
src/poems/*.txt                the poems (format below)
src/authors.txt                poets: name | English name | dynasty | dates | bio
src/wiki.txt                   poets' Wikipedia articles: name | zh title | en title ('-' = none)
src/ranking.txt                every poem, most famous first; sets the order of every list
src/classic/*.txt              earlier translations (format at load_classic in tools/build.py)
src/pinyin.txt                 hand-checked pinyin corrections for classical readings
tools/build.py                 validates src/ → data/poems.json, hant.json, classic.json
tools/pinyin.mjs               pinyin-pro + src/pinyin.txt → data/pinyin.json, speech.json; page addresses into poems.json
tools/site.mjs                 prerenders every page (simplified + hant/ traditional) with JSON-LD, sitemap.xml, og.jpg
tools/fill_text.py             fills long Chinese texts from the chinese-poetry dataset
tools/verify_text.py           checks every Chinese text against that dataset
.github/workflows/deploy.yml   builds the site and publishes it to GitHub Pages on every push to main
```

Built from `src/` and not committed: `data/`, `index.html`, `404.html`, `p/`, `poet/`, `poets/`, `theme/`, `themes/`,
`era/`, `about/`, `random/`, `hant/`, `sitemap.xml`. Each page is the app's own rendering of it, so search engines read
the full text and visitors see it before the script loads; the script then takes over. Old `#/…` links still work
(they are redirected). Every file a page loads carries its own content hash (`app.js?v=…`), so after a deploy
browsers refetch only what changed. `og.jpg`, the share picture, is committed (`--og` redraws it).

Poem format (a blank line marks a stanza break):

```
== 静夜思 | Quiet Night Thoughts
by: 李白
form: 五绝
tags: 思乡 月 夜 羁旅
scene: night moon window frost
床前明月光，疑是地上霜。
…
--
Before my bed there gleams a silver light —
…
--
A note on the poem's background and meaning.
```

`scene:` words (time, season, weather, motifs such as `peaks`, `willow`, `boat`, `lady`, `ox`, `kite`; see `SCENE_WORDS` in
`tools/build.py`) drive the painting, which also picks a colour manner (ink, ochre, blue-green) and one of Guo Xi's three
compositions (level, deep or high distance). A new poem must also be added to `src/ranking.txt`.

## Build

```sh
pip install opencc-python-reimplemented    # once: traditional characters
(cd tools && npm install)                   # once: pinyin-pro, puppeteer-core
python tools/build.py                       # validate + write data/   (--check: validate only)
node tools/pinyin.mjs                       # pinyin, read-aloud fixes, page addresses (--review: list readings to check)
node tools/site.mjs                         # prerender every page, sitemap.xml (needs Chrome; --og redraws og.jpg)
node tools/site.mjs --serve                 # preview at http://localhost:8000/poems/
```

Building locally is only for previewing: pushing to main runs the same steps on GitHub and publishes the site
(only the site: not `src/`, `tools/` or these notes). The site lives under `/poems/` (`<base>` in `src/page.html`);
its full address is `SITE` in `js/app.js` and `tools/site.mjs`.

## Credits

- Chinese texts follow the versions taught in schools, checked against [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) (MIT).
- English translations and notes are original to this project.
- Earlier translations, all public domain (published before 1930; translators died before 1972, so also free in Canada):
  James Legge, [*The She King*](https://archive.org/details/shekingorbookofa0000unse) (1876);
  Herbert A. Giles, [*Chinese Poetry in English Verse*](https://archive.org/details/cu31924008867222) (1898) and
  [*Gems of Chinese Literature: Verse*](https://archive.org/details/gems-of-chinese-literature);
  L. Cranmer-Byng, [*A Lute of Jade*](https://www.gutenberg.org/ebooks/390) (1909);
  W. J. B. Fletcher, [*Gems of Chinese Verse*](https://archive.org/details/gemsofchinesever00fletiala) (1919).
  A few are lightly adapted; each is marked and shows the printed text too.
- Pinyin: [pinyin-pro](https://github.com/zh-lx/pinyin-pro) (MIT), corrected by hand. Traditional text: [OpenCC](https://github.com/BYVoid/OpenCC).
- Fonts (SIL OFL): [LXGW WenKai Screen](https://github.com/lxgw/LxgwWenKai-Screen), [Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng), Noto Serif SC, Zhi Mang Xing, EB Garamond.
