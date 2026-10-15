#!/usr/bin/env python3
"""~/.codex/pets/<id>/spritesheet.webp から assets/<id>.json を生成する。"""
import base64, io, json, os
from PIL import Image

PETS = {"barista": "Barista"}  # 配布物に含めるのは barista のみ
CW, CH = 192, 208
OW, OH = 72, 78
ROWS = {"idle": (0, 6), "wave": (3, 4), "run": (7, 6), "done": (8, 6)}
DUR = {"idle": [280, 110, 110, 140, 140, 320], "wave": [140] * 4, "run": [120] * 6, "done": [150] * 6}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.expanduser("~/.codex/pets")

def enc(cell):
    im = cell.resize((OW, OH), Image.LANCZOS).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 0 if a < 40 else 255)
    q = im.convert("RGB").quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE)
    # アルファを透過インデックスに反映
    pal = q.getpalette()[:96]
    used = set(q.getdata())
    idx = next((i for i in range(256) if i not in used), None)
    if idx is None:
        idx = 0
    data = [idx if alpha.getpixel((x, y)) == 0 else q.getpixel((x, y)) for y in range(OH) for x in range(OW)]
    out = Image.new("P", (OW, OH))
    pal += [0] * (768 - len(pal))
    out.putpalette(pal)
    out.putdata(data)
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True, transparency=idx, bits=6 if False else 8)
    return base64.b64encode(buf.getvalue()).decode()

total = 0
os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
for pid, name in PETS.items():
    sheet = Image.open(os.path.join(SRC, pid, "spritesheet.webp")).convert("RGBA")
    frames = {}
    for key, (row, n) in ROWS.items():
        frames[key] = [enc(sheet.crop((c * CW, row * CH, (c + 1) * CW, (row + 1) * CH))) for c in range(n)]
    obj = {"id": pid, "name": name, "w": OW, "h": OH, "frames": frames, "durations": DUR}
    path = os.path.join(ROOT, "assets", pid + ".json")
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    sz = os.path.getsize(path)
    total += sz
    print(pid, sz, "bytes")
print("total", total)

# 構造検証
for pid in PETS:
    o = json.load(open(os.path.join(ROOT, "assets", pid + ".json")))
    for k, n in (("idle", 6), ("wave", 4), ("run", 6), ("done", 6)):
        assert len(o["frames"][k]) == n and len(o["durations"][k]) == n, (pid, k)
print("ok")
