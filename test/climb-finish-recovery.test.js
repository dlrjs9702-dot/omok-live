'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../public/climb/climb-client.js'), 'utf8');
const flush = source.slice(source.indexOf('  async function flush('), source.indexOf('  function frame('));
const finish = source.slice(source.indexOf('  async function finish('), source.indexOf('  async function leave('));
function fixture(api) {
  let stopped = 0; let waits = 0;
  const context = vm.createContext({
    S: { isSafe: () => true, step() {} }, state: { tick: 0 }, pending: [{ tick: 0, input: 0 }],
    keys: new Set(), ending: false, sending: false, lastSend: 0, others: [],
    performance: { now: () => 0 }, api, stop: () => stopped++,
    setTimeout: fn => { waits++; fn(); },
    els: { status: { textContent: '' }, resultTitle: {}, resultDetail: {}, result: { classList: { remove() {} } } },
  });
  vm.runInContext(flush + finish + '\nglobalThis.finish = finish;', context);
  return { context, stopped: () => stopped, waits: () => waits };
}
test('등반 종료: 입력 전송 실패는 종료 버튼을 복원하고 재시도는 누락 입력 후 한 번만 정산', async () => {
  let fail = true; const routes = [];
  const fx = fixture(async route => {
    routes.push(route);
    if (fail) throw new Error('offline');
    return route === '/api/climb/input' ? { state: { tick: 1 }, others: [] } : { altitude: 10, delta: 0, best: 10, weekBest: 10 };
  });
  await fx.context.finish();
  assert.equal(fx.context.ending, false);
  assert.equal(fx.context.pending.length, 1);
  assert.deepEqual(routes, ['/api/climb/input']);
  fail = false; await fx.context.finish();
  assert.deepEqual(routes, ['/api/climb/input', '/api/climb/input', '/api/climb/end']);
  assert.equal(fx.stopped(), 1);
});
test('등반 종료: 전송이 계속 진행 중이어도 유한한 대기 뒤 다시 종료할 수 있다', async () => {
  const fx = fixture(async () => { throw new Error('must not send while busy'); });
  fx.context.sending = true;
  await fx.context.finish();
  assert.equal(fx.context.ending, false);
  assert.equal(fx.waits(), 40);
  assert.equal(fx.stopped(), 0);
});
test('등반 종료: 정산 실패도 버튼을 복원하며 성공 전 결과를 표시하지 않는다', async () => {
  const fx = fixture(async () => { throw new Error('settlement unavailable'); });
  fx.context.pending = [];
  await fx.context.finish();
  assert.equal(fx.context.ending, false);
  assert.equal(fx.context.els.status.textContent, 'settlement unavailable');
  assert.equal(fx.stopped(), 0);
});
