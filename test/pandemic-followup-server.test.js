'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { launch } = require('../tests/support/pandemic-server.cjs');

for (const count of [2, 4]) test(`팬데믹 ${count}인: pending 복구·예측 권한·종료·재대결`, { timeout: 40000 }, async t => {
  const server = await launch(); t.after(server.close);
  let ip = 0;
  async function req(route, token, body) {
    const response = await fetch(server.baseURL + route, { method: body === undefined ? 'GET' : 'POST', headers: {
      'Content-Type': 'application/json', 'X-Forwarded-For': `10.57.${Math.floor(++ip / 200)}.${ip % 200 + 1}`, ...(token ? { 'X-Session-Token': token } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  const tokens = [];
  for (let i = 0; i < count + 1; i++) tokens.push((await req('/api/admin/login', null, { password: 'playwright-test-password' })).data.sessionToken);
  const [host, second] = tokens; const watcher = tokens.at(-1);
  const code = (await req('/api/rooms', host, { gameType: 'pandemic' })).data.state.me.roomCode;
  for (const token of tokens.slice(1)) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  for (let i = 0; i < count; i++) await req('/api/room/choose-role', tokens[i], { choice: String(i + 1) });
  await req('/api/room/choose-role', watcher, { choice: 'spectator' });
  await req('/api/room/start-pandemic', host, {});
  const act = (token, action) => req('/api/room/pandemic-act', token, { action });
  const view = async token => (await req('/api/room', token)).data.state;
  const same = async () => {
    const g = (await view(host)).game;
    for (const token of tokens) {
      const s = await view(token); assert.deepEqual(s.game, g);
      assert.equal('playerDeck' in s.game, false); assert.equal('infectionDeck' in s.game, false);
      assert.equal(s.game.pending?.cards, undefined);
    }
    return g;
  };
  await act(host, { type: 'pass' });
  assert.equal((await same()).pending.type, 'discard');
  assert.equal((await req('/api/rooms/join', host, { code })).data.state.game.pending.type, 'discard');
  await act(host, { type: 'event', event: 'forecast' });
  const forecast = (await view(host)).me.myPandemic.forecast;
  assert.equal(forecast.length, 6);
  assert.equal((await view(second)).me.myPandemic.forecast, null);
  assert.equal((await view(watcher)).me.myPandemic, null);
  assert.deepEqual((await req('/api/rooms/join', host, { code })).data.state.me.myPandemic.forecast, forecast);
  assert.equal((await act(second, { type: 'forecast-order', order: forecast })).status, 409);
  assert.equal((await act(host, { type: 'forecast-order', order: Array(6).fill(forecast[0]) })).status, 409);
  await same();
  await act(host, { type: 'forecast-order', order: [...forecast].reverse() });
  assert.equal((await same()).pending.type, 'discard', '원래 버리기로 복귀·두 번째 카드 획득');
  await act(host, { type: 'event', event: 'grant', city: 'sydney', remove: 'essen' });
  assert.equal((await same()).pending.type, 'window');
  await act(host, { type: 'event', event: 'airlift', pawn: '2', to: 'tokyo' });
  assert.equal((await same()).pending.owner, '2');
  assert.equal((await req('/api/rooms/join', second, { code })).data.state.game.pending.kind, 'airlift');
  await act(second, { type: 'respond', accept: true });
  assert.equal((await same()).pending.type, 'window');
  assert.equal((await view(host)).game.pawns['2'], 'tokyo');
  await req('/api/room/resign', second, {});
  const ended = await same(); assert.equal(ended.status, 'finished'); assert.deepEqual(ended.winner, []);
  assert.equal(ended.pending, null); assert.equal(ended.resume, null); assert.equal(ended.phase, null);
  assert.equal((await act(host, { type: 'pass' })).status, 409);
  assert.equal((await req('/api/room/resign', host, {})).status, 409);
  assert.deepEqual((await same()), ended, '중복 종료와 실패한 행동은 결과를 바꾸지 않는다');
  assert.deepEqual((await req('/api/rooms/join', second, { code })).data.state.game, ended);
  assert.equal((await req('/api/room/rematch', host, {})).status, 200);
  const reset = await same(); assert.equal(reset.status, 'selecting'); assert.equal(reset.round, 2);
  assert.equal(reset.pending, null); assert.deepEqual(reset.hands, {}); assert.deepEqual(reset.removedInfection, []);
});
