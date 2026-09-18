from pathlib import Path


def swap(path, before, after, count=1):
    file = Path(path)
    source = file.read_text(encoding='utf-8')
    found = source.count(before)
    if found != count:
        raise RuntimeError(f'{path}: expected {count} anchors, found {found}: {before[:90]!r}')
    file.write_text(source.replace(before, after, count), encoding='utf-8')


# 1. Land King: all costs and tolls are calculated in the authoritative engine.
p = 'lib/games/cityking.js'
swap(p, 'const TURN_LIMIT = 50;', "const TURN_LIMIT = 50;\nconst BUILD_NAMES = ['도시', '별장', '빌딩', '호텔'];\nconst TOLL_MULTIPLIERS = [1, 2, 3, 5];")
swap(p, '상대가 소유한 도시에 도착하면 통행료를 냅니다. 출발을', '상대 도시에 도착하면 개발 단계에 따른 통행료를 냅니다. 자기 소유 도시에 도착할 때 매입가의 절반을 내고 별장·빌딩·호텔을 한 단계씩 지을 수 있습니다. 출발을')
swap(p, '    owners: {}, moves: [],', '    owners: {}, developments: {}, moves: [],')
swap(p, "function netWorth(game, color) {\n  return game.players[color].cash + game.players[color].properties.reduce((sum, index) => sum + (TILES[index].price || 0), 0);\n}", """function propertyLevel(game, index) {
  return Math.max(0, Math.min(3, Number(game.developments?.[index]) || 0));
}
function buildCost(index) { return Math.floor((TILES[index]?.price || 0) / 2); }
function propertyToll(game, index) { return (TILES[index]?.toll || 0) * TOLL_MULTIPLIERS[propertyLevel(game, index)]; }
function netWorth(game, color) {
  return game.players[color].cash + game.players[color].properties.reduce((sum, index) =>
    sum + (TILES[index].price || 0) + buildCost(index) * propertyLevel(game, index), 0);
}""")
swap(p, """    if (owner !== color) {
      player.cash -= tile.toll;
      game.players[owner].cash += tile.toll;
      game.lastEvent = `${tile.name} 통행료 ${tile.toll}을 지불했습니다.`;
      if (bankruptIfNeeded(game, color)) return;
    } else game.lastEvent = `내 도시 ${tile.name}에 도착했습니다.`;""", """    if (owner !== color) {
      const toll = propertyToll(game, tile.index);
      player.cash -= toll;
      game.players[owner].cash += toll;
      game.lastEvent = `${tile.name} 통행료 ${toll}을 지불했습니다.`;
      if (bankruptIfNeeded(game, color)) return;
    } else {
      game.lastEvent = `내 도시 ${tile.name}에 도착했습니다.`;
      if (propertyLevel(game, tile.index) < 3) {
        game.pendingProperty = tile.index;
        game.phase = 'build';
        return;
      }
    }""")
