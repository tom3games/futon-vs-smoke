# 描いたシート（緑背景）を切り抜いて img/*.webp と js/art.js を作る。~/tools/pyimg/bin/python art/key.py
# 1枚のシートの中の部品は、緑を抜いた後のかたまり（つながった所）ごとに切る。並びは上の段から左→右
import numpy as np, os, json
from collections import deque
from PIL import Image, ImageFilter
D = os.path.dirname(os.path.abspath(__file__)); OUT = D + '/../img/'
os.makedirs(OUT, exist_ok=True)

def keyed(src):
    a = np.asarray(Image.open(D + '/raw/' + src + '.png').convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    k = g - np.maximum(r, b)
    al = 1 - np.clip((k - 30) / (100 - 30), 0, 1)
    lim = np.maximum(r, b); g2 = np.where(g > lim + 8, lim + 8, g)     # 縁の緑かぶりを消す
    im = Image.fromarray(np.dstack([r, g2, b, al * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    a2 = im.split()[3].filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6)); im.putalpha(a2)
    return im

def blobs(im, grow=10, minA=1500):
    S = 4
    m = np.asarray(im.split()[3].resize((im.width // S, im.height // S))) > 40
    m = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(grow // S * 2 + 1))) > 0
    H, W = m.shape; lab = np.zeros((H, W), np.int32); out = []
    for y in range(H):
        for x in range(W):
            if m[y, x] and not lab[y, x]:
                n = len(out) + 1; q = deque([(y, x)]); lab[y, x] = n; x0 = x1 = x; y0 = y1 = y; c = 0
                while q:
                    cy, cx = q.popleft(); c += 1
                    x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not lab[ny, nx]: lab[ny, nx] = n; q.append((ny, nx))
                out.append((c, (x0 * S, y0 * S, (x1 + 1) * S, (y1 + 1) * S)))
    out = [b for c, b in out if c * S * S >= minA]
    out.sort(key=lambda b: (round(((b[1] + b[3]) / 2) / (im.height / 2.6)), b[0]))   # 段ごと → 左から
    return out

ART = {}
def cut(sheet, names, scale, grow=10, grid=None):
    im = keyed(sheet); bs = blobs(im, grow)
    if grid:   # 升目ごとに、中心がその升目にあるかたまりを全部まとめる（星や吹き出す煙が離れている絵）
        cw, ch = im.width / grid[0], im.height / grid[1]; cells = {}
        for bx in blobs(im, 6, 200):
            i = min(grid[0] - 1, int((bx[0] + bx[2]) / 2 // cw)) + grid[0] * min(grid[1] - 1, int((bx[1] + bx[3]) / 2 // ch))
            c = cells.get(i); cells[i] = bx if not c else (min(c[0], bx[0]), min(c[1], bx[1]), max(c[2], bx[2]), max(c[3], bx[3]))
        bs = [cells[i] for i in range(grid[0] * grid[1])]
    if len(bs) != len(names):
        print('!!', sheet, 'かたまりの数', len(bs), '名前', len(names), bs)
    for name, box in zip(names, bs):
        if name is None: continue
        c = im.crop(box); bb = c.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox(); c = c.crop(bb)
        w, h = c.size; c = c.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        c.save(OUT + name + '.webp', quality=86, method=6, alpha_quality=90)
        ART[name] = {'w': c.width, 'h': c.height, 'sx': box[0] + bb[0], 'sy': box[1] + bb[1], 's': scale}

cut('hero_a', ['h_idle', 'h_run1', 'h_run2', 'h_jump', 'h_duck', 'h_hurt'], 0.42, grow=20)
cut('hero_b', ['h_shoot', 'h_up', 'h_dash', 'h_flap', 'h_cheer', 'h_sleep'], 0.42, grow=20)
cut('boss_a', ['b_head', 'b_torso', 'b_uarmL', 'b_farmL', 'b_uarmR', 'b_farmR', 'b_tray'], 0.62, grow=14)
cut('props', ['p_puff', 'p_butt', 'p_ring', 'p_cig', 'p_futon', 'p_futon2', 'p_manga', 'p_spray'], 0.5, grow=16)
if os.path.exists(D + '/raw/boss_b.png'):
    cut('boss_b', ['b_inhale', 'b_angry', 'b_hurt', 'b_cough', 'b_small', 'b_slam'], 0.62, grid=(3, 2))
# 背景は高さ 540 に合わせる
for n in ['bg_room', 'bg_street', 'bg_roof']:
    im = Image.open(D + '/raw/' + n + '.png').convert('RGB'); k = 600 / im.height
    im = im.resize((round(im.width * k), 600), Image.LANCZOS); im.save(OUT + n + '.webp', quality=80, method=6)
    ART[n] = {'w': im.width, 'h': im.height}
open(D + '/../js/art.js', 'w').write('// art/key.py が作る。w,h は img の大きさ、sx,sy はシートの中の位置、s は縮め\nexport const ART = ' + json.dumps(ART) + '\n')
print(json.dumps(ART, indent=0)[:3000])
