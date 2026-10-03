'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const ClimbSim = require('../public/climb/climb-sim.js');

// v1.9.4 상시 등반 도전 through the real server: only inputs move a climber, a record exists only after ending standing
// safely, leaving or refreshing never records, and a client number is never a record.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'climb-test';

async function boot(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'climb-'));
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

test('등반 서버: 입력으로만 움직이고, 안전하게 서서 끝내야 기록되며, 클라이언트 숫자는 무시된다', { timeout: 60000 }, async (t) => {
  const fx = await boot(t);
  const a = await fx.guest('등반가');
  assert.equal((await fx.req('/api/climb', null)).status, 401);
  const view = await fx.req('/api/climb', a.session);
  assert.equal(view.status, 200);
  assert.deepEqual([view.data.today, view.data.active], [{ best: 0, paid: 0 }, null]);
  assert.equal((await fx.req('/api/climb/end', a.session, {})).status, 409, '시작 전에는 끝낼 수 없다');

  const started = await fx.req('/api/climb/start', a.session, {});
  assert.equal(started.status, 200);
  const id = started.data.active.id;
  // inputs move the climber exactly like the shared simulation
  const local = ClimbSim.newState();
  const inputs = Array.from({ length: 20 }, (_, i) => ClimbSim.BIT.right | (i === 0 ? ClimbSim.BIT.jump : 0));
  for (const input of inputs) ClimbSim.step(local, input);
  await sleep(700); // earn the ticks (real time limits how fast a climb can run)
  const moved = await fx.req('/api/climb/input', a.session, { tick: 0, inputs });
  assert.equal(moved.status, 200);
  assert.deepEqual(moved.data.state, local, '서버와 브라우저가 같은 결과');
  const stale = await fx.req('/api/climb/input', a.session, { tick: 0, inputs: [ClimbSim.BIT.right] });
  assert.equal(stale.data.state.tick, local.tick, '다른 틱에서 시작한 묶음은 무시');
  const floodStart = Date.now(); let tick = local.tick;
  for (let i = 0; i < 6; i += 1) tick = (await fx.req('/api/climb/input', a.session, { tick, inputs: Array(60).fill(ClimbSim.BIT.right) })).data.state.tick;
  const allowed = ((Date.now() - floodStart) / 1000) * 30 + 90 + 30; // real time + the 3 s burst (+1 s of slack)
  assert.ok(tick - local.tick <= allowed && tick - local.tick < 360, `실제 시간보다 빨리 진행할 수 없다 (${tick - local.tick} 틱)`);

  // in the air: cannot end; standing on a 300 m-ish shelf: ends with that altitude, whatever the body says
  assert.equal((await fx.req('/api/test/climb/place', a.session, { y: 300, air: true })).status, 200);
  const air = await fx.req('/api/climb/end', a.session, { altitude: 3000 });
  assert.deepEqual([air.status, air.data.error], [409, 'CLIMB_NOT_SAFE']);
  await fx.req('/api/test/climb/place', a.session, { y: 300 });
  const ended = await fx.req('/api/climb/end', a.session, { altitude: 3000, delta: 999999 });
  assert.equal(ended.status, 200);
  assert.deepEqual([ended.data.altitude, ended.data.delta], [300, 1000]);
  assert.equal((await fx.req('/api/climb/end', a.session, {})).status, 409, '끝난 등반은 다시 끝낼 수 없다(중복 지급 없음)');

  // a climb that went higher but was abandoned is never recorded
  const second = await fx.req('/api/climb/start', a.session, {});
  assert.notEqual(second.data.active.id, id);
  await fx.req('/api/test/climb/place', a.session, { y: 2000 });
  assert.equal((await fx.req('/api/climb/abandon', a.session, {})).status, 200);
  assert.equal((await fx.req('/api/climb/end', a.session, {})).status, 409);
  // a climb that went high, fell back and ended: the altitude where it stands now
  await fx.req('/api/climb/start', a.session, {});
  await fx.req('/api/test/climb/place', a.session, { y: 900 });
  await fx.req('/api/test/climb/place', a.session, { y: 600 });
  const fell = await fx.req('/api/climb/end', a.session, {});
  assert.deepEqual([fell.data.altitude, fell.data.delta, fell.data.best], [600, 3000, 600], '최고점이 아니라 끝낸 높이');
  const status = await fx.req('/api/climb', a.session);
  assert.deepEqual(status.data.today, { best: 600, paid: 4000 });
  assert.deepEqual(status.data.ranking.top.map(r => [r.rank, r.best, r.me]), [[1, 600, true]]);
});

test('등반 서버: 새로고침(같은 계정의 새 세션)은 이어서 하고, 두 사람의 등반은 서로 막지 않는다', { timeout: 60000 }, async (t) => {
  const fx = await boot(t);
  const a = await fx.guest('하나');
  const b = await fx.guest('둘');
  await fx.req('/api/climb/start', a.session, {});
  await fx.req('/api/climb/start', b.session, {});
  await fx.req('/api/test/climb/place', a.session, { y: 120, x: 12 });
  await fx.req('/api/test/climb/place', b.session, { y: 120, x: 12 }); // the very same spot: no collision between climbers
  await sleep(300);
  const sa = await fx.req('/api/climb/input', a.session, { tick: 0, inputs: [0] });
  const sb = await fx.req('/api/climb/input', b.session, { tick: 0, inputs: [0] });
  assert.deepEqual([sa.data.state.x, sa.data.state.y], [sb.data.state.x, sb.data.state.y], '같은 자리에 함께 설 수 있다');
  assert.deepEqual(sa.data.others.map(o => o.name), ['둘'], '다른 등반자는 보이기만 한다');
  // the climb in progress survives a reconnect: GET shows it, start resumes it (same id)
  const view = await fx.req('/api/climb', a.session);
  const resumed = await fx.req('/api/climb/start', a.session, {});
  assert.equal(resumed.data.active.id, view.data.active.id);
  assert.equal(resumed.data.active.state.y, view.data.active.state.y);
});
