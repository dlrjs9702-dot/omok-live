'use strict';
// H1 한판마당 혼자 퍼즐 5 (notes docs/hanpanmadang-share-20261112.md, 결정 9A · 58 · 82 A): every place the five are known -- the solo list,
// the puzzle or 점수 퍼즐 set, the tower; their week's trophies only once assets 180's models are in (the settlement passes a game without one)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const R = require('../public/solo-ranking.js'); const Reflex = require('../lib/reflex'); const PuzzleDaily = require('../lib/puzzle-daily');
const IDS = ['lightup', 'slide', 'blockpuzzle', 'apple10', 'watermelon'];

test('H1 다섯: 기록의 탑 순위에 있고, 주간 트로피는 모델(180)이 오면 -- 그때까지 정산이 트로피를 건너뜀', () => {
  for (const id of IDS) { assert.ok(R.BY_ID[id], id); assert.ok(R.BY_ID[id].levels.includes(R.BY_ID[id].board), id); assert.equal(R.TROPHY[id], undefined, `${id}: no trophy till its model`); }
  assert.deepEqual(R.TROPHY_SOON, { lightup: 'lights', slide: 'slide', blockpuzzle: 'blocks', apple10: 'apple', watermelon: 'melon' });
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.match(server, /if \(SoloRanking\.TROPHY\[g\.id\]\) for \(const r of top\) await giveTrophy\(/);
});

test('H1 다섯: 불빛 채우기는 오늘의 문제(서버가 답을 다시 만듦), 넷은 서버가 여는 점수 판', () => {
  assert.equal(PuzzleDaily.GAMES.lightup, '불빛 채우기');
  for (const id of ['slide', 'blockpuzzle', 'apple10', 'watermelon']) assert.ok(Reflex.GAMES[id], id);
  const ps = fs.readFileSync(path.join(__dirname, '../lib/point-store.js'), 'utf8'); for (const id of IDS) assert.ok(ps.includes(`'${id}'`), id);
  const reflex = fs.readFileSync(path.join(__dirname, '../public/reflex/reflex.js'), 'utf8');
  assert.match(reflex, /scored: \{ title: '점수 퍼즐', games: \[slide, blockpuzzle, apple10, watermelon\], info: '\/api\/solo\/reflex' \}/);
  assert.match(reflex, /if \(set === SETS\.reflex \|\| set === SETS\.scored\) id = \(await api\('\/api\/solo\/reflex\/start'/);
  const cat = require('../public/gamehall-catalog.js'); for (const id of IDS) assert.ok((cat.GAMES || globalThis.GamehallCatalog.GAMES).some((g) => g.id === id), id);
});
