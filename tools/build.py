#!/usr/bin/env python3
"""Build data/poems.json from src/ sources, validating everything on the way.

Usage:  python tools/build.py          build + print warnings
        python tools/build.py --list   also print every poem title (handy for dedup)
"""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "data"

DYNASTIES = [
    ("先秦", "Pre-Qin"), ("秦", "Qin"), ("汉", "Han"), ("魏晋", "Wei & Jin"), ("南北朝", "Southern & Northern"),
    ("隋", "Sui"), ("唐", "Tang"), ("五代", "Five Dynasties"), ("宋", "Song"), ("金", "Jin"),
    ("元", "Yuan"), ("明", "Ming"), ("清", "Qing"), ("近代", "Modern"),
]

FORMS = {
    "五言绝句": "Five-character quatrain", "七言绝句": "Seven-character quatrain",
    "五言律诗": "Five-character regulated verse", "七言律诗": "Seven-character regulated verse",
    "五言古诗": "Five-character old-style verse", "七言古诗": "Seven-character old-style verse",
    "五言排律": "Extended regulated verse", "乐府": "Yuefu ballad", "杂言": "Mixed-meter verse",
    "四言诗": "Four-character verse", "六言诗": "Six-character verse", "楚辞": "Songs of Chu", "词": "Ci lyric", "散曲": "Sanqu song",
}
FORM_ALIASES = {"五绝": "五言绝句", "七绝": "七言绝句", "五律": "五言律诗", "七律": "七言律诗",
                "五古": "五言古诗", "七古": "七言古诗", "排律": "五言排律", "曲": "散曲", "四言": "四言诗", "六言": "六言诗"}

# tag: (English label, extra search words)
TAGS = {
    "思乡": ("Homesickness", "home homesick hometown homeland native"),
    "离别": ("Parting", "farewell goodbye separation departure seeing off"),
    "友情": ("Friendship", "friend friends companion"),
    "爱情": ("Love", "romance lover lovers marriage"),
    "相思": ("Longing", "missing yearning lovesick miss pining"),
    "闺怨": ("Lament", "boudoir palace lady wife abandoned lonely woman"),
    "边塞": ("Frontier", "border frontier desert fortress garrison soldier"),
    "战争": ("War", "battle army soldier conflict fighting"),
    "爱国": ("Patriotism", "country nation patriot loyalty homeland"),
    "怀古": ("History", "past ancient ruins history bygone dynasty"),
    "山水": ("Landscape", "scenery nature view"),
    "田园": ("Countryside", "rural farm village pastoral farming"),
    "隐逸": ("Reclusion", "hermit recluse retreat solitude seclusion"),
    "人生": ("Life", "life reflection fate destiny living"),
    "哲理": ("Wisdom", "philosophy wisdom insight truth"),
    "壮志": ("Ambition", "aspiration ambition heroism hero heroic"),
    "失意": ("Frustration", "disappointment failure unrecognized exile setback"),
    "民生": ("The People", "poverty peasants suffering society people hardship"),
    "饮酒": ("Wine", "wine drink drinking alcohol toast drunk"),
    "闲适": ("Leisure", "leisure idle relaxation peaceful quiet calm"),
    "月": ("Moon", "moon moonlight lunar"),
    "春": ("Spring", "spring springtime"),
    "夏": ("Summer", "summer"),
    "秋": ("Autumn", "autumn fall"),
    "冬": ("Winter", "winter cold"),
    "雪": ("Snow", "snow snowy"),
    "雨": ("Rain", "rain rainy shower"),
    "风": ("Wind", "wind breeze"),
    "花": ("Flowers", "flower flowers blossom blossoms"),
    "柳": ("Willow", "willow willows"),
    "江河": ("Rivers", "river rivers stream water yangtze yellow"),
    "山": ("Mountains", "mountain mountains peak hill hills"),
    "海": ("Sea", "sea ocean"),
    "天空": ("Sky", "sky heaven heavens clouds stars sun"),
    "夜": ("Night", "night evening dark"),
    "鸟": ("Birds", "bird birds geese goose crane swallow crow oriole"),
    "节日": ("Festivals", "festival holiday new year qingming mid-autumn double ninth"),
    "咏物": ("Objects", "object thing ode"),
    "时光": ("Time", "time transience aging old age youth fleeting years"),
    "禅": ("Zen", "buddhism buddhist temple monk zen meditation"),
    "羁旅": ("Travel", "journey traveler travel wandering road exile"),
    "悼亡": ("Mourning", "death grief loss mourning elegy"),
    "音乐": ("Music", "music song pipa lute flute qin zither"),
    "童趣": ("Childhood", "child children innocence kids"),
    "女性": ("Women", "woman women heroine girl"),
}

