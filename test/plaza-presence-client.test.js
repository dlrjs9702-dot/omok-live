'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');
const begin = source.indexOf('  let plazaSendTimer =');
const end = source.indexOf('  function applyPlazaAvatar()', begin);
assert.ok(begin >= 0 && end > begin);
const apiBegin = source.indexOf('  async function api(path, options');
const apiEnd = source.indexOf('  // v1.10.35 무입력 로그아웃', apiBegin);
assert.ok(apiBegin >= 0 && apiEnd > apiBegin);
const tick = () => new Promise(resolve => setImmediate(resolve));

test('광장 화면: 이전 응답은 새 화면을 보정하지 않고 퇴장 응답 뒤 새 위치 전송을 시작한다', async () => {
  const calls = []; let corrected = 0; let mounted = true;
  const controller = { pose: () => ({ x: 0, z: 8, yaw: 0 }), correctTo: () => corrected++, setOthers() {} };
  const context = vm.createContext({
    plaza: { controller }, sessionToken: 'fixture',
    document: { body: { classList: { contains: () => mounted } } },
    setInterval: () => 1, clearInterval() {}, Date, Math, AbortController,
    fetch: (route, options) => new Promise(resolve => calls.push({ route, options, resolve: data => resolve({ ok: true, status: 200, json: async () => data }) })),
  });
  vm.runInContext(source.slice(apiBegin, apiEnd) + source.slice(begin, end) + '\nglobalThis.testHooks = { plazaPresenceTick, setPlazaPresence };', context);
  const h = context.testHooks;
  h.setPlazaPresence(true); h.plazaPresenceTick();
  assert.equal(calls.length, 1);
  mounted = false; h.setPlazaPresence(false);
  context.sessionToken = 'replacement';
  mounted = true; h.setPlazaPresence(true);
  context.plaza.controller = { ...controller };
  h.plazaPresenceTick(); assert.equal(calls.length, 1, '퇴장 전 새 상태 전송을 보류');
  await tick(); assert.equal(calls[1].route, '/api/plaza/leave');
  assert.equal(calls[1].options.headers['X-Session-Token'], 'fixture', '퇴장 요청은 새 로그인 토큰을 사용하지 않는다');
  assert.equal(calls[0].options.signal.aborted, true);
  calls[0].resolve({ corrected: true, x: 90, z: 90, now: Date.now() });
  await tick(); assert.equal(corrected, 0, '취소가 늦게 반영되어도 이전 응답을 무시');
  calls[1].resolve({ ok: true }); await tick();
  h.plazaPresenceTick(); assert.equal(calls[2].route, '/api/plaza/state');
  calls[2].resolve({ corrected: true, x: 1, z: 8 }); await tick();
  assert.equal(corrected, 1, '현재 방문의 정상 보정은 유지');
});
