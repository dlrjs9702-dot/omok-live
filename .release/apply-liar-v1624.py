from pathlib import Path
import json


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


def append_once(path, marker, block):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    if block.strip() in text:
        return
    if marker not in text:
        raise SystemExit(f'append marker not found in {path}')
    p.write_text(text.replace(marker, block + marker, 1), encoding='utf-8')

# Engine minor state hygiene between rounds.
replace_once('lib/games/liar.js',
"  game.lastResult = null;\n  phase(game, 'hint1', now + HINT_MS);",
"  game.lastResult = null;\n  game.winningSide = null;\n  phase(game, 'hint1', now + HINT_MS);")

# ---------------- server integration ----------------
replace_once('server.js',
"const isPictionary = (room) => room.gameType === 'pictionary';\nconst isNumberedSeatGame = (room) => isTeam(room) || isBingo(room) || isPictionary(room);\nconst seatsFor = (room) => isPictionary(room) ? PICTIONARY_SEATS : TEAM_SEATS;",
"const isPictionary = (room) => room.gameType === 'pictionary';\nconst isLiar = (room) => room.gameType === 'liar';\nconst isNumberedSeatGame = (room) => isTeam(room) || isBingo(room) || isPictionary(room) || isLiar(room);\nconst seatsFor = (room) => (isPictionary(room) || isLiar(room)) ? PICTIONARY_SEATS : TEAM_SEATS;")

replace_once('server.js',
"    players: gameEngine.id === 'pictionary'\n      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))",
"    players: ['pictionary', 'liar'].includes(gameEngine.id)\n      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))")

replace_once('server.js',
"    ...publicRoom(room),\n    me: {",
"    ...publicRoom(room),\n    game: isLiar(room) ? getGame('liar').publicState(room.game, seat) : publicRoom(room).game,\n    me: {")

replace_once('server.js',
"  if (isBingo(room) || isPictionary(room)) return;",
"  if (isBingo(room) || isPictionary(room) || isLiar(room)) return;")
replace_once('server.js',
"  if (isBingo(room) || isPictionary(room)) {",
"  if (isBingo(room) || isPictionary(room) || isLiar(room)) {")

replace_once('server.js',
"  const role = seat ? (isBingo(room) || isPictionary(room) ? `${seat}번`",
"  const role = seat ? (isBingo(room) || isPictionary(room) || isLiar(room) ? `${seat}번`")
replace_once('server.js',
"  const opponent = (isBingo(room) || isPictionary(room)) && seat",
"  const opponent = (isBingo(room) || isPictionary(room) || isLiar(room)) && seat")

liar_tick = r'''
// Server-authoritative phase timers for liar game. Deadlines are stored on the game,
// so reload/reconnect never resets hint, vote, reveal or final-guess time limits.
function tickLiarRooms() {
  const now = nowMs();
  const engine = getGame('liar');
  for (const room of rooms.values()) {
    if (!isLiar(room) || room.game.status !== 'playing') continue;
    if (!engine.tick(room.game, now)) continue;
    touchRoom(room);
    broadcast(room);
  }
}

'''
append_once('server.js', 'async function handleRoomAction(req, res, action, session) {', liar_tick)

liar_actions = r'''
  if (action === 'set-liar-rounds') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 설정할 수 있습니다.');
    if (room.hostSessionToken !== session.token) return sendError(res, 403, 'HOST_ONLY', '방장만 판 수를 변경할 수 있습니다.');
    const engine = getGame('liar');
    const verdict = engine.setRounds(room.game, Number(body.totalRounds));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_SETTING', engine.moveError(verdict.reason));
  }

  if (action === 'start-liar') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 시작할 수 있습니다.');
    if (room.hostSessionToken !== session.token) return sendError(res, 403, 'HOST_ONLY', '방장만 라이어게임을 시작할 수 있습니다.');
    const seats = seatsFor(room).filter(seatNumber => room.players[seatNumber]);
    const engine = getGame('liar');
    const verdict = engine.start(room.game, seats, nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `라이어게임 시작! ${room.game.totalRounds}판 모드 · 첫 힌트 발언을 시작합니다.`);
  }

  if (action === 'liar-hint') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 힌트를 제출할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 힌트를 제출할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitHint(room.game, playerSeat, body.hint, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_HINT', engine.moveError(verdict.reason));
  }

  if (action === 'liar-vote') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 투표할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 투표할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitVote(room.game, playerSeat, body.target, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_VOTE', engine.moveError(verdict.reason));
  }

  if (action === 'liar-guess') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 최종 추측을 제출할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 제시어를 추측할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitGuess(room.game, playerSeat, body.guess, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_GUESS', engine.moveError(verdict.reason));
  }

'''
append_once('server.js', "  if (action === 'set-bingo-target') {", liar_actions)

