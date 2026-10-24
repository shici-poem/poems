#!/usr/bin/env python3
"""Fill in Chinese original text from the chinese-poetry dataset.

In a source file, a poem whose Chinese section is just

    @ref                 (look up by this poem's author + title)
    @ref 长恨歌          (look up by a different title)

gets that line replaced by the text found in the reference JSON files.

Usage: python -I tools/fill_text.py <dir-with-chinese-poetry-json-files>
"""
import json
import re
import sys
from pathlib import Path

import opencc

ROOT = Path(__file__).resolve().parent.parent
cc = opencc.OpenCC("t2s")
PUNCT = re.compile(r"[，。？！、；：“”‘’《》·—…（）\s]")
POEM = re.compile(r"^== (?P<title>[^|\n]+)\|.*\nby: (?P<author>.+)\n(?:[a-z]+: .*\n)*(?P<ref>@ref(?: (?P<alt>.+))?)$", re.M)


def key(s):
    s = cc.convert(s)
    s = re.sub(r"（.*?）|\(.*?\)", "", s)
    return PUNCT.sub("", s)


def walk(node, out):
    if isinstance(node, dict):
        title = node.get("title") or node.get("chapter") or node.get("rhythmic")
        if "paragraphs" in node and title and node.get("author"):
            out.append((key(node["author"]), key(title), node["paragraphs"]))
        for v in node.values():
            walk(v, out)
    elif isinstance(node, list):
        for v in node:
            walk(v, out)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    refs = []
    for f in Path(sys.argv[1]).rglob("*.json"):
        walk(json.loads(f.read_text(encoding="utf-8")), refs)
    print(f"{len(refs)} reference poems loaded")

    for path in sorted((ROOT / "src" / "poems").glob("*.txt")):
        text = path.read_text(encoding="utf-8")

        def fill(m):
            title = (m.group("alt") or m.group("title")).strip()
            author = m.group("author").strip()
            a, t = key(author), key(title)
            hits = [r for r in refs if r[0] == a and r[1] == t] or \
                   [r for r in refs if r[0] == a and (t in r[1] or r[1] in t)]
            if not hits:
                print(f"  NOT FOUND: {path.name}: {author} {title}")
                return m.group(0)
            paras = [re.sub(r"[(（][^)）]*[)）]?", "", cc.convert(l)) for l in hits[0][2]]  # drop editorial notes
            lines = [seg for l in paras for seg in re.findall(r"[^。？！；]+[。？！；]+”?", l) or [l]]
            print(f"  filled: {path.name}: {author} {title} ({len(lines)} lines)")
            return m.group(0)[: m.start("ref") - m.start()] + "\n".join(lines)

        new = POEM.sub(fill, text)
        if new != text:
            path.write_text(new, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
