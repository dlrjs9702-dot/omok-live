from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# server.js: numbered-seat reuse for Bingo plus authoritative Bingo actions.
path = 'server.js'
s = read(path)
s = replace_once(s,
"const TEAM_SEATS = ['1', '2', '3', '4'];\nconst isTeam = (room) => room.gameType === 'omok2v2';\nconst teamColor = (seat) => TEAM_SEATS.includes(String(seat)) ? (Number(seat) % 2 ? 'black' : 'white') : null;",
"const TEAM_SEATS = ['1', '2', '3', '4'];\nconst isTeam = (room) => room.gameType === 'omok2v2';\nconst isBingo = (room) => room.gameType === 'bingo';\nconst isNumberedSeatGame = (room) => isTeam(room) || isBingo(room);\nconst teamColor = (seat) => TEAM_SEATS.includes(String(seat)) ? (Number(seat) % 2 ? 'black' : 'white') : null;",
'server helpers')
s = replace_once(s,
"    playerCount: isTeam(room) ? TEAM_SEATS.filter(seat => room.players[seat]).length\n      : Number(Boolean(room.players.black)) + Number(Boolean(room.players.white)),\n    maxPlayers: isTeam(room) ? 4 : 2,",
"    playerCount: isNumberedSeatGame(room) ? TEAM_SEATS.filter(seat => room.players[seat]).length\n      : Number(Boolean(room.players.black)) + Number(Boolean(room.players.white)),\n    maxPlayers: isNumberedSeatGame(room) ? 4 : 2,",
'public room summary')
s = replace_once(s,
"    players: gameEngine.id === 'omok2v2'\n      ? { '1': null, '2': null, '3': null, '4': null }\n      : { black: null, white: null },",
"    players: ['omok2v2', 'bingo'].includes(gameEngine.id)\n      ? { '1': null, '2': null, '3': null, '4': null }\n      : { black: null, white: null },",
'make room players')
s = replace_once(s, "if (isNew && isTeam(room) && session.guestKeyId) {", "if (isNew && isNumberedSeatGame(room) && session.guestKeyId) {", 'reclaim numbered seat')
s = replace_once(s, "  if (isTeam(room)) return TEAM_SEATS.find(seat => room.players[seat] === token) || null;", "  if (isNumberedSeatGame(room)) return TEAM_SEATS.find(seat => room.players[seat] === token) || null;", 'find numbered seat')
s = replace_once(s, "    players: isTeam(room) ? Object.fromEntries(TEAM_SEATS.map(seat => [seat, publicPlayer(room, seat)])) : {", "    players: isNumberedSeatGame(room) ? Object.fromEntries(TEAM_SEATS.map(seat => [seat, publicPlayer(room, seat)])) : {", 'public players')
s = replace_once(s, "    maxPlayers: isTeam(room) ? 4 : 2,", "    maxPlayers: isNumberedSeatGame(room) ? 4 : 2,", 'public max players')
s = replace_once(s,
"      mySecret: room.gameType === 'baseball' && seat ? room.game.secrets[seat] : null,",
"      mySecret: room.gameType === 'baseball' && seat ? room.game.secrets[seat] : null,\n      myBingoBoard: room.gameType === 'bingo' && seat ? getGame('bingo').boardFor(room.game, seat) : null,",
'bingo private board')
s = replace_once(s, "    if (!p || !isTeam(room)) continue;", "    if (!p || !isNumberedSeatGame(room)) continue;", 'disconnect numbered seats')
s = replace_once(s,
"function maybeStart(room) {\n  if (isTeam(room)) {",
"function maybeStart(room) {\n  if (isBingo(room)) return;\n  if (isTeam(room)) {",
'bingo manual start')
s = replace_once(s,
"function prepareNextRound(room) {\n  const gameEngine = getGame(room.gameType) || getGame('omok');\n  gameEngine.reset(room.game);\n  room.players = isTeam(room) ? { '1': null, '2': null, '3': null, '4': null } : { black: null, white: null };\n  for (const p of Object.values(room.participants)) p.choice = null;\n}",
"function prepareNextRound(room) {\n  const gameEngine = getGame(room.gameType) || getGame('omok');\n  gameEngine.reset(room.game);\n  if (isBingo(room)) {\n    for (const p of Object.values(room.participants)) {\n      if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';\n    }\n    return;\n  }\n  room.players = isTeam(room) ? { '1': null, '2': null, '3': null, '4': null } : { black: null, white: null };\n  for (const p of Object.values(room.participants)) p.choice = null;\n}",
'bingo rematch seats')
s = replace_once(s,
"  const role = seat ? (isTeam(room) ? `${teamColor(seat) === 'black' ? '흑' : '백'}팀 ${seat}번`\n    : room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공')",
"  const role = seat ? (isBingo(room) ? `${seat}번`\n    : isTeam(room) ? `${teamColor(seat) === 'black' ? '흑' : '백'}팀 ${seat}번`\n    : room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공')",
'presence bingo role')
s = replace_once(s,
"  const opponent = isTeam(room) && seat\n    ? TEAM_SEATS.filter(s => teamColor(s) !== teamColor(seat))\n      .map(s => room.participants[room.players[s]]?.label).filter(Boolean).join(', ') || null\n    : opponentToken ? (room.participants[opponentToken]?.label || null) : null;",
"  const opponent = isBingo(room) && seat\n    ? TEAM_SEATS.filter(s => s !== seat).map(s => room.participants[room.players[s]]?.label).filter(Boolean).join(', ') || null\n    : isTeam(room) && seat\n      ? TEAM_SEATS.filter(s => teamColor(s) !== teamColor(seat))\n        .map(s => room.participants[room.players[s]]?.label).filter(Boolean).join(', ') || null\n      : opponentToken ? (room.participants[opponentToken]?.label || null) : null;",
'presence bingo opponents')
s = replace_once(s,
"    const valid = isTeam(room) ? [...TEAM_SEATS, 'spectator'] : ['black', 'white', 'spectator'];\n    const choice = valid.includes(body.choice) ? body.choice : null;\n    if (!choice) return sendError(res, 400, 'BAD_ROLE', isTeam(room) ? '1~4번 자리 또는 관전을 선택해 주세요.' : '흑, 백, 관전 중에서 선택해 주세요.');\n    if (choice !== 'spectator' && room.players[choice] && room.players[choice] !== session.token) {\n      return sendError(res, 409, 'ROLE_TAKEN', isTeam(room) ? `${choice}번 자리는 이미 선택됐습니다.` : `${choice === 'black' ? '흑' : '백'}은 다른 사람이 이미 선택했습니다.`);",
"    const valid = isNumberedSeatGame(room) ? [...TEAM_SEATS, 'spectator'] : ['black', 'white', 'spectator'];\n    const choice = valid.includes(body.choice) ? body.choice : null;\n    if (!choice) return sendError(res, 400, 'BAD_ROLE', isNumberedSeatGame(room) ? '1~4번 자리 또는 관전을 선택해 주세요.' : '흑, 백, 관전 중에서 선택해 주세요.');\n    if (choice !== 'spectator' && room.players[choice] && room.players[choice] !== session.token) {\n      return sendError(res, 409, 'ROLE_TAKEN', isNumberedSeatGame(room) ? `${choice}번 자리는 이미 선택됐습니다.` : `${choice === 'black' ? '흑' : '백'}은 다른 사람이 이미 선택했습니다.`);",
'bingo role selection')

