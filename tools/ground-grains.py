# 1.10.358 땅 텍스처 칸 줄이기 (phones' 16 texture units: the ground's shader reached 17 with 1.10.357's road map): the three grey
# grain pictures in one -- R grass (64 px, tiled 4 x 4), G soil (256 px), B sand (32 px, tiled 8 x 8) -- 256 x 256, sRGB like
# them. island.js reads each channel at its own scale (GRASS / SOIL / SAND), the same as the three were read.
# Run: python -I tools/ground-grains.py  (writes public/assets/island/ground-v1/ground.grains.png)
import pathlib
from PIL import Image

D = pathlib.Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'island' / 'ground-v1'
N = 256

def tiled(name, size):
    im = Image.open(D / f'ground.{name}.png').convert('L')
    assert im.size == (size, size), (name, im.size)
    out = Image.new('L', (N, N))
    for y in range(0, N, size):
        for x in range(0, N, size):
            out.paste(im, (x, y))
    return out

Image.merge('RGB', (tiled('grass_gray', 64), tiled('soil_gray', 256), tiled('sand_gray', 32))).save(D / 'ground.grains.png', optimize=True)
print('ground.grains.png', (D / 'ground.grains.png').stat().st_size)
