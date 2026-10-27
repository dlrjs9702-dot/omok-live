'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// C4 P2-2: iPhone Safari sounds a context only if it is resumed inside a touch's handler -- the first touch unlocks it
test('게임방 소리: 첫 터치에 AudioContext를 만들고 resume·무음 재생, 소리를 꺼 둬도', () => {
  const listeners = new Map(); let made = 0; let resumed = 0; let started = 0;
  class FakeAC {
    constructor() { made += 1; this.state = 'suspended'; this.sampleRate = 8000; this.destination = {}; }
    resume() { resumed += 1; this.state = 'running'; return Promise.resolve(); }
    createGain() { return { gain: {}, connect() {} }; }
    createBuffer(c, n) { return { getChannelData: () => new Float32Array(n) }; }
    createBufferSource() { return { connect() {}, start() { started += 1; } }; }
  }
  const document = { hidden: false,
    addEventListener: (t, fn) => listeners.set(t, fn), removeEventListener: (t, fn) => { if (listeners.get(t) === fn) listeners.delete(t); } };
  const store = { 'gc.settings': JSON.stringify({ sound: false }) };
  const window = { AudioContext: FakeAC };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/room-sound.js'), 'utf8'),
    { window, document, localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } } });
  assert.equal(made, 0, '누르기 전엔 만들지 않음');
  assert.ok(listeners.has('pointerdown') && listeners.has('keydown'));
  listeners.get('pointerdown')();
  assert.equal(made, 1); assert.equal(resumed, 1); assert.equal(started, 1);
  assert.equal(listeners.size, 0, '풀린 뒤엔 듣지 않음');
});

// G-게임별 v187: a stone's sound as it lands on the board, 오델로's 착 as each disc turns -- the board's own timings
test('돌 소리 시점: 오목 내려앉을 때, 사목 줄만큼 떨어진 뒤, 오델로 놓고 뒤집힐 때마다 「착」(높아짐), 움직임 줄이기는 바로', () => {
  const window = {}; const document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/room-sound.js'), 'utf8'), { window, document, localStorage: { getItem: () => null, setItem() {} } });
  const landPlan = (...a) => JSON.parse(JSON.stringify(window.RoomSound.landPlan(...a))); // (its arrays are the context's own)
  assert.deepEqual(landPlan('omok', { x: 7, y: 7 }), [[260, 'stone']]);
  assert.deepEqual(landPlan('connect4', { x: 3, y: 5 }), [[590, 'stone']]);
  assert.deepEqual(landPlan('othello', { x: 2, y: 2, flippedCells: [{}, {}, {}] }), [[240, 'stone'], [266, 'flip', 0], [376, 'flip', 1], [486, 'flip', 2]]);
  assert.deepEqual(landPlan('othello', { x: 2, y: 2, flippedCells: [{}, {}] }, true), [[0, 'stone']]);
  assert.deepEqual(landPlan('bingo', null), [[0, 'card']]);
  assert.deepEqual(landPlan('dots', { x: 1 }), [[0, 'stone']]);
});
