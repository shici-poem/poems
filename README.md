# 诗词 · Classical Chinese Poems

**Live site:** https://shici-poem.github.io/poems/

The 378 best-loved poems in the Chinese language, from the *Book of Songs* to the Qing. Each poem has:

- the original text (simplified or traditional, horizontal or vertical) with optional **pinyin**
- an English **verse translation** that keeps the images and rhymes where it can, plus a short note
- where one exists, a classic **earlier translation** (public domain, credited and linked)
- an **ink-wash painting** drawn in the browser
- read-aloud in Chinese or English

Every list puts the best-known poems and poets first. Poems you have opened are marked *read* (kept only in your browser).
Works on phones, tablets and desktops, light and dark. No framework, no server: plain HTML/CSS/JS on GitHub Pages.

## Layout

```
index.html, css/, js/app.js    the site (hash routing, search, views)
js/scene.js                    ink-wash painter: "night moon river boat" → SVG
src/poems/*.txt                the poems (format below)
src/authors.txt                poets: name | English name | dynasty | dates | bio
src/ranking.txt                every poem, most famous first; sets the order of every list
src/classic/*.txt              earlier translations (format at load_classic in tools/build.py)
src/pinyin.txt                 hand-checked pinyin corrections for classical readings
tools/build.py                 validates src/ → data/poems.json, hant.json, classic.json
tools/pinyin.mjs               pinyin-pro + src/pinyin.txt → data/pinyin.json, speech.json
tools/fill_text.py             fills long Chinese texts from the chinese-poetry dataset
tools/verify_text.py           checks every Chinese text against that dataset
```

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
(cd tools && npm install)                   # once: pinyin-pro
python tools/build.py                       # validate + write data/   (--check: validate only)
node tools/pinyin.mjs                       # pinyin + read-aloud fixes (--review: list readings to check)
python -m http.server                       # preview at http://localhost:8000
```

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
