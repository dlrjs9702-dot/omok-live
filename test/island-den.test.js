'use strict';
// 1.10.341 지하 도박장 (lib/island-den.js): the four games' returns (the house about 5 %), their limits, the day's password and its
// note, a raid's chance and its times
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../lib/island-den');

test('도박장 판: 네 가지 모두 집 몫 4~6 %(되돌림 0.94~0.96), 한 판 1~5,000칩, 잘못된 고름은 막음', () => {
  for (const p of D.DICE_PICKS) { const e = D.expected('dice', p); assert.ok(e > 0.94 && e < 0.96, `dice ${p} ${e}`); }
  for (const shown of [2, 5, 7, 9, 12]) for (const p of D.HILO_PICKS) { const e = D.expected('hilo', p, shown); assert.ok(e > 0.94 && e <= 0.95, `hilo ${shown} ${p} ${e}`); }
  for (const p of [...D.ROULETTE_PICKS, 0, 7, 18]) { const e = D.expected('roulette', p); assert.ok(e > 0.94 && e < 0.96, `roulette ${p} ${e}`); }
  { const e = D.expected('slots'); assert.ok(e > 0.94 && e < 0.96, `slots ${e}`); }
  const r = () => 0.5;
  assert.equal(D.play({ game: 'dice', bet: 0, pick: 'big' }, r).error, 'BET'); assert.equal(D.play({ game: 'dice', bet: 5001, pick: 'big' }, r).error, 'BET');
  assert.equal(D.play({ game: 'dice', bet: 10, pick: 'huge' }, r).error, 'PICK'); assert.equal(D.play({ game: 'poker', bet: 10 }, r).error, 'GAME');
  assert.equal(D.play({ game: 'hilo', bet: 10, pick: 'high', shown: 13 }, r).error, 'PICK', 'K보다 높은 카드는 없음');
  assert.equal(D.play({ game: 'roulette', bet: 10, pick: 19 }, r).error, 'PICK');
  // a seeded run: wins and losses both, never more back than the table pays
  let seed = 3; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let back = 0; let staked = 0; for (let k = 0; k < 20000; k += 1) { const g = D.GAMES[k % 4]; const o = D.play({ game: g, bet: 100, pick: g === 'dice' ? 'big' : g === 'hilo' ? 'low' : g === 'roulette' ? 'red' : undefined, shown: 9 }, rand); assert.ok(!o.error, JSON.stringify(o)); back += o.back; staked += 100; }
  assert.ok(back / staked > 0.9 && back / staked < 1, `되돌림 ${(back / staked).toFixed(3)}`);
  assert.equal(D.play({ game: 'slots', bet: 100 }, () => 0).back, 4300, '세븐 셋 43배');
});

test('오늘의 암호·쪽지 자리: 서버 열쇠와 날짜로 정해지고, 띄어쓰기는 상관없음; 단속 확률·시각', () => {
  const a = D.wordOf('k', '2026-11-17'); assert.ok(D.WORDS.includes(a)); assert.equal(D.wordOf('k', '2026-11-17'), a);
  assert.ok(new Set(['2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((d) => D.wordOf('k', d))).size > 1, '날마다 바뀜');
  assert.equal(D.sameWord('달빛재즈', '달빛 재즈'), true); assert.equal(D.sameWord('달빛', '달빛 재즈'), false);
  const spots = [{ x: 1 }, { x: 2 }, { x: 3 }]; assert.ok(spots.includes(D.noteSpot('k', '2026-11-17', spots)));
  const p = D.raidChance(); assert.ok(Math.abs(p - 5000 / 2400000) < 1e-5, '5초에 한 번, 평균 40분');
  const t = D.raidTimes(1000, 64); assert.equal(t.walk, 40000); assert.equal(t.arrive - t.hintAt, 12000, '12초 전 낌새');
  assert.ok(t.end - t.start < 5 * 60000, '5분 안');
  assert.equal(D.raidPhase(t, 2000), 'walk'); assert.equal(D.raidPhase(t, t.arrive + 1), 'search'); assert.equal(D.raidPhase(t, t.searchEnd + 1), 'back'); assert.equal(D.raidPhase(t, t.end), null);
});
