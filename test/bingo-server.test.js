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
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

test('Bingo API supports 3-player authoritative turns, duplicate protection, refresh and rematch reset', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-bingo-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'bingo-test-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
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
  assert.ok(started, `test server failed to start: ${output}`);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'bingo-test-secret' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }

  const host = await login();
  const second = await login();
  const third = await login();
  const spectator = await login();
  const created = await req('/api/rooms', host, { gameType: 'bingo' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.gameType, 'bingo');
  const code = created.data.state.me.roomCode;
  for (const token of [second, third, spectator]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);

  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', second, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', third, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/choose-role', spectator, { choice: 'spectator' })).status, 200);
  assert.equal((await req('/api/room/set-bingo-target', second, { targetLines: 1 })).status, 403);
  assert.equal((await req('/api/room/set-bingo-target', host, { targetLines: 1 })).status, 200);
  const startedGame = await req('/api/room/start-bingo', host, {});
  assert.equal(startedGame.status, 200);
  assert.equal(startedGame.data.state.game.status, 'playing');
  assert.equal(startedGame.data.state.game.targetLines, 1);
  assert.equal(startedGame.data.state.game.seatOrder.length, 3);

  const tokens = { '1': host, '2': second, '3': third };
  const boards = {};
  for (const [seat, token] of Object.entries(tokens)) {
    const current = await req('/api/room', token, undefined, 'GET');
    boards[seat] = current.data.state.me.myBingoBoard;
    assert.equal(boards[seat].length, 25);
    assert.equal(new Set(boards[seat]).size, 25);
  }
  const spectatorState = await req('/api/room', spectator, undefined, 'GET');
  assert.equal(spectatorState.data.state.me.myBingoBoard, null);
  assert.equal((await req('/api/room/select-bingo', spectator, { number: 1, expectedMoveCount: 0 })).status, 403);

  let snapshot = (await req('/api/room', host, undefined, 'GET')).data.state;
  const firstSeat = snapshot.game.turn;
  const firstToken = tokens[firstSeat];
  const firstNumber = boards[firstSeat][0];
  const [fastA, fastB] = await Promise.all([
    req('/api/room/select-bingo', firstToken, { number: firstNumber, expectedMoveCount: 0 }),
    req('/api/room/select-bingo', firstToken, { number: firstNumber, expectedMoveCount: 0 }),
  ]);
  assert.deepEqual([fastA.status, fastB.status].sort(), [200, 409]);
  snapshot = (await req('/api/room', host, undefined, 'GET')).data.state;
  assert.equal(snapshot.game.selectedNumbers.filter(n => n === firstNumber).length, 1);
  assert.equal(snapshot.game.moveCount, 1);

  const nextSeat = snapshot.game.turn;
  const nextToken = tokens[nextSeat];
  const nextBoard = boards[nextSeat];
  const nextNumber = nextBoard.find(number => !snapshot.game.selectedNumbers.includes(number));
  const stale = await req('/api/room/select-bingo', nextToken, { number: nextNumber, expectedMoveCount: 0 });
  assert.equal(stale.status, 409);
  const valid = await req('/api/room/select-bingo', nextToken, { number: nextNumber, expectedMoveCount: 1 });
  assert.equal(valid.status, 200);

  const refreshed = await req('/api/room', nextToken, undefined, 'GET');
  assert.deepEqual(refreshed.data.state.me.myBingoBoard, boards[nextSeat]);
  assert.equal(refreshed.data.state.game.selectedNumbers.includes(firstNumber), true);
  assert.equal(refreshed.data.state.game.selectedNumbers.includes(nextNumber), true);

  for (let guard = 0; guard < 80; guard += 1) {
    const state = (await req('/api/room', host, undefined, 'GET')).data.state;
    if (state.game.status === 'finished') break;
    const currentSeat = state.game.turn;
    const token = tokens[currentSeat];
    const board = boards[currentSeat];
    const number = board.find(value => !state.game.selectedNumbers.includes(value));
    assert.ok(number, `seat ${currentSeat} should have an unselected number`);
    const move = await req('/api/room/select-bingo', token, { number, expectedMoveCount: state.game.moveCount });
    assert.equal(move.status, 200);
  }
  const finished = (await req('/api/room', host, undefined, 'GET')).data.state;
  assert.equal(finished.game.status, 'finished');
  assert.ok(['1','2','3'].includes(finished.game.winner));
  const winnerToken = tokens[finished.game.winner];
  const blockedNumber = boards[finished.game.winner].find(value => !finished.game.selectedNumbers.includes(value)) || boards[finished.game.winner][0];
  assert.equal((await req('/api/room/select-bingo', winnerToken, { number: blockedNumber, expectedMoveCount: finished.game.moveCount })).status, 409);

  const reset = await req('/api/room/next-round', second, {});
  assert.equal(reset.status, 200);
  assert.equal(reset.data.state.game.status, 'selecting');
  assert.equal(reset.data.state.game.round, 2);
  assert.deepEqual(reset.data.state.game.selectedNumbers, []);
  assert.equal(reset.data.state.game.moveCount, 0);
  assert.equal(reset.data.state.me.seat, '2');
  assert.equal(reset.data.state.me.myBingoBoard, null);
  assert.equal(reset.data.state.game.targetLines, 1);
  const restarted = await req('/api/room/start-bingo', host, {});
  assert.equal(restarted.status, 200);
  const newHostBoard = (await req('/api/room', host, undefined, 'GET')).data.state.me.myBingoBoard;
  assert.equal(newHostBoard.length, 25);
  assert.notDeepEqual(newHostBoard, boards['1']);
});

