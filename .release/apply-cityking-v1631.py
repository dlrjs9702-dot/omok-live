#!/usr/bin/env python3
"""Apply the scoped v1.6.31 Land King patch with exact-context guards."""
from pathlib import Path


def change(path, old, new, expected=1):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != expected:
        raise RuntimeError(f'{path}: expected {expected} occurrences, found {actual}: {old[:75]!r}')
    file.write_text(text.replace(old, new), encoding='utf-8')


engine = 'lib/games/cityking.js'
change(engine,
    '출발을 지날 때마다 +200을 받고, 이벤트·공동기금 칸의 효과를 적용합니다. 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.',
    '출발을 지날 때마다 +200을 받고, 이벤트·공동기금 칸의 효과를 적용합니다. 더블이면 해당 칸의 매입·건설 등 처리를 마친 뒤 계속 굴립니다. 양쪽 플레이어의 차례가 모두 끝날 때 전체 턴이 1 증가하며, 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.')
change(engine,
    "round: 1, phase: 'roll', turnCount: 0, pendingProperty: null, lastRoll: null, lastEvent: null,",
    "round: 1, phase: 'roll', turnCount: 0, completedTurns: { black: false, white: false }, extraRoll: false, pendingProperty: null, lastRoll: null, lastEvent: null,")
change(engine,
    "function start(game) {\n  game.status = 'playing';\n  game.turn = 'black';\n  game.phase = 'roll';\n}",
    "function start(game) {\n  game.status = 'playing';\n  game.turn = 'black';\n  game.phase = 'roll';\n  game.completedTurns = { black: false, white: false };\n  game.extraRoll = false;\n}")
change(engine,
    "  game.phase = 'finished';\n  game.pendingProperty = null;\n}\n\nfunction advanceTurn(game) {\n  game.pendingProperty = null;\n  game.phase = 'roll';\n  if (game.turnCount >= TURN_LIMIT) finishByWorth(game);\n  else game.turn = other(game.turn);\n}",
    "  game.phase = 'finished';\n  game.pendingProperty = null;\n  game.extraRoll = false;\n}\n\nfunction activeColors(game) {\n  return ['black', 'white'].filter(color => game.players[color] && game.players[color].cash >= 0 && !game.players[color].eliminated);\n}\n\nfunction advanceTurn(game) {\n  game.pendingProperty = null;\n  if (game.status !== 'playing') return;\n  game.phase = 'roll';\n  // Only finish the player's turn after the entire landing interaction.\n  if (game.extraRoll) return;\n  game.completedTurns ||= { black: false, white: false };\n  game.completedTurns[game.turn] = true;\n  const active = activeColors(game);\n  if (active.every(color => game.completedTurns[color])) {\n    game.turnCount += 1;\n    game.completedTurns = { black: false, white: false };\n    if (game.turnCount >= TURN_LIMIT) { finishByWorth(game); return; }\n  }\n  const next = other(game.turn);\n  game.turn = active.includes(next) && !game.completedTurns[next]\n    ? next : active.find(color => !game.completedTurns[color]) || null;\n}")
change(engine,
    "  game.winner = other(color);\n  game.turn = null;\n  game.phase = 'finished';\n  game.pendingProperty = null;\n  return true;",
    "  game.winner = other(color);\n  game.turn = null;\n  game.phase = 'finished';\n  game.pendingProperty = null;\n  game.extraRoll = false;\n  return true;")
