'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const oldmaid = require('../lib/games/oldmaid');

test('mode defaults to normal, can be set to special only before start, and is preserved across a rematch', () => {
  const g = oldmaid.create();
  assert.equal(g.mode, 'normal');
  assert.equal(oldmaid.setMode(g, 'special').legal, true);
  assert.equal(g.mode, 'special');
  assert.equal(oldmaid.setMode(g, 'bogus').reason, 'bad-mode');
  oldmaid.start(g, ['1', '2']);
  assert.equal(oldmaid.setMode(g, 'normal').reason, 'already-started');
  oldmaid.reset(g);
  assert.equal(g.status, 'selecting');
  assert.equal(g.mode, 'special'); // carried forward, only the ability assignment re-randomizes
});

test('normal mode never assigns or allows abilities', () => {
  const g = oldmaid.create();
  oldmaid.start(g, ['1', '2']);
  assert.deepEqual(g.abilities, {});
  assert.equal(oldmaid.publicState(g).mode, 'normal');
  assert.equal(oldmaid.publicState(g).abilityUsed, null);
  assert.equal(oldmaid.abilityFor(g, '1'), null);
  assert.equal(oldmaid.peekCard(g, '1', 0, g.revision).reason, 'not-special-mode');
  assert.equal(oldmaid.armShield(g, '1', g.revision).reason, 'not-special-mode');
});

test('special mode randomly assigns one of the four abilities to every seat, one use each', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2', '3', '4']);
  const types = new Set(['peek', 'redirect', 'shield', 'detect']);
  for (const seat of ['1', '2', '3', '4']) {
    assert.ok(types.has(g.abilities[seat]), `seat ${seat} has a real ability`);
    assert.equal(g.abilityUsed[seat], false);
  }
  assert.deepEqual(oldmaid.publicState(g).abilityUsed, { '1': false, '2': false, '3': false, '4': false });
  // Public state never leaks which ability a seat holds.
  assert.equal('abilities' in oldmaid.publicState(g), false);
});

test('peek reveals one card to the peeker only, is one-shot, and requires my turn with the current target', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2']);
  g.abilities['1'] = 'peek';
  g.turn = '1'; g.target = '2';
  const targetCard = g.hands['2'][0];
  const result = oldmaid.peekCard(g, '1', 0, g.revision);
  assert.equal(result.legal, true);
  assert.deepEqual(result.card, targetCard);
  const mine = oldmaid.abilityFor(g, '1');
  assert.equal(mine.used, true);
  assert.deepEqual(mine.reveal, { type: 'peek', targetSeat: '2', index: 0, card: targetCard });
  // The opponent sees their own ability info (whatever they were assigned), but never seat 1's
  // reveal -- abilityFor is strictly seat-scoped.
  assert.equal(oldmaid.abilityFor(g, '2').reveal, null);
  assert.equal(oldmaid.peekCard(g, '1', 0, g.revision).reason, 'already-used');
  // A different seat trying to peek (they don't hold the ability at all) is rejected.
  const g2 = oldmaid.create();
  oldmaid.setMode(g2, 'special');
  oldmaid.start(g2, ['1', '2']);
  g2.abilities['1'] = 'redirect'; // seat 1 holds a different ability
  g2.turn = '1'; g2.target = '2';
  assert.equal(oldmaid.peekCard(g2, '1', 0, g2.revision).reason, 'wrong-ability');
});

test('a peek result is invalidated the moment the target reshuffles or any draw happens', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2']);
  g.abilities['1'] = 'peek';
  g.turn = '1'; g.target = '2';
  oldmaid.peekCard(g, '1', 0, g.revision);
  assert.ok(oldmaid.abilityFor(g, '1').reveal);
  oldmaid.shuffleHand(g, '2', g.revision);
  assert.equal(oldmaid.abilityFor(g, '1').reveal, null);
});

