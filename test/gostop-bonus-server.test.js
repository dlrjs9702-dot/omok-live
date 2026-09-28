'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

for (const count of [2, 3]) test(`${count}인 첫뻑→2연뻑→자뻑: 즉시 포인트 정산과 중복 방지`, { timeout: 30_000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gostop-bonus-'));
  const port = await freePort();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'gostop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', data => { output += data; });
  proc.stderr.on('data', data => { output += data; });
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => proc.once('exit', resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (proc.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  let ip = 1;
  async function api(route, token, body, method = 'POST') {
    const res = await fetch(base + route, {
      method,
      headers: { 'X-Forwarded-For': `10.94.0.${ip++}`, ...(token ? { 'X-Session-Token': token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json() };
  }
  const admin = (await api('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  const people = [];
  for (let i = 1; i <= count; i += 1) {
    const issued = await api('/api/admin/keys', admin, { label: `참가자${i}` });
    const entry = await fetch(`${base}/guest-entry`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `10.95.0.${i}` },
      body: new URLSearchParams({ token: issued.data.html.match(/name="token" value="([^"]+)"/)[1] }).toString() });
    people.push((await entry.text()).match(/data-session="([^"]+)"/)[1]);
  }
  const created = await api('/api/rooms', people[0], { gameType: 'gostop' });
  const code = created.data.state.me.roomCode;
  for (let i = 1; i < count; i += 1) assert.equal((await api('/api/rooms/join', people[i], { code })).status, 200);
  for (let i = 0; i < count; i += 1) assert.equal((await api('/api/room/choose-role', people[i], { choice: String(i + 1) })).status, 200);
  const fixture = await api('/api/test/gostop-fixture', people[0], { fixture: 'first-ppeok' });
  assert.equal(fixture.status, 200);
  async function play(i, cardId) {
    const response = await api('/api/room/gostop-play', people[i - 1], { cardId });
    assert.equal(response.status, 200, JSON.stringify(response.data));
    return response.data.state.game;
  }
  let game = await play(1, 'm05-pi1');
  assert.ok(game.lastEvent.tags.includes('firstPpeok'));
  const perPayer = count === 2 ? 700 : 300;
  assert.equal(game.bonusAwards[0].paid, perPayer * (count - 1));
  assert.equal((await api('/api/room/gostop-play', people[0], { cardId: 'm05-pi1' })).status, 409);
  await play(2, 'm08-pi1');
  if (count === 3) await play(3, 'm10-pi1');
  game = await play(1, 'm06-pi1');
  assert.ok(game.lastEvent.tags.includes('secondPpeok'));
  assert.deepEqual(game.bonusAwards.map(award => award.paid), [perPayer * (count - 1), perPayer * 2 * (count - 1)]);
  await play(2, 'm09-pi1');
  if (count === 3) await play(3, 'm11-pi1');
  game = await play(1, 'm05-ribbon');
  assert.ok(game.lastEvent.tags.includes('jappeok'), JSON.stringify({ event: game.lastEvent, floor: game.floor }));
  assert.equal(game.lastEvent.stolen.length, (count - 1) * 2);
  const balances = await Promise.all(people.map(async token => (await api('/api/points', token, undefined, 'GET')).data));
  assert.equal(balances[0].balance, 100_000 + perPayer * 3 * (count - 1));
  for (const item of balances.slice(1)) assert.equal(item.balance, 100_000 - perPayer * 3);
  assert.equal(balances.reduce((sum, item) => sum + item.balance, 0), 100_000 * count);
  assert.deepEqual(balances.map(item => item.recentGostopSettlements.length), Array(count).fill(2));
  assert.equal(balances[0].recentGostopSettlements[0].balanceAfter, balances[0].balance);
  assert.equal((await api('/api/room', people[0], undefined, 'GET')).data.state.game.bonusAwards.length, 2);
  // Finish the same hand without a score: the in-hand bonus payouts survive a 나가리.
  game = await play(1, 'm04-pi2');
  assert.equal(game.status, 'draw');
  assert.equal(game.nagariStreak, 1);
  const afterDraw = await Promise.all(people.map(async token => (await api('/api/points', token, undefined, 'GET')).data.balance));
  assert.deepEqual(afterDraw, balances.map(item => item.balance));
  assert.equal((await api('/api/room/next-round', people[0], {})).status, 200);
  assert.equal((await api('/api/test/gostop-fixture', people[0], { fixture: 'go-bak' })).status, 200);
  assert.equal((await api('/api/room/gostop-decide', people[0], { choice: 'go' })).status, 200);
  game = await play(2, 'm03-ribbon');
  assert.equal(game.phase, 'go-stop');
  const stopped = await api('/api/room/gostop-decide', people[1], { choice: 'stop' });
  assert.equal(stopped.status, 200, JSON.stringify(stopped.data));
  game = stopped.data.state.game;
  assert.equal(game.result.winner, '2');
  assert.equal(game.result.nagariStreak, 1);
  assert.ok(game.result.losers.find(loser => loser.seat === '1').baks.includes('gobak'));
  assert.ok(game.result.losers.every(loser => loser.factors.some(factor => factor.key === 'nagari' && factor.multiplier === 2)));
  const final = await Promise.all(people.map(async token => (await api('/api/points', token, undefined, 'GET')).data.balance));
  assert.equal(final.reduce((sum, value) => sum + value, 0), 100_000 * count);
  for (const item of game.settlement.transfers) {
    const from = Number(item.fromSeat) - 1;
    assert.equal(final[from], afterDraw[from] - item.paid);
    assert.equal(item.requested, game.result.losers.find(loser => loser.seat === item.fromSeat).amount);
  }
  assert.equal(final[1], afterDraw[1] + game.settlement.transfers.reduce((sum, item) => sum + item.paid, 0));
  assert.equal((await api('/api/room/next-round', people[0], {})).status, 200);
  const afterRetry = await Promise.all(people.map(async token => (await api('/api/points', token, undefined, 'GET')).data.balance));
  assert.deepEqual(afterRetry, final);
});