change(engine,
    "function rollDice(game, color, at, die = randomDie) {\n  if (!validColor(color)) return { legal: false, reason: 'not-player' };\n  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };\n  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };\n  if (game.phase !== 'roll') return { legal: false, reason: 'must-buy' };\n  const first = die();\n  const second = die();\n  if (![first, second].every(value => Number.isInteger(value) && value >= 1 && value <= 6)) return { legal: false, reason: 'bad-die' };\n  const player = game.players[color];\n  const oldPosition = player.position;\n  const total = first + second;\n  player.position = (player.position + total) % TILES.length;\n  game.turnCount += 1;\n  game.lastRoll = { color, first, second, total, from: oldPosition, to: player.position, at };\n  game.moves.push({ type: 'roll', ...game.lastRoll });\n  resolveLanding(game, color, oldPosition, at);\n  return { legal: true, first, second, total, position: player.position, phase: game.phase, finished: game.status !== 'playing' };\n}",
    "function rollDice(game, color, at, die = randomDie, expectedMoveCount = null) {\n  if (!validColor(color)) return { legal: false, reason: 'not-player' };\n  if (game.status !== 'playing') return { legal: false, reason: 'not-playing' };\n  if (game.turn !== color) return { legal: false, reason: 'not-your-turn' };\n  if (game.phase !== 'roll') return { legal: false, reason: 'must-buy' };\n  // Reject a second request sent from the same client state, even on a double.\n  if (expectedMoveCount !== null && (!Number.isSafeInteger(expectedMoveCount) || expectedMoveCount !== game.moves.length))\n    return { legal: false, reason: 'stale-roll' };\n  const first = die();\n  const second = die();\n  if (![first, second].every(value => Number.isInteger(value) && value >= 1 && value <= 6)) return { legal: false, reason: 'bad-die' };\n  const player = game.players[color];\n  const oldPosition = player.position;\n  const total = first + second;\n  const double = first === second;\n  game.extraRoll = double;\n  player.position = (player.position + total) % TILES.length;\n  game.lastRoll = { color, first, second, total, double, from: oldPosition, to: player.position, at };\n  game.moves.push({ type: 'roll', ...game.lastRoll });\n  resolveLanding(game, color, oldPosition, at);\n  return { legal: true, first, second, total, double, position: player.position, phase: game.phase, finished: game.status !== 'playing' };\n}")
change(engine,
    "  if (reason === 'must-buy') return '도시 매입 또는 건설 여부를 선택한 뒤 다음 차례로 넘어갑니다.';",
    "  if (reason === 'must-buy') return '도시 매입 또는 건설 여부를 먼저 선택해 주세요.';\n  if (reason === 'stale-roll') return '이미 처리된 주사위 요청입니다. 갱신된 차례를 확인하고 다시 굴려 주세요.';")
change(engine,
    "round: game.round, phase: game.phase, turnCount: game.turnCount, turnLimit: TURN_LIMIT,",
    "round: game.round, phase: game.phase, turnCount: game.turnCount, turnLimit: TURN_LIMIT,\n    completedTurns: game.completedTurns || { black: false, white: false }, extraRoll: Boolean(game.extraRoll),")

server = 'server.js'
change(server,
    'const verdict = engine.rollDice(room.game, seat, nowIso());',
    'const verdict = engine.rollDice(room.game, seat, nowIso(), undefined, Number(body.expectedMoveCount));')
change(server,
    "appendSystemMessage(room, `${session.label || '플레이어'}님이 주사위를 굴려 ${verdict.total}칸 이동했습니다.`);",
    "appendSystemMessage(room, `${session.label || '플레이어'}님이 주사위를 굴려 ${verdict.total}칸 이동했습니다.${verdict.double && !verdict.finished ? ' 더블! 칸 처리 후 추가 굴림입니다.' : ''}`);")

client = 'public/app.js'
change(client,
    "cityTurnSummary.textContent = `진행 ${turn}/${limit}턴 · 남은 ${Math.max(0, limit - turn)}턴 · ${g.turn ? name(g.turn) + ' 차례' : '대국 종료'}`;",
    "const extraText = g.extraRoll ? (g.phase === 'roll' ? ' · 더블 추가 굴림' : ' · 더블: 칸 처리 후 추가 굴림') : '';\n    cityTurnSummary.textContent = `전체 턴 ${turn}/${limit} 완료 · 남은 ${Math.max(0, limit - turn)}턴 · ${g.turn ? name(g.turn) + ' 차례' + extraText : '대국 종료'}`;")
change(client,
    "cityRollBtn.textContent = mine && g.phase === 'roll' ? '주사위 굴리기' : '굴리기 대기';",
    "cityRollBtn.textContent = mine && g.phase === 'roll' ? (g.extraRoll ? '더블 · 추가 굴리기' : '주사위 굴리기') : '굴리기 대기';")
change(client,
    "? `최근 주사위: ${g.lastRoll.first} + ${g.lastRoll.second} = ${g.lastRoll.total}`",
    "? `최근 주사위: ${g.lastRoll.first} + ${g.lastRoll.second} = ${g.lastRoll.total}${g.lastRoll.double ? ' · 더블!' : ''}`")
change(client,
    "cityRollBtn.addEventListener('click', () => roomAction('roll-city'));",
    "cityRollBtn.addEventListener('click', async () => {\n    const expectedMoveCount = state?.game?.moveCount ?? 0;\n    cityRollBtn.disabled = true;\n    await roomAction('roll-city', { expectedMoveCount });\n    if (state?.gameType === 'cityking') renderCityControls();\n  });")