swap(p, '  game.owners[tile.index] = color;\n  game.lastEvent', '  game.owners[tile.index] = color;\n  game.developments ||= {};\n  game.developments[tile.index] = 0;\n  game.lastEvent')
swap(p, 'function applyMove() { return { legal: false, reason: \'wrong-action\' }; }', """function buildProperty(game, color, at) {
  if (!validColor(color)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };
  const index = game.pendingProperty;
  if (game.phase !== 'build' || index === null || game.owners[index] !== color || game.players[color].position !== index)
    return { legal: false, reason: 'not-buildable' };
  const level = propertyLevel(game, index);
  if (level >= 3) return { legal: false, reason: 'max-level' };
  const cost = buildCost(index);
  if (game.players[color].cash < cost) return { legal: false, reason: 'not-enough-cash' };
  game.players[color].cash -= cost;
  game.developments ||= {};
  game.developments[index] = level + 1;
  game.lastEvent = `${TILES[index].name}에 ${BUILD_NAMES[level + 1]} 건설 · 비용 ${cost} · 통행료 ${propertyToll(game, index)}`;
  game.moves.push({ type: 'build', color, property: index, level: level + 1, cost, at });
  advanceTurn(game);
  return { legal: true, property: index, level: level + 1, finished: game.status !== 'playing' };
}

function skipBuild(game, color, at) {
  if (!validColor(color)) return { legal: false, reason: 'not-player' };
  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };
  const index = game.pendingProperty;
  if (game.phase !== 'build' || index === null || game.owners[index] !== color || game.players[color].position !== index)
    return { legal: false, reason: 'not-buildable' };
  game.moves.push({ type: 'skip-build', color, property: index, at });
  game.lastEvent = `${TILES[index].name} 건설을 건너뛰었습니다.`;
  advanceTurn(game);
  return { legal: true, property: index, finished: game.status !== 'playing' };
}

function applyMove() { return { legal: false, reason: 'wrong-action' }; }""")
swap(p, "if (reason === 'must-buy') return '도시를 매입하거나 통행을 확인한 뒤 다음 차례로 넘어갑니다.';", "if (reason === 'must-buy') return '도시 매입 또는 건설 여부를 선택한 뒤 다음 차례로 넘어갑니다.';")
swap(p, "  if (reason === 'not-enough-cash') return '현금이 부족해 이 도시를 매입할 수 없습니다.';", "  if (reason === 'not-enough-cash') return '현금이 부족해 매입하거나 건설할 수 없습니다.';\n  if (reason === 'not-buildable') return '자기 소유 도시에 도착했을 때만 건설할 수 있습니다.';\n  if (reason === 'max-level') return '호텔까지 건설한 도시는 더 개발할 수 없습니다.';")
swap(p, '    tiles: TILES, players: game.players, owners: game.owners,', "    tiles: TILES, players: game.players, owners: game.owners, developments: game.developments || {},\n    tolls: Object.fromEntries(TILES.filter(tile => tile.type === 'property').map(tile => [tile.index, propertyToll(game, tile.index)])),")
swap(p, 'rollDice, buyProperty, skipProperty, applyMove, publicState, moveError, netWorth };', 'rollDice, buyProperty, skipProperty, buildProperty, skipBuild, propertyLevel, propertyToll, buildCost, applyMove, publicState, moveError, netWorth };')
print('1/3 Land King engine patched')

p = 'server.js'
swap(p, "  if (action === 'move') {", """  if (action === 'build-city' || action === 'skip-build-city') {
    if (room.gameType !== 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 건설할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 건설할 수 없습니다.');
    const engine = getGame('cityking');
    const verdict = action === 'build-city' ? engine.buildProperty(room.game, seat, nowIso()) : engine.skipBuild(room.game, seat, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_BUILD', engine.moveError(verdict.reason));
  }

  if (action === 'move') {""")
swap(p, 'roll-city|buy-city|skip-city|move|resign', 'roll-city|buy-city|skip-city|build-city|skip-build-city|move|resign')
swap(p, '랜드킹은 주사위와 도시 매입 기능을 이용해 주세요.', '랜드킹은 주사위·도시 매입·건설 기능을 이용해 주세요.')

p = 'public/index.html'
swap(p, '            <div class="cityBuyRow"><span id="cityPropertyOffer"></span><button id="cityBuyBtn" class="secondary" type="button">도시 매입</button><button id="citySkipBtn" class="ghost" type="button">매입 안 함</button></div>', '''            <div class="cityBuyRow"><span id="cityPropertyOffer"></span><button id="cityBuyBtn" class="secondary" type="button">도시 매입</button><button id="citySkipBtn" class="ghost" type="button">매입 안 함</button></div>
            <div class="cityBuildRow hidden" id="cityBuildRow"><span id="cityBuildOffer"></span><button id="cityBuildBtn" class="secondary" type="button">건설</button><button id="cityBuildSkipBtn" class="ghost" type="button">건설 안 함</button></div>''')

p = 'public/app.js'
swap(p, "  const citySkipBtn = document.getElementById('citySkipBtn');", """  const citySkipBtn = document.getElementById('citySkipBtn');
  const cityBuildRow = document.getElementById('cityBuildRow');
  const cityBuildOffer = document.getElementById('cityBuildOffer');
  const cityBuildBtn = document.getElementById('cityBuildBtn');
  const cityBuildSkipBtn = document.getElementById('cityBuildSkipBtn');""")
swap(p, '출발 보너스와 이벤트를 활용해 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.', '자기 소유 도시에 도착하면 매입가의 50%로 별장·빌딩·호텔을 방문당 한 단계 건설할 수 있습니다. 통행료는 기본·2배·3배·5배이며, 건설비는 순자산에 포함됩니다. 출발 보너스와 이벤트를 활용해 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.')
swap(p, "    cityTileName.textContent = tile ? `${tile.index}번 · ${tile.name}` : '칸 정보 없음';", """    const level = tile?.type === 'property' ? Math.max(0, Math.min(3, Number(g.developments?.[tile.index]) || 0)) : 0;
    const building = ['도시', '별장', '빌딩', '호텔'][level];
    cityTileName.textContent = tile ? `${tile.index}번 · ${tile.name}${g.owners?.[tile.index] ? ` · ${building} (${level}단계)` : ''}` : '칸 정보 없음';""")
