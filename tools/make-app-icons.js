#!/usr/bin/env node
'use strict';
// v1.10.190 홈 화면 아이콘: 달마루섬 as the game shows it from above (tools/assets/app-icon-shot.jpg), its sea painted over
// with one calm blue so the sun's glint and the clouds go and the crescent reads even at 32 and 48 px. No text.
// The shot: in the game (a test server), PlazaDebug(): setTime('day'), setWeather('clear'), overview(true, [17, 560, -6]),
// a 1400 x 1400 window with everything but the scene hidden, cropped inside the page's frame to 1024 x 1024.
//   node tools/make-app-icons.js
// Writes the PNGs the manifest and index.html name and public/favicon.ico (16, 32, 48), drawn in Playwright's Chromium.
const fs = require('node:fs');
const path = require('node:path');

const SHOT = path.join(__dirname, 'assets', 'app-icon-shot.jpg');
const OUT = path.join(__dirname, '..', 'public', 'icons');

// in the page: the sea is what is bluer than red (or the sun's white glint on it) joined to the edge or to the bay's middle
// (the island's pond and streams stay); `fill` is the
// share of the side the island spans (the maskable one inside Android's 80 % safe circle)
function draw({ src, sizes }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const N = img.width; const c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, N, N); const px = data.data;
      const sea = new Uint8Array(N * N); const stack = [];
      const seaLike = (i) => { const [r, gg, b] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]]; return b > r + 2 || (b >= r - 6 && Math.min(r, gg, b) > 212); };
      for (let k = 0; k < N; k += 1) stack.push(k, (N - 1) * N + k, k * N, k * N + N - 1);
      stack.push(Math.round(N * 0.62) * N + Math.round(N * 0.47)); // (the bay, shut in by the bridges)
      while (stack.length) {
        const i = stack.pop(); if (sea[i] || !seaLike(i)) continue; sea[i] = 1;
        const x = i % N; const y = (i - x) / N;
        if (x > 0) stack.push(i - 1); if (x < N - 1) stack.push(i + 1); if (y > 0) stack.push(i - N); if (y < N - 1) stack.push(i + N);
      }
      let x0 = N; let x1 = 0; let y0 = N; let y1 = 0;
      for (let i = 0; i < N * N; i += 1) {
        if (sea[i]) { px[i * 4 + 3] = 0; continue; }
        const x = i % N; const y = (i - x) / N; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      g.putImageData(data, 0, 0);
      const out = {};
      for (const [name, size, fill] of sizes) {
        const o = document.createElement('canvas'); o.width = o.height = size; const q = o.getContext('2d');
        const bg = q.createRadialGradient(size * 0.5, size * 0.45, 0, size * 0.5, size * 0.5, size * 0.72);
        bg.addColorStop(0, '#8fd6f0'); bg.addColorStop(1, '#4fa9d8'); q.fillStyle = bg; q.fillRect(0, 0, size, size);
        const side = Math.max(x1 - x0, y1 - y0) + 1; const s = (size * fill) / side; const w = (x1 - x0 + 1) * s; const h = (y1 - y0 + 1) * s;
        // (down in halves, so the small ones keep the coast)
        let from = c; let fx = x0; let fy = y0; let fw = x1 - x0 + 1; let fh = y1 - y0 + 1;
        while (fw / 2 > w) {
          const t = document.createElement('canvas'); t.width = Math.ceil(fw / 2); t.height = Math.ceil(fh / 2);
          t.getContext('2d').drawImage(from, fx, fy, fw, fh, 0, 0, t.width, t.height); from = t; fx = 0; fy = 0; fw = t.width; fh = t.height;
        }
        q.imageSmoothingQuality = 'high'; q.shadowColor = 'rgba(16, 64, 96, 0.6)'; q.shadowBlur = Math.max(1.5, size * 0.012); /* (a dark rim: the pale south shore against the sea when small) */ q.drawImage(from, fx, fy, fw, fh, (size - w) / 2, (size - h) / 2, w, h);
        out[name] = o.toDataURL('image/png');
      }
      resolve(out);
    };
    img.src = src;
  });
}

// an .ico of PNG images (Windows Vista on reads them)
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let at = head.length;
  pngs.forEach(([size, buf], k) => {
    const e = 6 + 16 * k; head[e] = size; head[e + 1] = size; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(at, e + 12); at += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(([, buf]) => buf)]);
}

async function main() {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sizes = [['icon-192.png', 192, 0.92], ['icon-512.png', 512, 0.92], ['icon-maskable-512.png', 512, 0.72], ['apple-touch-icon.png', 180, 0.92], ['16', 16, 1], ['32', 32, 1], ['48', 48, 1]];
  const out = await page.evaluate(draw, { src: `data:image/jpeg;base64,${fs.readFileSync(SHOT).toString('base64')}`, sizes });
  await browser.close();
  const png = (name) => Buffer.from(out[name].split(',')[1], 'base64');
  for (const [name] of sizes.filter(([n]) => n.endsWith('.png'))) fs.writeFileSync(path.join(OUT, name), png(name));
  fs.writeFileSync(path.join(OUT, '..', 'favicon.ico'), ico([16, 32, 48].map((n) => [n, png(String(n))])));
  console.log('icons:', fs.readdirSync(OUT).join(', '), '+ favicon.ico');
}
main().catch((error) => { console.error(error); process.exit(1); });
