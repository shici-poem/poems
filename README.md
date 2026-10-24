# 诗词 · Classical Chinese Poems

**Live site:** https://shici-poem.github.io/poems/

A free, open collection of **548 of the best-loved poems in the Chinese language** — from the
*Book of Songs* (c. 1000 BC) through the Tang and Song golden ages to the Qing — each with:

- the original text, set in beautiful Chinese calligraphic fonts (horizontal or traditional vertical layout, simplified or traditional characters)
- an English **verse translation** that keeps the images and allusions of the original and rhymes wherever that can be done without betraying the sense
- a short note on background, allusions and the meanings a translation cannot carry
- a small **ink-wash painting**, drawn in the browser from a few words describing the scene
- themes, so you can browse or search by what a poem is about

Works on phones, tablets and desktops, in light and dark mode.

## Features

| | |
|---|---|
| **Search** | Chinese or English: a poet (`李白`, `Li Bai`), a line or word (`明月`), or a theme (`moon`, `wine`, `homesick`, `frontier`, `sky`, `life`). Words combine: `Du Fu autumn`. |
| **Browse** | By era (Pre-Qin → Modern), theme (45 themes), poet (153 poets with short biographies) or form (quatrain, regulated verse, *ci*, *sanqu*…). |
| **Read** | 竖排 vertical layout; 繁/简 traditional/simplified; 字 font switcher (文楷 Kai, 宋 Song, 毛笔 brush, 行草 cursive); read aloud in Chinese or English (browser speech); ← → keys or swipe for next/previous. |
| **Light** | No framework, no build step to serve. The whole collection is one ~620 KB JSON file (~200 KB gzipped). Paintings are SVG generated on the fly — no image downloads. Fonts load only the glyphs a page uses. |

## How it's built

```
index.html, css/, js/          the site (plain HTML/CSS/JS, hash routing)
js/scene.js                    the ink-wash painter: "night moon river boat" → SVG
src/authors.txt                poets: name | English name | dynasty | dates | bio
src/poems/*.txt                the poems (format below)
tools/build.py                 validates src/ and writes data/poems.json + data/hant.json
tools/fill_text.py             fills long Chinese originals from the chinese-poetry dataset
tools/verify_text.py           compares every Chinese text against the dataset
```

Poem source format:

```
== 静夜思 | Quiet Night Thoughts
by: 李白
form: 五绝
tags: 思乡 月 夜 羁旅
scene: night moon window frost
床前明月光，疑是地上霜。
举头望明月，低头思故乡。
--
Before my bed there gleams a silver light —
…
--
A note on the poem's background and meaning.
```

A blank line inside the Chinese or English text marks a stanza break. The `scene:` words drive the
painting (time of day, season, weather and motifs such as `moon`, `peaks`, `willow`, `boat`,
`pavilion`, `geese`…; see `SCENE_WORDS` in `tools/build.py`).

To rebuild after editing:

```sh
pip install opencc-python-reimplemented   # for the traditional-character file
python tools/build.py                      # validates and writes data/
```

To preview locally: `python -m http.server` and open http://localhost:8000.

## Sources & credits

- Chinese texts follow the versions commonly taught in schools today. Long poems were filled from,
  and all poems checked against, the open [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry)
  dataset (MIT licence); differences were reviewed by hand — many famous poems exist in several textual traditions.
- English translations and notes are original to this project.
- Fonts: [LXGW WenKai Screen](https://github.com/lxgw/LxgwWenKai-Screen) (SIL OFL),
  [Ma Shan Zheng](https://fonts.google.com/specimen/Ma+Shan+Zheng), Noto Serif SC, Zhi Mang Xing, EB Garamond (all SIL OFL).
- Traditional characters converted with [OpenCC](https://github.com/BYVoid/OpenCC).
