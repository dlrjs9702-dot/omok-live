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