replace_once('server.js',
"    if (room.gameType === 'pictionary') return sendError(res, 400, 'WRONG_GAME', '그림 맞히기는 그리기와 정답 제출 기능을 이용해 주세요.');",
"    if (room.gameType === 'pictionary') return sendError(res, 400, 'WRONG_GAME', '그림 맞히기는 그리기와 정답 제출 기능을 이용해 주세요.');\n    if (room.gameType === 'liar') return sendError(res, 400, 'WRONG_GAME', '라이어게임은 힌트·투표·최종 추측 기능을 이용해 주세요.');")
replace_once('server.js',
"    if (isPictionary(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '그림 맞히기에서는 기권 기능을 사용하지 않습니다.');",
"    if (isPictionary(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '그림 맞히기에서는 기권 기능을 사용하지 않습니다.');\n    if (isLiar(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '라이어게임에서는 기권 기능을 사용하지 않습니다.');")

replace_once('server.js',
"if (pathname === '/health' && req.method === 'GET') {\n    return sendJson(res, 200, { ok: true, rooms: rooms.size, sessions: sessions.size, games: listGames().map((g) => g.id), version: '1.6.23', time: nowIso() });",
"if (pathname === '/health' && req.method === 'GET') {\n    return sendJson(res, 200, { ok: true, rooms: rooms.size, sessions: sessions.size, games: listGames().map((g) => g.id), version: '1.6.24', time: nowIso() });")

replace_once('server.js',
"match = pathname.match(/^\\/api\\/room\\/(choose-role|set-bingo-target|start-bingo|select-bingo|start-pictionary|pictionary-stroke|pictionary-clear|pictionary-guess|set-secret|guess|throw-yut|move-yut|roll-city|buy-city|skip-city|move|resign|end-game|next-round|rematch)$/);",
"match = pathname.match(/^\\/api\\/room\\/(choose-role|set-liar-rounds|start-liar|liar-hint|liar-vote|liar-guess|set-bingo-target|start-bingo|select-bingo|start-pictionary|pictionary-stroke|pictionary-clear|pictionary-guess|set-secret|guess|throw-yut|move-yut|roll-city|buy-city|skip-city|move|resign|end-game|next-round|rematch)$/);")

replace_once('server.js',
"  setInterval(tickPictionaryRooms, 1000).unref();\n  server.listen(PORT, HOST, () => console.log(`게임 서버 v1.6.23 실행: http://${HOST}:${PORT}`));",
"  setInterval(tickPictionaryRooms, 1000).unref();\n  setInterval(tickLiarRooms, 1000).unref();\n  server.listen(PORT, HOST, () => console.log(`게임 서버 v1.6.24 실행: http://${HOST}:${PORT}`));")

# ---------------- HTML ----------------
replace_once('public/index.html', '/styles.css?v=1.6.23', '/styles.css?v=1.6.24')
replace_once('public/index.html', '/session-lock.js?v=1.6.23', '/session-lock.js?v=1.6.24')
replace_once('public/index.html', '/app.js?v=1.6.23', '/app.js?v=1.6.24')
replace_once('public/index.html',
'                  <option value="pictionary">그림 맞히기</option>',
'                  <option value="pictionary">그림 맞히기</option>\n                  <option value="liar">라이어게임</option>')
replace_once('public/index.html',
'''            <div class="gameOption" data-game-option="pictionary">
              <button type="button" class="gameChoice" data-game="pictionary"><strong>그림 맞히기</strong></button>
            </div>''',
'''            <div class="gameOption" data-game-option="pictionary">
              <button type="button" class="gameChoice" data-game="pictionary"><strong>그림 맞히기</strong></button>
            </div>
            <div class="gameOption" data-game-option="liar">
              <button type="button" class="gameChoice" data-game="liar"><strong>라이어게임</strong></button>
            </div>''')