bingo_actions = """
  if (action === 'set-bingo-target') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 설정할 수 있습니다.');
    if (room.hostSessionToken !== session.token) return sendError(res, 403, 'HOST_ONLY', '방장만 승리 조건을 변경할 수 있습니다.');
    const engine = getGame('bingo');
    const verdict = engine.setTarget(room.game, Number(body.targetLines));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_TARGET', engine.moveError(verdict.reason));
  }

  if (action === 'start-bingo') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 시작할 수 있습니다.');
    if (room.hostSessionToken !== session.token) return sendError(res, 403, 'HOST_ONLY', '방장만 빙고를 시작할 수 있습니다.');
    const seats = TEAM_SEATS.filter(seat => room.players[seat]);
    const engine = getGame('bingo');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `빙고 시작! ${room.game.targetLines}줄을 먼저 완성하면 승리합니다.`);
  }

  if (action === 'select-bingo') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 숫자를 선택할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 숫자를 선택할 수 없습니다.');
    const engine = getGame('bingo');
    const verdict = engine.selectNumber(room.game, seat, Number(body.number), nowIso(), Number(body.expectedMoveCount));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_SELECTION', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 ${Number(body.number)}번을 선택했습니다.`);
    if (verdict.finished) appendSystemMessage(room, `${room.participants[room.players[room.game.winner]]?.label || room.game.winner + '번'}님이 빙고 승리 조건을 달성했습니다!`);
  }

"""
s = replace_once(s, "  if (action === 'set-secret') {", bingo_actions + "  if (action === 'set-secret') {", 'bingo actions')
s = replace_once(s,
"    if (room.gameType === 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹은 주사위와 도시 매입 기능을 이용해 주세요.');",
"    if (room.gameType === 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹은 주사위와 도시 매입 기능을 이용해 주세요.');\n    if (room.gameType === 'bingo') return sendError(res, 400, 'WRONG_GAME', '빙고는 자신의 숫자판에서 숫자를 선택해 주세요.');",
'bingo generic move guard')
s = replace_once(s,
"  if (action === 'resign') {\n    const seat = findSeat(room, session.token);",
"  if (action === 'resign') {\n    if (isBingo(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '빙고에서는 기권 기능을 사용하지 않습니다.');\n    const seat = findSeat(room, session.token);",
'bingo resign guard')
s = replace_once(s, "      if (!isTeam(room) || room.game.status !== 'playing') continue;", "      if (!isNumberedSeatGame(room) || room.game.status !== 'playing') continue;", 'guest bingo reconnect')
s = replace_once(s,
"  match = pathname.match(/^\\/api\\/room\\/(choose-role|set-secret|guess|throw-yut|move-yut|roll-city|buy-city|skip-city|move|resign|end-game|next-round|rematch)$/);",
"  match = pathname.match(/^\\/api\\/room\\/(choose-role|set-bingo-target|start-bingo|select-bingo|set-secret|guess|throw-yut|move-yut|roll-city|buy-city|skip-city|move|resign|end-game|next-round|rematch)$/);",
'bingo route endpoint')
s = s.replace("version: '1.6.18'", "version: '1.6.21'")
s = s.replace('게임 서버 v1.6.19 실행', '게임 서버 v1.6.21 실행')
write(path, s)

