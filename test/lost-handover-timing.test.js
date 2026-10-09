'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the real scene callback with a delayed browser timer, without a GPU.
const scene = fs.readFileSync(path.join(__dirname, '../public/plaza/plaza-scene.js'), 'utf8');
const begin = scene.indexOf('  function returnLost(id) {');
const end = scene.indexOf('  function removeEvent(', begin);
assert.ok(begin >= 0 && end > begin);
const callback = scene.slice(begin, end);

for (const delay of [0, 400, 1800]) {
  test(`분실물 전달: Give 콜백 ${delay}ms 지연 후에도 Receive를 1400ms 유지`, () => {
    let now = 0;
    const timers = [];
    const owner = { root: { parent: {}, position: { x: 1, z: 0 }, rotation: { y: 0 } }, npc: {
      root: { rotation: { y: 0 } }, home: {}, anim: { play() {} },
    } };
    let handovers = 0;
    let removals = 0;
    const context = vm.createContext({
      performance: { now: () => now },
      setTimeout: (fn, ms) => timers.push({ fn, at: now + ms }),
      returning: new Set(), lastReturn: null,
      eventObjs: new Map([['ev:lost_owner:item', owner]]),
      eventDoors: { 'ev:lost_owner:item': {} },
      me: { root: { position: { x: 0, z: 0 } }, carryId: 'item', carrying: true, anim: { play: () => true } },
      assets: { handOver: () => { handovers++; } },
      setCarry() { throw new Error('owner exists'); },
      removeEvent: () => { removals++; owner.root.parent = null; },
    });
    vm.runInContext(callback + '\nreturnLost("item");', context);
    const advance = (time) => {
      now = time;
      while (timers.some(t => t.at <= now)) {
        const i = timers.findIndex(t => t.at <= now);
        timers.splice(i, 1)[0].fn();
      }
    };
    advance(700 + delay);
    assert.equal(handovers, 1);
    assert.equal(removals, 0, '전달 순간에 사라지지 않는다');
    assert.equal(context.me.carrying, false);
    assert.equal(context.eventDoors['ev:lost_owner:item'], undefined);
    advance(700 + delay + 1399);
    assert.equal(removals, 0, '실제 전달 후 유지 시간 확보');
    advance(700 + delay + 1400);
    assert.equal(removals, 1);
    assert.equal(context.returning.size, 0);
    assert.deepEqual(Array.from(context.lastReturn.steps, s => s[0]), ['give', 'received', 'gone']);
    assert.equal(context.lastReturn.steps[2][1] - context.lastReturn.steps[1][1], 1400);
  });
}
