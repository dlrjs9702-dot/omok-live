'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

// v1.9.6 광장 플레이어 충돌: the server never stores a position inside another plaza player; it moves only the
// sender, to the nearest free spot, and says so in its answer.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'plaza-collision-test';

async function boot(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plaza-collision-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
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
  t.after(async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
  });
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'X-Forwarded-For': `10.88.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return { label, id: issued.data.key.id, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] };
  }
  const grant = (person, amount) => req(`/api/admin/keys/${person.id}/points`, admin, { requestId: crypto.randomUUID(), category: 'event', amount });
  return { req, guest, grant, logs: () => logs };
}

test('광장 충돌(서버): 다른 사람 자리에 그대로 좌표를 보내도 겹치지 않게 보내는 사람만 보정한다', { timeout: 60000 }, async (t) => {
  const fx = await boot(t);
  const a = await fx.guest('서있는사람');
  const b = await fx.guest('끼어드는사람');
  const c = await fx.guest('세번째');
  assert.equal((await fx.req('/api/plaza/state', a.session, { x: 2, z: 5, yaw: 0 })).data.corrected, false);
  // b sends exactly a's spot (a hand-made request): stored outside a, a not moved
  const same = await fx.req('/api/plaza/state', b.session, { x: 2, z: 5, yaw: 0 });
  assert.equal(same.status, 200);
  assert.equal(same.data.corrected, true);
  assert.ok(Math.hypot(same.data.x - 2, same.data.z - 5) >= 0.49, `떨어진 거리 ${Math.hypot(same.data.x - 2, same.data.z - 5)}`);
  assert.ok(Math.hypot(same.data.x - 2, same.data.z - 5) <= 0.6, '가장 가까운 자리로(멀리 튕기지 않음)');
  const again = await fx.req('/api/plaza/state', a.session, { x: 2, z: 5, yaw: 0 });
  assert.equal(again.data.corrected, false, '먼저 서 있던 사람은 그대로');
  // a near miss on the side keeps its side; far away is untouched
  const side = await fx.req('/api/plaza/state', c.session, { x: 2.3, z: 5.1, yaw: 0 });
  assert.equal(side.data.corrected, true);
  assert.ok(side.data.x > 2.3 - 0.001, '접촉면 바깥쪽(원래 있던 쪽)으로');
  const far = await fx.req('/api/plaza/state', c.session, { x: 6, z: 9, yaw: 0 }); // away from a, on c's side
  assert.deepEqual([far.data.corrected, far.data.x, far.data.z], [false, 6, 9]);
  // a jump straight through a (from c's spot to the other side) stops at the contact on c's side
  const through = await fx.req('/api/plaza/state', c.session, { x: 2, z: 5, yaw: 0 });
  const back = await fx.req('/api/plaza/state', c.session, { x: 1.9, z: 4.1, yaw: 0 }); // a walking-sized step straight through a
  assert.ok(through.data.corrected && back.data.corrected, '사람을 가로질러 건너뛸 수 없다');
  assert.ok(back.data.z > 5, `a의 반대편으로 넘어가지 않음 (${back.data.x}, ${back.data.z})`);
});
