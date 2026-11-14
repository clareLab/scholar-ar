import json
import re
import sys
import tempfile
import unicodedata
import urllib.request
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

static = "https://raw.githubusercontent.com/notofonts/notofonts.github.io/3460ae9d93e7ac7a90d38a247d5d4d0f6147d239/fonts"
cjk = "https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans"
families = [
    "Noto Sans",
    "Noto Sans CJK SC",
    "Noto Sans Arabic",
    "Noto Sans Thai",
    "Noto Sans Armenian",
    "Noto Sans Devanagari",
    "Noto Sans Hebrew",
    "Noto Sans Georgian",
    "Noto Sans Sinhala",
]
variable = {"Noto Sans CJK SC": ("NotoSansCJKsc", f"{cjk}/Variable/TTF/NotoSansCJKsc-VF.ttf")}
weights = {400: "Regular", 500: "Medium", 600: "SemiBold"}
dropped = {"locl", "valt", "vert", "vkrn", "vpal", "vrt2", "chws", "vchw", "halt", "vhal", "rand", "jalt"}

release = Path(sys.argv[1])
fonts = Path(__file__).resolve().parent / "public" / "fonts"


def ignorable(code):
    return code in (0x200C, 0x200D, 0x34F) or 0xFE00 <= code <= 0xFE0F or 0xE0100 <= code <= 0xE01EF


def clean(name):
    name = re.sub("&amp;?", "&", name)
    return "".join(c for c in name if unicodedata.category(c) != "Cf" or c in "\u200c\u200d")


def clusters(text):
    out = []
    for c in text:
        if out and (unicodedata.category(c).startswith("M") or c in "\u200c\u200d"):
            out[-1] += c
        else:
            out.append(c)
    return out


def fetch(url, path):
    with urllib.request.urlopen(url) as response:
        path.write_bytes(response.read())
    return path


def stem(family):
    return variable[family][0] if family in variable else family.replace(" ", "")


def ranges(codes):
    out = []
    for code in sorted(codes):
        if out and out[-1][1] == code - 1:
            out[-1][1] = code
        else:
            out.append([code, code])
    return out


def options():
    out = subset.Options()
    out.layout_features = [f for f in out.layout_features if f not in dropped]
    out.drop_tables += ["vhea", "vmtx", "VORG", "BASE", "STAT", "meta"]
    out.name_IDs = ["*"]
    out.hinting = False
    return out


def cut(source, codes):
    font = TTFont(source)
    sub = subset.Subsetter(options())
    sub.populate(unicodes=codes)
    sub.subset(font)
    return font


def name(font, family, weight):
    style = weights[weight]
    full = family if weight == 400 else f"{family} {style}"
    table = font["name"]
    for nid, value in [
        (1, full),
        (2, "Regular"),
        (3, f"{stem(family)}-{style}"),
        (4, full if weight != 400 else f"{family} Regular"),
        (6, f"{stem(family)}-{style}"),
        (16, family),
        (17, style),
    ]:
        table.setName(value, nid, 3, 1, 0x409)
    font["OS/2"].usWeightClass = weight


names = []
for file in ("institutions.json", "venues.json"):
    names += json.loads((release / file).read_text())["name"]
tree = json.loads((release / "tree.json").read_text())
names += [row[1] for rows in tree.values() for row in rows]

plex = None
for path in fonts.glob("IBMPlex*.otf"):
    codes = set(TTFont(path, lazy=True).getBestCmap())
    plex = codes if plex is None else plex & codes

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    sources = {}
    for family in families:
        if family in variable:
            sources[family] = {0: fetch(variable[family][1], tmp / f"{stem(family)}.ttf")}
        else:
            sources[family] = {
                w: fetch(f"{static}/{stem(family)}/unhinted/ttf/{stem(family)}-{s}.ttf", tmp / f"{stem(family)}-{s}.ttf")
                for w, s in weights.items()
            }
    cmaps = {f: set(TTFont(next(iter(sources[f].values())), lazy=True).getBestCmap()) for f in families}
    need = {f: set() for f in families}
    uncovered = set()
    for text in names:
        for cluster in clusters(clean(text)):
            codes = [ord(c) for c in cluster if not ignorable(ord(c))]
            if all(c in plex for c in codes):
                continue
            for family in families:
                if all(c in cmaps[family] for c in codes):
                    need[family] |= {ord(c) for c in cluster if ord(c) in cmaps[family]}
                    break
            else:
                uncovered.add(cluster)
    manifest = []
    made = set()
    for family in families:
        if not need[family]:
            continue
        files = {}
        for weight, style in weights.items():
            target = fonts / f"{stem(family)}-{style}.ttf"
            if family in variable:
                font = instancer.instantiateVariableFont(cut(sources[family][0], need[family]), {"wght": weight})
                name(font, family, weight)
            else:
                font = cut(sources[family][weight], need[family])
            font.save(target)
            files[str(weight)] = target.name
            made.add(target.name)
        codes = set(TTFont(fonts / files["400"]).getBestCmap())
        manifest.append({"name": family, "files": files, "codes": ranges(codes)})
    for path in fonts.glob("Noto*.ttf"):
        if path.name not in made:
            path.unlink()
    shipped = {m["name"] for m in manifest}
    licences = {
        "OFL-Noto.txt": (f"{static}/LICENSE", any(f not in variable for f in shipped)),
        "OFL-NotoSansCJK.txt": (f"{cjk}/LICENSE", any(f in variable for f in shipped)),
    }
    for file, (url, wanted) in licences.items():
        if wanted:
            fetch(url, fonts / file)
        elif (fonts / file).exists():
            (fonts / file).unlink()
    (fonts / "noto.json").write_text(json.dumps(manifest, separators=(",", ":")) + "\n")
    for cluster in sorted(uncovered):
        print("uncovered", " ".join(f"U+{ord(c):04X}" for c in cluster), file=sys.stderr)