# public/index.html: game picker, Bingo controls, cache version.
path = 'public/index.html'
h = read(path)
h = replace_once(h, '                  <option value="yut">윷놀이</option>\n                  <option value="dots">점과 상자</option>', '                  <option value="yut">윷놀이</option>\n                  <option value="bingo">빙고</option>\n                  <option value="dots">점과 상자</option>', 'bingo rules option')
h = replace_once(h,
'''            <div class="gameOption" data-game-option="yut">
              <button type="button" class="gameChoice" data-game="yut"><strong>윷놀이</strong></button>
            </div>
            <div class="gameOption" data-game-option="dots">''',
'''            <div class="gameOption" data-game-option="yut">
              <button type="button" class="gameChoice" data-game="yut"><strong>윷놀이</strong></button>
            </div>
            <div class="gameOption" data-game-option="bingo">
              <button type="button" class="gameChoice" data-game="bingo"><strong>빙고</strong></button>
            </div>
            <div class="gameOption" data-game-option="dots">''', 'bingo game picker')

bingo_panel = '''
          <section id="bingoPanel" class="bingoPanel hidden" aria-label="빙고 게임">
            <div class="bingoSetupRow">
              <label for="bingoTargetSelect">승리 조건</label>
              <select id="bingoTargetSelect" aria-label="승리에 필요한 빙고 줄 수">
                <option value="1">1줄</option><option value="2">2줄</option><option value="3">3줄</option><option value="4">4줄</option>
                <option value="5" selected>5줄</option><option value="6">6줄</option><option value="7">7줄</option><option value="8">8줄</option>
                <option value="9">9줄</option><option value="10">10줄</option><option value="11">11줄</option><option value="12">12줄</option>
              </select>
              <button id="bingoStartBtn" class="primary" type="button">빙고 시작</button>
            </div>
            <p id="bingoStatus" class="bingoStatus">2명 이상 자리를 선택하면 방장이 시작할 수 있습니다.</p>
            <div class="bingoInfoGrid">
              <div><strong>선택된 숫자</strong><p id="bingoSelectedNumbers">없음</p></div>
              <div><strong>현재 빙고</strong><p id="bingoLineSummary">-</p></div>
            </div>
            <div id="bingoBoard" class="bingoBoard" aria-live="polite"></div>
          </section>

'''
h = replace_once(h, '          <section id="cityControls" class="cityControls hidden" aria-label="랜드킹 조작">', bingo_panel + '          <section id="cityControls" class="cityControls hidden" aria-label="랜드킹 조작">', 'bingo panel')
h = h.replace('v=1.6.20', 'v=1.6.21')
write(path, h)