liar_html = r'''
          <section id="liarPanel" class="liarPanel hidden" aria-label="라이어게임">
            <div class="liarSetupRow">
              <label for="liarRoundsSelect">게임 판 수</label>
              <select id="liarRoundsSelect"><option value="1">1판</option><option value="3">3판</option></select>
              <button id="liarStartBtn" type="button" class="primary">라이어게임 시작</button>
            </div>
            <div id="liarRoleBox" class="liarRoleBox">게임 시작 후 내 역할이 표시됩니다.</div>
            <div class="liarProgress">
              <strong id="liarPhaseLabel">참가자 대기 중</strong>
              <span id="liarSpeakerLabel" class="smallMuted"></span>
              <span id="liarTimer" class="liarTimer hidden">60초</span>
            </div>
            <div id="liarHintLog" class="liarHintLog" aria-live="polite"></div>
            <form id="liarHintForm" class="liarActionForm hidden" autocomplete="off">
              <input id="liarHintInput" type="text" maxlength="100" placeholder="힌트를 입력하세요" aria-label="라이어게임 힌트" />
              <button type="submit" class="primary">힌트 제출</button>
            </form>
            <div id="liarVoteBox" class="liarVoteBox hidden"></div>
            <form id="liarGuessForm" class="liarActionForm hidden" autocomplete="off">
              <input id="liarGuessInput" type="text" maxlength="40" placeholder="제시어 최종 추측" aria-label="라이어 최종 제시어 추측" />
              <button type="submit" class="primary">최종 추측</button>
            </form>
            <div id="liarResult" class="liarResult hidden" aria-live="polite"></div>
            <div id="liarScoreboard" class="liarScoreboard" aria-label="라이어게임 누적 점수"></div>
          </section>

'''
append_once('public/index.html', '          <div class="mobileActions">', liar_html)

# ---------------- client JS ----------------
replace_once('public/app.js',
"  const pictionaryScoreboard = document.getElementById('pictionaryScoreboard');",
"  const pictionaryScoreboard = document.getElementById('pictionaryScoreboard');\n  const liarPanel = document.getElementById('liarPanel');\n  const liarRoundsSelect = document.getElementById('liarRoundsSelect');\n  const liarStartBtn = document.getElementById('liarStartBtn');\n  const liarRoleBox = document.getElementById('liarRoleBox');\n  const liarPhaseLabel = document.getElementById('liarPhaseLabel');\n  const liarSpeakerLabel = document.getElementById('liarSpeakerLabel');\n  const liarTimer = document.getElementById('liarTimer');\n  const liarHintLog = document.getElementById('liarHintLog');\n  const liarHintForm = document.getElementById('liarHintForm');\n  const liarHintInput = document.getElementById('liarHintInput');\n  const liarVoteBox = document.getElementById('liarVoteBox');\n  const liarGuessForm = document.getElementById('liarGuessForm');\n  const liarGuessInput = document.getElementById('liarGuessInput');\n  const liarResult = document.getElementById('liarResult');\n  const liarScoreboard = document.getElementById('liarScoreboard');")

replace_once('public/app.js',
"      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹' : type === 'pictionary' ? '그림 맞히기'\n        : (type === 'othello' ? '오델로' : '오목');",
"      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹' : type === 'pictionary' ? '그림 맞히기' : type === 'liar' ? '라이어게임'\n        : (type === 'othello' ? '오델로' : '오목');")
replace_once('public/app.js',
"  function isPictionaryGame() { return state?.gameType === 'pictionary'; }\n  function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame(); }\n  function numberedSeats() { return isPictionaryGame() ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }",
"  function isPictionaryGame() { return state?.gameType === 'pictionary'; }\n  function isLiarGame() { return state?.gameType === 'liar'; }\n  function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame(); }\n  function numberedSeats() { return (isPictionaryGame() || isLiarGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }")
replace_once('public/app.js',
"    if (gameType === 'bingo') return String(playerSeat) === String(game.winner) ? 'win' : 'loss';",
"    if (gameType === 'bingo') return String(playerSeat) === String(game.winner) ? 'win' : 'loss';\n    if (gameType === 'liar' && Array.isArray(game.winner)) return game.winner.includes(String(playerSeat)) ? 'win' : 'loss';")
replace_once('public/app.js',
'''    "pictionary": "2~8명이 참여합니다. 라운드마다 한 명이 출제자가 되어 서버가 정한 제시어를 90초 동안 그림으로 표현하고 나머지는 정답을 맞힙니다. 정답자는 100점, 출제자는 정답자 1명당 50점을 얻습니다. 전원이 한 번씩 출제자를 맡으면 총점이 가장 높은 사람이 승리하며, 제시어는 출제자에게만 보입니다."
});''',
'''    "pictionary": "2~8명이 참여합니다. 라운드마다 한 명이 출제자가 되어 서버가 정한 제시어를 90초 동안 그림으로 표현하고 나머지는 정답을 맞힙니다. 정답자는 100점, 출제자는 정답자 1명당 50점을 얻습니다. 전원이 한 번씩 출제자를 맡으면 총점이 가장 높은 사람이 승리하며, 제시어는 출제자에게만 보입니다.",
    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다."
});''')
replace_once('public/app.js',
"    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary'].includes(type) ? type : 'omok';",
"    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar'].includes(type) ? type : 'omok';")
replace_once('public/app.js',
"    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary'].includes(state?.gameType) ? state.gameType : 'omok';",
"    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar'].includes(state?.gameType) ? state.gameType : 'omok';")
replace_once('public/app.js',
"    if ((isBingoGame() || isPictionaryGame()) && numberedSeats().includes(choice)) return `${choice}번`;",
"    if ((isBingoGame() || isPictionaryGame() || isLiarGame()) && numberedSeats().includes(choice)) return `${choice}번`;")
replace_once('public/app.js',
"    if ((isBingoGame() || isPictionaryGame()) && numberedSeats().includes(value)) return `${value}번`;",
"    if ((isBingoGame() || isPictionaryGame() || isLiarGame()) && numberedSeats().includes(value)) return `${value}번`;")

