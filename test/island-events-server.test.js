'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// v1.10.11 서버 공용 랜덤 이벤트: everyone shares the same events; a player is told only of those near; one solve
// each (the second gets 「이미 사라졌습니다」), and a new one keeps the island at 15.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'island-events-test';

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
    const headers = { 'X-Forwarded-For': `10.55.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
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

test('공용 이벤트: 가까운 것만 알리고, 먼저 해결한 한 사람만 받으며, 다시 15개가 된다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'island-events-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const [a, b] = [await server.enter(await server.issue('이벤트에이')), await server.enter(await server.issue('이벤트비'))];
  assert.ok(a && b, server.logs());
  const all = async () => (await req('/api/test/island/events', a)).data.events;
  const list = await all();
  assert.equal(list.length, 15);
  const stand = (s, p) => req('/api/plaza/state', s, { x: p.x, z: p.z, yaw: 0, moving: false });
  const far = await stand(a, { x: 0, z: 8 });
  for (const ev of far.data.events) assert.ok(Math.hypot(ev.x, ev.z - 8) <= 90.01, '가까운 것만');
  assert.ok(far.data.events.length < 16);

  const finds = list.filter((e) => !e.npc);
  const first = finds[0];
  assert.equal((await req('/api/island/event', a, { id: first.id })).data.error, 'TOO_FAR');
  await stand(a, first); await stand(b, first);
  const got = await req('/api/island/event', a, { id: first.id });
  assert.equal(got.status, 200, JSON.stringify(got.data));
  const late = await req('/api/island/event', b, { id: first.id });
  assert.equal(late.data.error, 'EVENT_GONE');
  const after = await all();
  assert.equal(after.length, 15, '다시 15개');
  assert.ok(!after.some((e) => e.id === first.id));
  const bag = (await req('/api/island/bag', a)).data;
  const balance = (await req('/api/donation', a)).data.balance;
  assert.ok(bag.items.length > 0 || balance > 100_000, '받은 것이 있다');

  // two at once: one of them
  const second = after.find((e) => !e.npc && e.id !== first.id);
  await stand(a, second); await stand(b, second);
  const both = await Promise.all([req('/api/island/event', a, { id: second.id }), req('/api/island/event', b, { id: second.id })]);
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409], JSON.stringify(both.map((r) => r.data)));
});
