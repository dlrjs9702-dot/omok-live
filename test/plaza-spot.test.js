'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { kstDate } = require('../lib/point-store');
const T = require('../public/plaza/island-terrain.js');

// v1.10.7 게임 아일랜드 당일 위치: the island starts where I last stood today (kept across a logout and a restart), a
// new day starts at the central plaza, and a spot nobody may stand on is never kept and is moved when it is used.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'plaza-spot-test';

async function boot(t, dir) {
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 4000).unref(); });
  };
  t.after(stop);
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body) {
    const headers = { 'X-Forwarded-For': `10.77.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  const issue = async (label) => {
    const issued = await req('/api/admin/keys', admin, { label });
    return { id: issued.data.key.id, key: issued.data.html.match(/name="token" value="([^"]+)"/)[1] };
  };
  const enter = async ({ key }) => {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  };
  const release = (session) => req('/api/session/release', session, {});
  return { req, issue, enter, release, stop, logs: () => logs };
}

test('게임 아일랜드 당일 위치: 저장·복원, 재시작 유지, 날짜 변경 시 중앙광장, 못 서는 곳은 저장 안 함·보정', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plaza-spot-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let server = await boot(t, dir);
  const who = await server.issue('위치복원');
  let session = await server.enter(who);
  assert.ok(session, server.logs());
  assert.equal((await server.req('/api/plaza/spot', session)).data.spot, null, '처음에는 중앙광장');

  const there = { x: 25, z: 4 }; // the shop street walk
  assert.ok(T.walkable(there.x, there.z));
  assert.equal((await server.req('/api/plaza/state', session, { ...there, yaw: 0, moving: false })).status, 200);
  assert.ok(!T.walkable(0, 120), '바다');
  assert.equal((await server.req('/api/plaza/state', session, { x: 0, z: 120, yaw: 0, moving: false })).status, 200);
  assert.deepEqual((await server.req('/api/plaza/spot', session)).data.spot, there, '바다 위치는 저장하지 않는다');
  assert.equal((await server.req('/api/plaza/leave', session, {})).status, 200); // a room, logout: saved now

  // a restart (the spot was written when I left), and a new login
  await server.stop();
  server = await boot(t, dir);
  session = await server.enter(who);
  assert.deepEqual((await server.req('/api/plaza/spot', session)).data.spot, there, '재시작·재접속 후에도 오늘 위치');
  await server.stop();

  // yesterday's spot is not used; a spot that is now in a stream moves to the nearest standable ground
  const file = path.join(dir, 'points.json');
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const userId = `guest:${who.id}`;
  data.plaza.spots[userId] = { day: kstDate(Date.now() - 86400000), x: 25, z: 4 };
  await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir);
  session = await server.enter(who);
  assert.equal((await server.req('/api/plaza/spot', session)).data.spot, null, '전날 위치는 무효(중앙광장)');
  await server.stop();

  const wet = T.streamCurves[0].find(([x, z], i) => i > 10 && !T.walkable(x, z)); // a point in the first stream
  assert.ok(!T.walkable(wet[0], wet[1]));
  data.plaza.spots[userId] = { day: kstDate(), x: wet[0], z: wet[1] };
  await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir);
  session = await server.enter(who);
  const moved = (await server.req('/api/plaza/spot', session)).data.spot;
  assert.ok(moved && T.walkable(moved.x, moved.z), JSON.stringify(moved));
  assert.ok(Math.hypot(moved.x - wet[0], moved.z - wet[1]) < 6, '가까운 곳으로 보정');
});