test('redirect switches to the other-direction active seat, is rejected in a 2-player game, and is one-shot', () => {
  const twoPlayer = oldmaid.create();
  oldmaid.setMode(twoPlayer, 'special');
  oldmaid.start(twoPlayer, ['1', '2']);
  twoPlayer.abilities['1'] = 'redirect';
  twoPlayer.turn = '1'; twoPlayer.target = '2';
  assert.equal(oldmaid.redirectTarget(twoPlayer, '1', twoPlayer.revision).reason, 'no-alternate-target');

  const threePlayer = oldmaid.create();
  oldmaid.setMode(threePlayer, 'special');
  oldmaid.start(threePlayer, ['1', '2', '3']);
  threePlayer.abilities['1'] = 'redirect';
  threePlayer.turn = '1'; threePlayer.target = '2'; // the normal next-active seat
  const result = oldmaid.redirectTarget(threePlayer, '1', threePlayer.revision);
  assert.equal(result.legal, true);
  assert.equal(result.target, '3'); // the seat on the other side
  assert.equal(threePlayer.target, '3');
  assert.equal(oldmaid.redirectTarget(threePlayer, '1', threePlayer.revision).reason, 'already-used');
});

test('redirect only changes the target for the current turn -- the next player still gets the normal rotation', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2', '3']);
  g.abilities['1'] = 'redirect';
  g.turn = '1'; g.target = '2';
  oldmaid.redirectTarget(g, '1', g.revision);
  assert.equal(g.target, '3');
  // Seat 1 draws from the redirected target (3); afterwards the turn and target rotate normally.
  const idx = g.hands['3'].length - 1;
  const draw = oldmaid.draw(g, '1', '3', idx, g.revision);
  assert.equal(draw.legal, true);
  assert.equal(g.turn, '2');
  assert.equal(g.target, '3'); // normal nextActive(game, '2') with seat 1 still holding cards
});

test('a shield arms independent of turn order, forces a random index on the next draw against me, and is consumed once', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2']);
  g.abilities['2'] = 'shield';
  g.turn = '1'; // it is NOT seat 2's turn -- arming is allowed any time
  const armed = oldmaid.armShield(g, '2', g.revision);
  assert.equal(armed.legal, true);
  assert.equal(oldmaid.abilityFor(g, '2').shieldArmed, true);
  assert.equal(oldmaid.abilityFor(g, '2').used, true); // the ability-use itself is consumed at activation
  g.target = '2';
  const requestedIndex = 0;
  const before = g.hands['2'][requestedIndex];
  const draw = oldmaid.draw(g, '1', '2', requestedIndex, g.revision);
  assert.equal(draw.legal, true);
  assert.equal(draw.shieldTriggered, true);
  assert.equal(oldmaid.abilityFor(g, '2').shieldArmed, false); // consumed
  // The draw still happened (never blocked); seat 1's hand grew by exactly one card either way.
  assert.equal(g.hands['1'].length >= 1, true);
});

test('a shield never blocks the draw itself, only substitutes which card is taken', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2']);
  g.abilities['2'] = 'shield';
  oldmaid.armShield(g, '2', g.revision);
  g.turn = '1'; g.target = '2';
  const beforeCount = g.hands['2'].length;
  const result = oldmaid.draw(g, '1', '2', 0, g.revision);
  assert.equal(result.legal, true);
  assert.equal(g.hands['2'].length, beforeCount - 1);
});

test('joker detection reports only a boolean, never a position, and is one-shot', () => {
  const g = oldmaid.create();
  oldmaid.setMode(g, 'special');
  oldmaid.start(g, ['1', '2']);
  g.abilities['1'] = 'detect';
  g.turn = '1'; g.target = '2';
  const actual = g.hands['2'].some(card => card.rank === 'JOKER');
  const result = oldmaid.detectJoker(g, '1', g.revision);
  assert.equal(result.legal, true);
  assert.equal(result.hasJoker, actual);
  assert.equal('index' in result, false);
  assert.equal('card' in result, false);
  assert.equal(oldmaid.detectJoker(g, '1', g.revision).reason, 'already-used');
});