# public/app.js: numbered seats + Bingo UI.
path = 'public/app.js'
a = read(path)
a = replace_once(a,
"  const yutMoveChoices = document.getElementById('yutMoveChoices');\n  const cityControls = document.getElementById('cityControls');",
"  const yutMoveChoices = document.getElementById('yutMoveChoices');\n  const bingoPanel = document.getElementById('bingoPanel');\n  const bingoTargetSelect = document.getElementById('bingoTargetSelect');\n  const bingoStartBtn = document.getElementById('bingoStartBtn');\n  const bingoStatus = document.getElementById('bingoStatus');\n  const bingoSelectedNumbers = document.getElementById('bingoSelectedNumbers');\n  const bingoLineSummary = document.getElementById('bingoLineSummary');\n  const bingoBoard = document.getElementById('bingoBoard');\n  const cityControls = document.getElementById('cityControls');",
'bingo dom refs')
a = replace_once(a,
"    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구'\n      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹'\n        : (type === 'othello' ? '오셀로' : '오목');",
"    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구'\n      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹'\n        : (type === 'othello' ? '오셀로' : '오목');",
'bingo game name')
a = replace_once(a,
"  function isTeamGame() { return state?.gameType === 'omok2v2'; }\n  function seatColor(value) {",
"  function isTeamGame() { return state?.gameType === 'omok2v2'; }\n  function isBingoGame() { return state?.gameType === 'bingo'; }\n  function isNumberedSeatGame() { return isTeamGame() || isBingoGame(); }\n  function seatColor(value) {",
'bingo client helpers')
a = replace_once(a,
"  function resultOutcome(game, playerSeat, gameType) {\n    if (game?.status !== 'finished' || !playerSeat || !['black', 'white'].includes(game.winner)) return null;\n    const color = gameType === 'omok2v2' ? seatColor(playerSeat) : playerSeat;\n    if (!['black', 'white'].includes(color)) return null;\n    return color === game.winner ? 'win' : 'loss';\n  }",
"  function resultOutcome(game, playerSeat, gameType) {\n    if (game?.status !== 'finished' || !playerSeat || !game.winner) return null;\n    if (gameType === 'bingo') return String(playerSeat) === String(game.winner) ? 'win' : 'loss';\n    if (!['black', 'white'].includes(game.winner)) return null;\n    const color = gameType === 'omok2v2' ? seatColor(playerSeat) : playerSeat;\n    if (!['black', 'white'].includes(color)) return null;\n    return color === game.winner ? 'win' : 'loss';\n  }",
'bingo outcome')
a = replace_once(a,
'    "yut": "각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 움직이며, 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 같은 편 말끼리는 업어서 함께 이동하고 모서리에 정확히 멈추면 지름길을 이용합니다.",\n    "dots":',
'    "yut": "각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 움직이며, 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 같은 편 말끼리는 업어서 함께 이동하고 모서리에 정확히 멈추면 지름길을 이용합니다.",\n    "bingo": "2~4명이 1~50 중 서로 다른 25개 숫자로 된 5×5 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자를 누르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 방장이 시작 전에 1~12줄 중 승리 조건을 정하며 가로·세로·두 대각선을 합쳐 먼저 조건을 달성하면 승리합니다.",\n    "dots":',
'bingo rules text')
a = a.replace("['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'dots', 'cityking']", "['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking']")
a = replace_once(a,
"  function choiceKo(choice) {\n    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;",
"  function choiceKo(choice) {\n    if (isBingoGame() && ['1','2','3','4'].includes(choice)) return `${choice}번`;\n    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;",
'bingo choice label')
a = replace_once(a,
"  function seatKo(value) {\n    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;",
"  function seatKo(value) {\n    if (isBingoGame() && ['1','2','3','4'].includes(value)) return `${value}번`;\n    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;",
'bingo seat label')
a = replace_once(a,
"  function participantRoleText(p) {\n    if (isTeamGame() && ['1','2','3','4'].includes(p.seat)) return seatKo(p.seat);",
"  function participantRoleText(p) {\n    if (isNumberedSeatGame() && ['1','2','3','4'].includes(p.seat)) return seatKo(p.seat);",
'bingo participant role')