SCENE_WORDS = set("""
dawn day dusk night spring summer autumn winter rain snow mist wind frost
moon crescent sun stars clouds mountains peaks hills river lake sea waterfall
boat sail fisher person two rider horse
pine willow plum peach bamboo maple lotus chrysanthemum reeds grass flowers petals leaves
geese crane crows swallows birds butterfly oriole
tower pavilion temple cottage bridge wall fort desert smoke flag palace fields
cup jar lantern candle window
""".split())

ZH_OK = re.compile(r"^[㐀-鿿豈-﫿\U00020000-\U0002ffff，。？！、；：“”‘’《》·—…（）]+$")


def die(msg):
    print("ERROR:", msg)
    sys.exit(1)


def load_authors():
    authors = {}
    for n, line in enumerate((SRC / "authors.txt").read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) != 5:
            die(f"authors.txt:{n}: expected 5 fields, got {len(parts)}")
        zh, en, dyn, years, bio = parts
        if dyn not in dict(DYNASTIES):
            die(f"authors.txt:{n}: unknown dynasty {dyn}")
        if zh in authors:
            die(f"authors.txt:{n}: duplicate author {zh}")
        m = re.match(r"\D*(\d+)", years)
        born = int(m.group(1)) if m else 9999
        if "BC" in years:
            born = -born
        authors[zh] = {"en": en, "d": dyn, "y": years, "b": bio, "_born": born}
    return authors


