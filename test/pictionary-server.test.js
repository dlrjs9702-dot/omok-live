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

test('Pictionary API isolates the secret word, gates drawing to the drawer, scores guesses and restores strokes on reconnect', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-pictionary-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'pictionary-test-secret', NODE_ENV: 'test' },
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
    const response = await req('/api/admin/login', null, { password: 'pictionary-test-secret' });
    assert.equal(response.status, 200);
    return response.data.sessionToken;
  }

  const host = await login();
  const guesser = await login();
  const spectatorToken = await login();

  const created = await req('/api/rooms', host, { gameType: 'pictionary' });
  assert.equal(created.status, 201);
  assert.equal(created.data.state.gameType, 'pictionary');
  const code = created.data.state.me.roomCode;

  assert.equal((await req('/api/room/choose-role', host, { choice: '1' })).status, 200);
  // A single seated player cannot start a round.
  const tooFew = await req('/api/room/start-pictionary', host, {});
  assert.equal(tooFew.status, 409);
  assert.equal(tooFew.data.error, 'INVALID_PICTIONARY_START');

  assert.equal((await req('/api/rooms/join', guesser, { code })).status, 200);
  assert.equal((await req('/api/rooms/join', spectatorToken, { code })).status, 200);
  assert.equal((await req('/api/room/choose-role', guesser, { choice: '2' })).status, 200);
  assert.equal((await req('/api/room/choose-role', spectatorToken, { choice: 'spectator' })).status, 200);

  const start = await req('/api/room/start-pictionary', host, {});
  assert.equal(start.status, 200);
  assert.equal(start.data.state.game.status, 'playing');
  assert.equal(start.data.state.game.phase, 'drawing');
  const drawerSeat = start.data.state.game.drawerSeat;
  const tokens = { '1': host, '2': guesser };
  const drawerToken = tokens[drawerSeat];
  const guesserSeat = drawerSeat === '1' ? '2' : '1';
  const guesserToken = tokens[guesserSeat];

  const drawerView = (await req('/api/room', drawerToken, undefined, 'GET')).data.state;
  const guesserView = (await req('/api/room', guesserToken, undefined, 'GET')).data.state;
  const spectatorView = (await req('/api/room', spectatorToken, undefined, 'GET')).data.state;
  assert.ok(typeof drawerView.me.myWord === 'string' && drawerView.me.myWord.length > 0, 'drawer must see the word');
  assert.equal(guesserView.me.myWord, null, 'non-drawer must never receive the word');
  assert.equal(spectatorView.me.myWord, null, 'spectator must never receive the word');
  const secretWord = drawerView.me.myWord;

  // Only the drawer may draw.
  const blockedStroke = await req('/api/room/pictionary-stroke', guesserToken, { stroke: { points: [[0.1, 0.1], [0.2, 0.2]], color: '#111111', width: 4, tool: 'pen' } });
  assert.equal(blockedStroke.status, 409); // seated but not the drawer
  const spectatorStroke = await req('/api/room/pictionary-stroke', spectatorToken, { stroke: { points: [[0.1, 0.1], [0.2, 0.2]], color: '#111111', width: 4, tool: 'pen' } });
  assert.equal(spectatorStroke.status, 403);

  const drawn = await req('/api/room/pictionary-stroke', drawerToken, { stroke: { points: [[0.1, 0.1], [0.5, 0.5], [0.9, 0.1]], color: '#ff0000', width: 6, tool: 'pen' } });
  assert.equal(drawn.status, 200);
  assert.equal(drawn.data.state.game.strokes.length, 1);

  // Reconnecting (a fresh GET, as a reload would do) must show the same in-progress drawing.
  const reconnected = await req('/api/room', guesserToken, undefined, 'GET');
  assert.equal(reconnected.data.state.game.strokes.length, 1);
  assert.equal(reconnected.data.state.game.strokes[0].color, '#ff0000');

  // Spectators and the drawer cannot submit guesses.
  assert.equal((await req('/api/room/pictionary-guess', spectatorToken, { guess: secretWord })).status, 403);
  assert.equal((await req('/api/room/pictionary-guess', drawerToken, { guess: secretWord })).status, 409);

  const wrongGuess = await req('/api/room/pictionary-guess', guesserToken, { guess: '절대아닐정답' });
  assert.equal(wrongGuess.status, 200);
  assert.equal(wrongGuess.data.state.game.correctGuessers.length, 0);
  assert.equal(wrongGuess.data.state.game.scores[guesserSeat], 0);

  // Correct guess (allowing surrounding whitespace) scores the guesser and, since every eligible
  // guesser has now answered, immediately ends the round (drawer gets the 50-point bonus too).
  const rightGuess = await req('/api/room/pictionary-guess', guesserToken, { guess: `  ${secretWord}  ` });
  assert.equal(rightGuess.status, 200);
  assert.equal(rightGuess.data.state.game.correctGuessers.includes(guesserSeat), true);
  assert.equal(rightGuess.data.state.game.scores[guesserSeat], 100);
  assert.equal(rightGuess.data.state.game.phase, 'reveal');
  assert.equal(rightGuess.data.state.game.scores[drawerSeat], 50);
  assert.equal(rightGuess.data.state.game.lastRound.word, secretWord);

  // Duplicate correct guesses are rejected.
  assert.equal((await req('/api/room/pictionary-guess', guesserToken, { guess: secretWord })).status, 409);

  // Board moves stay unsupported, but resigning (v1.6.49) now works: it ends the game immediately
  // and credits every other seated player -- just the drawer here -- as the winner.
  const resigned = await req('/api/room/resign', guesserToken, {});
  assert.equal(resigned.status, 200);
  assert.equal(resigned.data.state.game.status, 'finished');
  assert.deepEqual(resigned.data.state.game.winner, [drawerSeat]);
  assert.equal(resigned.data.state.game.endReason, 'resign');
  assert.equal((await req('/api/room/move', guesserToken, { x: 0, y: 0 })).status, 400);
});