swap(p, "    cityTileToll.textContent = tile?.type === 'property' ? `${tile.toll}` : '-';", "    cityTileToll.textContent = tile?.type === 'property' ? `${g.tolls?.[tile.index] ?? tile.toll}` : '-';")
swap(p, "    citySkipBtn.disabled = !canBuy;\n  }", """    citySkipBtn.disabled = !canBuy;
    const buildTile = g.phase === 'build' && g.pendingProperty !== null ? g.tiles?.[g.pendingProperty] : null;
    const buildLevel = buildTile ? Math.max(0, Math.min(3, Number(g.developments?.[buildTile.index]) || 0)) : 0;
    const cost = buildTile ? Math.floor(buildTile.price / 2) : 0;
    cityBuildRow.classList.toggle('hidden', !buildTile);
    cityBuildOffer.textContent = buildTile ? `${buildTile.name} · 다음 ${['별장', '빌딩', '호텔'][buildLevel] || '건설 완료'} · 건설비 ${cost} · 현재 통행료 ${g.tolls?.[buildTile.index] ?? buildTile.toll}` : '';
    cityBuildBtn.disabled = !(buildTile && mine && g.owners?.[buildTile.index] === seat && buildLevel < 3 && g.players?.[seat]?.cash >= cost);
    cityBuildSkipBtn.disabled = !(buildTile && mine);
  }""")
swap(p, "        ctx.fillText(`${tile.price}`, x, y + 27);", """        ctx.fillText(`${tile.price} / ${g.tolls?.[tile.index] ?? tile.toll}`, x, y + 27);
        if (owner) {
          const level = Math.max(0, Math.min(3, Number(g.developments?.[tile.index]) || 0));
          ctx.fillStyle = '#1d4ed8';
          ctx.font = '900 10px system-ui, sans-serif';
          ctx.fillText(`${['도시', '별장', '빌딩', '호텔'][level]} · ${level}단계`, x, y - 29);
        }""")
swap(p, "  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));", """  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));
  cityBuildBtn.addEventListener('click', () => roomAction('build-city'));
  cityBuildSkipBtn.addEventListener('click', () => roomAction('skip-build-city'));""")
print('1/3 Land King server and UI patched')

# 2. Explicit second click inside a dialog; returning to lobby never logs out.
p = 'public/index.html'
swap(p, '<button id="logoutBtn" class="ghost">나가기</button>', '<button id="logoutBtn" class="ghost">접속 종료</button>')
swap(p, '<button id="leaveRoomBtn" class="ghost">로비</button>', '<button id="leaveRoomBtn" class="ghost">로비로 돌아가기</button>')
swap(p, '<button id="roomLogoutBtn" class="ghost">나가기</button>', '<button id="roomLogoutBtn" class="ghost">접속 종료</button>')
swap(p, '  <script src="/session-lock.js?v=1.6.28"></script>', '''  <dialog id="logoutDialog" class="logoutDialog" aria-labelledby="logoutDialogTitle" aria-describedby="logoutDialogMessage">
    <h2 id="logoutDialogTitle">접속 종료</h2>
    <p id="logoutDialogMessage">접속을 종료하시겠습니까? 다시 이용하려면 입장 파일을 열어야 합니다.</p>
    <div class="logoutDialogActions"><button id="logoutCancelBtn" class="ghost" type="button">취소</button><button id="logoutConfirmBtn" class="primary" type="button">접속 종료</button></div>
  </dialog>
  <script src="/session-lock.js?v=1.6.28"></script>''')
p = 'public/app.js'
swap(p, "  const roomLogoutBtn = document.getElementById('roomLogoutBtn');", """  const roomLogoutBtn = document.getElementById('roomLogoutBtn');
  const logoutDialog = document.getElementById('logoutDialog');
  const logoutCancelBtn = document.getElementById('logoutCancelBtn');
  const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');""")