replace_once('public/app.js',
"    const pictionary = isPictionaryGame();\n    for (const number of numberedSeats()) {",
"    const pictionary = isPictionaryGame();\n    const liar = isLiarGame();\n    for (const number of numberedSeats()) {")
replace_once('public/app.js',
"      const currentTurn = pictionary ? state.game.drawerSeat === number : bingo ? state.game.turn === number : state.game.nextSeat === number;\n      card.className = `teamPlayer ${(bingo || pictionary) ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${currentTurn && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;",
"      const currentTurn = pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : bingo ? state.game.turn === number : state.game.nextSeat === number;\n      card.className = `teamPlayer ${(bingo || pictionary || liar) ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${currentTurn && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;")
replace_once('public/app.js',
"      title.textContent = pictionary\n        ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 출제자' : ''}`\n        : bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}` : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;",
"      title.textContent = pictionary\n        ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 출제자' : ''}`\n        : liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`\n        : bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}` : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;")
replace_once('public/app.js',
"        ? `${player.label}${pictionary ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}`",
"        ? `${player.label}${(pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}`")

replace_once('public/app.js',
"    const pictionary = isPictionaryGame();\n    const team = isTeamGame();",
"    const pictionary = isPictionaryGame();\n    const liar = isLiarGame();\n    const team = isTeamGame();")
replace_once('public/app.js',
"      roleChooser.querySelector('small').textContent = pictionary\n        ? '2~8명이 자리를 선택할 수 있습니다. 방장이 그림 맞히기를 시작합니다.'\n        : bingo",
"      roleChooser.querySelector('small').textContent = pictionary\n        ? '2~8명이 자리를 선택할 수 있습니다. 방장이 그림 맞히기를 시작합니다.'\n        : liar ? '3~8명이 자리를 선택할 수 있습니다. 방장이 1판/3판을 정하고 시작합니다.'\n        : bingo")
replace_once('public/app.js',
"        button.textContent = (bingo || pictionary) ? `${number}번 자리` : `${number}번 · ${seatColor(number) === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;",
"        button.textContent = (bingo || pictionary || liar) ? `${number}번 자리` : `${number}번 · ${seatColor(number) === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;")

replace_once('public/app.js',
"    const pictionary = isPictionaryGame();\n    roundNumber.textContent = pictionary ? `${g.roundNumber || 1}/${g.totalRounds || 0}라운드` : `${g.round || 1}판`;",
"    const pictionary = isPictionaryGame();\n    const liar = isLiarGame();\n    roundNumber.textContent = pictionary ? `${g.roundNumber || 1}/${g.totalRounds || 0}라운드` : liar ? `${g.roundNumber || 0}/${g.totalRounds || 1}판` : `${g.round || 1}판`;")
replace_once('public/app.js',
"    moveCountLabel.textContent = pictionary ? '진행 라운드' : state.gameType === 'baseball' ? '추측 횟수'",
"    moveCountLabel.textContent = pictionary ? '진행 라운드' : liar ? '진행 행동' : state.gameType === 'baseball' ? '추측 횟수'")
replace_once('public/app.js', "    const scores = !pictionary && g.scores;", "    const scores = !pictionary && !liar && g.scores;")

