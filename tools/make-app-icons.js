#!/usr/bin/env node
'use strict';
// v1.10.66 홈 화면 아이콘: the island itself (its real coast, streams and pond from public/plaza/island-terrain.js) on a
// sea-blue square -- an iPhone always shows a rounded square, and an Android launcher may cut any shape, so the square
// is the sea and the island keeps clear of the edges. No text. Run after a change of the island's shape:
//   node tools/make-app-icons.js
// Writes public/icons/island.svg and the PNGs the manifest and index.html name (rendered by Playwright's Chromium).
const fs = require('node:fs');
const path = require('node:path');
const T = require('../public/plaza/island-terrain.js');

const OUT = path.join(__dirname, '..', 'public', 'icons');

// island metres -> a 512 viewBox; `fill` is the share of the side the island spans (the maskable icon keeps it
// inside Android's 80 % safe circle)
function svg(fill) {
  const s = (512 * fill) / (2 * (T.ISLAND_RADIUS + 4));
  const X = (x) => (256 + x * s).toFixed(1);
  const Z = (z) => (256 + z * s).toFixed(1);
  const coast = (grow) => Array.from({ length: 181 }, (_, i) => {
    const a = (i / 180) * T.TAU; const R = T.coastR(a) + grow;
    return `${i ? 'L' : 'M'}${X(Math.cos(a) * R)} ${Z(Math.sin(a) * R)}`;
  }).join('') + 'Z';
  const line = (pts) => pts.map(([x, z], i) => `${i ? 'L' : 'M'}${X(x)} ${Z(z)}`).join('');
  const streams = [...T.streamCurves.map((pts) => line(pts))];
  // a few round trees in clumps, between the plaza and the shore (a picture, not the island's real planting)
  const trees = [];
  for (const [deg, k] of [[25, 0.62], [70, 0.7], [150, 0.6], [205, 0.66], [255, 0.55], [320, 0.64], [115, 0.45]]) {
    const a = (deg / 180) * Math.PI; const R = T.coastR(a) * k;
    for (const [dx, dz, r] of [[0, 0, 11], [9, 6, 8.5], [-8, 7, 8]]) {
      const x = Math.cos(a) * R + dx; const z = Math.sin(a) * R + dz;
      if (Math.hypot(x - T.POND.x, z - T.POND.z) > T.POND.r + r) trees.push([x, z, r]); // the pond stays in sight
    }
  }
  const tree = ([x, z, r]) => `<circle cx="${X(x)}" cy="${Z(z) - r * s * 0.15}" r="${(r * s).toFixed(1)}" fill="#5aa85a"/><circle cx="${(+X(x) - r * s * 0.3).toFixed(1)}" cy="${(+Z(z) - r * s * 0.45).toFixed(1)}" r="${(r * s * 0.45).toFixed(1)}" fill="#7cc46b"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<defs><radialGradient id="sea" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#8fd6f0"/><stop offset="1" stop-color="#4fa9d8"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#sea)"/>
<path d="${coast(6)}" fill="#bfe6f4" opacity=".55"/>
<path d="${coast(0)}" fill="#f1dfae"/>
<path d="${coast(-6)}" fill="#9fd67f"/>
<g fill="none" stroke="#5fb4e0" stroke-linecap="round" stroke-linejoin="round" stroke-width="${(T.STREAM_HALF * 2.4 * s).toFixed(1)}">${streams.map((d) => `<path d="${d}"/>`).join('')}</g>
<circle cx="${X(T.POND.x)}" cy="${Z(T.POND.z)}" r="${(T.POND.r * s).toFixed(1)}" fill="#5fb4e0"/>
<circle cx="${X(0)}" cy="${Z(0)}" r="${(T.PLAZA_R * s).toFixed(1)}" fill="#f3e6c8" stroke="#c9b48a" stroke-width="2"/>
${trees.map(tree).join('\n')}
</svg>`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const plain = svg(0.86); const maskable = svg(0.7);
  fs.writeFileSync(path.join(OUT, 'island.svg'), plain);
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, art] of [['icon-192.png', 192, plain], ['icon-512.png', 512, plain], ['icon-maskable-512.png', 512, maskable], ['apple-touch-icon.png', 180, plain]]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${art.replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
    await page.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  console.log('icons:', fs.readdirSync(OUT).join(', '));
}
main().catch((error) => { console.error(error); process.exit(1); });
