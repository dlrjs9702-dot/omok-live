'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const portAvailable = () => new Promise((resolve, reject) => {
  const socket = net.createServer();
  socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => {
    const port = socket.address().port;
    socket.close(() => resolve(port));
  });
});

test('Twenty Questions HTTP: host starts, secret stays private, turns and two-round tie', { timeout: 30000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'twenty-http-'));
  const port = await portAvailable();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'test-twenty-password', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => {
      if (proc.exitCode !== null) return resolve();
      proc.once('exit', resolve);
      setTimeout(resolve, 2000).unref();
    });
    await fs.rm(dir, { recursive: true, force: true });
  });
  let running = false;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { running = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(running, `Server did not start: ${output}`);
  async function req(route, session, body, method = 'POST') {
    const headers = {};
    if (session) headers['X-Session-Token'] = session;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'test-twenty-password' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }
  const host = await login();
  const guest = await login();
  const watcher = await login();
  const health = await req('/health', null, undefined, 'GET');
  assert.equal(health.data.version, '1.6.70');
  assert.equal(health.data.games.includes('twentyquestions'), true);
  const created = await req('/api/rooms', host, { gameType: 'twentyquestions', visibility: 'public' });
  assert.equal(created.status, 201);
  const listing = await req('/api/rooms/public', guest, undefined, 'GET');
  const room = listing.data.rooms.find(item => item.gameType === 'twentyquestions');
  assert.ok(room);
  assert.equal(room.maxPlayers, 8);
  assert.equal((await req('/api/rooms/public/join', guest, { roomId: room.id })).status, 200);
  assert.equal((await req('/api/rooms/public/join', watcher, { roomId: room.id })).status, 200);
  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', guest, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', watcher, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/twenty-start', guest, { mode: 'individual', totalRounds: 2 })).status, 403);
  const opened = await req('/api/room/twenty-start', host, { mode: 'individual', totalRounds: 2 });
  assert.equal(opened.status, 200);
  assert.equal(opened.data.state.game.roundNumber, 1);
  assert.equal(opened.data.state.game.drawerSeat, '1');
  const drawerChatBlocked = await req('/api/room/chat', host, { text: '출제자 채팅' });
  assert.equal(drawerChatBlocked.status, 409);
  assert.equal(drawerChatBlocked.data.code, 'TWENTY_DRAWER_CHAT_LOCKED');
  assert.equal((await req('/api/room/chat', guest, { text: '도전자 채팅' })).status, 200);
  assert.equal((await req('/api/room/chat', watcher, { text: '관전자 채팅' })).status, 200);
  assert.equal((await req('/api/room/twenty-secret', watcher, { secret: '비밀' })).status, 403);
  assert.equal((await req('/api/room/twenty-secret', guest, { secret: '비밀' })).status, 409);
  const secret = '비밀비행기';
  assert.equal((await req('/api/room/twenty-secret', host, { secret })).status, 200);
  const challengerView = await req('/api/room', guest, undefined, 'GET');
  const watcherView = await req('/api/room', watcher, undefined, 'GET');
  const drawerView = await req('/api/room', host, undefined, 'GET');
  assert.equal(drawerView.data.state.me.myTwentySecret, secret);
  assert.equal(challengerView.data.state.me.myTwentySecret, null);
  assert.equal(watcherView.data.state.me.myTwentySecret, null);
  assert.equal(JSON.stringify(challengerView.data).includes(secret), false);
  assert.equal(JSON.stringify(watcherView.data).includes(secret), false);
  assert.equal((await req('/api/room/twenty-question', watcher, { question: '날아요?' })).status, 403);
  assert.equal((await req('/api/room/twenty-question', guest, { question: '날아요?' })).status, 200);
  assert.equal((await req('/api/room/twenty-answer', guest, { reply: '예' })).status, 409);
  assert.equal((await req('/api/room/twenty-answer', host, { reply: '모르겠음' })).status, 409);
  const answer = await req('/api/room/twenty-answer', host, { reply: '예' });
  assert.equal(answer.status, 200);
  assert.equal(answer.data.state.game.questionsUsed, 1);
  const guess = await req('/api/room/twenty-guess', guest, { guess: secret });
  assert.equal(guess.status, 200);
  assert.equal((await req('/api/room/twenty-judge', guest, { correct: true })).status, 409);
  const judged = await req('/api/room/twenty-judge', host, { correct: true });
  assert.equal(judged.status, 200);
  assert.equal(judged.data.state.game.status, 'round-ended');
  assert.equal(judged.data.state.game.scores['2'], 1);
  assert.equal((await req('/api/room/twenty-next', guest, {})).status, 403);
  const next = await req('/api/room/twenty-next', host, {});
  assert.equal(next.status, 200);
  assert.equal(next.data.state.game.drawerSeat, '2');
  assert.equal(next.data.state.game.roundNumber, 2);
  assert.equal((await req('/api/room/chat', host, { text: '이제 도전자 채팅' })).status, 200);
  assert.equal((await req('/api/room/chat', guest, { text: '둘째 출제자 채팅' })).status, 409);
  assert.equal((await req('/api/room/twenty-secret', guest, { secret: '둘째정답' })).status, 200);
  assert.equal((await req('/api/room/twenty-guess', host, { guess: '둘째정답' })).status, 200);
  const finished = await req('/api/room/twenty-judge', guest, { correct: true });
  assert.equal(finished.status, 200);
  assert.equal(finished.data.state.game.status, 'finished');
  assert.deepEqual(finished.data.state.game.winner, ['1', '2']);
  assert.deepEqual(finished.data.state.game.winners, ['1', '2']);
  assert.deepEqual(finished.data.state.game.scores, { '1': 1, '2': 1 });
  assert.equal(finished.data.state.game.roundResults.length, 2);
  assert.equal((await req('/api/room/twenty-guess', host, { guess: '셋째' })).status, 409);

  const appSource = await fs.readFile(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  assert.match(appSource, /function chatLockedForTwentyDrawer\(\)/);
  assert.match(appSource, /String\(seat\) === String\(g\.drawerSeat\)/);
  assert.match(appSource, /출제자는 스무고개 진행 중 채팅할 수 없습니다/);
});
