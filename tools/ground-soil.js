#!/usr/bin/env node
'use strict';
// v1.10.311 땅·길 ③ (notes docs/ground-path-audit-20261111 2-A): the earth walks' grain picture 32 -> 256 (it is 1.4 m a repeat:
// 4 cm a point was a smudge, now 5.5 mm) -- written to public/assets/island/ground-v1/ground.soil_gray.png, the same file the
// ground shader reads. Seamless value noise in four sizes and a few small stones; its linear mean kept at 0.319, which the
// shader divides by (island.js tSoil / 0.319). A grey PNG (node's zlib, no picture library):  node tools/ground-soil.js
const fs = require('node:fs'); const path = require('node:path'); const zlib = require('node:zlib');
const N = 256; const MEAN = 0.319;
let seed = 0x5011; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const grid = (cells) => { const g = Array.from({ length: cells * cells }, rnd); return (x, y) => { const fx = (x / N) * cells; const fy = (y / N) * cells; const i = Math.floor(fx); const j = Math.floor(fy); const u = fx - i; const v = fy - j; const s = (t) => t * t * (3 - 2 * t); const at = (a, b) => g[((b + cells) % cells) * cells + ((a + cells) % cells)]; return (at(i, j) * (1 - s(u)) + at(i + 1, j) * s(u)) * (1 - s(v)) + (at(i, j + 1) * (1 - s(u)) + at(i + 1, j + 1) * s(u)) * s(v); }; };
const octaves = [[8, 0.45], [16, 0.3], [32, 0.17], [64, 0.08]].map(([c, w]) => [grid(c), w]);
const stones = Array.from({ length: 70 }, () => ({ x: rnd() * N, y: rnd() * N, r: 1.2 + rnd() * 2.6, k: rnd() < 0.55 ? 1.35 : 0.62 }));
const raw = new Float32Array(N * N);
for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
  let v = 0; for (const [f, w] of octaves) v += f(x, y) * w; v = 0.55 + (v - 0.5) * 1.1;
  for (const s of stones) { const dx = Math.min(Math.abs(x - s.x), N - Math.abs(x - s.x)); const dy = Math.min(Math.abs(y - s.y), N - Math.abs(y - s.y)); const d = Math.hypot(dx, dy); if (d < s.r) v *= 1 + (s.k - 1) * (1 - (d / s.r) ** 2); }
  raw[y * N + x] = Math.max(0.05, v);
}
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); const toSrgb = (l) => (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055);
let gain = 0.3; for (let it = 0; it < 40; it += 1) { let m = 0; for (const v of raw) m += toLin(Math.round(Math.min(1, toSrgb(v * gain)) * 255) / 255); m /= raw.length; gain *= MEAN / m; }
const rows = Buffer.alloc((N + 1) * N); let mean = 0;
for (let y = 0; y < N; y += 1) { rows[y * (N + 1)] = 0; for (let x = 0; x < N; x += 1) { const b = Math.round(Math.min(1, toSrgb(raw[y * N + x] * gain)) * 255); rows[y * (N + 1) + 1 + x] = b; mean += toLin(b / 255); } }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const t = Buffer.from(type, 'ascii'); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const out = path.join(__dirname, '..', 'public', 'assets', 'island', 'ground-v1', 'ground.soil_gray.png');
fs.writeFileSync(out, png); console.log(`${N}x${N}, linear mean ${(mean / (N * N)).toFixed(3)}, ${png.length} bytes`);
