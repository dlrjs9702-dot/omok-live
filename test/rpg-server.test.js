'use strict';

// 잿빛 원정 through the real server (JSON stores, no database).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

async function startServer(dataDir, port) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'gostop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i += 1) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return proc; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server failed: ${output}`);
}

async function stopServer(proc) {
  if (proc.exitCode !== null) return;
  proc.kill('SIGTERM');
  await new Promise(resolve => { proc.once('exit', resolve); setTimeout(resolve, 3000).unref(); });
}

test('잿빛 원정 서버: 역할·시작 권한·관전자 차단·실시간 틱·입력·성장 선택·포기·다시 준비·vendor 허용 목록', { timeout: 60_000 }, async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rpg-server-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = await startServer(dataDir, port);
  t.after(async () => { await stopServer(proc); await fs.rm(dataDir, { recursive: true, force: true }); });
  let ipCounter = 0;
  async function req(route, token, body, method = 'POST') {
    const headers = { 'X-Forwarded-For': `10.81.0.${(ipCounter = (ipCounter % 250) + 1)}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function enter(html) {
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '10.82.0.1' }, body: new URLSearchParams({ token }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)[1];
  }
  const admin = (await req('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  const guest = async label => enter((await req('/api/admin/keys', admin, { label })).data.html);
  const [a, b, w] = [await guest('가'), await guest('나'), await guest('관')];

  const health = await req('/health', null, undefined, 'GET');
  assert.ok(health.data.games.includes('rpg'));
  const created = await req('/api/rooms', a, { gameType: 'rpg' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (const token of [b, w]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', a, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b, { choice: '4' })).status, 200);
  assert.equal((await req('/api/room/choose-role', w, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/rpg-class', w, { cls: 'hunter' })).status, 403, '관전자는 역할 선택 불가');
  assert.equal((await req('/api/room/rpg-class', a, { cls: 'cleric' })).status, 409, '미구현 역할 거부');
  assert.equal((await req('/api/room/rpg-class', a, { cls: 'guardian' })).status, 200);
  assert.equal((await req('/api/room/rpg-start', a, {})).status, 409, '모두 역할을 골라야 시작');
  assert.equal((await req('/api/room/rpg-class', b, { cls: 'guardian' })).status, 200, '같은 역할 중복 허용');
  assert.equal((await req('/api/room/rpg-start', b, {})).status, 403, '방장만 시작');

  // Live stream: roomState plus 20 Hz rpgTick events on the same connection.
  const controller = new AbortController();
  const stream = await fetch(base + '/api/room/events', { headers: { 'X-Session-Token': a, Accept: 'text/event-stream' }, signal: controller.signal });
  const streamB = await fetch(base + '/api/room/events', { headers: { 'X-Session-Token': b, Accept: 'text/event-stream' }, signal: controller.signal });
  t.after(() => controller.abort());
  const started = await req('/api/room/rpg-start', a, {});
  assert.equal(started.status, 200);
  const g = started.data.state.game;
  assert.deepEqual([g.status, g.phase, g.partySize, g.seatOrder], ['playing', 'combat', 2, ['1', '4']]);
  assert.equal((await req('/api/room/rpg-input', w, { mv: 1 })).status, 403, '관전자 조작 불가');

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const readFor = async (ms) => { const until = Date.now() + ms; while (Date.now() < until) { const chunk = await Promise.race([reader.read(), new Promise(r => setTimeout(() => r(null), until - Date.now()))]); if (!chunk || chunk.done) break; text += decoder.decode(chunk.value, { stream: true }); } };
  void streamB;
  await readFor(1000);
  const ticks = [...text.matchAll(/event: rpgTick\ndata: (.+)\n/g)].map(m => JSON.parse(m[1]));
  assert.ok(ticks.length >= 10, `틱 수 ${ticks.length}`);
  const first = ticks[ticks.length - 1].p.find(p => p.s === '1');

  // Held-key intent: move right; the server moves the character (the client never sends positions).
  const moved = await req('/api/room/rpg-input', a, { mv: 8, atk: false, x: 999, z: 999 });
  assert.deepEqual(moved.data, { ok: true });
  text = '';
  await readFor(600);
  await req('/api/room/rpg-input', a, { mv: 0, atk: false });
  const later = [...text.matchAll(/event: rpgTick\ndata: (.+)\n/g)].map(m => JSON.parse(m[1])).pop().p.find(p => p.s === '1');
  assert.ok(later.x > first.x + 1, `서버 이동 ${first.x} → ${later.x}`);
  assert.ok(later.x < 50, '클라이언트 좌표는 무시');
  const act = await req('/api/room/rpg-act', a, { a: 'q' });
  assert.equal(act.status, 200);
  assert.equal((await req('/api/room/rpg-act', a, { a: 'w' })).data.reason, 'no-skill');
  assert.equal((await req('/api/room/rpg-pick', a, { index: 0 })).status, 409, '전투 중에는 성장 선택 불가');
  assert.equal((await req('/api/room/rpg-act', a, { a: 'kill-all', damage: 99999 })).data.reason, 'bad-action');

  // Give up: the party's run ends (co-op, no win/loss record), then back to role selection.
  assert.equal((await req('/api/room/resign', w, {})).status, 409);
  const quit = await req('/api/room/resign', b, {});
  assert.equal(quit.status, 200);
  assert.deepEqual([quit.data.state.game.status, quit.data.state.game.result.kind, quit.data.state.game.result.reason], ['finished', 'defeat', 'abandon']);
  const again = await req('/api/room/next-round', a, {});
  assert.equal(again.status, 200);
  assert.equal(again.data.state.game.status, 'selecting');
  assert.deepEqual(again.data.state.game.classes, { 1: 'guardian', 4: 'guardian' }, '역할 선택은 유지, 성장은 초기화');
  assert.deepEqual(again.data.state.game.players, {});

  // Vendor route: exactly the two three.js files, gzip-compressed; nothing else under node_modules.
  const three = await fetch(base + '/vendor/three/three.module.js', { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(three.status, 200);
  assert.match(three.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/vendor/three/package.json')).status, 404);
  assert.equal((await fetch(base + '/vendor/../node_modules/pg/package.json')).status, 404);
  assert.equal((await fetch(base + '/rpg/rpg-client.js')).status, 200);
});
