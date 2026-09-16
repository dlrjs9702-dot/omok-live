'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const connect4 = require('../lib/games/connect4');
const { getGame, listGames } = require('../lib/games');

test('Connect Four is registered independently of existing games', () => {
  assert.equal(getGame('connect4'), connect4);
  assert.deepEqual(listGames().map(g => g.id).sort(), ['baseball', 'cityking', 'connect4', 'dots', 'omok', 'omok2v2', 'othello', 'yut']);
  assert.equal(connect4.create().board.length, 6);
  assert.equal(connect4.create().board[0].length, 7);
});

test('a column click drops to the lowest empty row, cannot float or overflow, and resets', () => {
  const g = connect4.create();
  connect4.start(g);
  for (let i = 0; i < 6; i++) {
    const color = i % 2 ? 'white' : 'black';
    const result = connect4.applyMove(g, 3, -800, color, `t${i}`);
    assert.equal(result.legal, true);
    assert.equal(result.y, 5 - i);
    assert.equal(g.board[5 - i][3], color);
  }
  assert.equal(connect4.applyMove(g, 3, 500, 'black', 'later').reason, 'full-column');
  assert.equal(connect4.applyMove(g, -1, 0, 'black', 'later').reason, 'out-of-bounds');
  assert.equal(connect4.applyMove(g, 7, 0, 'black', 'later').reason, 'out-of-bounds');
  assert.equal(connect4.applyMove(g, 2.5, 0, 'black', 'later').reason, 'out-of-bounds');
  assert.equal(g.moves.length, 6);
  assert.equal(connect4.publicState(g).legalColumns.includes(3), false);
  connect4.reset(g);
  assert.equal(g.round, 2);
  assert.equal(g.status, 'selecting');
  assert.equal(g.moves.length, 0);
  assert.equal(g.board.flat().filter(Boolean).length, 0);
  assert.equal(g.winner, null);
});

test('horizontal, vertical and both diagonal four-in-a-row win for either player', () => {
  for (const [points, final, color] of [
    [[[0, 5], [1, 5], [2, 5]], [3, 5], 'black'],
    [[[2, 5], [2, 4], [2, 3]], [2, 2], 'white'],
    [[[0, 5], [1, 4], [2, 3]], [3, 2], 'black'],
    [[[0, 2], [1, 3], [2, 4]], [3, 5], 'white'],
  ]) {
    const g = connect4.create();
    connect4.start(g);
    for (const [x, y] of points) g.board[y][x] = color;
    // Supply supporting stones for the diagonal/vertical test positions.
    for (let y = 5; y > final[1]; y--) if (!g.board[y][final[0]]) g.board[y][final[0]] = color === 'black' ? 'white' : 'black';
    const result = connect4.applyMove(g, final[0], -999, color, 'now');
    assert.equal(result.legal, true);
    assert.equal(result.y, final[1]);
    assert.equal(g.winner, color);
    assert.equal(g.status, 'finished');
    assert.ok(g.winningLine.length >= 4);
    assert.ok(g.winningLine.some(([x, y]) => x === final[0] && y === final[1]));
    assert.deepEqual(connect4.publicState(g).legalColumns, []);
  }
});

test('full board without a winning line is a draw', () => {
  const g = connect4.create();
  connect4.start(g);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
    g.board[y][x] = ((Math.floor(x / 2) + y) % 2 === 0) ? 'black' : 'white';
  }
  const color = g.board[0][6];
  g.board[0][6] = null;
  const placed = connect4.applyMove(g, 6, 200, color, 'last');
  assert.equal(placed.legal, true);
  assert.equal(placed.y, 0);
  assert.equal(g.status, 'draw');
  assert.equal(g.winner, null);
  assert.deepEqual(connect4.publicState(g).legalColumns, []);
});

async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

