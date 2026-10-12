'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

// v1.10.71 AI 대전 오목 (한판마당 rules.js): our omok rule (lib/game.js) — 장목 is forbidden for black even when the same
// stone also makes an exact five another way (Codex review: the material counted it as a win)
test('AI 대전 오목: 가로 장목과 세로 5목이 함께 생기는 흑 수는 장목 금수', async () => {
  const R = await import('../public/reflex/js/games/rules.js');
  const N = 15; const b = Array(N * N).fill(0); const at = (x, y) => y * N + x;
  for (const x of [2, 3, 4, 6, 7, 8]) b[at(x, 7)] = 1;
  for (const y of [3, 4, 5, 6]) b[at(5, y)] = 1;
  assert.equal(R.gmForbidden(b, at(5, 7)), '6');
  b[at(8, 7)] = 0; b[at(2, 7)] = 0; // now 4 across + 5 down: an exact five, allowed
  assert.equal(R.gmForbidden(b, at(5, 7)), '');
});
