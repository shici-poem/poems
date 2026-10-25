# Working on this repo

Read [README.md](README.md) (layout, formats, build) and [PLAN.md](PLAN.md) (what is done, decisions) first.

- Keep README.md and PLAN.md current, accurate and concise. README.md describes the final result; PLAN.md gives each
  feature a status (done / in progress / planned / idea) and each decision one line, never a progress log.
- Work on a feature branch; merge it into main only once the change is reviewed and approved.
- Built files (`data/`, the prerendered pages, `sitemap.xml`) are not committed. Pushing to main builds and deploys the
  site (`.github/workflows/deploy.yml`); build locally only to preview and verify, then delete the output.
  Before rebuilding after a change to `tools/`, keep a copy of the old output to compare against.
- This repo is public: commit as the `shici-poem` organization and never write personal account names, emails or
  local user paths into any file.
- Earlier translations must be public domain in Canada and the US (published before 1930, translator died before 1972),
  credited and linked.
- Chinese texts follow the school versions; check them with `tools/verify_text.py`. Fill long texts from the dataset
  with `@ref` and `tools/fill_text.py` rather than typing them out.
- Pinyin follows current textbooks and the 审音表; corrections go in `src/pinyin.txt`. Read-aloud must say what the
  pinyin shows (`tools/pinyin.mjs` swaps in same-sounding characters for the voice).
- Bilingual labels never wrap mid-language on phones: each language on its own line; check at 320 and 375 px wide.
- External links (Wikipedia, sources) only when certainly about that subject.
- Poem ids are the key for reading history and paintings; page addresses may change. Keep `google8a3c681ac87878d8.html`.
