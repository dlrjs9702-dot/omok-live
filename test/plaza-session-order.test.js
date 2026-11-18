'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep } = require('../test-support/test-server');
const { hold, fixture } = require('../test-support/session-order');

test('광장 위치: 이탈·방 입장·로그아웃 전에 시작한 느린 본문은 캐릭터를 되살리지 않는다', async t => {
  const fx = await fixture(t);
  await fx.req('/api/plaza/state', fx.token, { x: 25, z: 4 });
  const departed = hold(fx.base, '/api/plaza/state', fx.token, { x: 25, z: 4 });
  await sleep(150);
  assert.equal((await fx.req('/api/plaza/leave', fx.token, {})).status, 200);
  // A fresh visit remains valid even when the previous request arrives afterwards.
  const fresh = await fx.req('/api/plaza/state', fx.token, { x: 0, z: 8 });
  assert.equal(fresh.status, 200);
  departed.complete();
  assert.equal((await departed.result).status, 409);
  const inRoom = hold(fx.base, '/api/plaza/state', fx.token, { x: 0, z: 8 });
  await sleep(150);
  assert.equal((await fx.req('/api/rooms', fx.token, { gameType: 'baseball' })).status, 201);
  inRoom.complete();
  assert.equal((await inRoom.result).status, 409);
  const other = await fx.enter(await fx.issue('늦은로그아웃'));
  const loggedOut = hold(fx.base, '/api/plaza/state', other, { x: 0, z: 8 });
  await sleep(150);
  await fx.req('/api/logout', other, {});
  loggedOut.complete();
  assert.equal((await loggedOut.result).status, 401);
});

// CI 3차 검토: a stop cuts off the walking pose on its way (app.js plazaPresenceTick), but a body already sent is still
// taken -- after the stop, it put back the old spot and the walking step (others saw me walk on until the next pose, 3 s).
test('광장 위치: 멈춤 뒤에 도착한 더 이른 걷는 중 위치는 멈춤을 덮지 않는다', async t => {
  const fx = await fixture(t);
  const t0 = Date.now();
  await fx.req('/api/plaza/state', fx.token, { x: 25, z: 4, moving: true, t: t0 });
  const walking = hold(fx.base, '/api/plaza/state', fx.token, { x: 25, z: 4.5, moving: true, t: t0 + 125 });
  await sleep(150);
  const stopped = await fx.req('/api/plaza/state', fx.token, { x: 25, z: 5, moving: false, t: t0 + 250 });
  assert.equal(stopped.status, 200);
  walking.complete();
  const late = await walking.result;
  assert.equal(late.status, 200);
  assert.deepEqual([late.data.x, late.data.z, late.data.corrected], [stopped.data.x, stopped.data.z, false], 'answered with where I am');
  const res = await fetch(fx.base + '/api/lobby/events', { headers: { 'X-Session-Token': fx.token } });
  const reader = res.body.getReader(); const decoder = new TextDecoder(); let text = '';
  while (!text.includes('event: plaza\n')) { const { value, done } = await reader.read(); if (done) break; text += decoder.decode(value); }
  await reader.cancel();
  const frame = text.split('\n\n').find(f => f.startsWith('event: plaza\n'));
  const me = JSON.parse(frame.match(/^data: (.*)$/m)[1]).players.find(p => p.id === stopped.data.id);
  assert.deepEqual([me.x, me.z, me.moving], [stopped.data.x, stopped.data.z, false]);
  // a pose without t (an old client) is taken as before
  const old = await fx.req('/api/plaza/state', fx.token, { x: 25, z: 5.5, moving: false });
  assert.deepEqual([old.data.x, old.data.z], [25, 5.5]);
});

test('첫 heartbeat가 끝나기 전에 닫힌 문서는 늦은 heartbeat로 입장키를 잠그지 않는다', async t => {
  const fx = await fixture(t);
  await fx.req('/api/session/heartbeat', fx.token, { page: 'old' });
  const heartbeat = hold(fx.base, '/api/session/heartbeat', fx.token, { page: 'new' });
  await sleep(150);
  await fx.req('/api/session/release', null, { sessionToken: fx.token, page: 'old' });
  await fx.req('/api/session/release', null, { sessionToken: fx.token, page: 'new' });
  heartbeat.complete();
  assert.equal((await heartbeat.result).data.error, 'PAGE_CLOSED');
  // Existing grace is 10 s; no requests touch the lease during it.
  await sleep(10500);
  assert.equal((await fx.req('/api/session', fx.token)).data.authenticated, false);
});

// 300 끊기지 않는 섬 (나·다): SIGTERM (a test's own route where no signal reaches a handler) -- every open lobby stream gets
// 'restart' before the server goes; /ready answers once the store is ready (JSON here: at once)
test('끌 때 열린 대기방 SSE에 restart를 먼저 보내고 꺼진다, /ready는 준비되면 200', async t => {
  const fx = await fixture(t);
  assert.equal((await fetch(fx.base + '/ready')).status, 200);
  const abort = new AbortController(); t.after(() => abort.abort());
  const res = await fetch(fx.base + '/api/lobby/events', { headers: { 'X-Session-Token': fx.token }, signal: abort.signal });
  const reader = res.body.getReader(); const decoder = new TextDecoder(); let text = '';
  const reading = (async () => { try { for (;;) { const { value, done } = await reader.read(); if (done) break; text += decoder.decode(value, { stream: true }); } } catch {} })();
  await sleep(300);
  const started = Date.now();
  if (process.platform === 'win32') assert.equal((await fx.req('/api/test/shutdown', fx.token, {})).status, 200); else fx.stop();
  await reading;
  assert.match(text, /^event: restart$/m);
  for (let k = 0; k < 40 && (await fetch(fx.base + '/health').then(() => true, () => false)); k += 1) await sleep(100);
  assert.equal(await fetch(fx.base + '/health').then(() => true, () => false), false, '꺼짐');
  assert.ok(Date.now() - started < 3500, `${Date.now() - started} ms`);
});