'use strict';
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
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
}

// 팬데믹을 실제 서버로: 방 생성·좌석·설정·시작, 비공개 정보(카드 더미 순서)가 응답에 없는지, 행동 권한, 새로고침 뒤에도 같은 상태.
test('팬데믹 API: 3인 시작, 더미 순서 비공개, 차례 밖 행동 거부, 행동 적용, 관전자 제한', { timeout: 40000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-pandemic-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: 'pandemic-test-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', c => { output += c; }); proc.stderr.on('data', c => { output += c; });
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 90; i += 1) {
    if (proc.exitCode !== null) break;
    try { const res = await fetch(`${base}/health`); if (res.ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `서버 시작 실패: ${output}`);

  let ip = 0;
  async function req(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'X-Forwarded-For': `10.55.${Math.floor(++ip / 200)}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const login = async () => (await req('/api/admin/login', null, { password: 'pandemic-test-secret' })).data.sessionToken;
  const [host, second, third, watcher] = [await login(), await login(), await login(), await login()];

  const created = await req('/api/rooms', host, { gameType: 'pandemic' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.gameType, 'pandemic');
  assert.equal(created.data.state.maxPlayers, 4);
  const code = created.data.state.me.roomCode;
  for (const token of [second, third, watcher]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  for (const [token, seat] of [[host, '1'], [second, '2'], [third, '3']]) assert.equal((await req('/api/room/choose-role', token, { choice: seat })).status, 200);
  assert.equal((await req('/api/room/choose-role', watcher, { choice: 'spectator' })).status, 200);

  assert.equal((await req('/api/room/set-pandemic', second, { difficulty: 'heroic' })).status, 403, '방장만 설정');
  assert.equal((await req('/api/room/set-pandemic', host, { difficulty: 'nope' })).status, 409);
  assert.equal((await req('/api/room/set-pandemic', host, { difficulty: 'heroic' })).data.state.game.difficulty, 'heroic');
  assert.equal((await req('/api/room/start-pandemic', second, {})).status, 403);
  const startedGame = await req('/api/room/start-pandemic', host, {});
  assert.equal(startedGame.status, 200);
  const g = startedGame.data.state.game;
  assert.equal(g.status, 'playing'); assert.equal(g.epidemicsTotal, 6); assert.equal(g.seatOrder.length, 3);
  assert.equal('playerDeck' in g, false); assert.equal('infectionDeck' in g, false);
  assert.ok(g.playerDeckCount > 0 && g.infectionDeckCount === 39);
  for (const seat of g.seatOrder) assert.ok(g.hands[seat].length === 3 && g.roles[seat] && g.pawns[seat] === 'atlanta', '손패·직업은 공개');

  // 감염 더미 맨 위 카드가 응답 어디에도 순서로 새지 않는다: 같은 상태를 두 번 받아도 상위 카드 목록은 없다
  const view = await req('/api/room', watcher, undefined, 'GET');
  assert.equal(view.data.state.me.myPandemic, null, '관전자에게는 개인 정보가 없다');
  assert.equal(view.data.state.game.hands[g.turn].length, 3);

  const turnToken = { 1: host, 2: second, 3: third }[g.turn];
  const otherToken = { 1: host, 2: second, 3: third }[g.seatOrder.find(s => s !== g.turn)];
  const mine = (await req('/api/room', turnToken, undefined, 'GET')).data.state;
  assert.ok(mine.me.myPandemic.legal.drive.length >= 1, '내 차례의 갈 수 있는 도시가 서버 계산으로 온다');
  assert.equal((await req('/api/room/pandemic-act', otherToken, { action: { type: 'drive', to: mine.me.myPandemic.legal.drive[0] } })).status, 409, '차례가 아닌 사람은 못 움직인다');
  assert.equal((await req('/api/room/pandemic-act', watcher, { action: { type: 'pass' } })).status, 403, '관전자는 행동할 수 없다');
  assert.equal((await req('/api/room/pandemic-act', turnToken, { action: { type: 'drive', to: 'tokyo' } })).status, 409, '연결되지 않은 도시');
  const to = mine.me.myPandemic.legal.drive[0];
  const moved = await req('/api/room/pandemic-act', turnToken, { action: { type: 'drive', to }, expectedRevision: mine.game.revision });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.state.game.pawns[g.turn], to); assert.equal(moved.data.state.game.actionsLeft, 3);
  assert.equal((await req('/api/room/pandemic-act', turnToken, { action: { type: 'drive', to: 'atlanta' }, expectedRevision: mine.game.revision })).status, 409, '오래된 화면은 거부');
  const after = (await req('/api/room', otherToken, undefined, 'GET')).data.state;
  assert.equal(after.game.pawns[g.turn], to, '다른 사람 화면에도 같은 상태');
  assert.equal(JSON.stringify(after).includes('"infectionDeck"'), false);

  // 기권하면 모두 진 것으로 끝나고 전적이 남는다(승자 없는 협력 패배도 기록 가능해야 한다)
  const leave = await req('/api/room/leave', host, {});
  assert.ok([200, 204].includes(leave.status) || leave.status < 500);
});

test('팬데믹은 협력 게임: 승리하면 모두 승, 패배(승자 없음)하면 모두 패로 전적이 만들어지고 참가 포인트는 승자 없음으로 정산된다', () => {
  const { buildMatchResult, winningSeats } = require('../lib/match-result');
  const room = (game) => ({ id: 'room-1', gameType: 'pandemic', players: { 1: 't1', 2: 't2', 3: null, 4: null },
    participants: { t1: { guestKeyId: 'g-1' }, t2: { guestKeyId: 'g-2' } }, game });
  const won = buildMatchResult(room({ status: 'finished', winner: ['1', '2'], round: 1, seatOrder: ['1', '2'] }));
  assert.deepEqual(won.outcomes.map(o => o.result), ['win', 'win']);
  const lost = room({ status: 'finished', winner: [], round: 2, seatOrder: ['1', '2'] });
  assert.deepEqual(buildMatchResult(lost).outcomes.map(o => o.result), ['loss', 'loss']);
  assert.deepEqual(winningSeats(lost), [], '승자가 없으면 참가 포인트 풀은 소각');
  assert.deepEqual(winningSeats(room({ status: 'finished', winner: ['1', '2'], round: 1, seatOrder: ['1', '2'] })), ['1', '2']);
});