html = 'public/index.html'
change(html, '1.6.30', '1.6.31', expected=2)
change('package.json', '"version": "1.6.30"', '"version": "1.6.31"')
change('package-lock.json', '"version": "1.6.30"', '"version": "1.6.31"', expected=2)

notice = 'lib/release-announcements.js'
release = Path(notice).read_text(encoding='utf-8')
if release.count("key: 'v1.6.30'") != 1 or "key: 'v1.6.31'" in release or not release.endswith('];\n'):
    raise RuntimeError('Unexpected release announcement list shape')
release = release[:-3] + "  {\n    key: 'v1.6.31',\n    title: '[업데이트] v1.6.31 랜드킹 더블·전체 턴 계산 수정',\n    body: '랜드킹에서 두 주사위가 같으면 도착 칸의 이벤트·통행료·도시 매입·건설 처리를 마친 후 같은 플레이어가 추가로 굴립니다. 연속 더블도 이어지며, 더블이 아닌 굴림의 칸 처리까지 끝나야 상대에게 차례가 넘어갑니다. 양쪽 활성 플레이어가 각자 차례를 마쳐야 전체 턴이 1 증가하고 50턴 종료 및 순자산 승패 판정에 반영됩니다. 현재 턴과 더블 추가 굴림을 화면에 표시하며 중복 굴림 요청을 방지합니다.',\n    publishedAt: '2026-09-18T12:30:00+09:00',\n  },\n];\n"
Path(notice).write_text(release, encoding='utf-8')

tests = 'test/cityking.test.js'
text = Path(tests).read_text(encoding='utf-8')
def replace_test(begin, end, replacement):
    global text
    start = text.find(begin)
    stop = text.find(end, start + len(begin))
    if start < 0 or stop < 0 or text.find(begin, start + 1) >= 0:
        raise RuntimeError(f'Unexpected test anchors: {begin}')
    text = text[:start] + replacement + text[stop:]

