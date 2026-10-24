#!/usr/bin/env python3
"""Fill in Chinese original text from the chinese-poetry dataset.

In a source file, a poem whose Chinese section is just

    @ref                 (look up by this poem's author + title)
    @ref 长恨歌          (look up by a different title)
    @ref 水龙吟 / 似花还似   (title + opening words, when a tune has many poems)

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
        paras = node.get("paragraphs") or node.get("para")
        if paras and title and node.get("author"):
            out.append((key(node["author"]), key(title), paras))
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
            alt, _, first = (m.group("alt") or "").partition("/")
            title = (alt or m.group("title")).strip()
            author = m.group("author").strip()
            a, t, first = key(author), key(title), key(first)
            hits = [r for r in refs if r[0] == a and r[1] == t] or \
                   [r for r in refs if r[0] == a and (t in r[1] or r[1] in t)]
            if first:  # several poems share a tune/title: pick by opening words
                hits = [r for r in hits if key("".join(r[2])).startswith(first)]
            if not hits:
                print(f"  NOT FOUND: {path.name}: {author} {title}")
                return m.group(0)
            paras = [re.sub(r"[(（][^)）]*[)）]?", "", cc.convert(l)) for l in hits[0][2]]  # drop editorial notes
            split = [re.findall(r"[^。？！；]+[。？！；]+”?", l) or [l] for l in paras]
            if a == "诗经":  # Book of Songs paragraphs are stanzas: keep a blank line between them
                lines = [seg for i, st in enumerate(split) for seg in ([""] if i else []) + st]
            else:
                lines = [seg for st in split for seg in st]
            print(f"  filled: {path.name}: {author} {title} ({len(lines)} lines)")
            return m.group(0)[: m.start("ref") - m.start()] + "\n".join(lines)

        new = POEM.sub(fill, text)
        if new != text:
            path.write_text(new, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
