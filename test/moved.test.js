'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { movedTarget } = require('../lib/moved');

// v1.10.256 주소 옮기기 14절: the old service with MOVED_TO points everyone to island-dalmaru and never opens the database
// -- a page 「옮겼어요」 (the island's on after 3 s, the messenger's not: an old installed app should not jump out), an API
// call 410, an entry file's POST 307 to the same path there; /health still answers (Render's check)
test('옛 주소 MOVED_TO: DB 연결 없이 안내 페이지·API 410·/guest-entry 307·/health', async (t) => {
  const to = 'https://island-dalmaru.onrender.com';
  assert.deepEqual(movedTarget(to, '/'), { url: `${to}/island/`, what: '아일랜드', auto: true });
  assert.deepEqual(movedTarget(to + '/', '/messenger.html'), { url: `${to}/messenger`, what: '메신저', auto: false });
  // the moved server in this process (no database to it at all -- a child server.js killed under Windows' open sockets
  // ended the test run with a libuv assertion); server.js starting it before any store is checked from its source below
  const srv = require('../lib/moved').startMoved({ to, port: 0, host: '127.0.0.1' }); await new Promise((r) => srv.once('listening', r));
  t.after(() => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }));
  const base = `http://127.0.0.1:${srv.address().port}`; const out = '';
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.moved, to); assert.equal(health.version, require('../package.json').version);
  const page = await fetch(base + '/'); const html = await page.text();
  assert.equal(page.status, 200); assert.match(html, /island-dalmaru\.onrender\.com\/island\//); assert.match(html, /http-equiv="refresh" content="3;url=https:\/\/island-dalmaru\.onrender\.com\/island\/"/);
  const msg = await (await fetch(base + '/messenger')).text(); assert.match(msg, /island-dalmaru\.onrender\.com\/messenger/); assert.doesNotMatch(msg, /http-equiv="refresh"/);
  const api = await fetch(base + '/api/plaza/state', { method: 'POST' }); assert.equal(api.status, 410); assert.equal((await api.json()).to, to);
  const entry = await fetch(base + '/guest-entry', { method: 'POST', body: 'token=abc', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });
  assert.deepEqual([entry.status, entry.headers.get('location')], [307, `${to}/guest-entry`]); await entry.arrayBuffer(); // (its body read: an unread one held its socket past the end -- Windows' libuv assertion at exit)
  assert.doesNotMatch(out, /PostgreSQL|ECONNREFUSED|포인트 저장소/, out);
  // and the server checks it before any store is made
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'); const main = src.slice(src.indexOf('async function main()'));
  assert.ok(main.indexOf('process.env.MOVED_TO') < main.indexOf('createAccessStore'));
});
