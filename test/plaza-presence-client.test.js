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

test('이전 위치 요청의 늦은 401은 새 로그인 세션을 종료하지 않는다', async () => {
  let reply; let expired = 0;
  const context = vm.createContext({
    sessionToken: 'old', document: { body: { classList: { contains: () => false } } },
    fetch: () => new Promise(resolve => { reply = resolve; }),
    expireSession: () => expired++,
  });
  vm.runInContext(source.slice(apiBegin, apiEnd) + '\nglobalThis.api = api;', context);
  const pending = context.api('/api/plaza/state', { method: 'POST', body: '{}' }).catch(e => e);
  context.sessionToken = 'new';
  reply({ ok: false, status: 401, json: async () => ({ message: 'old session expired' }) });
  assert.equal((await pending).status, 401);
  assert.equal(expired, 0, '새 세션의 인증 상태를 지우지 않는다');
});

test('시설의 선행 위치 확인 중 로그인 전환이 있어도 지급 요청의 계정을 바꾸지 않는다', async () => {
  const calls = [];
  const context = vm.createContext({
    sessionToken: 'old', document: { body: { classList: { contains: () => true } } },
    plaza: { controller: { canInteract: () => true, pose: () => ({ x: 0, z: 8 }) } },
    fetch: (route, options) => new Promise(resolve => calls.push({ route, options, resolve: () => resolve({ ok: true, status: 200, json: async () => ({ ok: true }) }) })),
    expireSession() {},
  });
  vm.runInContext(source.slice(apiBegin, apiEnd) + '\nglobalThis.api = api;', context);
  const pending = context.api('/api/points/attendance', { method: 'POST', body: '{}' });
  assert.equal(calls[0].options.headers['X-Session-Token'], 'old');
  context.sessionToken = 'new'; calls[0].resolve(); await tick();
  assert.equal(calls[1].route, '/api/points/attendance');
  assert.equal(calls[1].options.headers['X-Session-Token'], 'old');
  calls[1].resolve(); await pending;
});