old_render_team = '''  function renderTeamPlayers() {
    teamPlayers.replaceChildren();
    for (const number of ['1','2','3','4']) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      card.className = `teamPlayer ${color}${seat === number ? ' mySeat' : ''}${state.game.nextSeat === number && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;
      const title = document.createElement('strong');
      title.textContent = `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      name.textContent = player ? `${player.label} · ${player.connected ? '접속 중' : '연결 끊김'}` : '자리 선택 가능';
      card.append(title, name);
      teamPlayers.appendChild(card);
    }
  }'''
new_render_team = '''  function renderTeamPlayers() {
    teamPlayers.replaceChildren();
    const bingo = isBingoGame();
    for (const number of ['1','2','3','4']) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      const currentTurn = bingo ? state.game.turn === number : state.game.nextSeat === number;
      card.className = `teamPlayer ${bingo ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${currentTurn && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;
      const title = document.createElement('strong');
      title.textContent = bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}` : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      name.textContent = player ? `${player.label}${bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}` : '자리 선택 가능';
      card.append(title, name);
      teamPlayers.appendChild(card);
    }
  }'''
a = replace_once(a, old_render_team, new_render_team, 'render bingo seats')
a = replace_once(a,
"    const city = state.gameType === 'cityking';\n    const team = isTeamGame();\n    roleChooser.classList.toggle('connectFourRole', connect4);\n    roleChooser.classList.toggle('blueRedRole', yut || dots || city);\n    standardRoleButtons.classList.toggle('hidden', team);\n    teamRoleButtons.classList.toggle('hidden', !team);\n    roleChooser.classList.toggle('hidden', !selecting);\n    if (team) {\n      roleChooser.querySelector('small').textContent = '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';\n      for (const button of teamSeatButtons) {\n        const number = button.dataset.teamSeat;\n        button.disabled = Boolean(state.players[number] && seat !== number);\n        button.classList.toggle('selected', choice === number);\n      }\n      teamSpectatorBtn.classList.toggle('selected', choice === 'spectator');\n      return;\n    }",
"    const city = state.gameType === 'cityking';\n    const bingo = isBingoGame();\n    const team = isTeamGame();\n    const numbered = isNumberedSeatGame();\n    roleChooser.classList.toggle('connectFourRole', connect4);\n    roleChooser.classList.toggle('blueRedRole', yut || dots || city);\n    standardRoleButtons.classList.toggle('hidden', numbered);\n    teamRoleButtons.classList.toggle('hidden', !numbered);\n    roleChooser.classList.toggle('hidden', !selecting);\n    if (numbered) {\n      roleChooser.querySelector('small').textContent = bingo\n        ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 승리 줄 수를 정하고 시작합니다.'\n        : '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';\n      for (const button of teamSeatButtons) {\n        const number = button.dataset.teamSeat;\n        button.textContent = bingo ? `${number}번 자리` : `${number}번 · ${seatColor(number) === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;\n        button.disabled = Boolean(state.players[number] && seat !== number);\n        button.classList.toggle('selected', choice === number);\n      }\n      teamSpectatorBtn.classList.toggle('selected', choice === 'spectator');\n      return;\n    }",
'bingo role chooser')
a = replace_once(a,
"    const team = isTeamGame();\n    standardPlayers.classList.toggle('hidden', team);",
"    const team = isTeamGame();\n    const numbered = isNumberedSeatGame();\n    standardPlayers.classList.toggle('hidden', numbered);",
'bingo player layout')
a = replace_once(a, "    teamPlayers.classList.toggle('hidden', !team);", "    teamPlayers.classList.toggle('hidden', !numbered);", 'numbered player cards')
a = replace_once(a,
"    moveCountLabel.textContent = state.gameType === 'baseball' ? '추측 횟수' : state.gameType === 'yut' ? '말 이동 수' : state.gameType === 'dots' ? '그은 선 수' : state.gameType === 'cityking' ? '진행 수' : '착수 수';",
"    moveCountLabel.textContent = state.gameType === 'baseball' ? '추측 횟수' : state.gameType === 'yut' ? '말 이동 수' : state.gameType === 'bingo' ? '선택 수' : state.gameType === 'dots' ? '그은 선 수' : state.gameType === 'cityking' ? '진행 수' : '착수 수';",
'bingo move label')
a = replace_once(a,
"        : state.gameType === 'cityking' ? `파랑 자산 ${scores.black} · 빨강 자산 ${scores.white}`\n        : `흑 ${scores.black} · 백 ${scores.white}`) : '-';",
"        : state.gameType === 'cityking' ? `파랑 자산 ${scores.black} · 빨강 자산 ${scores.white}`\n        : `흑 ${scores.black} · 백 ${scores.white}`) : (state.gameType === 'bingo' ? Object.entries(g.lineCounts || {}).map(([n, count]) => `${n}번 ${count}줄`).join(' · ') || '-' : '-');",
'bingo score summary')
a = replace_once(a,
"    if (g.status === 'selecting') statusText.textContent = team ? '4명 자리 선택 중' : '역할 선택 중';",
"    if (g.status === 'selecting') statusText.textContent = isBingoGame() ? '빙고 참가자 자리 선택 · 방장 시작' : team ? '4명 자리 선택 중' : '역할 선택 중';",
'bingo selecting status')
a = replace_once(a,
"      statusText.textContent = team ? (g.paused\n        ? `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 복귀 대기`\n        : `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`)\n        : state.gameType === 'yut'",
"      statusText.textContent = isBingoGame()\n        ? `${seatKo(g.turn)} · ${state.players[g.turn]?.label || '플레이어'}님 숫자 선택 차례`\n        : team ? (g.paused\n          ? `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 복귀 대기`\n          : `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`)\n        : state.gameType === 'yut'",
'bingo turn status')
a = replace_once(a, "    if (team) renderTeamPlayers();", "    if (numbered) renderTeamPlayers();", 'render numbered players')
a = replace_once(a,
"    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));",
"    const canResign = !isBingoGame() && canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));",
'bingo resign hidden')
a = replace_once(a,
"    const baseball = state.gameType === 'baseball';\n    const yut = state.gameType === 'yut';\n    const city = state.gameType === 'cityking';\n    canvasWrap.classList.toggle('hidden', baseball);",
"    const baseball = state.gameType === 'baseball';\n    const yut = state.gameType === 'yut';\n    const bingo = state.gameType === 'bingo';\n    const city = state.gameType === 'cityking';\n    canvasWrap.classList.toggle('hidden', baseball || bingo);",
'bingo panel mode')
a = replace_once(a,
"    yutControls.classList.toggle('hidden', !yut);\n    if (yut) renderYut();\n    cityControls.classList.toggle('hidden', !city);",
"    yutControls.classList.toggle('hidden', !yut);\n    if (yut) renderYut();\n    bingoPanel.classList.toggle('hidden', !bingo);\n    if (bingo) renderBingo();\n    cityControls.classList.toggle('hidden', !city);",
'render bingo panel')