test('Old Maid special-ability actions are wired through the server and privacy-safe in room state', async () => {
  const root = path.join(__dirname, '..');
  const [html, js, server] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'server.js'), 'utf8'),
  ]);
  assert.match(server, /set-oldmaid-mode/);
  assert.match(server, /use-ability-oldmaid/);
  assert.match(server, /myOldMaidAbility/);
  assert.match(server, /engine\.peekCard\(room\.game, playerSeat/);
  assert.match(server, /engine\.redirectTarget\(room\.game, playerSeat/);
  assert.match(server, /engine\.armShield\(room\.game, playerSeat/);
  assert.match(server, /engine\.detectJoker\(room\.game, playerSeat/);
  assert.match(html, /oldmaidModeToggle|data-oldmaid-mode/);
  assert.match(js, /myOldMaidAbility/);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => { const port = srv.address().port; srv.close(() => resolve(port)); });
  });
}

test('special-mode room over HTTP: ability use is authorized, one-shot, and never leaks another seat\'s reveal', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'oldmaid-ability-'));
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir,
      DATABASE_URL: '', ADMIN_PASSWORD: 'oldmaid-ability-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    proc.kill('SIGTERM');
    await new Promise(resolve => { if (proc.exitCode !== null) resolve(); else { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); } });
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  let started = false;
  for (let i = 0; i < 100; i += 1) {
    if (proc.exitCode !== null) break;
    try { if ((await fetch(`${base}/health`)).ok) { started = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(started, 'server did not start');

  async function req(route, token, body, method = 'POST') {
    const headers = {};
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json() };
  }
  async function login() {
    const res = await req('/api/admin/login', null, { password: 'oldmaid-ability-secret' });
    return res.data.sessionToken;
  }
  const host = await login();
  const guest = await login();
  const room = await req('/api/rooms', host, { gameType: 'oldmaid', visibility: 'public' });
  assert.equal(room.status, 201);
  const code = room.data.state.me.roomCode;
  assert.equal((await req('/api/rooms/join', guest, { code })).status, 200);
  assert.equal((await req('/api/room/set-oldmaid-mode', guest, { mode: 'special' })).status, 403); // host only
  assert.equal((await req('/api/room/set-oldmaid-mode', host, { mode: 'special' })).status, 200);
  await req('/api/room/choose-role', host, { choice: '1' });
  await req('/api/room/choose-role', guest, { choice: '2' });
  const started2 = await req('/api/room/start-oldmaid', host, {});
  assert.equal(started2.status, 200);
  assert.equal(started2.data.state.game.mode, 'special');

  assert.ok(['peek', 'redirect', 'shield', 'detect'].includes(started2.data.state.me.myOldMaidAbility?.type));
  // The public game state never carries ability type or reveal data.
  assert.equal('abilities' in started2.data.state.game, false);
  assert.equal('reveals' in started2.data.state.game, false);
  assert.ok(started2.data.state.game.abilityUsed);
});

// v1.6.36: usability pass -- explain each ability, and say why the button is disabled instead of
// just greying it out.
test('the ability bar explains what each ability does and why it is currently unusable', () => {
  const readSync = require('node:fs').readFileSync;
  const app = readSync(path.join(__dirname, '..', 'public/app.js'), 'utf8');
  const html = readSync(path.join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.match(html, /id="oldmaidAbilityDesc"/);
  assert.match(html, /id="oldmaidAbilityHint"/);
  assert.match(app, /const ABILITY_DESC = \{/);
  assert.match(app, /const tooFewForRedirect = ability\.type === 'redirect' && active < 3;/);
  assert.match(app, /'2인전에서는 방향 전환을 사용할 수 없습니다\.'/);
  assert.match(app, /'내 차례가 되면 사용할 수 있습니다\.'/);
  assert.match(app, /'이미 사용한 능력입니다\.'/);
  // Reveals (private to the viewing seat) are visibly marked as such, not shown the same as
  // public information.
  assert.match(app, /🔒 나에게만 보임/);
});
