'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// 문제 기록 저장 정리 (2026-10-21): the records written before keep their pictures, moved out of the list on the first
// request; solved ones lose the picture after 7 days and go after 30; each change is one `[issue]` server-log line.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const PASSWORD = 'issue-test';
const DAY = 86400e3;

test('문제 기록 저장: 옛 기록 사진 옮기기, 해결 7일·30일 정리, 사진은 한 장씩, 로그 한 줄', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'issue-log-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const shot = `data:image/jpeg;base64,${'A'.repeat(400)}`; const now = Date.now();
  const old = (id, extra) => ({ id, at: now - 60 * DAY, version: '1.10.110', kind: 'bug', status: 'open', text: `기록 ${id}`, ctx: {}, shot, by: { id: 'admin', label: '관리자' }, ...extra });
  await fs.writeFile(path.join(dir, 'points.json'), JSON.stringify({ accounts: {}, ledger: [], island: { bags: {}, days: {}, world: { issueLog: [
    old('open1'), old('done8', { status: 'done', changedAt: now - 8 * DAY }), old('done40', { status: 'done', changedAt: now - 40 * DAY }), old('noshot', { shot: null }),
  ] } } }));
  const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; child.stdout.on('data', (d) => { logs += d; }); child.stderr.on('data', (d) => { logs += d; });
  t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 4000).unref(); }); } });
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await sleep(100); }
  assert.equal(child.exitCode, null, logs);
  const req = async (route, token, body) => {
    const headers = { 'X-Forwarded-For': '10.77.0.1' }; if (token) headers['X-Session-Token'] = token; if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken; assert.ok(admin, logs);

  const list = (await req('/api/admin/issues', admin)).data.issues;
  assert.deepEqual(list.map((i) => [i.id, i.hasShot, 'shot' in i]), [['open1', true, false], ['done8', false, false], ['noshot', false, false]]);
  assert.equal((await req('/api/admin/issues/open1/shot', admin)).data.shot, shot);
  assert.equal((await req('/api/admin/issues/done8/shot', admin)).status, 404);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'points.json'), 'utf8')).island.world;
  assert.equal(saved['issueShot:open1'], shot); assert.ok(!('issueShot:done8' in saved) && !('issueShot:done40' in saved));
  assert.ok(!JSON.stringify(saved.issueLog).includes('base64'));

  assert.equal((await req('/api/admin/issues', admin, { action: 'add', kind: 'odd', text: '새 기록\n둘째 줄', shot, ctx: { screen: 'island', island: { x: 1, z: 2, space: 'island' } } })).status, 201);
  const added = (await req('/api/admin/issues', admin)).data.issues[0]; assert.equal(added.hasShot, true);
  assert.equal((await req('/api/admin/issues', admin, { action: 'status', id: 'open1', status: 'done' })).status, 200);
  assert.equal((await req('/api/admin/issues', admin, { action: 'delete', id: added.id })).status, 200);
  assert.equal((await req(`/api/admin/issues/${added.id}/shot`, admin)).status, 404);
  await sleep(200);
  const lines = logs.split('\n').filter((l) => l.startsWith('[issue] ')).map((l) => JSON.parse(l.slice(8)));
  assert.deepEqual(lines.map((l) => [l.event, l.id === added.id ? 'new' : l.id]), [['expire', 'done40'], ['add', 'new'], ['status', 'open1'], ['delete', 'new']]);
  assert.equal(lines[1].text, '새 기록 둘째 줄'); assert.ok(!logs.includes('base64'));
});