test('Connect Four server supports public join, spectators, turn enforcement, real gravity, victory, rematch and existing guest files', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'connect4-server-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'test-connect4-password', NODE_ENV: 'test' },
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
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 100; i++) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(base + '/health')).ok) { started = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(started, `Server did not start: ${output}`);
  async function req(route, session, body, method = 'POST') {
    const headers = {};
    if (session) headers['X-Session-Token'] = session;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  async function login() {
    const res = await req('/api/admin/login', null, { password: 'test-connect4-password' });
    assert.equal(res.status, 200);
    return res.data.sessionToken;
  }
  const host = await login();
  const challenger = await login();
  const watcher = await login();
  const health = await req('/health', null, undefined, 'GET');
  assert.equal(health.data.version, '1.6.18');
  assert.deepEqual(health.data.games.sort(), ['baseball', 'cityking', 'connect4', 'dots', 'omok', 'omok2v2', 'othello', 'yut']);
  const entry = await req('/api/admin/keys', host, { label: '사목손님' });
  assert.equal(entry.status, 201);
  assert.match(entry.data.html, /사목손님/);
  const created = await req('/api/rooms', host, { gameType: 'connect4', visibility: 'public' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.gameType, 'connect4');
  assert.equal(created.data.state.game.board.length, 6);
  assert.equal(created.data.state.game.board[0].length, 7);
  const listing = await req('/api/rooms/public', challenger, undefined, 'GET');
  assert.equal(listing.status, 200);
  const publicRoom = listing.data.rooms.find(r => r.gameType === 'connect4');
  assert.ok(publicRoom);
  assert.equal(publicRoom.maxPlayers, 2);
  assert.equal(publicRoom.gameName, '사목 (4목)');
  assert.equal(JSON.stringify(listing.data).includes(created.data.state.me.roomCode), false);
  assert.equal((await req('/api/rooms/public/join', challenger, { roomId: publicRoom.id })).status, 200);
  assert.equal((await req('/api/rooms/public/join', watcher, { roomId: publicRoom.id })).status, 200);
  assert.equal((await req('/api/room/choose-role', host, { choice: 'black' })).status, 200);
  const startedRound = await req('/api/room/choose-role', challenger, { choice: 'white' });
  assert.equal(startedRound.data.state.game.status, 'playing');
  assert.equal(startedRound.data.state.game.turn, 'black');
  assert.equal((await req('/api/room/move', watcher, { x: 0, y: 5 })).status, 403);
  assert.equal((await req('/api/room/move', challenger, { x: 0, y: 5 })).status, 409);
  assert.equal((await req('/api/room/move', host, { x: 7, y: 5 })).status, 409);
  const xs = [0, 1, 0, 1, 0, 1, 0];
  for (let i = 0; i < xs.length; i++) {
    const player = i % 2 === 0 ? host : challenger;
    const move = await req('/api/room/move', player, { x: xs[i], y: 0 });
    assert.equal(move.status, 200);
    assert.equal(move.data.state.game.lastMove.x, xs[i]);
    assert.equal(move.data.state.game.lastMove.y, 5 - Math.floor(i / 2));
    assert.equal(move.data.state.game.board[0].length, 7);
    if (i < 6) assert.equal(move.data.state.game.status, 'playing');
    else {
      assert.equal(move.data.state.game.status, 'finished');
      assert.equal(move.data.state.game.winner, 'black');
      assert.equal(move.data.state.game.winningLine.length, 4);
    }
  }
  assert.equal((await req('/api/room/move', challenger, { x: 1 })).status, 409);
  const watchState = await req('/api/room', watcher, undefined, 'GET');
  assert.equal(watchState.data.state.game.winner, 'black');
  assert.equal(watchState.data.state.me.seat, null);
  const reset = await req('/api/room/next-round', watcher, {});
  assert.equal(reset.status, 200);
  assert.equal(reset.data.state.game.round, 2);
  assert.equal(reset.data.state.game.status, 'selecting');
  assert.equal(reset.data.state.game.board.flat().filter(Boolean).length, 0);
  const keys = await req('/api/admin/keys', host, undefined, 'GET');
  assert.equal(keys.data.keys.find(k => k.id === entry.data.key.id).label, '사목손님');
});

test('Connect Four game selection and separate canvas hit detection are present in client', async () => {
  const root = path.join(__dirname, '..');
  const html = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(html, /data-game="connect4"/);
  assert.match(js, /7열×6행/);
  assert.match(js, /function drawConnect4Board\(/);
  assert.match(js, /function connect4Layout\(/);
  assert.match(js, /state\.gameType === 'connect4'/);
  assert.match(js, /legalColumns/);
  assert.match(html, /app\.js\?v=1\.6\.19/);
});