swap(p, '  async function logout() {', "  function requestLogout() {\n    if (sessionToken && !logoutDialog.open) logoutDialog.showModal();\n  }\n\n  async function logout() {")
swap(p, "  logoutBtn.addEventListener('click', logout);\n  roomLogoutBtn.addEventListener('click', logout);", """  logoutBtn.addEventListener('click', requestLogout);
  roomLogoutBtn.addEventListener('click', requestLogout);
  logoutCancelBtn.addEventListener('click', () => logoutDialog.close());
  logoutConfirmBtn.addEventListener('click', () => { logoutDialog.close(); logout(); });""")
print('2/3 two-stage logout patched')

# 3. Match board diagonals to authoritative routes, and retain route when different groups meet at center.
p = 'public/app.js'
swap(p, "      [5,21,22,23,28,29,0], [10,26,27,23,24,25,15],", "      [5,21,22,23,24,25,15], [10,26,27,23,28,29,0],")
p = 'lib/games/yut.js'
swap(p, "  return game.pieces[color].filter(other => other.status === 'board' && other.position === piece.position);", "  return game.pieces[color].filter(other => other.status === 'board' && other.position === piece.position\n    && (piece.position !== 23 || (other.route || 'outer') === (piece.route || 'outer')));")
swap(p, "    for (const piece of game.pieces[color]) {\n      if (piece.status === 'board' && piece.position === option.destination.position) piece.route = option.destination.route;\n    }", "    // Only a genuine shared path may merge routes. At the center, each diagonal retains its entry route.\n    if (option.destination.position !== 23) for (const piece of game.pieces[color]) {\n      if (piece.status === 'board' && piece.position === option.destination.position) piece.route = option.destination.route;\n    }")
print('3/3 Yut crossing and route preservation patched')

# Version, static cache and public announcement are release artifacts, not speculative features.
for name in ('package.json', 'package-lock.json', 'public/index.html', 'server.js'):
    file = Path(name)
    source = file.read_text(encoding='utf-8')
    if '1.6.28' not in source: raise RuntimeError(f'{name}: version anchor missing')
    file.write_text(source.replace('1.6.28', '1.6.29'), encoding='utf-8')
for file in Path('test').glob('*.test.js'):
    source = file.read_text(encoding='utf-8')
    updated = source.replace('1\\.6\\.28', '1\\.6\\.29').replace('1.6.28', '1.6.29')
    if source != updated: file.write_text(updated, encoding='utf-8')
swap('lib/release-announcements.js', '\n];', """
  {
    key: 'v1.6.29',
    title: '[업데이트] v1.6.29 랜드킹 도시 건설·접속 종료 확인·윷놀이 경로 수정',
    body: '랜드킹에서 자기 소유 도시에 도착하면 별장·빌딩·호텔을 방문당 한 단계씩 건설하거나 건너뛸 수 있습니다. 단계당 건설비는 매입가의 50%이고 통행료는 기본·2배·3배·5배로 적용되며 건설비가 순자산에 반영됩니다. 게임판에서 개발 단계와 통행료를 확인할 수 있습니다. 로비와 게임방의 접속 종료를 명확히 구분하고 재확인 창을 추가해 실수로 로그아웃하지 않도록 했습니다. 윷놀이 중앙 대각선의 경로 표시를 실제 이동과 일치시키고 서로 다른 진입 경로를 유지하도록 수정했습니다.',
    publishedAt: '2026-09-18T11:45:00+09:00',
  },
];""")

