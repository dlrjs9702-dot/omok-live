'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

test('할리갈리 서버: 6인 자리, 관전자 권한, 동시 종 입력과 실시간 차례', { timeout: 30000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'halli-server-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'halli-test-password', NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const login = async () => (await req('/api/admin/login', null, { password: 'halli-test-password' })).data.sessionToken;
  const players = await Promise.all(Array.from({ length: 2 }, () => login()));
  const watcher = await login();
  const created = await req('/api/rooms', players[0], { gameType: 'halligalli' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.maxPlayers, 6);
  const code = created.data.state.me.roomCode;
  for (const token of [...players.slice(1), watcher]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  for (let i = 0; i < players.length; i++) assert.equal((await req('/api/room/choose-role', players[i], { choice: String(i+1) })).status, 200);
  assert.equal((await req('/api/room/choose-role', watcher, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/set-halligalli-time', players[0], { minutes: 10 })).status, 200);
  assert.equal((await req('/api/room/start-halligalli', players[1], {})).status, 403);
  const start = await req('/api/room/start-halligalli', players[0], {});
  assert.equal(start.status, 200);
  assert.equal(start.data.state.game.seatOrder.length, 2);
  assert.ok(Object.values(start.data.state.game.pileCounts).every(n => n === 28));
  assert.equal(JSON.stringify(start.data.state.game).includes('"piles"'), false);
  const turn = Number(start.data.state.game.turn);
  assert.equal((await req('/api/room/flip-halligalli', watcher, { expectedRevision: start.data.state.game.revision })).status, 403);
  assert.equal((await req('/api/room/ring-halligalli', watcher, { expectedFlipId: 0 })).status, 403);
  assert.equal((await req('/api/room/flip-halligalli', players[turn - 1], { expectedRevision: -1 })).status, 409);
  const flip = await req('/api/room/flip-halligalli', players[turn - 1], { expectedRevision: start.data.state.game.revision });
  assert.equal(flip.status, 200);
  const id = flip.data.state.game.flipId;
  await new Promise(resolve => setTimeout(resolve, 320));
  const rings = await Promise.all(players.slice(0,2).map(token => req('/api/room/ring-halligalli', token, { expectedFlipId: id })));
  assert.ok(rings.every(r => r.status === 200));
  const after = (await req('/api/room', watcher, undefined, 'GET')).data.state.game;
  assert.ok(after.bellLog.filter(entry => entry.type === 'ring' && entry.correct).length <= 1);
  assert.equal(after.bellLog.filter(entry => entry.type === 'ring' || entry.type === 'late').length, 2);
  assert.equal(after.status, 'playing');
});
