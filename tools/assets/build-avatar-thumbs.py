#!/usr/bin/env python3
# v1.10.32 캐릭터 스킨 상점 그림: each avatar item worn on the common character (the plain male base, the item's slot
# swapped as the game does -- island-assets.js wardrobeOf), seen from the front and from behind, from the same finished
# models the game draws (their sources through tools/assets/island-models.json) with the skins pack's own preview
# renderer. Writes public/assets/shop/avatar/<item id>.webp (260 x 130, the shop card's picture).
# Usage: python tools/assets/build-avatar-thumbs.py --src "<asset folder>"   (numpy, Pillow; Node for the registry)
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
src = Path(sys.argv[sys.argv.index('--src') + 1])
config = json.loads((ROOT / 'tools/assets/island-models.json').read_text(encoding='utf-8'))
sys.path.insert(0, str(src / config['sources']['skins'] / '13. Source'))
import shared_geometry as g  # noqa: E402

plans = json.loads(subprocess.check_output(['node', '-e', '''
const A = require('./public/plaza/island-assets.js');
const out = {};
for (const item of Object.keys(A.WARDROBE)) {
  if (!item.startsWith('avatar_')) continue;
  const slot = item.startsWith('avatar_animal_') ? item.split('_').pop() : item.split('_')[1];
  const plan = A.wardrobeOf({ gender: 'male', [slot]: item });
  out[item] = { slot, urls: plan.parts.map((id) => A.REGISTRY[id].url) };
}
out.__body = A.REGISTRY['character.base'].url;
console.log(JSON.stringify(out));
'''], cwd=ROOT))
by_out = {e['out']: e['src'] for e in config['files']}
def source(url):
    name, rel = by_out[url.replace('/assets/island/', '')].split(':', 1)
    return src / config['sources'][name] / rel
def parts_of(paths):
    parts = []; mats = []
    for p in paths:
        doc, ps = g.decode(Path(p).read_bytes())
        off = len(mats); mats += doc.get('materials', [])
        parts += [(n, v, f, mi + off) for n, v, f, mi in ps]
    return parts, mats
skin = [1.0, 0.7454, 0.552, 1]  # the island's warm skin #ffe0c4 (the game tints the part's paler skin)
out_dir = ROOT / 'public/assets/shop/avatar'; out_dir.mkdir(parents=True, exist_ok=True)
body = source(plans.pop('__body'))
for item, plan in plans.items():
    if '--only' in sys.argv and sys.argv[sys.argv.index('--only') + 1] not in item:
        continue
    parts, mats = parts_of([body] + [source(u) for u in plan['urls']])
    for m in mats:
        if m.get('name') == 'skin': m['pbrMetallicRoughness']['baseColorFactor'] = skin
    # framed on the item: the head for hair and hats, the chest for a necklace, the feet for shoes (fractions of a
    # whole-figure picture)
    box = {'hair': (.12, 0, .88, .62), 'hat': (.12, 0, .88, .62), 'necklace': (.2, .3, .8, .78), 'shoes': (.2, .55, .8, 1), 'tail': (.05, .3, .95, 1), 'cape': (.05, .25, .95, 1)}.get(plan['slot'], (0, 0, 1, 1))
    def view(azimuth):
        full = g.render(parts, mats, (360, 360), azimuth=azimuth, elevation=12)
        pad = Image.new('RGB', (720, 720), full.getpixel((2, 2))); pad.paste(full, (180, 180)) # the backdrop round it
        x0, y0, x1, y1 = box; side = max(x1 - x0, y1 - y0); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        return pad.crop(tuple(180 + round(v * 360) for v in (cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2))).resize((130, 130), Image.Resampling.LANCZOS)
    front = view(-62); back = view(118)
    sheet = Image.new('RGB', (260, 130)); sheet.paste(front, (0, 0)); sheet.paste(back, (130, 0))
    sheet.save(out_dir / f'{item}.webp', 'WEBP', quality=82, method=6)
    print(item, plan['slot'])
