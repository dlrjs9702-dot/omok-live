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
const PASSWORD = 'mission-test';

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
    const headers = { 'X-Forwarded-For': `10.99.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
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

test('인증 없이는 조회할 수 없고, 응답에는 계정·원장 정보가 없다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  assert.equal((await fx.req('/api/missions')).status, 401);
  const me = await fx.guest('조회');
  const view = await fx.missions(me);
  assert.equal(view.missions.length, 3);
  assert.equal(new Set(view.missions.map(item => item.id)).size, 3);
  assert.deepEqual([view.doneCount, view.total, view.firstWin.done, view.firstWin.reward], [0, 3, false, 5_000]);
  assert.equal(JSON.stringify(view).includes('guest:'), false);
  assert.equal(view.remainingReward, view.missions.reduce((sum, item) => sum + item.reward, 0) + 5_000);
  const total = view.missions.reduce((sum, item) => sum + item.reward, 0);
  assert.ok(total >= 8_000 && total <= 10_000, `하루 합계 ${total}`);
});

test('정상 종료된 판이 진행도를 올리고 미션·첫 승리가 원장에 한 번씩 남는다(기권한 사람은 이탈 없는 완료가 아니다)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('승자'), await fx.guest('기권')];
  assert.equal((await fx.deal(a, ['win1', 'clean1', 'play3'])).status, 200);
  assert.equal((await fx.deal(b, ['clean1', 'win1', 'play3'])).status, 200);
  await startOthello(fx, a, b);
  const eventsA = await fx.listen(a);
  await sleep(150);
  assert.equal((await fx.req('/api/room/resign', b.session, {})).status, 200);

  const viewA = await waitFor(async () => { const v = await fx.missions(a); return v.doneCount === 2 && v; }, 'A의 미션이 완료되지 않았습니다');
  assert.deepEqual(viewA.missions.map(item => [item.id, item.done, item.progress]), [['play3', false, 1], ['win1', true, 1], ['clean1', true, 1]], '완료는 아래');
  assert.equal(viewA.firstWin.done, true);
  const viewB = await fx.missions(b);
  assert.deepEqual([viewB.doneCount, viewB.firstWin.done], [0, false], '기권 패배: 이탈 없는 완료·승리 없음');
  assert.deepEqual(viewB.missions.find(item => item.id === 'play3').progress, 1, '정상 종료 1판은 센다');

  const rowsA = (await fx.history(a)).filter(item => ['daily_mission', 'first_win'].includes(item.reason));
  assert.deepEqual(rowsA.map(item => [item.reason, item.delta]).sort(), [['daily_mission', 2_000], ['daily_mission', 3_000], ['first_win', 5_000]].sort());
  assert.equal((await fx.history(b)).some(item => ['daily_mission', 'first_win'].includes(item.reason)), false);

  const update = await waitFor(() => eventsA.find(event => event.name === 'missionUpdate'), '방 안 미션 알림이 오지 않았습니다');
  assert.ok(update.data.lines.includes('게임 3판 1/3'));
  assert.ok(update.data.lines.some(line => line.startsWith('미션 완료 +3,000P')));
  assert.ok(update.data.lines.some(line => line.startsWith('첫 승리 보너스 +5,000P')));
  assert.deepEqual([update.data.doneCount, update.data.total], [2, 3]);
});

test('같은 판을 다시 조회·종료 요청해도 두 번 세지 않고, 재대결의 새 판은 새로 센다(첫 승리는 하루 한 번)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('가'), await fx.guest('나')];
  await fx.deal(a, ['play5', 'win3', 'variety2']);
  await fx.deal(b, ['play5', 'win3', 'variety2']);
  await startOthello(fx, a, b);
  await Promise.all([1, 2, 3].map(() => fx.req('/api/room/resign', b.session, {})));
  await Promise.all([fx.req('/api/room', a.session), fx.req('/api/room', b.session), fx.req('/api/room', a.session)]);
  const first = await waitFor(async () => { const v = await fx.missions(a); return v.firstWin.done && v; }, '첫 판이 반영되지 않았습니다');
  assert.deepEqual(first.missions.map(item => [item.id, item.progress]), [['play5', 1], ['win3', 1], ['variety2', 1]], '한 판은 한 번만');

  await Promise.all([fx.req('/api/room/next-round', a.session, {}), fx.req('/api/room/next-round', b.session, {})]);
  assert.equal((await fx.req('/api/room/choose-role', a.session, { choice: 'black' })).status, 200);
  assert.equal((await fx.req('/api/room/choose-role', b.session, { choice: 'white' })).status, 200);
  await fx.req('/api/room/resign', b.session, {});
  const second = await waitFor(async () => { const v = await fx.missions(a); return v.missions.find(item => item.id === 'play5').progress === 2 && v; }, '두 번째 판이 반영되지 않았습니다');
  assert.equal(second.missions.find(item => item.id === 'win3').progress, 2);
  const bonuses = (await fx.history(a)).filter(item => item.reason === 'first_win');
  assert.equal(bonuses.length, 1, '첫 승리 보너스는 하루 1회');
});

test('주간 미션(v1.7.20): 조회에 포함되고, 판이 끝나면 주 단위 진행이 오르며, 목표를 채우면 미션 3개와 보너스가 한 번씩 지급된다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mission-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('주간승자'), await fx.guest('주간패자')];
  const initial = (await fx.missions(a)).weekly;
  assert.deepEqual(initial.missions.map(item => [item.id, item.target, item.reward, item.progress]), [['weekly_play20', 20, 9_000, 0], ['weekly_win10', 10, 9_000, 0], ['weekly_variety5', 5, 7_000, 0]]);
  assert.deepEqual([initial.bonus.reward, initial.bonus.done, initial.total, initial.remainingReward], [5_000, false, 3, 30_000]);
  assert.match(initial.week, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(`${initial.week}T00:00:00Z`).getUTCDay(), 1, '주는 월요일에 시작한다');
  assert.equal(JSON.stringify(initial).includes('guest:'), false);

  assert.equal((await fx.deal(a, ['win1', 'play3', 'variety2'])).status, 200); // 지급 대상 지정
  assert.equal((await fx.deal(b, ['win1', 'play3', 'variety2'])).status, 200);
  // 목표 직전까지 채워 두고(20판 19·10승 9·4종), 실제 판 한 번으로 모두 완료한다.
  const preset = { played: 19, wins: 9, games: ['omok', 'yut', 'bingo', 'dots'] };
  assert.equal((await fx.req('/api/test/weekly', a.session, preset)).status, 200);
  assert.equal((await fx.req('/api/test/weekly', b.session, { played: 3, wins: 0, games: ['omok'] })).status, 200);
  await startOthello(fx, a, b);
  const eventsA = await fx.listen(a);
  await sleep(150);
  assert.equal((await fx.req('/api/room/resign', b.session, {})).status, 200);

  const weeklyA = await waitFor(async () => { const w = (await fx.missions(a)).weekly; return w.bonus.done && w; }, '주간 미션이 완료되지 않았습니다');
  assert.deepEqual([weeklyA.doneCount, weeklyA.remainingReward], [3, 0]);
  const rows = (await fx.history(a)).filter(item => item.reason === 'weekly_mission');
  assert.deepEqual(rows.map(item => [item.delta, item.memo]).sort(), [[5_000, '주간 미션 모두 완료'], [7_000, '주간 서로 다른 게임 5종 플레이'], [9_000, '주간 10승'], [9_000, '주간 20판 정상 완료']].sort());
  const update = await waitFor(() => eventsA.find(event => event.name === 'missionUpdate' && event.data.lines.some(line => line.startsWith('주간'))), '주간 완료 알림이 오지 않았습니다');
  assert.ok(update.data.lines.includes('주간 미션 모두 완료 +5,000P'));
  assert.ok(update.data.lines.includes('주간 미션 완료 +9,000P · 주간 20판'));

  const weeklyB = (await fx.missions(b)).weekly; // 기권 패배도 정상 종료 1판으로 센다
  assert.deepEqual(weeklyB.missions.map(item => [item.id, item.progress]).sort(), [['weekly_play20', 4], ['weekly_variety5', 2], ['weekly_win10', 0]].sort());
  assert.equal((await fx.history(b)).some(item => item.reason === 'weekly_mission'), false);

  const balance = (await fx.req('/api/points', a.session)).data.balance;
  await Promise.all([1, 2, 3].map(() => fx.req('/api/room', a.session)));
  await Promise.all([1, 2, 3].map(() => fx.missions(a)));
  assert.equal((await fx.req('/api/points', a.session)).data.balance, balance, '반복 조회는 잔액을 바꾸지 않는다');
  assert.equal((await fx.history(a)).filter(item => item.reason === 'weekly_mission').length, 4, '같은 주 지급은 미션 3개 + 보너스, 각 1회');
});
