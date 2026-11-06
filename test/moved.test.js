'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { movedTarget } = require('../lib/moved');

// v1.10.256 주소 옮기기 14절: the old service with MOVED_TO points everyone to island-dalmaru and never opens the database
// -- a page 「옮겼어요」 (the island's on after 3 s, the messenger's not: an old installed app should not jump out), an API
// call 410, an entry file's POST 307 to the same path there; /health still answers (Render's check)
test('옛 주소 MOVED_TO: DB 연결 없이 안내 페이지·API 410·/guest-entry 307·/health', async (t) => {
  const to = 'https://island-dalmaru.onrender.com';
  assert.deepEqual(movedTarget(to, '/'), { url: `${to}/island/`, what: '아일랜드', auto: true });
  assert.deepEqual(movedTarget(to + '/', '/messenger.html'), { url: `${to}/messenger`, what: '메신저', auto: false });
  // the real server: a database address nobody answers -- it must not try it
  const port = await require('../test-support/free-port')();
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, MOVED_TO: to, PORT: String(port), HOST: '127.0.0.1', DATABASE_URL: 'postgres://nobody:x@127.0.0.1:1/none', NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
  t.after(async () => { if (child.exitCode !== null) return; child.kill('SIGTERM'); await new Promise((r) => { child.once('exit', r); setTimeout(r, 4000).unref(); }); }); // (as test-server's stop: waited for)
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300 && child.exitCode === null; i += 1) { try { if ((await fetch(base + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 100)); }
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.moved, to); assert.equal(health.version, require('../package.json').version);
  const page = await fetch(base + '/'); const html = await page.text();
  assert.equal(page.status, 200); assert.match(html, /island-dalmaru\.onrender\.com\/island\//); assert.match(html, /http-equiv="refresh" content="3;url=https:\/\/island-dalmaru\.onrender\.com\/island\/"/);
  const msg = await (await fetch(base + '/messenger')).text(); assert.match(msg, /island-dalmaru\.onrender\.com\/messenger/); assert.doesNotMatch(msg, /http-equiv="refresh"/);
  const api = await fetch(base + '/api/plaza/state', { method: 'POST' }); assert.equal(api.status, 410); assert.equal((await api.json()).to, to);
  const entry = await fetch(base + '/guest-entry', { method: 'POST', body: 'token=abc', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  assert.deepEqual([entry.status, entry.headers.get('location')], [307, `${to}/guest-entry`]);
  assert.doesNotMatch(out, /PostgreSQL|ECONNREFUSED|포인트 저장소/, out);
  // and the server checks it before any store is made
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'); const main = src.slice(src.indexOf('async function main()'));
  assert.ok(main.indexOf('process.env.MOVED_TO') < main.indexOf('createAccessStore'));
});
