#!/usr/bin/env python3
"""Compare every poem's Chinese text with reference corpora and report differences.

Usage: python -I tools/verify_text.py <corpus-dir> [<corpus-dir> …] [--all]

A corpus is a folder of chinese-poetry JSON files or of Werneror/Poetry CSV files. Use both:
they were collected separately, so a typo in one (chinese-poetry has 木瓜 "报之以琼九")
shows up as a difference from the other.

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
from fill_text import cc, key, load  # noqa: E402

PUNCT = re.compile(r"[，。？！、；：“”‘’《》·—…（）\s]")


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)}


def index(folder):
    by_author, by_title = {}, {}
    for a, t, paras in load(folder):
        text = PUNCT.sub("", re.sub(r"[(（][^)）]*[)）]?", "", cc.convert("".join(paras))))
        by_author.setdefault(a, []).append((t, text))
        by_title.setdefault(t, []).append((t, text))
    return by_author, by_title


def best_match(mine, title, cands):
    """The candidate closest to `mine` (an excerpt is compared with the matching part of the poem)."""
    if not cands:
        return None, None
    mb = bigrams(mine)
    scored = sorted(cands, key=lambda c: -(len(mb & bigrams(c[1])) / (len(mb | bigrams(c[1])) or 1)
                                        + (0.3 if c[0] == title or title in c[0] or c[0] in title else 0)))
    best = None
    for t, ref in scored[:5]:
        sm = difflib.SequenceMatcher(None, mine, ref, autojunk=False)
        blocks = [b for b in sm.get_matching_blocks() if b.size >= 3]
        if len(ref) > len(mine) * 1.2 and blocks:  # excerpt: keep the stretch of the poem it covers
            ref = ref[max(0, blocks[0].b - blocks[0].a):blocks[-1].b + blocks[-1].size + len(mine) - blocks[-1].a - blocks[-1].size]
            sm = difflib.SequenceMatcher(None, mine, ref, autojunk=False)
        if best is None or sm.ratio() > best[1].ratio():
            best = (t, sm)
    return best


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    show_all = "--all" in sys.argv
    corpora = []
    for folder in [a for a in sys.argv[1:] if not a.startswith("--")]:
        corpora.append((Path(folder).name, *index(folder)))
        print(f"{corpora[-1][0]}: {sum(map(len, corpora[-1][1].values()))} reference poems, {len(corpora[-1][1])} authors")

    stats = {"exact": 0, "diff": 0, "noref": 0}
    for path in sorted((build.SRC / "poems").glob("*.txt")):
        for p in build.parse_file(path):
            author, title = p["meta"]["by"], p["title"]
            mine = PUNCT.sub("", "".join(p["zh"]))
            t = key(title)
            lines = []
            for name, by_author, by_title in corpora:
                ref, sm = best_match(mine, t, by_author.get(key(author), []))
                if sm is None or sm.ratio() < 0.5:  # anonymous or differently labelled: try the title alone
                    ref, sm = best_match(mine, t, by_title.get(t, [])) if t in by_title else (ref, sm)
                if sm is None or sm.ratio() < 0.5:
                    lines.append(f"  {name}: no match" + (f" (best {sm.ratio():.2f} 《{ref}》)" if sm else ""))
                    continue
                if sm.ratio() == 1:
                    lines.append(None)
                    continue
                diffs = [f"{mine[max(0, i1 - 3):i1]}[{mine[i1:i2]}→{sm.b[j1:j2]}]"
                         for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
                lines.append(f"  {name}: {sm.ratio():.2f} 《{ref}》 " + "  ".join(diffs[:12]) + (" …" if len(diffs) > 12 else ""))
            if None in lines:
                stats["exact"] += 1
            elif all(l.endswith("no match") or "no match (" in l for l in lines):
                stats["noref"] += 1
            else:
                stats["diff"] += 1
            if show_all or None not in lines:
                shown = [l for l in lines if l]
                if shown:
                    print(f"{author}《{title}》" + ("  (exact in one corpus)" if None in lines else ""))
                    print("\n".join(shown))
    print(stats)


if __name__ == "__main__":
    main()