replace_once('public/app.js',
"    if (pictionary) {\n      const drawerLabel = g.drawerSeat ? `${state.players[g.drawerSeat]?.label || g.drawerSeat + '번'}님` : '출제자';",
"    if (liar) {\n      const speaker = g.currentSpeaker ? `${state.players[g.currentSpeaker]?.label || g.currentSpeaker + '번'}님` : '';\n      const phases = { hint1: '1차 힌트', hint2: '2차 힌트', extraHint: '동률 후보 추가 힌트', vote: '라이어 투표', revote: '재투표', guess: '라이어 최종 추측', reveal: '판 결과 공개' };\n      statusText.textContent = g.status === 'selecting' ? '참가자 자리 선택 · 방장 시작' : g.status === 'finished' ? '라이어게임 종료' : `${phases[g.phase] || '진행 중'}${speaker ? ` · ${speaker}` : ''}`;\n    } else if (pictionary) {\n      const drawerLabel = g.drawerSeat ? `${state.players[g.drawerSeat]?.label || g.drawerSeat + '번'}님` : '출제자';")
replace_once('public/app.js',
"    const canResign = !isBingoGame() && !pictionary && canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));",
"    const canResign = !isBingoGame() && !pictionary && !liar && canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));")
replace_once('public/app.js',
"    canvasWrap.classList.toggle('hidden', baseball || bingo || pictionary);",
"    canvasWrap.classList.toggle('hidden', baseball || bingo || pictionary || liar);")
replace_once('public/app.js',
"    pictionaryPanel.classList.toggle('hidden', !pictionary);\n    if (pictionary) renderPictionary();\n    if (pictionary) {",
"    pictionaryPanel.classList.toggle('hidden', !pictionary);\n    if (pictionary) renderPictionary();\n    liarPanel.classList.toggle('hidden', !liar);\n    if (liar) renderLiar();\n    if (pictionary || liar) {")