def parse_file(path):
    """Yield poem dicts from one source file."""
    text = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    blocks = re.split(r"^== ", text, flags=re.M)
    for block in blocks[1:]:
        lines = block.split("\n")
        head = lines[0].strip()
        if "|" not in head:
            die(f"{path.name}: title line needs 'zh | en': {head}")
        title, title_en = [s.strip() for s in head.split("|", 1)]
        meta = {}
        i = 1
        while i < len(lines) and re.match(r"^(by|form|tags|scene):", lines[i]):
            k, v = lines[i].split(":", 1)
            meta[k] = v.strip()
            i += 1
        rest = "\n".join(lines[i:])
        parts = re.split(r"^--\s*$", rest, flags=re.M)
        if len(parts) != 3:
            die(f"{path.name}: {title}: expected zh -- en -- note (got {len(parts)} parts)")
        zh, en, note = parts
        yield {
            "title": title, "title_en": title_en, "meta": meta, "file": path.name,
            "zh": zh.strip("\n").split("\n"), "en": en.strip("\n").split("\n"),
            "note": " ".join(note.split()),
        }


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    show_list = "--list" in sys.argv
    authors = load_authors()
    poems, warnings, seen = [], [], {}
    used_authors = set()
    for path in sorted((SRC / "poems").glob("*.txt")):
        for p in parse_file(path):
            where = f"{p['file']}: {p['title']}"
            m = p["meta"]
            for k in ("by", "form", "tags", "scene"):
                if k not in m:
                    die(f"{where}: missing '{k}:'")
            a = m["by"]
            if a not in authors:
                die(f"{where}: unknown author {a} (add to src/authors.txt)")
            form = FORM_ALIASES.get(m["form"], m["form"])
            if form not in FORMS:
                die(f"{where}: unknown form {m['form']}")
            tags = m["tags"].split()
            for t in tags:
                if t not in TAGS:
                    die(f"{where}: unknown tag {t}")
            scene = m["scene"].replace(":", " ").split()
            for s in scene:
                if s not in SCENE_WORDS:
                    die(f"{where}: unknown scene word {s}")
            key = a + "|" + p["title"]
            if key in seen:
                die(f"{where}: duplicate of {seen[key]}")
            seen[key] = where
            zh = [l.strip() for l in p["zh"]]
            if any(l.startswith("@ref") for l in zh):
                die(f"{where}: Chinese text not filled in yet — run tools/fill_text.py")
            for l in zh:
                if l and not ZH_OK.match(l):
                    bad = "".join(sorted(set(c for c in l if not ZH_OK.match(c))))
                    warnings.append(f"{where}: odd characters {bad!r} in: {l}")
                if l and l[-1] not in "。？！；…”，、：":
                    warnings.append(f"{where}: line does not end with full stop: {l}")
            en = [l.rstrip() for l in p["en"]]
            if not p["note"]:
                warnings.append(f"{where}: empty note")
            if not p["title_en"]:
                die(f"{where}: missing English title")
            # collapse multiple blank lines to one stanza break
            zh = re.sub(r"\n{3,}", "\n\n", "\n".join(zh)).split("\n")
            en = re.sub(r"\n{3,}", "\n\n", "\n".join(en)).split("\n")
            pid = hashlib.md5(key.encode("utf-8")).hexdigest()[:6]
            used_authors.add(a)
            poems.append({
                "id": pid, "t": p["title"], "te": p["title_en"], "a": a, "f": form,
                "g": tags, "s": " ".join(scene), "z": zh, "e": en, "n": p["note"],
            })

    ids = [p["id"] for p in poems]
    if len(set(ids)) != len(ids):
        die("id collision — tweak a title")

    order = {d: i for i, (d, _) in enumerate(DYNASTIES)}
    file_rank = {p["id"]: i for i, p in enumerate(poems)}
    poems.sort(key=lambda p: (order[authors[p["a"]]["d"]], authors[p["a"]]["_born"], p["a"], file_rank[p["id"]]))

    out_authors = {k: {kk: vv for kk, vv in v.items() if not kk.startswith("_")}
                   for k, v in authors.items() if k in used_authors}
    data = {
        "dynasties": DYNASTIES,
        "forms": FORMS,
        "tags": [[k, v[0], v[1]] for k, v in TAGS.items()],
        "authors": out_authors,
        "poems": poems,
    }
    OUT.mkdir(exist_ok=True)
    js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (OUT / "poems.json").write_text(js, encoding="utf-8")

    hant(poems, out_authors)

    for w in warnings:
        print("WARN:", w)
    by_author = {}
    for p in poems:
        by_author[p["a"]] = by_author.get(p["a"], 0) + 1
    tag_count = {t: 0 for t in TAGS}
    for p in poems:
        for t in p["g"]:
            tag_count[t] += 1
    if show_list:
        for p in poems:
            print(f"  {p['a']} 《{p['t']}》 {p['id']}")
    print("authors:", " ".join(f"{a}{n}" for a, n in sorted(by_author.items(), key=lambda x: -x[1])))
    print("tags:", " ".join(f"{t}{n}" for t, n in sorted(tag_count.items(), key=lambda x: -x[1])))
    print(f"{len(poems)} poems, {len(out_authors)} authors, poems.json = {len(js.encode('utf-8')) // 1024} KB")


def hant(poems, authors):
    """Traditional-Chinese text, loaded lazily by the site only when the 繁 toggle is used."""
    try:
        import opencc  # pip install opencc-python-reimplemented
    except ImportError:
        print("NOTE: opencc not installed — skipping data/hant.json")
        return
    cc = opencc.OpenCC("s2tw")
    out = {"p": {}, "a": {}}
    for p in poems:
        out["p"][p["id"]] = [cc.convert(p["t"])] + [cc.convert(l) for l in p["z"]]
    for a in authors:
        out["a"][a] = cc.convert(a)
    (OUT / "hant.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


if __name__ == "__main__":
    main()
