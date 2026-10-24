# 诗词 · Plan & status

Architecture, formats and build steps are in [README.md](README.md). This file tracks what is done and why.

## Done
- Site: search, browse by era / theme / poet / form, poem pages, traditional toggle, fonts, dark mode, vertical layout.
- 548 poems written and checked against chinese-poetry; then trimmed to the best-known **378**, ranked in `src/ranking.txt`.
- Popularity order everywhere: home, filters, search (relevance band first, then fame), poets, poem of the day (top 200).
- Era and Theme filters wrap onto several lines; each folds on its own (keeping the current pick visible); themes show the top 14 with "+N more".
- Ink-wash painter: three compositions (平远 / 深远 / 高远), three colour manners (ink, ochre, Tang blue-green),
  figures (lady, child, elder, ox with herd-boy, kite), title and poet inscribed (no seal), ink and paper texture on the large painting.
- Pinyin (pinyin-pro + 290 hand corrections, textbook readings, full tones). Read-aloud swaps in same-sounding
  characters where a reading is unusual (一骑 → 一寂); it uses the device's best voice (no male/female choice: most devices have no male Chinese voice).
- 116 earlier public-domain translations for 93 poems (Legge, Giles, Cranmer-Byng, Fletcher), each credited and linked;
  23 lightly adapted, each marked with the printed text alongside.
- Reading history in localStorage: 已读 marks, "Read" (newest first) and "Unread only" filters, per-poet counts, Random prefers unread.

## Decisions
- Earlier translations must be public domain in Canada and the US: published before 1930 and translator died before 1972
  (Canada's life + 70 term from 2022 did not revive expired works). That rules out Bynner, Waley, Waddell, Pound, Xu Yuanchong.
- Pinyin follows today's school textbooks and the 审音表 (斜 xié, not the rhyme reading xiá).
- No server: pinyin, speech fixes, traditional text and earlier translations load only when needed.

## Ideas
- *More Gems of Chinese Poetry* (Fletcher, 1919): no accessible scan found yet.
- A tall hanging-scroll format for the poem-page painting.

## Notes
- Long Chinese texts: write `@ref` and run `python -I tools/fill_text.py <chinese-poetry json dir>`; typing very long
  famous texts verbatim can trip the model's output filter.