liar_render = r'''
  function liarCountdownText(endsAt) {
    if (!endsAt) return '';
    return `${Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000))}초`;
  }

  function renderLiar() {
    const g = state.game;
    const occupied = numberedSeats().filter(number => state.players[number]);
    liarRoundsSelect.value = String(g.totalRounds || 1);
    liarRoundsSelect.disabled = !(isHost && g.status === 'selecting');
    liarStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    liarStartBtn.disabled = !(isHost && occupied.length >= 3 && g.status === 'selecting');

    if (g.status === 'selecting') liarRoleBox.textContent = '게임 시작 후 내 역할이 개인 화면에 공개됩니다.';
    else if (!seat) liarRoleBox.textContent = '관전 중 · 진행 중인 판의 역할과 제시어는 공개되지 않습니다.';
    else if (g.role === 'liar') liarRoleBox.textContent = '🕵️ 당신은 라이어입니다. 시민들의 힌트를 듣고 제시어를 추리하세요.';
    else if (g.role === 'citizen') liarRoleBox.textContent = `👥 시민 · 제시어: ${g.myWord || '-'}`;
    else liarRoleBox.textContent = '판 결과를 확인하세요.';

    const phaseNames = { hint1: '1차 힌트', hint2: '2차 힌트', extraHint: '동률 후보 추가 힌트', vote: '라이어 비밀 투표', revote: '동률 후보 재투표', guess: '라이어 최종 제시어 추측', reveal: '판 결과 공개', finished: '게임 종료' };
    liarPhaseLabel.textContent = g.status === 'selecting' ? `현재 ${occupied.length}명 · 3명 이상 필요` : (phaseNames[g.phase] || '진행 중');
    liarSpeakerLabel.textContent = g.currentSpeaker ? `현재 발언: ${state.players[g.currentSpeaker]?.label || g.currentSpeaker + '번'}` : '';
    liarTimer.classList.toggle('hidden', !g.deadlineAt);
    if (g.deadlineAt) liarTimer.textContent = liarCountdownText(g.deadlineAt);

    liarHintLog.replaceChildren();
    for (const hint of g.hints || []) {
      const row = document.createElement('div');
      row.className = `liarHintRow${hint.timedOut ? ' timedOut' : ''}`;
      const who = document.createElement('strong');
      const stage = hint.stage === 'hint1' ? '1차' : hint.stage === 'hint2' ? '2차' : '추가';
      who.textContent = `${stage} · ${state.players[hint.seat]?.label || hint.seat + '번'}`;
      const text = document.createElement('span');
      text.textContent = hint.text;
      row.append(who, text);
      liarHintLog.appendChild(row);
    }
    if (!(g.hints || []).length) {
      const empty = document.createElement('p'); empty.className = 'smallMuted'; empty.textContent = '아직 공개된 힌트가 없습니다.'; liarHintLog.appendChild(empty);
    }

    const hintPhase = ['hint1','hint2','extraHint'].includes(g.phase);
    const canHint = Boolean(seat && g.status === 'playing' && hintPhase && g.currentSpeaker === seat);
    liarHintForm.classList.toggle('hidden', !canHint);
    liarHintInput.disabled = !canHint;

    liarVoteBox.replaceChildren();
    const voting = ['vote','revote'].includes(g.phase);
    liarVoteBox.classList.toggle('hidden', !voting);
    if (voting) {
      const note = document.createElement('p');
      note.className = 'smallMuted';
      note.textContent = !seat ? '관전자는 투표할 수 없습니다.' : g.myVoted ? '투표 완료 · 다른 참가자의 투표는 개표 전까지 비공개입니다.' : '라이어라고 생각하는 참가자 한 명에게 투표하세요.';
      liarVoteBox.appendChild(note);
      if (seat && !g.myVoted) for (const target of g.voteTargets || []) {
        if (target === seat) continue;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ghost liarVoteBtn';
        button.textContent = state.players[target]?.label || `${target}번`;
        button.addEventListener('click', () => roomAction('liar-vote', { target, expectedPhaseId: g.phaseId }));
        liarVoteBox.appendChild(button);
      }
    }

    liarGuessForm.classList.toggle('hidden', !g.canGuess);
    liarGuessInput.disabled = !g.canGuess;

    const result = g.lastResult;
    liarResult.classList.toggle('hidden', !result);
    liarResult.replaceChildren();
    if (result) {
      const title = document.createElement('strong');
      title.textContent = result.winningSide === 'liar' ? '🕵️ 라이어 승리' : '👥 시민 승리';
      const detail = document.createElement('p');
      detail.textContent = `라이어: ${state.players[result.liarSeat]?.label || result.liarSeat + '번'} · 제시어: ${result.word}`;
      liarResult.append(title, detail);
      const ballot = result.voteHistory?.at(-1);
      if (ballot) {
        const vote = document.createElement('p'); vote.className = 'smallMuted';
        vote.textContent = `최종 투표 · ${Object.entries(ballot.counts || {}).map(([s,c]) => `${state.players[s]?.label || s + '번'} ${c}표`).join(' · ')}`;
        liarResult.appendChild(vote);
      }
      if (g.status === 'finished' && Array.isArray(g.winner)) {
        const final = document.createElement('p'); final.className = 'liarFinalWinners';
        final.textContent = `최종 승자: ${g.winner.map(s => state.players[s]?.label || s + '번').join(', ')}`;
        liarResult.appendChild(final);
      }
    }

    liarScoreboard.replaceChildren();
    const seats = g.players?.length ? g.players : occupied;
    for (const s of [...seats].sort((a,b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0))) {
      const row = document.createElement('div'); row.className = `liarScoreRow${s === seat ? ' isMe' : ''}`;
      const name = document.createElement('span'); name.textContent = state.players[s]?.label || `${s}번`;
      const score = document.createElement('strong'); score.textContent = `${g.scores?.[s] || 0}점`;
      row.append(name, score); liarScoreboard.appendChild(row);
    }
  }

'''
append_once('public/app.js', '  function drawBoard() {', liar_render)
replace_once('public/app.js',
"    if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary') return;",
"    if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar') return;")
replace_once('public/app.js',
"    if (state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking' || state?.gameType === 'bingo') return false;",
"    if (state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking' || state?.gameType === 'bingo' || state?.gameType === 'liar') return false;")

liar_events = r'''
  liarRoundsSelect.addEventListener('change', () => roomAction('set-liar-rounds', { totalRounds: Number(liarRoundsSelect.value) }));
  liarStartBtn.addEventListener('click', () => roomAction('start-liar'));
  liarHintForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const hint = liarHintInput.value.trim();
    if (!hint) return;
    const phaseId = state?.game?.phaseId;
    liarHintInput.disabled = true;
    try { await roomAction('liar-hint', { hint, expectedPhaseId: phaseId }); liarHintInput.value = ''; }
    finally { liarHintInput.disabled = false; }
  });
  liarGuessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const guess = liarGuessInput.value.trim();
    if (!guess) return;
    const phaseId = state?.game?.phaseId;
    liarGuessInput.disabled = true;
    try { await roomAction('liar-guess', { guess, expectedPhaseId: phaseId }); liarGuessInput.value = ''; }
    finally { liarGuessInput.disabled = false; }
  });

'''
append_once('public/app.js', "  pictionaryStartBtn.addEventListener('click', () => roomAction('start-pictionary'));", liar_events)

liar_timer = r'''
  setInterval(() => {
    if (state?.gameType !== 'liar' || liarPanel.classList.contains('hidden')) return;
    if (!state.game.deadlineAt) return;
    liarTimer.textContent = liarCountdownText(state.game.deadlineAt);
  }, 1000);
'''
append_once('public/app.js', "  copyRoomCodeBtn.addEventListener('click', copyRoomCode);", liar_timer)

