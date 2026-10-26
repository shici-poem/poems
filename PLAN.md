# 诗词 · Plan

How the site is built: [README.md](README.md). This file lists each feature with its status, then the decisions behind them.

✅ done · 🚧 in progress · ⬜ planned · 💭 idea

## Features

| Status | Feature | What |
|:-:|---|---|
| ✅ | Poems | The best-known 378 (trimmed from 548), ranked by fame in `src/ranking.txt`; every text checked against two corpora (chinese-poetry, Werneror/Poetry) or Wikisource, each difference reviewed. |
| ✅ | Browse & search | Era / theme / poet / form filters, most famous first everywhere (search: relevance band, then fame). Era and Theme wrap and fold separately; themes show the top 14 + "N more". |
| ✅ | Reading | Simplified / traditional, horizontal / vertical, fonts, dark mode; one language per line on phones. |
| ✅ | Pinyin | pinyin-pro + ~290 hand corrections, full tones, title pinyin. |
| ✅ | Read-aloud | Says what the pinyin shows: same-sounding characters where a voice would misread (一骑 → 一寂); device's best voice. |
| ✅ | Translations | An original verse translation and note for every poem. |
| ✅ | Earlier translations | 116 for 93 poems (Legge, Giles, Cranmer-Byng, Fletcher), credited and linked, exactly as printed. |
| ✅ | Paintings | Ink-wash painter: 3 compositions (平远 / 深远 / 高远), 3 colour manners (ink, ochre, blue-green), figures, inscribed title and poet, ink and paper texture. |
| ✅ | Poets | Chinese and English Wikipedia links for 121 of 126 poets (`src/wiki.txt`). |
| ✅ | Poem of the day | Seeded shuffle of the top 200: same all day, no repeats within 200 days. |
| ✅ | Reading history | 已读 marks, Read / Unread-only filters, per-poet counts, Random prefers unread (localStorage). |
| ✅ | Addresses & SEO | Real addresses (`p/jing-ye-si/`, `poet/li-bai/` …); 1130 prerendered pages incl. `hant/`, each with title, description, canonical, 简/繁 hreflang, JSON-LD; `sitemap.xml`; share picture. |
| ✅ | Robustness | Old `#/` links redirect; bad stored values drop settings, then history, before an error shows; content-hashed files. |
| ✅ | Deploy | GitHub Actions builds `src/` and publishes the site on every push to main. |
| ✅ | Search engines | `sitemap.xml` submitted to Google Search Console (verified via `google8a3c681ac87878d8.html`; keep that file). |
| ✅ | Chinese notes | A 赏析 for every poem above the English note (fourth `--` part of a poem), simplified and traditional. |

## Decisions

- **Earlier translations:** public domain in Canada and the US (published before 1930, translator died before 1972). Rules out Bynner, Waley, Waddell, Pound, Xu Yuanchong. Shown exactly as printed, never corrected: our own translation and note carry the meaning.
- **Pinyin:** today's school textbooks and the 审音表 (斜 xié, not the rhyme reading xiá).
- **Read-aloud voice:** one voice, the device's best; most devices have no male Chinese voice.
- **Wikipedia:** only articles certainly about this poet (via Wikipedia's language links, first sentence checked); no namesakes or disambiguation pages.
- **No server:** pinyin, speech fixes, traditional text, Chinese notes and earlier translations load only when needed.
- **Chinese notes:** written for Chinese readers from researched, sourced facts, not translated from the English; disputed points say 一说.
- **Prerendering:** runs the real app in headless Chrome, so static and live pages can't drift; traditional pages get their own addresses so they can be found.
- **Ids, not addresses:** poem ids key reading history and paintings, so page addresses can change.
- **Built files not committed:** history holds only sources; the build is reproducible (pinned pinyin-pro, OpenCC, Node).
- **Long Chinese texts:** filled from the dataset (`@ref` + `tools/fill_text.py`), never typed out.
- **Text check:** two independent corpora, because each has its own typos (chinese-poetry has 木瓜 琼九); a reading found in neither is checked against the current textbook.
