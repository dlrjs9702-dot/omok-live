'use strict';

// v1.6.87: three-player settlement end to end through the real server (JSON stores).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
  });
}

async function startServer(dataDir, port) {
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'gostop-test', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => { output += chunk; });
  proc.stderr.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i += 1) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return proc; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`server failed: ${output}`);
}

async function stopServer(proc) {
  if (proc.exitCode !== null) return;
  proc.kill('SIGTERM');
  await new Promise(resolve => { proc.once('exit', resolve); setTimeout(resolve, 3000).unref(); });
}

test('3인 고스톱 서버 정산: 패자별 독립 한도·승자는 실제 지불 합만·동시 스톱 1회·관전자 비공개', { timeout: 90_000 }, async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gostop-3p-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  let proc = await startServer(dataDir, port);
  t.after(async () => { await stopServer(proc); await fs.rm(dataDir, { recursive: true, force: true }); });
  let ipCounter = 0;
  async function req(route, token, body, method = 'POST') {
    const headers = { 'X-Forwarded-For': `10.79.0.${(ipCounter = (ipCounter % 250) + 1)}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function enter(html) {
    const token = html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Forwarded-For': '10.80.0.1' },
      body: new URLSearchParams({ token }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)[1];
  }
  let admin = (await req('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  const people = [];
  for (const label of ['가', '나', '다', '관']) {
    const issued = await req('/api/admin/keys', admin, { label });
    people.push({ keyId: issued.data.key.id, session: await enter(issued.data.html) });
  }
  for (const person of people) await req('/api/points', person.session, undefined, 'GET'); // 계정 생성
  // 두 사람의 잔액을 낮춰 한도 적용 상황을 만든다(서버 정지 중 저장소 수정).
  await stopServer(proc);
  const file = path.join(dataDir, 'points.json');
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  const low = { 0: 700, 1: 300, 2: 100_000 };
  for (const [index, balance] of Object.entries(low)) saved.accounts[`guest:${people[index].keyId}`].balance = balance;
  await fs.writeFile(file, JSON.stringify(saved));
  proc = await startServer(dataDir, port);
  admin = (await req('/api/admin/login', null, { password: 'gostop-test' })).data.sessionToken;
  for (const person of people) person.session = await enter((await req(`/api/admin/keys/${person.keyId}/reissue`, admin, {})).data.html);
  const [pa, pb, pc, watcher] = people;

  const created = await req('/api/rooms', pa.session, { gameType: 'gostop', pointsPerScore: 100 });
  const code = created.data.state.me.roomCode;
  for (const person of [pb, pc, watcher]) assert.equal((await req('/api/rooms/join', person.session, { code })).status, 200);
  for (const [person, choice] of [[pa, '1'], [pb, '2'], [pc, '3'], [watcher, 'spectator']]) assert.equal((await req('/api/room/choose-role', person.session, { choice })).status, 200);
  const started = await req('/api/room/start-gostop', pa.session, {});
  assert.equal(started.status, 200, JSON.stringify(started.data));
  assert.equal(started.data.state.game.mode, 'gostop');

  const view = async session => (await req('/api/room', session, undefined, 'GET')).data.state;
  const seatSession = { 1: pa, 2: pb, 3: pc };
  let state = await view(pa.session);
  let concurrentStops = null;
  for (let step = 0; step < 300 && state.game.status === 'playing'; step += 1) {
    const g = state.game;
    const actor = seatSession[g.turn].session;
    const me = await view(actor);
    // 관전자 응답에는 어떤 손패도 없다.
    const watched = await view(watcher.session);
    assert.equal(watched.me.myGostopHand, null);
    for (const viewer of [watched, me]) {
      for (const key of ['deck', 'hands', 'ctx', 'random', 'seed']) assert.equal(key in viewer.game, false, `game.${key} 노출`);
    }
    // 다른 두 사람의 손패는 현재 행동자 응답에도 없다.
    for (const seat of Object.keys(seatSession).filter(seat => seat !== g.turn)) {
      const theirs = (await view(seatSession[seat].session)).me.myGostopHand || [];
      for (const item of theirs) assert.equal(JSON.stringify(me).includes(`"${item.id}"`), false, `${seat}번 손패 ${item.id} 노출`);
    }
    for (const item of me.me.myGostopHand || []) assert.equal(JSON.stringify(watched).includes(`"${item.id}"`), false, `관전자에게 ${item.id} 노출`);
    let result;
    if (g.phase === 'play') {
      const hand = me.me.myGostopHand;
      result = hand.length ? await req('/api/room/gostop-play', actor, { cardId: hand[0].id }) : await req('/api/room/gostop-flip', actor, {});
    } else if (g.phase === 'choose-floor' || g.phase === 'choose-flip') result = await req('/api/room/gostop-choose', actor, { cardId: g.choice.options[0] });
    else if (g.phase === 'gukjin') result = await req('/api/room/gostop-gukjin', actor, { asPi: false });
    else if (g.phase === 'go-stop') {
      // 스톱 연타·동시 요청: 한 번만 처리된다.
      const replies = await Promise.all([1, 2, 3, 4].map(() => req('/api/room/gostop-decide', actor, { choice: 'stop' })));
      concurrentStops = replies.map(item => item.status);
      result = replies.find(item => item.status === 200);
    }
    assert.equal(result?.status, 200, JSON.stringify(result?.data));
    state = await view(pa.session);
  }
  assert.notEqual(state.game.status, 'playing');
  if (concurrentStops) assert.equal(concurrentStops.filter(code => code === 200).length, 1, `동시 스톱 ${concurrentStops}`);
  const balances = await Promise.all([pa, pb, pc].map(async person => (await req('/api/points', person.session, undefined, 'GET')).data.balance));
  assert.equal(balances.reduce((sum, value) => sum + value, 0), 700 + 300 + 100_000, '포인트 총량 보존');
  const g = state.game;
  t.diagnostic(`결과 ${g.status}/${g.result?.kind} · 동시 스톱 ${concurrentStops} · 정산 ${JSON.stringify(g.settlement.transfers)}`);
  assert.equal(g.settlement.status, 'done');
  if (g.status === 'finished' && g.result.kind === 'win') {
    const before = { 1: 700, 2: 300, 3: 100_000 };
    let received = 0;
    for (const loser of g.result.losers) {
      const transfer = g.settlement.transfers.find(item => item.fromSeat === loser.seat);
      assert.equal(transfer.requested, loser.amount, '서버 계산액 그대로 요청');
      assert.equal(transfer.paid, Math.min(loser.amount, before[loser.seat]), `${loser.seat} 독립 한도`);
      assert.equal(transfer.capped, loser.amount > before[loser.seat]);
      assert.equal(balances[Number(loser.seat) - 1], before[loser.seat] - transfer.paid);
      received += transfer.paid;
    }
    assert.equal(balances[Number(g.result.winner) - 1], before[g.result.winner] + received, '승자는 실제 지불 합만');
  }
  // 새로고침·다음 판 준비가 반복돼도 재정산 없음.
  await Promise.all([view(pa.session), view(pb.session), view(pc.session), req('/api/room/next-round', pa.session, {}), req('/api/room/next-round', pa.session, {})]);
  const after = await Promise.all([pa, pb, pc].map(async person => (await req('/api/points', person.session, undefined, 'GET')).data.balance));
  assert.deepEqual(after, balances);
});
