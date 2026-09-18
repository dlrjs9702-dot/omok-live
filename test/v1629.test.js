'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const city = require('../lib/games/cityking');
const yut = require('../lib/games/yut');
const root = path.resolve(__dirname, '..');
const dice = () => 1;

test('Land King: one build per owned-city landing, all three levels, value and tolls', () => {
  const g = city.create(); city.start(g, ['1', '2']);
  g.owners[3] = '1'; g.players['1'].properties.push(3);
  for (let level = 1; level <= 3; level++) {
    g.turn = '1'; g.phase = 'roll'; g.players['1'].position = 1;
    const result = city.rollDice(g, '1', 'roll' + level, dice);
    assert.equal(result.phase, 'build');
    assert.equal(g.pendingProperty, 3);
    assert.equal(city.buildProperty(g, '2', 'bad').reason, 'not-your-turn');
    const before = city.netWorth(g, '1');
    const cash = g.players['1'].cash;
    assert.equal(city.buildProperty(g, '1', 'build' + level).legal, true);
    assert.equal(g.players['1'].cash, cash - 70);
    assert.equal(city.netWorth(g, '1'), before);
    assert.equal(g.developments[3], level);
    assert.equal(city.publicState(g).tolls[3], 50 * [1, 2, 3, 5][level]);
    assert.equal(city.buildProperty(g, '1', 'repeat').legal, false);
  }
  g.turn = '1'; g.phase = 'roll'; g.players['1'].position = 1;
  assert.equal(city.rollDice(g, '1', 'max', dice).phase, 'roll');
  assert.equal(g.pendingProperty, null);
  g.turn = '2'; g.phase = 'roll'; g.players['2'].position = 1;
  const cash = g.players['2'].cash;
  city.rollDice(g, '2', 'toll', dice);
  assert.equal(g.players['2'].cash, cash - 250);
  city.reset(g);
  assert.deepEqual(g.developments, {});
  assert.equal(city.publicState(g).tolls[3], 50);
});

test('Land King: no building on another tile or without cash; skip is allowed', () => {
  const g = city.create(); city.start(g, ['1', '2']);
  assert.equal(city.buildProperty(g, '1', 'early').reason, 'not-buildable');
  g.owners[3] = '1'; g.players['1'].properties.push(3);
  g.players['1'].position = 1; g.players['1'].cash = 50;
  city.rollDice(g, '1', 'arrive', dice);
  assert.equal(g.phase, 'build');
  assert.equal(city.buildProperty(g, '1', 'poor').reason, 'not-enough-cash');
  assert.equal(city.skipBuild(g, '2', 'other').reason, 'not-your-turn');
  assert.equal(city.skipBuild(g, '1', 'skip').legal, true);
  assert.equal(g.turn, '1');
  assert.equal(g.developments[3], undefined);
});

test('Yut: a piece resting on center always departs via the short 10-side diagonal, regardless of arrival route', () => {
  assert.equal(yut.destination({ status: 'board', position: 22, route: 'shortcut5' }, 1).position, 23);
  // Stopping exactly on 23 always leaves toward home via 28/29, whichever diagonal it arrived on.
  assert.equal(yut.destination({ status: 'board', position: 23, route: 'shortcut5' }, 1).position, 28);
  assert.equal(yut.destination({ status: 'board', position: 23, route: 'shortcut10' }, 1).position, 28);
  // Passing through 23 mid-throw (not stopping there) keeps the original diagonal unchanged.
  assert.equal(yut.destination({ status: 'board', position: 21, route: 'shortcut5' }, 4).position, 25);
  assert.equal(yut.destination({ status: 'board', position: 25, route: 'shortcut5' }, 1).position, 15);
  // 29 is now one step short of actually finishing: it rests on the finish line first.
  assert.equal(yut.destination({ status: 'board', position: 29, route: 'shortcut10' }, 1).position, 'finishLine');
  assert.equal(yut.destination({ status: 'board', position: 'finishLine', route: 'shortcut10' }, 1).status, 'finished');
  const g = yut.create(); yut.start(g);
  Object.assign(g.pieces.black[0], { status:'board', position:23, route:'shortcut5' });
  Object.assign(g.pieces.black[1], { status:'board', position:23, route:'shortcut10' });
  g.phase = 'move'; g.pendingSteps = 1;
  const options = yut.legalMoves(g, 'black').filter(m => ['black-1','black-2'].includes(m.pieceId));
  assert.equal(options.length, 1);
  assert.equal(options[0].destination.position, 28);
  assert.equal(yut.applyMove(g, 'black-1', 'black', 'center').legal, true);
  assert.equal(g.pieces.black[0].position, 28);
  assert.equal(g.pieces.black[1].position, 28);
  assert.equal(g.pieces.black[1].route, 'shortcut10');
  const js = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  assert.match(js, /\[5,21,22,23,24,25,15\], \[10,26,27,23,28,29,0\]/);
});

test('UI: logout requires a second explicit click; lobby return retains session', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  assert.match(html, /id="logoutDialog"/);
  assert.match(html, /접속을 종료하시겠습니까\? 다시 이용하려면 입장 파일을 열어야 합니다\./);
  assert.match(html, /id="logoutConfirmBtn"[^>]*>접속 종료<\/button>/);
  assert.match(html, /id="leaveRoomBtn"[^>]*>로비로 돌아가기<\/button>/);
  assert.match(js, /logoutBtn\.addEventListener\('click', requestLogout\)/);
  assert.match(js, /roomLogoutBtn\.addEventListener\('click', requestLogout\)/);
  assert.match(js, /logoutCancelBtn\.addEventListener\('click', \(\) => logoutDialog\.close\(\)\)/);
  assert.match(js, /logoutConfirmBtn\.addEventListener\('click', \(\) => \{ logoutDialog\.close\(\); logout\(\); \}\)/);
  assert.match(js, /async function leaveRoom\(\) \{[\s\S]*?api\('\/api\/room\/leave'/);
  assert.match(server, /build-city\|skip-build-city/);
});
