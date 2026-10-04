'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

// v1.10.6 기부 리뷰 후속 (PR #129 Codex P1·P2): a retried donation with the same request id is burned once, and an
// amount over the store's cap is a 400 (it was a 500).
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'donation-server-test';

async function boot(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'donation-server-'));
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

test('기부: 같은 요청 ID 재전송은 한 번만 차감, 상한 초과는 400', async (t) => {
  const { req, guest, grant, logs } = await boot(t);
  const a = await guest('기부재시도');
  assert.ok(a.session, logs());
  assert.equal((await grant(a, 100_000)).status, 200, logs());
  const before = (await req('/api/donation', a.session)).data.balance;
  const requestId = crypto.randomUUID();
  const first = await req('/api/donation', a.session, { amount: 30_000, requestId });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  const again = await req('/api/donation', a.session, { amount: 30_000, requestId }); // the answer was lost; the same press again
  assert.equal(again.status, 200, JSON.stringify(again.data));
  const after = (await req('/api/donation', a.session)).data;
  assert.equal(after.balance, before - 30_000, '한 번만 차감');
  assert.equal(after.myTotal, 30_000);
  const huge = await req('/api/donation', a.session, { amount: 1_000_000_001, requestId: crypto.randomUUID() });
  assert.equal(huge.status, 400, JSON.stringify(huge.data));
  assert.equal(huge.data.error, 'BAD_AMOUNT', JSON.stringify(huge.data));
  assert.equal((await req('/api/donation', a.session)).data.balance, before - 30_000);
});