replace_test("test('dice movement resolves events, buys properties, and advances turns'", "test('landing on an opponent city pays toll", """test('dice movement resolves events, buys properties, and counts completed rounds', () => {
  const game = cityking.create();
  cityking.start(game);
  const event = cityking.rollDice(game, 'black', 'event', dice(1, 1));
  assert.equal(event.total, 2);
  assert.equal(event.double, true);
  assert.equal(game.players.black.position, 2);
  assert.equal(game.players.black.cash, 1600);
  assert.equal(game.turn, 'black');
  assert.equal(game.turnCount, 0);

  const property = cityking.rollDice(game, 'black', 'property', dice(1, 2));
  assert.equal(property.phase, 'buy');
  assert.equal(game.pendingProperty, 5);
  assert.equal(cityking.buyProperty(game, 'black', 'buy').legal, true);
  assert.equal(game.owners[5], 'black');
  assert.equal(game.players.black.properties.includes(5), true);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'white', 'complete', dice(1, 3)).legal, true);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
});

""")
replace_test("test('turn limit chooses the higher net worth", "test('declining an unaffordable property", """test('turn limit waits for both player turns, then uses existing net-worth outcome and resets', () => {
  const game = cityking.create();
  cityking.start(game);
  game.turnCount = cityking.TURN_LIMIT - 1;
  game.players.black.cash = 2000;
  game.players.white.cash = 1500;
  const first = cityking.rollDice(game, 'black', 'penultimate', dice(1, 3));
  assert.equal(first.finished, false);
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(game.turn, 'white');
  const doubled = cityking.rollDice(game, 'white', 'double', dice(2, 2));
  assert.equal(doubled.finished, false);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  const last = cityking.rollDice(game, 'white', 'last', dice(1, 2));
  assert.equal(last.phase, 'buy');
  assert.equal(game.turnCount, cityking.TURN_LIMIT - 1);
  assert.equal(cityking.skipProperty(game, 'white', 'finish').legal, true);
  assert.equal(game.turnCount, cityking.TURN_LIMIT);
  assert.equal(game.status, 'finished');
  assert.equal(game.winner, 'black');
  cityking.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.status, 'selecting');
  assert.equal(game.turnCount, 0);
  assert.equal(game.extraRoll, false);
  assert.equal(game.players.black.position, 0);
  assert.equal(Object.keys(game.owners).length, 0);
});

""")
extra_tests = """test('consecutive doubles retain the turn and apply each landing before the next roll', () => {
  const game = cityking.create();
  cityking.start(game);
  const first = cityking.rollDice(game, 'black', 'first', dice(1, 1), 0);
  assert.equal(first.double, true);
  assert.equal(game.players.black.cash, 1600); // event at tile 2
  assert.equal(game.turn, 'black');
  assert.equal(cityking.publicState(game).extraRoll, true);
  assert.equal(cityking.rollDice(game, 'white', 'wrong', dice(1, 1)).reason, 'not-your-turn');
  assert.equal(cityking.rollDice(game, 'black', 'duplicate', dice(1, 1), 0).reason, 'stale-roll');
  assert.equal(game.moves.length, 1);
  assert.equal(cityking.rollDice(game, 'black', 'second', dice(1, 1), 1).double, true);
  assert.equal(game.players.black.cash, 1480); // tax at tile 4
  assert.equal(game.turnCount, 0);
  const third = cityking.rollDice(game, 'black', 'third', dice(1, 2), 2);
  assert.equal(third.double, false);
  assert.equal(third.phase, 'buy');
  assert.equal(game.pendingProperty, 7);
  assert.equal(cityking.rollDice(game, 'black', 'during-buy', dice(1, 1)).reason, 'must-buy');
  assert.equal(cityking.buyProperty(game, 'black', 'bought').legal, true);
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
  assert.deepEqual(game.completedTurns, { black: true, white: false });
  assert.equal(cityking.rollDice(game, 'white', 'fourth', dice(2, 2)).double, true);
  assert.equal(game.players.white.cash, 1380);
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'white', 'fifth', dice(1, 2)).double, false);
  assert.equal(game.players.white.cash, 1320); // opponent property toll at tile 7
  assert.equal(game.players.black.cash, 1360);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
  assert.deepEqual(game.completedTurns, { black: false, white: false });
});

test('double landing on own city requires building decision before an extra roll', () => {
  const game = cityking.create();
  cityking.start(game);
  game.players.black.position = 1;
  game.players.black.properties.push(3);
  game.owners[3] = 'black';
  const result = cityking.rollDice(game, 'black', 'build', dice(1, 1));
  assert.equal(result.phase, 'build');
  assert.equal(game.extraRoll, true);
  assert.equal(cityking.rollDice(game, 'black', 'premature', dice(1, 2)).reason, 'must-buy');
  assert.equal(cityking.buildProperty(game, 'black', 'built').legal, true);
  assert.equal(game.developments[3], 1);
  assert.equal(game.players.black.cash, 1430);
  assert.equal(game.turn, 'black');
  assert.equal(game.phase, 'roll');
  assert.equal(game.turnCount, 0);
  assert.equal(cityking.rollDice(game, 'black', 'not-double', dice(1, 2)).legal, true);
  assert.equal(game.players.black.cash, 1630); // event at tile 6
  assert.equal(game.turn, 'white');
  assert.equal(game.turnCount, 0);
});

test('eliminated seats do not block completed-round counting', () => {
  const game = cityking.create();
  cityking.start(game);
  game.players.white.eliminated = true;
  assert.equal(cityking.rollDice(game, 'black', 'solo', dice(1, 3)).legal, true);
  assert.equal(game.turnCount, 1);
  assert.equal(game.turn, 'black');
});

"""
anchor = "test('Land King UI and protected action routes are wired'"
if text.count(anchor) != 1:
    raise RuntimeError('Missing UI test anchor')
text = text.replace(anchor, extra_tests + anchor)
if text.count('app\\.js\\?v=1\\.6\\.30') != 1 or text.count("roomAction\\('roll-city'\\)") != 1:
    raise RuntimeError('Unexpected client test assertions')
text = text.replace('app\\.js\\?v=1\\.6\\.30', 'app\\.js\\?v=1\\.6\\.31')
text = text.replace("roomAction\\('roll-city'\\)", "roomAction\\('roll-city', \\{ expectedMoveCount \\}\\)")
text = text.replace("  assert.match(html, /app\\.js\\?v=1\\.6\\.31/);",
                    "  assert.match(html, /app\\.js\\?v=1\\.6\\.31/);\n  assert.match(js, /더블 추가 굴림/);\n  assert.match(server, /Number\\(body\\.expectedMoveCount\\)/);")
Path(tests).write_text(text, encoding='utf-8')
print('v1.6.31 guarded patch applied to Land King, client, API, versions, notice and scoped tests')