Path('test/v1629.test.js').write_text(r'''\n'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const city = require('../lib/games/cityking');
const yut = require('../lib/games/yut');
const root = path.resolve(__dirname, '..');
const dice = () => 1;

test('Land King: one build per owned-city landing, all three levels, value and tolls', () => {
  const g = city.create(); city.start(g);
  g.owners[3] = 'black'; g.players.black.properties.push(3);
  for (let level = 1; level <= 3; level++) {
    g.turn = 'black'; g.phase = 'roll'; g.players.black.position = 1;
    const result = city.rollDice(g, 'black', 'roll' + level, dice);
    assert.equal(result.phase, 'build');
    assert.equal(g.pendingProperty, 3);
    assert.equal(city.buildProperty(g, 'white', 'bad').reason, 'not-your-turn');
    const before = city.netWorth(g, 'black');
    const cash = g.players.black.cash;
    assert.equal(city.buildProperty(g, 'black', 'build' + level).legal, true);
    assert.equal(g.players.black.cash, cash - 70);
    assert.equal(city.netWorth(g, 'black'), before);
    assert.equal(g.developments[3], level);
    assert.equal(city.publicState(g).tolls[3], 50 * [1, 2, 3, 5][level]);
    assert.equal(city.buildProperty(g, 'black', 'repeat').legal, false);
  }
  g.turn = 'black'; g.phase = 'roll'; g.players.black.position = 1;
  assert.equal(city.rollDice(g, 'black', 'max', dice).phase, 'roll');
  assert.equal(g.pendingProperty, null);
  g.turn = 'white'; g.phase = 'roll'; g.players.white.position = 1;
  const cash = g.players.white.cash;
  city.rollDice(g, 'white', 'toll', dice);
  assert.equal(g.players.white.cash, cash - 250);
  city.reset(g);
  assert.deepEqual(g.developments, {});
  assert.equal(city.publicState(g).tolls[3], 50);
});

test('Land King: no building on another tile or without cash; skip is allowed', () => {
  const g = city.create(); city.start(g);
  assert.equal(city.buildProperty(g, 'black', 'early').reason, 'not-buildable');
  g.owners[3] = 'black'; g.players.black.properties.push(3);
  g.players.black.position = 1; g.players.black.cash = 50;
  city.rollDice(g, 'black', 'arrive', dice);
  assert.equal(g.phase, 'build');
  assert.equal(city.buildProperty(g, 'black', 'poor').reason, 'not-enough-cash');
  assert.equal(city.skipBuild(g, 'white', 'other').reason, 'not-your-turn');
  assert.equal(city.skipBuild(g, 'black', 'skip').legal, true);
  assert.equal(g.turn, 'white');
  assert.equal(g.developments[3], undefined);
});

test('Yut: diagonal entry controls direction across center, outer merge and independent center groups', () => {
  assert.equal(yut.destination({ status: 'board', position: 22, route: 'shortcut5' }, 1).position, 23);
  assert.equal(yut.destination({ status: 'board', position: 23, route: 'shortcut5' }, 1).position, 24);
  assert.equal(yut.destination({ status: 'board', position: 23, route: 'shortcut10' }, 1).position, 28);
  assert.equal(yut.destination({ status: 'board', position: 25, route: 'shortcut5' }, 1).position, 15);
  assert.equal(yut.destination({ status: 'board', position: 29, route: 'shortcut10' }, 1).status, 'finished');
  const g = yut.create(); yut.start(g);
  Object.assign(g.pieces.black[0], { status:'board', position:23, route:'shortcut5' });
  Object.assign(g.pieces.black[1], { status:'board', position:23, route:'shortcut10' });
  g.phase = 'move'; g.pendingSteps = 1;
  const options = yut.legalMoves(g, 'black').filter(m => ['black-1','black-2'].includes(m.pieceId));
  assert.equal(options.length, 2);
  assert.equal(options[0].destination.position, 24);
  assert.equal(options[1].destination.position, 28);
  assert.equal(yut.applyMove(g, 'black-1', 'black', 'center').legal, true);
  assert.equal(g.pieces.black[0].position, 24);
  assert.equal(g.pieces.black[1].position, 23);
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
'''.lstrip(), encoding='utf-8')
Path('public/styles.css').open('a', encoding='utf-8').write('''

/* v1.6.29: scoped city construction and explicit logout confirmation. */
#cityControls .cityBuildRow{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;padding:12px;border:1px solid #2563eb;border-radius:11px;background:#14274a}
#cityControls .cityBuildRow.hidden{display:none}
#cityControls .cityBuildRow span{flex:1 1 180px;font-size:.82rem;line-height:1.4;font-weight:800;color:#dbeafe}
#cityControls .cityBuildRow button{min-height:42px}
.logoutDialog{border:1px solid #475569;border-radius:16px;background:#0f172a;color:#f8fafc;padding:22px;width:min(92vw,460px);box-shadow:0 22px 80px #0009}
.logoutDialog::backdrop{background:#020617cc}
.logoutDialog h2{margin:0 0 12px;font-size:1.2rem}
.logoutDialog p{line-height:1.65;overflow-wrap:anywhere}
.logoutDialogActions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px}
.logoutDialogActions button{min-height:44px}
@media(max-width:520px){#cityControls .cityBuildRow button{flex:1}.logoutDialogActions button{flex:1}}
''')
print('v1.6.29 release assets and focused regression tests prepared')
