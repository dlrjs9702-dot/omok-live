'use strict';

// A4 날씨 (IDEAS 「함께하는 섬」 섬 생활 확장, 사용자 시행 결정 2026-10-18): the island's weather by the server clock, the
// same for everyone -- each 3-hour block of a Seoul day is clear or rainy (about one in four), and the first half hour
// after a rain that clears shows a rainbow. The winter zone shows the rain as snow (the page draws it by where one
// stands). The administrator can hold it at one kind (mode). Rain helps fishing (lib/island-fishing.js where.rain).
const KINDS = Object.freeze(['clear', 'rain', 'rainbow']);
const BLOCK_MS = 3 * 3600 * 1000;
const RAINBOW_MS = 30 * 60 * 1000;
const KST = 9 * 3600 * 1000;

// a stable 0..1 for one block (no shared random state: every server instance and restart agrees)
function blockRoll(index) {
  let h = 2166136261 ^ index;
  for (let i = 0; i < 4; i += 1) { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); h ^= h >>> 16; }
  return (h >>> 0) / 4294967296;
}
const rainy = (index) => blockRoll(index) < 0.25;

// { kind, until } at ms; mode 'auto' or a fixed kind
function weatherAt(ms, mode = 'auto') {
  if (KINDS.includes(mode)) return { kind: mode, until: null, fixed: true };
  const index = Math.floor((ms + KST) / BLOCK_MS); const start = index * BLOCK_MS - KST;
  if (rainy(index)) return { kind: 'rain', until: start + BLOCK_MS, fixed: false };
  if (rainy(index - 1) && ms - start < RAINBOW_MS) return { kind: 'rainbow', until: start + RAINBOW_MS, fixed: false };
  return { kind: 'clear', until: start + BLOCK_MS, fixed: false };
}

module.exports = { KINDS, BLOCK_MS, RAINBOW_MS, weatherAt, blockRoll };

if (require.main === module) { // a quick check: about a quarter rainy, a rainbow only right after rain, fixed modes hold
  const assert = require('node:assert/strict'); let rain = 0; const n = 4000;
  for (let i = 0; i < n; i += 1) if (rainy(i)) rain += 1;
  assert.ok(rain / n > 0.2 && rain / n < 0.3, String(rain / n));
  for (let i = 1; i < 400; i += 1) { const ms = i * BLOCK_MS - KST + 60_000; const w = weatherAt(ms); if (w.kind === 'rainbow') assert.ok(rainy(i - 1) && !rainy(i)); }
  assert.equal(weatherAt(0, 'rain').kind, 'rain');
  console.log('island-weather ok', rain / n);
}