render_bingo = '''
  function renderBingo() {
    const g = state.game;
    const selected = new Set(g.selectedNumbers || []);
    const occupied = ['1','2','3','4'].filter(number => state.players[number]);
    bingoTargetSelect.value = String(g.targetLines || 5);
    bingoTargetSelect.disabled = !(isHost && g.status === 'selecting');
    bingoStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    bingoStartBtn.disabled = !(isHost && occupied.length >= 2 && g.status === 'selecting');
    bingoSelectedNumbers.textContent = (g.selectedNumbers || []).length ? g.selectedNumbers.join(', ') : '없음';
    const summarySeats = g.seatOrder?.length ? g.seatOrder : occupied;
    bingoLineSummary.textContent = summarySeats.length
      ? summarySeats.map(number => `${state.players[number]?.label || number + '번'} ${g.lineCounts?.[number] || 0}줄`).join(' · ')
      : '-';
    if (g.status === 'selecting') bingoStatus.textContent = `승리 조건 ${g.targetLines || 5}줄 · 현재 선수 ${occupied.length}명 · 2명 이상이면 방장이 시작할 수 있습니다.`;
    else if (g.status === 'playing') bingoStatus.textContent = `승리 조건 ${g.targetLines}줄 · 현재 ${seatKo(g.turn)} 차례${g.lastSelected ? ` · 직전 선택 ${g.lastSelected.number}` : ''}`;
    else if (g.status === 'finished') bingoStatus.textContent = `${state.players[g.winner]?.label || seatKo(g.winner)} 승리 · ${g.lineCounts?.[g.winner] || 0}줄 완성`;

    bingoBoard.replaceChildren();
    const board = state.me?.myBingoBoard;
    if (!Array.isArray(board) || board.length !== 25) {
      const note = document.createElement('p');
      note.className = 'smallMuted bingoSpectatorNote';
      note.textContent = g.status === 'selecting' ? '자리를 선택하면 게임 시작 후 내 빙고판이 생성됩니다.' : '관전 중입니다. 참가자별 완성 줄 수와 선택 숫자를 확인할 수 있습니다.';
      bingoBoard.appendChild(note);
      return;
    }
    const myTurn = Boolean(seat && g.status === 'playing' && g.turn === seat);
    for (const number of board) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bingoCell${selected.has(number) ? ' selected' : ''}`;
      button.textContent = String(number);
      button.disabled = !myTurn || selected.has(number);
      button.setAttribute('aria-label', `${number}번${selected.has(number) ? ' 선택됨' : ''}`);
      button.addEventListener('click', () => {
        button.disabled = true;
        roomAction('select-bingo', { number, expectedMoveCount: g.moveCount || 0 });
      });
      bingoBoard.appendChild(button);
    }
  }

'''
a = replace_once(a, "  function renderCityControls() {", render_bingo + "  function renderCityControls() {", 'bingo renderer')
a = replace_once(a,
"  function drawBoard() {\n    if (state?.gameType === 'baseball') return;",
"  function drawBoard() {\n    if (state?.gameType === 'baseball' || state?.gameType === 'bingo') return;",
'bingo no canvas draw')
a = replace_once(a,
"    if (state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking') return false;",
"    if (state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking' || state?.gameType === 'bingo') return false;",
'bingo no canvas place')
a = replace_once(a,
"  yutThrowBtn.addEventListener('click', () => roomAction('throw-yut'));\n  cityRollBtn.addEventListener('click', () => roomAction('roll-city'));",
"  yutThrowBtn.addEventListener('click', () => roomAction('throw-yut'));\n  bingoTargetSelect.addEventListener('change', () => roomAction('set-bingo-target', { targetLines: Number(bingoTargetSelect.value) }));\n  bingoStartBtn.addEventListener('click', () => roomAction('start-bingo'));\n  cityRollBtn.addEventListener('click', () => roomAction('roll-city'));",
'bingo event listeners')
write(path, a)

