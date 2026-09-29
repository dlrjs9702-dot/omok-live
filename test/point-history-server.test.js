'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

// v1.7.0: GET /api/points/history is the caller's own ledger only, newest first, paged, read-only.
test('로비 포인트 내역 API: 본인 조회·정렬·페이지·격리·읽기 전용', { timeout: 40_000 }, async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'point-history-'));
  const port = await freePort();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'history-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', data => { output += data; });
  proc.stderr.on('data', data => { output += data; });
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => proc.once('exit', resolve));
    await fs.rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) {
    try { if ((await fetch(`${base}/health`)).ok) break; } catch {}
    if (proc.exitCode !== null) throw new Error(output);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  let ip = 1;
  async function api(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const res = await fetch(base + route, {
      method,
      headers: { 'X-Forwarded-For': `10.96.${Math.floor(ip / 250)}.${ip++ % 250}`, ...(token ? { 'X-Session-Token': token } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json() };
  }
  const admin = (await api('/api/admin/login', null, { password: 'history-test' })).data.sessionToken;
  const guests = [];
  for (let i = 1; i <= 2; i += 1) {
    const issued = await api('/api/admin/keys', admin, { label: `참가자${i}` });
    const entry = await fetch(`${base}/guest-entry`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': `10.97.0.${i}` },
      body: new URLSearchParams({ token: issued.data.html.match(/name="token" value="([^"]+)"/)[1] }).toString() });
    guests.push((await entry.text()).match(/data-session="([^"]+)"/)[1]);
  }
  const [a, b] = guests;
  const ledgerFile = () => fs.readFile(path.join(dir, 'points.json'), 'utf8');

  assert.equal((await api('/api/points/history')).status, 401, '세션 없이 조회 불가');

  await t.test('신규 지급 + 출석체크가 최신순으로 보인다', async () => {
    assert.equal((await api('/api/points', a)).status, 200);
    const claim = await api('/api/points/attendance', a, {});
    assert.equal(claim.data.granted, true);
    const { status, data } = await api('/api/points/history', a);
    assert.equal(status, 200);
    assert.deepEqual(data.items.map(item => [item.reason, item.delta, item.balanceBefore, item.balanceAfter]),
      [['daily_attendance', 50_000, 100_000, 150_000], ['initial_grant', 100_000, 0, 100_000]]);
    assert.equal(data.hasMore, false);
    assert.equal(data.balance, 150_000);
    assert.equal(data.items[0].balanceAfter, (await api('/api/points', a)).data.balance, '최신 balanceAfter가 서버 잔액과 일치');
    const text = JSON.stringify(data);
    assert.equal(/guest:|idempotency|userId|initial:|attendance:/.test(text), false, '내부 식별자 미노출');
  });

  await t.test('맞고 정산 내역이 상대 것과 섞이지 않고 각자 부호로 보인다', async () => {
    const created = await api('/api/rooms', a, { gameType: 'gostop' });
    const code = created.data.state.me.roomCode;
    assert.equal((await api('/api/rooms/join', b, { code })).status, 200);
    assert.equal((await api('/api/room/choose-role', a, { choice: '1' })).status, 200);
    assert.equal((await api('/api/room/choose-role', b, { choice: '2' })).status, 200);
    assert.equal((await api('/api/test/gostop-fixture', a, { fixture: 'first-ppeok' })).status, 200);
    assert.equal((await api('/api/room/gostop-play', a, { cardId: 'm05-pi1' })).status, 200);
    const mine = (await api('/api/points/history', a)).data;
    const theirs = (await api('/api/points/history', b)).data;
    assert.deepEqual([mine.items[0].reason, mine.items[0].gameType, mine.items[0].mode, mine.items[0].detail, mine.items[0].delta], ['game_win', 'gostop', 'matgo', 'firstPpeok', 630]); // v1.7.3: 700P 이동 중 10% 소각
    assert.deepEqual([theirs.items[0].reason, theirs.items[0].delta, theirs.items[0].balanceBefore, theirs.items[0].balanceAfter], ['game_loss', -700, 100_000, 99_300]);
    assert.equal(theirs.items.some(item => item.reason === 'daily_attendance'), false, 'B는 A의 출석 내역이 없다');
    assert.equal(mine.items[0].balanceAfter, (await api('/api/points', a)).data.balance);
    assert.equal(theirs.items[0].balanceAfter, (await api('/api/points', b)).data.balance);
  });

  await t.test('다른 사용자 지정 파라미터는 무시되고 관리자 세션도 자기 계정만 본다', async () => {
    const before = await api('/api/points/history', a);
    const stored = JSON.parse(await ledgerFile());
    const [bId] = Object.keys(stored.accounts).filter(id => stored.ledger.some(row => row.userId === id && row.reason === 'game_loss'));
    for (const query of [`?userId=${encodeURIComponent(bId)}`, `?accountKey=${encodeURIComponent(bId)}&account=${encodeURIComponent(bId)}`]) {
      const res = await api(`/api/points/history${query}`, a);
      assert.deepEqual(res.data, before.data);
    }
    const post = await fetch(`${base}/api/points/history`, { method: 'POST', headers: { 'X-Session-Token': a, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: bId }) });
    assert.notEqual(post.status, 200, '쓰기 메서드로는 열리지 않는다');
    const adminView = (await api('/api/points/history', admin)).data;
    assert.equal(adminView.items.length, 1);
    assert.equal(adminView.items[0].reason, 'initial_grant');
  });

  await t.test('limit·before 페이지와 비정상 값 방어', async () => {
    const first = (await api('/api/points/history?limit=1', a)).data;
    assert.equal(first.items.length, 1);
    assert.equal(first.hasMore, true);
    const second = (await api(`/api/points/history?limit=1&before=${first.nextBefore}`, a)).data;
    assert.equal(second.items[0].reason, 'daily_attendance');
    const last = (await api(`/api/points/history?limit=5&before=${second.nextBefore}`, a)).data;
    assert.deepEqual(last.items.map(item => item.reason), ['initial_grant']);
    assert.equal(last.hasMore, false);
    assert.equal(last.nextBefore, null);
    assert.equal((await api('/api/points/history?limit=999999', a)).status, 200);
    assert.ok((await api('/api/points/history?limit=999999', a)).data.items.length <= 50);
    assert.equal((await api('/api/points/history?before=abc', a)).status, 400);
    assert.equal((await api('/api/points/history?before=-4', a)).status, 400);
  });

  await t.test('조회만으로 잔액·원장 파일이 바뀌지 않는다', async () => {
    const snapshot = await ledgerFile();
    for (let i = 0; i < 5; i += 1) await api('/api/points/history?limit=2', a);
    await api('/api/points/history', b);
    assert.equal(await ledgerFile(), snapshot);
  });
});