test('Bingo grid size and number-pool are host-configurable (v1.6.66) and generate matching boards', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-bingo-config-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'bingo-config-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
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
  assert.ok(started, `test server failed to start: ${output}`);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'bingo-config-secret' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }

  const host = await login();
  const second = await login();
  const created = await req('/api/rooms', host, { gameType: 'bingo' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  assert.equal((await req('/api/rooms/join', second, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', second, { choice: '2' })).status, 200);

  // Only the host may configure it, and only before the game starts.
  assert.equal((await req('/api/room/set-bingo-grid', second, { gridSize: 7 })).status, 403);
  assert.equal((await req('/api/room/set-bingo-grid', host, { gridSize: 6 })).data.error, 'INVALID_BINGO_GRID');
  assert.equal((await req('/api/room/set-bingo-pool', host, { poolMax: 60 })).data.error, 'INVALID_BINGO_POOL');

  const gridSet = await req('/api/room/set-bingo-grid', host, { gridSize: 7 });
  assert.equal(gridSet.status, 200);
  const poolSet = await req('/api/room/set-bingo-pool', host, { poolMax: 150 });
  assert.equal(poolSet.status, 200);
  // Setting a 7x7 grid raises the target-line ceiling from 12 to 16, so a value in between is now legal.
  assert.equal((await req('/api/room/set-bingo-target', host, { targetLines: 16 })).status, 200);
  assert.equal((await req('/api/room/set-bingo-target', host, { targetLines: 17 })).data.error, 'INVALID_BINGO_TARGET');

  const startedGame = await req('/api/room/start-bingo', host, {});
  assert.equal(startedGame.status, 200);
  assert.equal(startedGame.data.state.game.gridSize, 7);
  assert.equal(startedGame.data.state.game.poolMax, 150);

  const hostBoard = (await req('/api/room', host, undefined, 'GET')).data.state.me.myBingoBoard;
  assert.equal(hostBoard.length, 49);
  assert.equal(new Set(hostBoard).size, 49);
  assert.ok(hostBoard.every(n => n >= 1 && n <= 150));

  // Settings lock once play begins.
  assert.equal((await req('/api/room/set-bingo-grid', host, { gridSize: 5 })).data.error, 'INVALID_BINGO_GRID');
});

test('Bingo resign (v1.6.49) ends the match immediately and credits every other seated player as the winner, as an array', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-bingo-resign-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'bingo-resign-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  proc.stdout.on('data', chunk => output += chunk.toString());
  proc.stderr.on('data', chunk => output += chunk.toString());
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
  assert.ok(started, `test server failed to start: ${output}`);

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let data = {};
    try { data = await res.json(); } catch {}
    return { status: res.status, data };
  }
  async function login() {
    const response = await req('/api/admin/login', null, { password: 'bingo-resign-secret' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }

  const host = await login();
  const second = await login();
  const third = await login();
  const created = await req('/api/rooms', host, { gameType: 'bingo' });
  assert.equal(created.status, 201);
  const code = created.data.state.me.roomCode;
  for (const token of [second, third]) assert.equal((await req('/api/rooms/join', token, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  assert.equal((await req('/api/room/choose-role', second, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', third, { choice: '3' })).status, 200);
  assert.equal((await req('/api/room/start-bingo', host, {})).status, 200);

  // Host resigns mid-game; the two remaining seated players (2 and 3) are both credited as
  // winners -- always an array here (never collapsed to a lone scalar), matching how the other
  // free-for-all games' own displays already expect a resign-ended winner to be shaped.
  const resigned = await req('/api/room/resign', host, {});
  assert.equal(resigned.status, 200);
  assert.equal(resigned.data.state.game.status, 'finished');
  assert.deepEqual(resigned.data.state.game.winner.sort(), ['2', '3']);
  assert.equal(resigned.data.state.game.endReason, 'resign');
  // The game is already finished, so a further select-bingo move is rejected.
  assert.equal((await req('/api/room/select-bingo', second, { number: 1, expectedMoveCount: resigned.data.state.game.moveCount })).status, 409);
});

test('Bingo lobby and room UI expose the host controls, numbered seats and private board selection', async () => {
  const root = path.join(__dirname, '..');
  const [html, app, css, server] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'public/styles.css'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
  ]);
  assert.match(html, /data-game="bingo"/);
  assert.match(html, /id="bingoTargetSelect"/);
  assert.match(html, /id="bingoStartBtn"/);
  assert.match(html, /id="bingoBoard"/);
  assert.match(html, /app\.js\?v=1\.6\.76/);
  assert.match(app, /function isBingoGame\(/);
  assert.match(app, /function renderBingo\(/);
  assert.match(app, /roomAction\('select-bingo'/);
  assert.match(server, /start-bingo\|select-bingo/);
  assert.match(css, /Bingo v1\.6\.22/);
});

// v1.6.65: white board + larger digits + a red diagonal hatch marking a chosen number, replacing
// the old dark navy tiles and solid green fill (readability request).
test('Bingo cells are a white board with larger digits and a red hatch marks a selected number', async () => {
  const root = path.join(__dirname, '..');
  const css = await fs.readFile(path.join(root, 'public/styles.css'), 'utf8');
  const cellRule = css.match(/\.bingoCell\{[^}]*\}/)?.[0];
  assert.ok(cellRule, '.bingoCell rule missing');
  assert.match(cellRule, /background:#fff/);
  assert.match(cellRule, /color:#0f172a/);
  assert.match(cellRule, /font-size:clamp\(1\.2rem,3\.6vw,1\.7rem\)/);
  const selectedRule = css.match(/\.bingoCell\.selected\{[^}]*\}/)?.[0];
  assert.ok(selectedRule, '.bingoCell.selected rule missing');
  assert.match(selectedRule, /repeating-linear-gradient\(45deg,rgba\(220,38,38,\.9\)/);
  assert.doesNotMatch(selectedRule, /#14532d/); // old solid dark-green fill
});