# CSS: append isolated Bingo styles, preserving the existing design system.
path = 'public/styles.css'
c = read(path)
if '/* Bingo v1.6.21 */' not in c:
    c += '''\n\n/* Bingo v1.6.21 */\n.bingoPanel{margin-top:14px;padding:16px;border:1px solid #334155;border-radius:18px;background:#0b1324}.bingoSetupRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.bingoSetupRow label{font-weight:900;color:#cbd5e1}.bingoSetupRow select{border:1px solid #475569;border-radius:10px;background:#0f172a;color:#fff;padding:9px 11px;font-weight:850}.bingoStatus{color:#bfdbfe;font-weight:800;line-height:1.5}.bingoInfoGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.bingoInfoGrid>div{background:#111c30;border:1px solid #263246;border-radius:12px;padding:10px}.bingoInfoGrid strong{font-size:.78rem;color:#94a3b8}.bingoInfoGrid p{margin:5px 0 0;line-height:1.45;font-size:.86rem}.bingoBoard{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.bingoCell{aspect-ratio:1;min-width:0;padding:0;border:1px solid #3b82f6;border-radius:13px;background:#172554;color:#eff6ff;font-size:clamp(1rem,3vw,1.35rem);font-weight:950;touch-action:manipulation}.bingoCell:hover:not(:disabled){background:#1d4ed8}.bingoCell.selected{background:#14532d;border-color:#22c55e;color:#dcfce7;box-shadow:inset 0 0 0 2px rgba(74,222,128,.2)}.bingoCell:disabled:not(.selected){opacity:.7}.bingoSpectatorNote{grid-column:1/-1;text-align:center;padding:24px 8px}.teamPlayer.bingoSeat{border-color:#475569}.teamPlayer.bingoSeat.myTurn{outline:2px solid #facc15;background:#422006}.teamPlayer.bingoSeat.mySeat{box-shadow:inset 0 0 0 1px #60a5fa}@media(max-width:520px){.bingoPanel{padding:11px}.bingoSetupRow{align-items:stretch}.bingoSetupRow label{width:100%}.bingoSetupRow select,.bingoSetupRow button{flex:1}.bingoInfoGrid{grid-template-columns:1fr}.bingoBoard{gap:5px}.bingoCell{border-radius:10px;font-size:clamp(.95rem,5vw,1.2rem)}}\n'''
