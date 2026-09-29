'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.7.5: 실제 서버 시계로 자동 뒤집기가 약 5초 뒤에 일어나고, 공개 마감(deadlineAt)이 그와 일치하는지 확인한다.
test('할리갈리 서버: 무응답 5초 뒤 자동 뒤집기, 5초 전 직접 뒤집기는 중복되지 않는다', { timeout: 40_000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'halli-auto-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'halli-auto-pw', NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { proc.kill(); await fs.rm(dir, { recursive: true, force: true }); });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  async function req(route, token, body, method = 'POST') {
    const response = await fetch(base + route, { method, headers: {
      ...(token ? { 'X-Session-Token': token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const login = async () => (await req('/api/admin/login', null, { password: 'halli-auto-pw' })).data.sessionToken;
  const players = await Promise.all([login(), login()]);
  const created = await req('/api/rooms', players[0], { gameType: 'halligalli' });
  const code = created.data.state.me.roomCode;
  assert.equal((await req('/api/rooms/join', players[1], { code })).status, 200);
  for (let i = 0; i < 2; i++) assert.equal((await req('/api/room/choose-role', players[i], { choice: String(i + 1) })).status, 200);
  const started = await req('/api/room/start-halligalli', players[0], {});
  assert.equal(started.status, 200);
  const game = started.data.state.game;
  // 공개 상태의 마감은 서버 시각 기준 5초(전송 지연 여유 포함).
  const window = game.deadlineAt - game.serverNow;
  assert.ok(window > 4500 && window <= 5000, `마감까지 ${window}ms`);
  const state = async () => (await req('/api/room', players[0], undefined, 'GET')).data.state.game;
  await new Promise(resolve => setTimeout(resolve, 3600));
  assert.equal((await state()).moveCount, 0, '3초를 넘겨도(예전 마감) 자동으로 뒤집지 않는다');
  await new Promise(resolve => setTimeout(resolve, 1900));
  const flipped = await state();
  assert.equal(flipped.moveCount, 1, '약 5초 뒤 서버가 대신 뒤집는다');
  assert.notEqual(flipped.turn, game.turn);
  // 새 차례도 새 5초 창을 받고, 그 안에 직접 뒤집으면 자동 뒤집기가 겹치지 않는다.
  const next = await req('/api/room/flip-halligalli', players[Number(flipped.turn) - 1], { expectedRevision: flipped.revision });
  assert.equal(next.status, 200);
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal((await state()).moveCount, 2);
});
