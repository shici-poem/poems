# 诗词 · Plan & status

Architecture, formats and build steps are in [README.md](README.md). This file tracks what is done and why.

## Done
- Site: search, browse by era / theme / poet / form, poem pages, traditional toggle, fonts, dark mode, vertical layout.
- 548 poems written and checked against chinese-poetry; then trimmed to the best-known **378**, ranked in `src/ranking.txt`.
- Popularity order everywhere: home, filters, search (relevance band first, then fame), poets, poem of the day (top 200).
- Era and Theme filters wrap onto several lines; each folds on its own (keeping the current pick visible); themes show the top 14 with "+N more".
- Ink-wash painter: three compositions (平远 / 深远 / 高远), three colour manners (ink, ochre, Tang blue-green),
  figures (lady, child, elder, ox with herd-boy, kite), title and poet inscribed (no seal), ink and paper texture on the large painting.
- Pinyin (pinyin-pro + 290 hand corrections, textbook readings, full tones). Read-aloud follows the shown pinyin: wherever
  a voice might read a character its own way, it gets a same-sounding one instead (一骑 → 一寂, 愁字了得 → 愁字蓼得); it uses the device's best voice (no male/female choice: most devices have no male Chinese voice).
- 116 earlier public-domain translations for 93 poems (Legge, Giles, Cranmer-Byng, Fletcher), each credited and linked;
  23 lightly adapted, each marked with the printed text alongside.
- Poet pages link to Chinese and English Wikipedia (`src/wiki.txt`, 121 of 126 poets).
- Poem of the day: the same all day, a seeded shuffle of the top 200 (no repeats within 200 days).
- One language per line on phones where Chinese and English sit together (footer motto, pager, poet banner).
- Search: every page has a real address (`p/jing-ye-si/`, `poet/li-bai/`, `theme/moon/`, `era/tang/`) and is prerendered
  (`tools/site.mjs`) with its own title, description, canonical, 简/繁 hreflang pair and JSON-LD; 1130 pages incl.
  the `hant/` traditional copies, `sitemap.xml`, a share picture. Poem pages show the title's pinyin and an "English translation" label.
- Old visitors are safe: `#/` links redirect, reading history (by poem id) is kept, odd stored values or addresses
  can't break a page (it drops saved settings, then history, before showing an error), every file carries its own content hash.
- Deployed by GitHub Actions: each push to main builds the site from `src/` and publishes the site alone.
- Reading history in localStorage: 已读 marks, "Read" (newest first) and "Unread only" filters, per-poet counts, Random prefers unread.

## Decisions
- Earlier translations must be public domain in Canada and the US: published before 1930 and translator died before 1972
  (Canada's life + 70 term from 2022 did not revive expired works). That rules out Bynner, Waley, Waddell, Pound, Xu Yuanchong.
- Pinyin follows today's school textbooks and the 审音表 (斜 xié, not the rhyme reading xiá).
- Wikipedia links only where the article is certainly this poet: each was resolved through Wikipedia's own
  language links or redirects and its first sentence checked; namesakes and disambiguation pages are left out.
- No server: pinyin, speech fixes, traditional text and earlier translations load only when needed.
- Prerendering runs the real app in headless Chrome rather than a second template, so the static page and the
  live page can't drift apart. Traditional pages are separate addresses (not a hidden toggle) so they can be found.
- Page addresses use the title's pinyin; ids stay the key for reading history and paintings, so addresses can change safely.
- Built files are not committed: a change to one source file is a one-file commit, and the history holds only sources.
  The build is reproducible (pinned pinyin-pro, OpenCC and Node), so what GitHub publishes matches a local build.

## Ideas
- Submit `sitemap.xml` in Google Search Console (verified through `google8a3c681ac87878d8.html`; keep that file) and Bing Webmaster Tools.
- A custom domain would allow a root `robots.txt` and a shorter brand; per-poem share pictures.
- *More Gems of Chinese Poetry* (Fletcher, 1919): no accessible scan found yet.
- A tall hanging-scroll format for the poem-page painting.

## Notes
- Long Chinese texts: write `@ref` and run `python -I tools/fill_text.py <chinese-poetry json dir>`; typing very long
  famous texts verbatim can trip the model's output filter.
