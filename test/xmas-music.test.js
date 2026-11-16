'use strict';
// 1.10.331 M4 크리스마스 소리 (public/plaza/xmas-music.js): three old carols on a music box by the plaza tree -- each note a known
// pitch a box can play, every length positive, each song 15~60 s; loud by the tree, fading out by REACH m, silent past it
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../public/plaza/xmas-music.js');

test('크리스마스 오르골: 캐롤 셋(징글벨·위시유·고요한 밤), 음 범위·길이, 트리에서 멀수록 작게', () => {
  assert.deepEqual(M.SONGS.map((s) => s.id), ['jingle', 'wish', 'silent']);
  for (const s of M.SONGS) {
    for (const [m, b] of s.notes) { assert.ok(Number.isInteger(m) && m >= 60 && m <= 77, `${s.id} ${m}`); assert.ok(b > 0 && b <= 6, `${s.id} ${b}`); }
    const len = M.songLength(s); assert.ok(len >= 15 && len <= 60, `${s.id} ${len.toFixed(1)} s`);
  }
  assert.ok(Math.abs(M.freq(69) - 440) < 1e-9); assert.ok(Math.abs(M.freq(60 + M.BOX_UP) - 523.2511) < 0.01, '오르골은 한 옥타브 위');
  assert.equal(M.loudness(0), 1); assert.equal(M.loudness(4), 1); assert.ok(M.loudness(14) > 0 && M.loudness(14) < 1); assert.equal(M.loudness(M.REACH), 0); assert.equal(M.loudness(100), 0);
  const s = M.create({ isOn: () => false }); s.step(1, true); assert.equal(s.state().playing, false, '소리 끔이면 울리지 않음 (AudioContext도 만들지 않음)');
});