# ---------------- styles ----------------
styles = r'''

/* Liar game v1.6.24 */
.liarPanel{display:grid;gap:14px;margin-top:16px;padding:16px;border:1px solid #334155;border-radius:16px;background:#0b1324}
.liarSetupRow,.liarProgress{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.liarSetupRow label{font-weight:850;color:#cbd5e1}.liarSetupRow select{border:1px solid #334155;border-radius:10px;padding:9px 11px;background:#0f172a;color:#fff}
.liarRoleBox{padding:14px;border-radius:13px;background:#172554;border:1px solid #1d4ed8;font-weight:850;line-height:1.55}
.liarProgress{padding:10px 12px;border-radius:12px;background:#111c30}.liarTimer{margin-left:auto;font-weight:950;color:#fbbf24}
.liarHintLog{display:grid;gap:7px;max-height:280px;overflow:auto}.liarHintRow{display:grid;grid-template-columns:minmax(90px,auto) 1fr;gap:10px;padding:9px 11px;border:1px solid #263246;border-radius:11px;background:#0f172a}.liarHintRow strong{font-size:.78rem;color:#93c5fd}.liarHintRow span{overflow-wrap:anywhere}.liarHintRow.timedOut{opacity:.65}
.liarActionForm{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.liarActionForm input{min-width:0;border:1px solid #334155;border-radius:11px;padding:11px;background:#0f172a;color:#fff}
.liarVoteBox{display:flex;gap:8px;flex-wrap:wrap;padding:12px;border:1px solid #334155;border-radius:13px}.liarVoteBox p{flex-basis:100%;margin:0}.liarVoteBtn{flex:1 1 120px}
.liarResult{padding:14px;border-radius:13px;background:#111c30;border:1px solid #475569}.liarResult p{margin:7px 0 0;line-height:1.5}.liarFinalWinners{font-weight:900;color:#fde68a}
.liarScoreboard{display:grid;gap:6px}.liarScoreRow{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-radius:10px;background:#0f172a}.liarScoreRow.isMe{outline:2px solid #60a5fa}
@media(max-width:520px){.liarSetupRow{align-items:stretch}.liarSetupRow label{width:100%}.liarSetupRow select,.liarSetupRow button{flex:1}.liarActionForm{grid-template-columns:1fr}.liarHintRow{grid-template-columns:1fr}.liarTimer{margin-left:0}}
'''
p = Path('public/styles.css')
text = p.read_text(encoding='utf-8')
if '/* Liar game v1.6.24 */' not in text:
    p.write_text(text + styles, encoding='utf-8')

# ---------------- versions / release notice ----------------
pkg = json.loads(Path('package.json').read_text(encoding='utf-8'))
pkg['version'] = '1.6.24'
Path('package.json').write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
lock = json.loads(Path('package-lock.json').read_text(encoding='utf-8'))
lock['version'] = '1.6.24'
lock['packages']['']['version'] = '1.6.24'
Path('package-lock.json').write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

notice = r'''  {
    key: 'v1.6.24',
    title: '[업데이트] v1.6.24 라이어게임 추가',
    body: '신규 3~8인 라이어게임을 추가했습니다. 시민은 제시어를 확인하고 라이어 1명은 제시어 없이 두 차례 힌트를 들으며 추리합니다. 60초 힌트 발언, 30초 비밀 투표, 동률 후보 추가 힌트와 1회 재투표, 라이어 최종 제시어 추측을 지원합니다. 방장은 1판 또는 3판을 선택할 수 있으며 3판 모드에서는 진영 승리 점수를 참가자별로 누적해 공동 승리까지 판정합니다. 관전·재접속·재대결과 기존 방 채팅을 그대로 지원합니다.',
    publishedAt: '2026-09-18T01:25:00+09:00',
  },
'''
append_once('lib/release-announcements.js', '];', notice)

# Best-effort expected-version refresh in regression tests.
for test_file in Path('test').glob('*.js'):
    text = test_file.read_text(encoding='utf-8')
    text = text.replace('1.6.23', '1.6.24')
    test_file.write_text(text, encoding='utf-8')

