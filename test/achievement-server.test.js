'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.7.20 daily missions through the real server: finished matches (resigned Othello) drive progress,
// missions and the first-win bonus pay once into the ledger, repeated requests never count a match twice,
// and the in-room stream tells each player their progress in short lines.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'achievement-test';

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function boot(t, dataDir) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data.toString(); });
  child.stderr.on('data', data => { logs += data.toString(); });
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
    const headers = { 'X-Forwarded-For': `10.98.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return { label, key, id: issued.data.key.id, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] };
  }
  // Collect the room's server-sent events (named events only) until the test ends.
  async function listen(person) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const events = [];
    const res = await fetch(base + '/api/room/events', { headers: { 'X-Session-Token': person.session, Accept: 'text/event-stream' }, signal: controller.signal });
    (async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true });
          let cut;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const name = block.match(/^event: (.+)$/m)?.[1];
            const data = block.match(/^data: (.+)$/m)?.[1];
            if (name && data) events.push({ name, data: JSON.parse(data) });
          }
        }
      } catch {}
    })();
    return events;
  }
  const missions = async person => (await req('/api/missions', person.session)).data;
  const deal = (person, ids) => req('/api/test/missions', person.session, { ids });
  const history = async person => (await req('/api/points/history?limit=50', person.session)).data.items;
  return { req, guest, missions, deal, history, listen, logs: () => logs };
}

async function startOthello(fx, host, guestPlayer) {
  const created = await fx.req('/api/rooms', host.session, { gameType: 'othello' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  assert.equal((await fx.req('/api/rooms/join', guestPlayer.session, { code })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', host.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', guestPlayer.session, { choice: 'white' })).status, 200);
}

async function waitFor(fn, message) {
  for (let i = 0; i < 80; i += 1) { const value = await fn(); if (value) return value; await sleep(50); }
  assert.fail(message);
}

test('인증 없이는 조회할 수 없고, 새 계정은 아무 업적도 달성하지 않았다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'achievement-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  assert.equal((await fx.req('/api/achievements')).status, 401);
  const me = await fx.guest('조회');
  const view = (await fx.req('/api/achievements', me.session)).data;
  assert.deepEqual([view.total, view.doneCount, view.earned, view.granted.length], [70, 0, 0, 0]);
  assert.ok(view.maxReward > 200_000);
  assert.equal(JSON.stringify(view).includes('guest:'), false, '계정 정보 미노출');
  assert.deepEqual(view.items.slice(0, 4).map(item => [item.id, item.progress, item.target, item.reward]),
    [['omok_first_play', 0, 1, 1_000], ['omok_first_win', 0, 1, 2_000], ['omok_wins10', 0, 10, 5_000], ['omok_plays50', 0, 50, 7_500]]);
});

test('판이 끝나면 전적 기준 업적이 한 번씩 지급되고(방 안 알림·원장·내역), 다시 조회해도 추가 지급이 없다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'achievement-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('승자'), await fx.guest('패자')];
  assert.equal((await fx.req('/api/test/rewards', a.session, {})).status, 200); // a만 지급 대상, b는 아직 아님
  await startOthello(fx, a, b);
  const eventsA = await fx.listen(a);
  await sleep(150);
  const balanceBefore = (await fx.req('/api/points', a.session)).data.balance;
  assert.equal((await fx.req('/api/room/resign', b.session, {})).status, 200);

  const update = await waitFor(() => eventsA.find(event => event.name === 'missionUpdate' && event.data.lines.some(line => line.startsWith('업적'))), '업적 알림이 오지 않았습니다');
  assert.ok(update.data.lines.includes('업적 달성 +1,000P · 오델로 첫 정상 완료'));
  assert.ok(update.data.lines.includes('업적 달성 +2,000P · 오델로 첫 승리'));

  const view = (await fx.req('/api/achievements', a.session)).data;
  assert.deepEqual(view.granted, [], '이미 지급됨: 다시 조회해도 새로 지급되지 않는다');
  assert.deepEqual(view.items.filter(item => item.done).map(item => item.id), ['othello_first_play', 'othello_first_win']);
  assert.deepEqual([view.doneCount, view.earned], [2, 3_000]);
  const rows = (await fx.history(a)).filter(item => item.reason === 'achievement');
  assert.deepEqual(rows.map(item => [item.delta, item.memo]).sort(), [[1_000, '오델로 첫 정상 완료'], [2_000, '오델로 첫 승리']]);
  const after = (await fx.req('/api/points', a.session)).data.balance;
  await Promise.all([1, 2, 3].map(() => fx.req('/api/achievements', a.session)));
  assert.equal((await fx.req('/api/points', a.session)).data.balance, after, '반복 조회는 잔액을 바꾸지 않는다');
  assert.ok(after - balanceBefore >= 3_000, '업적 3,000P가 잔액에 반영');
  assert.equal((await fx.req('/api/achievements', b.session)).data.granted.length, 0, 'b는 지급 대상이 아니라 조회해도 지급되지 않는다');
  assert.equal((await fx.history(b)).some(item => item.reason === 'achievement'), false);
});

test('과거에 쌓인 전적도 대상이 되는 순간 소급되어 한 번만 지급되고, 동시에 조회해도 중복이 없다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'achievement-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('가'), await fx.guest('나')];
  await startOthello(fx, a, b);
  await fx.req('/api/room/resign', b.session, {}); // 이 판은 두 사람 모두 지급 대상이 아닐 때 끝난다
  await waitFor(async () => (await fx.req('/api/room', a.session)).data.state?.game?.status === 'finished', '판이 끝나지 않았습니다');
  assert.equal((await fx.history(b)).some(item => item.reason === 'achievement'), false);
  const balanceB = (await fx.req('/api/points', b.session)).data.balance;

  assert.equal((await fx.req('/api/test/rewards', b.session, {})).status, 200); // 이제 b가 지급 대상
  const results = await Promise.all(Array.from({ length: 6 }, () => fx.req('/api/achievements', b.session)));
  assert.ok(results.every(item => item.status === 200));
  assert.equal(results.filter(item => item.data.granted.length).length, 1, '동시 6건 중 1건만 지급');
  assert.deepEqual(results.find(item => item.data.granted.length).data.granted.map(item => [item.id, item.amount]), [['othello_first_play', 1_000]]);
  assert.equal((await fx.req('/api/points', b.session)).data.balance, balanceB + 1_000, '패자는 첫 정상 완료만(승리 없음)');
  assert.equal((await fx.history(b)).filter(item => item.reason === 'achievement').length, 1);
});
