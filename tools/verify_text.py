#!/usr/bin/env python3
"""Compare every poem's Chinese text with the chinese-poetry dataset and report differences.

Usage: python -I tools/verify_text.py <dir-with-chinese-poetry-json-files> [--all]

Differences are not automatically errors: many famous poems have several textual
traditions, and this collection follows the versions taught in schools today
(e.g. 静夜思 "床前明月光", where the Complete Tang Poems has "床前看月光").
Each reported difference was reviewed by hand.
"""
import difflib
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build  # noqa: E402
from fill_text import cc, key, walk  # noqa: E402

PUNCT = re.compile(r"[，。？！、；：“”‘’《》·—…（）\s]")


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    show_all = "--all" in sys.argv
    refs = []
    import json
    for f in Path(sys.argv[1]).rglob("*.json"):
        walk(json.loads(f.read_text(encoding="utf-8")), refs)
    by_author = {}
    for a, t, paras in refs:
        text = PUNCT.sub("", re.sub(r"[(（][^)）]*[)）]?", "", cc.convert("".join(paras))))
        by_author.setdefault(a, []).append((t, text))
    print(f"{len(refs)} reference poems, {len(by_author)} authors")

    stats = {"exact": 0, "diff": 0, "noref": 0}
    for path in sorted((build.SRC / "poems").glob("*.txt")):
        for p in build.parse_file(path):
            author = p["meta"]["by"]
            mine = PUNCT.sub("", "".join(p["zh"]))
            cands = by_author.get(key(author), [])
            if not cands:
                stats["noref"] += 1
                if show_all:
                    print(f"NOREF  {author}《{p['title']}》")
                continue
            t = key(p["title"])
            mb = bigrams(mine)
            scored = sorted(cands, key=lambda c: -(len(mb & bigrams(c[1])) / (len(mb | bigrams(c[1])) or 1)
                                                + (0.3 if c[0] == t or t in c[0] or c[0] in t else 0)))
            best = max(scored[:5], key=lambda c: difflib.SequenceMatcher(None, mine, c[1]).ratio())
            sm = difflib.SequenceMatcher(None, mine, best[1])
            if sm.ratio() < 0.5:
                stats["noref"] += 1
                if show_all:
                    print(f"NOREF  {author}《{p['title']}》 (best match {sm.ratio():.2f} 《{best[0]}》)")
                continue
            if mine == best[1]:
                stats["exact"] += 1
                continue
            stats["diff"] += 1
            diffs = []
            for op, i1, i2, j1, j2 in sm.get_opcodes():
                if op != "equal":
                    ctx = mine[max(0, i1 - 3):i1]
                    diffs.append(f"{ctx}[{mine[i1:i2]}→{best[1][j1:j2]}]")
            print(f"DIFF   {author}《{p['title']}》 ratio {sm.ratio():.2f}  vs 《{best[0]}》: " + "  ".join(diffs[:12])
                  + (" …" if len(diffs) > 12 else ""))
    print(stats)


if __name__ == "__main__":
    main()
