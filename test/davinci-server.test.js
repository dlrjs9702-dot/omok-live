'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

test('다빈치 코드: 서버는 다른 사람과 관전자에게 숫자를 숨기고 행동 권한을 검증한다', { timeout: 30000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'davinci-server-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'davinci-test-password', NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { proc.kill(); await fs.rm(dir, { recursive: true, force: true }); });
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);
  async function req(route, token, body, method = 'POST') {
    const response = await fetch(base + route, { method, headers: {
      ...(token ? { 'X-Session-Token': token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function login() { return (await req('/api/admin/login', null, { password: 'davinci-test-password' })).data.sessionToken; }
  const host = await login();
  const other = await login();
  const watcher = await login();
  const created = await req('/api/rooms', host, { gameType: 'davinci' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (const token of [other, watcher]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  for (const [token, choice] of [[host, '1'], [other, '2'], [watcher, 'spectator']]) {
    assert.equal((await req('/api/room/choose-role', token, { choice })).status, 200);
  }
  assert.equal((await req('/api/room/start-davinci', other, {})).status, 403);
  const started = await req('/api/room/start-davinci', host, {});
  assert.equal(started.status, 200);
  const g = started.data.state.game;
  const views = await Promise.all([host, other, watcher].map(token => req('/api/room', token, undefined, 'GET')));
  for (const view of views) {
    for (const hand of Object.values(view.data.state.game.hands)) for (const tile of hand) assert.equal(Object.hasOwn(tile, 'number'), false);
    assert.equal(Object.hasOwn(view.data.state.game.drawn, 'number'), false);
  }
  assert.equal(views[2].data.state.me.myDavinciTiles, null);
  assert.equal(views[2].data.state.me.myDavinciDrawn, null);
  assert.equal(views[0].data.state.me.myDavinciTiles.length, 4);
  const actor = g.turn === '1' ? host : other;
  const target = g.turn === '1' ? '2' : '1';
  const targetTile = g.hands[target][0];
  assert.equal((await req('/api/room/guess-davinci', watcher, { targetSeat: target, tileId: targetTile.id, number: 0, expectedRevision: g.revision })).status, 403);
  assert.equal((await req('/api/room/guess-davinci', actor, { targetSeat: target, tileId: targetTile.id, number: 0, expectedRevision: -1 })).status, 409);
  assert.equal((await req('/api/room/guess-davinci', actor, { targetSeat: target, tileId: targetTile.id, number: 0, expectedRevision: g.revision })).status, 200);
});