write(path, c)

# Release announcement only for the actual planned release contents.
path = 'lib/release-announcements.js'
r = read(path)
notice = """  {\n    key: 'v1.6.21',\n    title: '[업데이트] v1.6.21 빙고 추가 및 윷놀이 이동 경로 수정',\n    body: '신규 2~4인 턴제 빙고를 추가했습니다. 방장이 1~12줄 승리 조건을 정하고, 각자 1~50 중 무작위 25개 숫자로 구성된 5×5 판에서 직접 숫자를 선택합니다. 선택 숫자는 모든 참가자에게 실시간 반영되며 서버에서 턴·중복·승리 판정을 검증합니다. 함께 윷놀이의 대각선·중앙 교차점·외곽 복귀 경로 연결 오류를 수정해 선택한 지름길이 중앙 이후에도 올바르게 유지되도록 개선했습니다.',\n    publishedAt: '2026-09-17T07:30:00Z',\n  },\n"""
if "key: 'v1.6.21'" not in r:
    r = replace_once(r, '];', notice + '];', 'release announcement')
write(path, r)

# Version metadata and all cache-version assertions.
for path in ['package.json', 'package-lock.json']:
    t = read(path).replace('1.6.20', '1.6.21')
    write(path, t)
for p in (ROOT / 'test').glob('*.test.js'):
    t = p.read_text(encoding='utf-8').replace('1.6.20', '1.6.21')
    p.write_text(t, encoding='utf-8')

print('v1.6.21 Yut+Bingo patch applied')