# Server integration coverage for secret isolation and reconnect state.
Path('test/liar-server.test.js').write_text(r'''\
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}

test('liar server keeps roles/word private and restores phase on reconnect', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-liar-'));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], { cwd:path.resolve(__dirname,'..'), env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dataDir,DATABASE_URL:'',ADMIN_PASSWORD:'liar-test-secret',NODE_ENV:'test'}, stdio:['ignore','pipe','pipe'] });
  let output=''; proc.stdout.on('data',c=>output+=c); proc.stderr.on('data',c=>output+=c);
  t.after(async()=>{proc.kill('SIGTERM');await new Promise(r=>{if(proc.exitCode!==null)r();else{proc.once('exit',r);setTimeout(r,2000).unref();}});await fs.rm(dataDir,{recursive:true,force:true});});
  let ready=false; for(let i=0;i<90;i+=1){if(proc.exitCode!==null)break;try{const r=await fetch(`${base}/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready, `server failed: ${output}`);
  async function req(route,token,body,method='POST'){const headers={};if(token)headers['X-Session-Token']=token;if(body!==undefined)headers['Content-Type']='application/json';const r=await fetch(base+route,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});let data={};try{data=await r.json();}catch{}return{status:r.status,data};}
  async function login(){const r=await req('/api/admin/login',null,{password:'liar-test-secret'});assert.equal(r.status,200);return r.data.sessionToken;}
  const tokens=[await login(),await login(),await login(),await login()];
  const created=await req('/api/rooms',tokens[0],{gameType:'liar'}); assert.equal(created.status,201); const code=created.data.state.me.roomCode;
  for(let i=1;i<4;i+=1) assert.equal((await req('/api/rooms/join',tokens[i],{code})).status,200);
  for(let i=0;i<3;i+=1) assert.equal((await req('/api/room/choose-role',tokens[i],{choice:String(i+1)})).status,200);
  assert.equal((await req('/api/room/choose-role',tokens[3],{choice:'spectator'})).status,200);
  assert.equal((await req('/api/room/start-liar',tokens[0],{})).status,200);
  const views=[]; for(const token of tokens) views.push((await req('/api/room',token,undefined,'GET')).data.state);
  const playerViews=views.slice(0,3); const liarIndex=playerViews.findIndex(v=>v.game.role==='liar'); assert.ok(liarIndex>=0);
  const citizens=playerViews.filter(v=>v.game.role==='citizen'); assert.equal(citizens.length,2); const word=citizens[0].game.myWord; assert.ok(word);
  assert.equal(playerViews[liarIndex].game.myWord,null); assert.equal(views[3].game.role,null); assert.equal(views[3].game.myWord,null);
  assert.ok(!JSON.stringify(playerViews[liarIndex].game).includes(word)); assert.ok(!JSON.stringify(views[3].game).includes(word));
  const reloaded=(await req('/api/room',tokens[liarIndex],undefined,'GET')).data.state; assert.equal(reloaded.game.phase,playerViews[liarIndex].game.phase); assert.equal(reloaded.game.phaseId,playerViews[liarIndex].game.phaseId);
  assert.equal((await req('/api/room/liar-hint',tokens[3],{hint:'관전자',expectedPhaseId:views[3].game.phaseId})).status,403);
  const bySeat={}; for(let i=0;i<3;i+=1) bySeat[playerViews[i].me.seat]=tokens[i];
  let current=(await req('/api/room',tokens[0],undefined,'GET')).data.state;
  for(let i=0;i<6;i+=1){const speaker=current.game.currentSpeaker;const r=await req('/api/room/liar-hint',bySeat[speaker],{hint:`힌트 ${i}`,expectedPhaseId:current.game.phaseId});assert.equal(r.status,200);current=r.data.state;}
  assert.equal(current.game.phase,'vote');
  const liarSeat=playerViews[liarIndex].me.seat; const alternative=Object.keys(bySeat).find(s=>s!==liarSeat);
  for(const s of Object.keys(bySeat)){current=(await req('/api/room',bySeat[s],undefined,'GET')).data.state;const target=s===liarSeat?alternative:liarSeat;const r=await req('/api/room/liar-vote',bySeat[s],{target,expectedPhaseId:current.game.phaseId});assert.equal(r.status,200);}
  current=(await req('/api/room',tokens[liarIndex],undefined,'GET')).data.state; assert.equal(current.game.phase,'guess'); assert.equal(current.game.canGuess,true);
  const guessed=await req('/api/room/liar-guess',tokens[liarIndex],{guess:word,expectedPhaseId:current.game.phaseId}); assert.equal(guessed.status,200); assert.equal(guessed.data.state.game.status,'finished'); assert.equal(guessed.data.state.game.lastResult.winningSide,'liar');
  assert.equal((await req('/api/room/resign',tokens[0],{})).status,400); assert.equal((await req('/api/room/move',tokens[0],{x:0,y:0})).status,400);
});
''', encoding='utf-8')

print('v1.6.24 liar integration patch applied')
