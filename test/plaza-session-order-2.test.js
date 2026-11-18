'use strict';
// split from plaza-session-order.test.js (1.10.362, #513: each test boots its own server, ~11 s on CI -- the file passed the runner's 120 s a file, so it is split)
const test = require('node:test');
const assert = require('node:assert/strict');
const { sleep } = require('../test-support/test-server');
const { hold, fixture } = require('../test-support/session-order');

test('열린 광장 SSE는 위치 전송이 15초 멈춰도 캐릭터를 유지하고 실제 닫으면 제거한다', async t => {
  const fx = await fixture(t);
  const sentAt = Date.now() - 1000;
  const pose = await fx.req('/api/plaza/state', fx.token, { x: 25, z: 4, t: sentAt });
  const abort = new AbortController(); t.after(() => abort.abort());
  const res = await fetch(fx.base + '/api/lobby/events', { headers: { 'X-Session-Token': fx.token }, signal: abort.signal });
  assert.equal(res.status, 200);
  const reader = res.body.getReader(); let latest; let buffer = '';
  const decoder = new TextDecoder();
  const reading = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2);
          if (/^event: plaza$/m.test(frame)) latest = JSON.parse(frame.match(/^data: (.*)$/m)[1]);
        }
      }
    } catch (e) { if (e.name !== 'AbortError') throw e; }
  })();
  await sleep(16500);
  // Force a snapshot from another player after the expiry boundary.
  const observer = await fx.enter(await fx.issue('관찰'));
  await fx.req('/api/plaza/state', observer, { x: 0, z: 8 });
  await sleep(400);
  assert.ok(latest.players.some(p => p.id === pose.data.id), 'live SSE retained');
  assert.equal(latest.players.find(p => p.id === pose.data.id).t, sentAt, 'snapshot uses sender clock only for drawing');
  abort.abort(); await reading; await sleep(300);
  const check = await fetch(fx.base + '/api/lobby/events', { headers: { 'X-Session-Token': observer } });
  const checkReader = check.body.getReader();
  let text = '';
  while (!text.includes('event: plaza\n')) { const { value, done } = await checkReader.read(); if (done) break; text += decoder.decode(value); } // (CI 2차: read() at a stream's end answers at once, forever -- the loop froze the whole run)
  await checkReader.cancel();
  const frame = text.split('\n\n').find(f => f.startsWith('event: plaza\n'));
  assert.ok(frame, text);
  assert.equal(JSON.parse(frame.match(/^data: (.*)$/m)[1]).players.some(p => p.id === pose.data.id), false);
});

test('스무고개 출제자: 같은 단계로 재접속해도 사용한 제한 시간을 새로 받지 않는다', async t => {
  const fx = await fixture(t);
  const b = await fx.enter(await fx.issue('도전자'));
  const created = await fx.req('/api/rooms', fx.token, { gameType: 'twentyquestions' });
  assert.equal(created.status, 201);
  await fx.req('/api/rooms/join', b, { code: created.data.state.me.roomCode });
  await fx.req('/api/room/choose-role', fx.token, { choice: '1' });
  await fx.req('/api/room/choose-role', b, { choice: '2' });
  async function stream(token) {
    const abort = new AbortController(); t.after(() => abort.abort());
    const res = await fetch(fx.base + '/api/room/events', { headers: { 'X-Session-Token': token }, signal: abort.signal });
    assert.equal(res.status, 200);
    const reading = (async () => { try { for await (const _ of res.body) {} } catch (e) { if (e.name !== 'AbortError') throw e; } })();
    return async () => { abort.abort(); await reading; await sleep(150); };
  }
  const close = await stream(fx.token); const closeB = await stream(b);
  await fx.req('/api/room/twenty-start', fx.token, { mode: 'individual', totalRounds: 1 });
  const before = (await fx.req('/api/room', fx.token)).data.state.me.actionTimer;
  assert.ok(before?.deadlineAt);
  await sleep(700); await close(); await sleep(600); const closeAgain = await stream(fx.token);
  const after = (await fx.req('/api/room', fx.token)).data.state;
  assert.equal(after.game.status, 'playing');
  assert.equal(after.game.phase, 'secret');
  assert.equal(after.me.actionTimer.deadlineAt, before.deadlineAt);
  await closeAgain(); await closeB();
});

test('새 문서 heartbeat가 끝나면 첫 heartbeat가 미완료인 옛 문서의 늦은 해제·heartbeat를 무시한다', async t => {
  const fx = await fixture(t);
  const old = hold(fx.base, '/api/session/heartbeat', fx.token, { page: 'unseen-old', sequence: 1 });
  await sleep(150);
  assert.equal((await fx.req('/api/session/heartbeat', fx.token, { page: 'current', sequence: 2 })).status, 200);
  await fx.req('/api/session/release', null, { sessionToken: fx.token, page: 'unseen-old', sequence: 1 });
  old.complete();
  assert.equal((await old.result).data.error, 'PAGE_REPLACED');
  // Query without touching until the old grace would have expired.
  await sleep(10500);
  assert.equal((await fx.req('/api/session', fx.token)).data.authenticated, true);
  assert.equal((await fx.req('/api/session/heartbeat', fx.token, { page: 'current', sequence: 2 })).status, 200);
});
