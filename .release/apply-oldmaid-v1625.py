from pathlib import Path
import json

root = Path(__file__).resolve().parents[1]
def load(path): return (root / path).read_text(encoding='utf-8')
def save(path, text): (root / path).write_text(text, encoding='utf-8')
def once(text, old, new, label):
    n = text.count(old)
    if n != 1: raise SystemExit(f'{label}: expected one anchor, got {n}')
    return text.replace(old, new, 1)

p = 'lib/games/index.js'; s = load(p)
s = once(s, "const liar = require('./liar');", "const liar = require('./liar');\nconst oldmaid = require('./oldmaid');", 'registry-import')
s = once(s, '  [liar.id, liar],', '  [liar.id, liar],\n  [oldmaid.id, oldmaid],', 'registry-entry')
save(p, s)

p = 'server.js'; s = load(p)
s = once(s, "const PICTIONARY_SEATS = ['1', '2', '3', '4', '5', '6', '7', '8'];", "const PICTIONARY_SEATS = ['1', '2', '3', '4', '5', '6', '7', '8'];\nconst OLDMAID_SEATS = ['1', '2', '3', '4', '5', '6'];", 'server-seats')
s = once(s, "const isLiar = (room) => room.gameType === 'liar';", "const isLiar = (room) => room.gameType === 'liar';\nconst isOldMaid = (room) => room.gameType === 'oldmaid';", 'server-type')
s = once(s, 'const isNumberedSeatGame = (room) => isTeam(room) || isBingo(room) || isPictionary(room) || isLiar(room);', 'const isNumberedSeatGame = (room) => isTeam(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room);', 'server-numbered')
s = once(s, 'const seatsFor = (room) => (isPictionary(room) || isLiar(room)) ? PICTIONARY_SEATS : TEAM_SEATS;', 'const seatsFor = (room) => isOldMaid(room) ? OLDMAID_SEATS : (isPictionary(room) || isLiar(room)) ? PICTIONARY_SEATS : TEAM_SEATS;', 'server-seat-limit')
s = once(s, "    players: ['pictionary', 'liar'].includes(gameEngine.id)\n      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))", "    players: gameEngine.id === 'oldmaid'\n      ? Object.fromEntries(OLDMAID_SEATS.map((seat) => [seat, null]))\n      : ['pictionary', 'liar'].includes(gameEngine.id)\n      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))", 'server-room-seats')
s = once(s, "      myWord: isPictionary(room) ? getGame('pictionary').wordFor(room.game, seat) : null,", "      myWord: isPictionary(room) ? getGame('pictionary').wordFor(room.game, seat) : null,\n      myOldMaidHand: isOldMaid(room) ? getGame('oldmaid').handFor(room.game, seat) : null,", 'server-private-hand')
s = once(s, 'if (isBingo(room) || isPictionary(room) || isLiar(room)) return;', 'if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room)) return;', 'server-manual-start')
s = once(s, 'if (isBingo(room) || isPictionary(room) || isLiar(room)) {', 'if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room)) {', 'server-rematch-seats')
s = s.replace('isBingo(room) || isPictionary(room) || isLiar(room) ? `${seat}번`', 'isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) ? `${seat}번`')
s = s.replace('const opponent = (isBingo(room) || isPictionary(room) || isLiar(room)) && seat', 'const opponent = (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room)) && seat')
s = once(s, "  if (action === 'set-bingo-target') {", '''  if (action === 'start-oldmaid') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 시작할 수 있습니다.');
    if (room.hostSessionToken !== session.token) return sendError(res, 403, 'HOST_ONLY', '방장만 도둑잡기를 시작할 수 있습니다.');
    const players = seatsFor(room).filter(n => room.players[n]);
    const engine = getGame('oldmaid');
    const verdict = engine.start(room.game, players);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_START', engine.moveError(verdict.reason));
    for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
    appendSystemMessage(room, '도둑잡기가 시작됐습니다. 각자 자동으로 짝을 버렸습니다.');
  }

  if (action === 'shuffle-oldmaid' || action === 'draw-oldmaid') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 카드 조작이 가능합니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 카드를 조작할 수 없습니다.');
    const engine = getGame('oldmaid');
    if (action === 'shuffle-oldmaid') {
      const verdict = engine.shuffleHand(room.game, playerSeat, body.expectedRevision);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_SHUFFLE', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${session.label || '플레이어'}님이 자신의 카드를 섞었습니다.`);
    } else {
      const verdict = engine.draw(room.game, playerSeat, body.targetSeat, body.index, body.expectedRevision);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_DRAW', engine.moveError(verdict.reason));
      const targetLabel = room.participants[room.players[body.targetSeat]]?.label || '상대';
      appendSystemMessage(room, `${session.label || '플레이어'}님이 ${targetLabel}님의 카드 1장을 뽑았습니다.`);
      if (verdict.pairs) appendSystemMessage(room, `${session.label || '플레이어'}님이 카드 ${verdict.pairs}쌍을 버렸습니다.`);
      if (room.game.hands[body.targetSeat].length === 0) appendSystemMessage(room, `${targetLabel}님의 카드가 모두 없어졌습니다.`);
      if (room.game.hands[playerSeat].length === 0) appendSystemMessage(room, `${session.label || '플레이어'}님의 카드가 모두 없어졌습니다.`);
      if (verdict.finished) appendSystemMessage(room, `${room.participants[room.players[room.game.loser]]?.label || '마지막 참가자'}님이 조커를 보유하여 패배했습니다.`);
    }
  }

  if (action === 'set-bingo-target') {''', 'server-oldmaid-actions')
s = once(s, "    if (room.gameType === 'liar') return sendError(res, 400, 'WRONG_GAME', '라이어게임은 힌트·투표·최종 추측 기능을 이용해 주세요.');", "    if (room.gameType === 'liar') return sendError(res, 400, 'WRONG_GAME', '라이어게임은 힌트·투표·최종 추측 기능을 이용해 주세요.');\n    if (isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기는 카드 뽑기를 이용해 주세요.');", 'server-disallow-board-move')
s = once(s, "    if (isLiar(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '라이어게임에서는 기권 기능을 사용하지 않습니다.');", "    if (isLiar(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '라이어게임에서는 기권 기능을 사용하지 않습니다.');\n    if (isOldMaid(room)) return sendError(res, 400, 'UNSUPPORTED_ACTION', '도둑잡기에서는 기권 기능을 사용하지 않습니다.');", 'server-disallow-resign')
s = once(s, '(choose-role|set-liar-rounds|start-liar|', '(choose-role|start-oldmaid|shuffle-oldmaid|draw-oldmaid|set-liar-rounds|start-liar|', 'server-route-actions')
s = once(s, "version: '1.6.24'", "version: '1.6.25'", 'server-health-version')
s = once(s, '게임 서버 v1.6.24 실행', '게임 서버 v1.6.25 실행', 'server-log-version')
save(p, s)

p = 'public/index.html'; s = load(p)
s = once(s, '<option value="liar">라이어게임</option>', '<option value="liar">라이어게임</option>\n                  <option value="oldmaid">도둑잡기</option>', 'html-rule-option')
s = once(s, '''            <div class="gameOption" data-game-option="liar">
              <button type="button" class="gameChoice" data-game="liar"><strong>라이어게임</strong></button>
            </div>''', '''            <div class="gameOption" data-game-option="liar">
              <button type="button" class="gameChoice" data-game="liar"><strong>라이어게임</strong></button>
            </div>
            <div class="gameOption" data-game-option="oldmaid">
              <button type="button" class="gameChoice" data-game="oldmaid"><strong>도둑잡기</strong></button>
            </div>''', 'html-game-choice')
s = once(s, '          <section id="liarPanel" class="liarPanel hidden" aria-label="라이어게임">', '''          <section id="oldmaidPanel" class="oldmaidPanel hidden" aria-label="도둑잡기">
            <div class="oldmaidHeader"><strong id="oldmaidStatus">참가자를 기다리는 중</strong><button type="button" id="oldmaidStartBtn" class="primary">도둑잡기 시작</button></div>
            <p id="oldmaidResult" class="oldmaidResult hidden" aria-live="polite"></p>
            <div id="oldmaidCounts" class="oldmaidCounts"></div>
            <h3>상대방 카드 <small>현재 뽑을 상대의 카드만 선택할 수 있습니다</small></h3>
            <div id="oldmaidOpponents" class="oldmaidOpponents"></div>
            <div class="oldmaidMyHeader"><h3>내 손패</h3><button type="button" id="oldmaidShuffleBtn" class="secondary">카드 섞기</button></div>
            <div id="oldmaidMyHand" class="oldmaidCards" aria-label="내 손패"></div>
            <h3>최근 행동</h3><div id="oldmaidHistory" class="oldmaidHistory" aria-live="polite"></div>
          </section>

          <section id="liarPanel" class="liarPanel hidden" aria-label="라이어게임">''', 'html-oldmaid-panel')
s = s.replace('1.6.24', '1.6.25')
save(p, s)

p = 'public/app.js'; s = load(p)
s = once(s, "  const liarPanel = document.getElementById('liarPanel');", "  const oldmaidPanel = document.getElementById('oldmaidPanel');\n  const oldmaidStartBtn = document.getElementById('oldmaidStartBtn');\n  const oldmaidShuffleBtn = document.getElementById('oldmaidShuffleBtn');\n  const oldmaidStatus = document.getElementById('oldmaidStatus');\n  const oldmaidResult = document.getElementById('oldmaidResult');\n  const oldmaidCounts = document.getElementById('oldmaidCounts');\n  const oldmaidOpponents = document.getElementById('oldmaidOpponents');\n  const oldmaidMyHand = document.getElementById('oldmaidMyHand');\n  const oldmaidHistory = document.getElementById('oldmaidHistory');\n  const liarPanel = document.getElementById('liarPanel');", 'app-nodes')
s = once(s, ": type === 'liar' ? '라이어게임'", ": type === 'liar' ? '라이어게임' : type === 'oldmaid' ? '도둑잡기'", 'app-game-name')
s = once(s, "  function isLiarGame() { return state?.gameType === 'liar'; }", "  function isLiarGame() { return state?.gameType === 'liar'; }\n  function isOldMaidGame() { return state?.gameType === 'oldmaid'; }", 'app-type')
s = once(s, 'function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame(); }', 'function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame(); }', 'app-numbered')
s = once(s, "function numberedSeats() { return (isPictionaryGame() || isLiarGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }", "function numberedSeats() { return isOldMaidGame() ? ['1','2','3','4','5','6'] : (isPictionaryGame() || isLiarGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }", 'app-seat-count')
s = once(s, "    if (gameType === 'liar' && Array.isArray(game.winner)) return game.winner.includes(String(playerSeat)) ? 'win' : 'loss';", "    if (['liar', 'oldmaid'].includes(gameType) && Array.isArray(game.winner)) return game.winner.includes(String(playerSeat)) ? 'win' : 'loss';", 'app-winners')
s = once(s, '''    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다."
});''', '''    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다.",
    "oldmaid": "2~6명이 53장(조커 1장 포함)을 나누고 같은 계급의 카드 두 장씩 자동으로 버립니다. 내 차례에는 다음 활성 참가자의 카드 뒷면 중 한 장을 선택해 뽑습니다. 자기 손패는 카드 섞기로 순서를 바꿀 수 있습니다. 짝이 생기면 자동으로 버리며 마지막 조커 보유자가 패배합니다."
});''', 'app-rules')
s = once(s, "'pictionary', 'liar'].includes(type)", "'pictionary', 'liar', 'oldmaid'].includes(type)", 'app-select-game')
s = s.replace('(isBingoGame() || isPictionaryGame() || isLiarGame()) && numberedSeats()', '(isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame()) && numberedSeats()')
s = once(s, '''    const liar = isLiarGame();
    for (const number of numberedSeats()) {''', '''    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    for (const number of numberedSeats()) {''', 'app-player-type')
s = once(s, "const currentTurn = pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : bingo ? state.game.turn === number : state.game.nextSeat === number;", "const currentTurn = pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : oldmaid ? state.game.turn === number : bingo ? state.game.turn === number : state.game.nextSeat === number;", 'app-player-turn')
s = once(s, "(bingo || pictionary || liar) ? 'bingoSeat'", "(bingo || pictionary || liar || oldmaid) ? 'bingoSeat'", 'app-player-style')
s = once(s, ": liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`", ": liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`\n        : oldmaid ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 뽑기 차례' : ''}`", 'app-player-title')
s = once(s, "${(pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''}", "${oldmaid ? ` · ${state.game.counts?.[number] ?? 0}장` : (pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''}", 'app-player-count')
s = once(s, '''    const liar = isLiarGame();
    const team = isTeamGame();''', '''    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    const team = isTeamGame();''', 'app-roles-type')
s = once(s, ": liar ? '3~8명이 자리를 선택할 수 있습니다. 방장이 1판/3판을 정하고 시작합니다.'", ": liar ? '3~8명이 자리를 선택할 수 있습니다. 방장이 1판/3판을 정하고 시작합니다.'\n        : oldmaid ? '2~6명이 자리를 선택할 수 있습니다. 방장이 시작하면 카드를 나누고 짝을 자동으로 버립니다.'", 'app-roles-description')
s = once(s, '(bingo || pictionary || liar) ? `${number}번 자리`', '(bingo || pictionary || liar || oldmaid) ? `${number}번 자리`', 'app-roles-seat-label')
s = once(s, '''    const liar = isLiarGame();
    roundNumber.textContent''', '''    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    roundNumber.textContent''', 'app-render-type')
s = once(s, " : state.gameType === 'baseball' ? '추측 횟수'", " : oldmaid ? '뽑기 횟수' : state.gameType === 'baseball' ? '추측 횟수'", 'app-move-label')
s = once(s, "    if (liar) {\n      const speaker", "    if (oldmaid) {\n      statusText.textContent = g.status === 'selecting' ? '도둑잡기 자리 선택 · 방장 시작' : g.status === 'finished' ? `${state.players[g.loser]?.label || '조커 보유자'}님 패배` : `${state.players[g.turn]?.label || '플레이어'}님 차례 · ${state.players[g.target]?.label || '상대'}님 카드 뽑기`;\n    } else if (liar) {\n      const speaker", 'app-game-status')
s = once(s, 'const canResign = !isBingoGame() && !pictionary && !liar && canAct', 'const canResign = !isBingoGame() && !pictionary && !liar && !oldmaid && canAct', 'app-no-resign')
s = once(s, 'canvasWrap.classList.toggle(\'hidden\', baseball || bingo || pictionary || liar);', 'canvasWrap.classList.toggle(\'hidden\', baseball || bingo || pictionary || liar || oldmaid);', 'app-hide-board')
s = once(s, '''    if (liar) renderLiar();
    if (pictionary || liar) {''', '''    if (liar) renderLiar();
    oldmaidPanel.classList.toggle('hidden', !oldmaid);
    if (oldmaid) renderOldMaid();
    if (pictionary || liar || oldmaid) {''', 'app-render-oldmaid')
s = once(s, "if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar') return;", "if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar' || state?.gameType === 'oldmaid') return;", 'app-no-canvas')
s = once(s, "|| state?.gameType === 'liar') return false;", "|| state?.gameType === 'liar' || state?.gameType === 'oldmaid') return false;", 'app-no-canvas-input')
s = once(s, '  function drawBoard() {', '''  function renderOldMaid() {
    const g = state.game;
    const active = g.seatOrder?.length || numberedSeats().filter(number => state.players[number]).length;
    oldmaidStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    oldmaidStartBtn.disabled = !(isHost && active >= 2 && g.status === 'selecting');
    oldmaidShuffleBtn.disabled = !(seat && g.status === 'playing' && (g.counts?.[seat] || 0) > 0);
    const label = number => state.players[number]?.label || `${number}번`;
    oldmaidStatus.textContent = g.status === 'selecting'
      ? `참가자 ${active}명 · 2~6명이 자리를 선택하면 방장이 시작합니다.`
      : g.status === 'finished' ? `종료 · ${label(g.loser)}님이 조커를 보유했습니다.`
      : g.turn === seat ? `내 차례! ${label(g.target)}님의 카드 한 장을 뽑으세요.`
      : `${label(g.turn)}님 차례 · ${label(g.target)}님의 카드를 뽑는 중`;
    oldmaidResult.classList.toggle('hidden', g.status !== 'finished');
    oldmaidResult.textContent = g.status === 'finished'
      ? `🃏 ${label(g.loser)}님 패배 · 나머지 참가자 승리` : '';
    oldmaidCounts.replaceChildren();
    for (const number of (g.seatOrder?.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]))) {
      const chip = document.createElement('span');
      chip.className = 'oldmaidCount' + (g.turn === number ? ' active' : '');
      chip.textContent = `${label(number)} · ${g.counts?.[number] ?? 0}장${g.target === number ? ' · 뽑기 대상' : ''}`;
      oldmaidCounts.appendChild(chip);
    }
    oldmaidMyHand.replaceChildren();
    if (seat && Array.isArray(state.me?.myOldMaidHand)) {
      for (const card of state.me.myOldMaidHand) {
        const face = document.createElement('span');
        face.className = 'oldmaidCard oldmaidFace' + (card.rank === 'JOKER' ? ' joker' : '');
        face.textContent = card.rank === 'JOKER' ? '🃏 조커' : `${card.suit} ${card.rank}`;
        face.setAttribute('aria-label', card.rank === 'JOKER' ? '조커' : `${card.suit} ${card.rank}`);
        oldmaidMyHand.appendChild(face);
      }
    } else {
      oldmaidMyHand.textContent = seat ? '게임 시작 후 내 카드가 표시됩니다.' : '관전자는 다른 참가자의 카드 내용을 볼 수 없습니다.';
    }
    if (seat && g.status === 'playing' && !state.me.myOldMaidHand?.length) oldmaidMyHand.textContent = '카드를 모두 버렸습니다!';
    oldmaidOpponents.replaceChildren();
    for (const number of (g.seatOrder?.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]))) {
      if (number === seat) continue;
      const row = document.createElement('section');
      row.className = 'oldmaidOpponent' + (g.target === number ? ' target' : '');
      const name = document.createElement('strong');
      name.textContent = `${label(number)} · ${g.counts?.[number] ?? 0}장${g.target === number ? ' · 뽑기 대상' : ''}`;
      const cards = document.createElement('div');
      cards.className = 'oldmaidCards';
      const canDraw = Boolean(seat && g.status === 'playing' && g.turn === seat && g.target === number);
      for (let index = 0; index < (g.counts?.[number] || 0); index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'oldmaidCard oldmaidBack' + (canDraw ? ' selectable' : '');
        button.textContent = '🂠';
        button.disabled = !canDraw;
        button.setAttribute('aria-label', `${label(number)}님의 ${index + 1}번째 카드 뽑기`);
        button.addEventListener('click', () => {
          if (button.disabled) return;
          button.classList.add('selected');
          for (const candidate of cards.querySelectorAll('button')) candidate.disabled = true;
          roomAction('draw-oldmaid', { targetSeat: number, index, expectedRevision: g.revision });
        });
        cards.appendChild(button);
      }
      row.append(name, cards);
      oldmaidOpponents.appendChild(row);
    }
    oldmaidHistory.replaceChildren();
    for (const item of (g.history || []).slice(-12).reverse()) {
      const line = document.createElement('p');
      line.textContent = `${label(item.actor)}님이 ${label(item.target)}님의 카드 1장을 뽑았습니다.${item.pairs ? ` · ${item.pairs}쌍 버림` : ''}${item.emptied ? ` · ${label(item.emptied)}님 카드 소진` : ''}`;
      oldmaidHistory.appendChild(line);
    }
    if (!g.history?.length) oldmaidHistory.textContent = '아직 카드를 뽑지 않았습니다.';
  }

  function drawBoard() {''', 'app-oldmaid-renderer')
s = once(s, "  liarRoundsSelect.addEventListener('change'", "  oldmaidStartBtn.addEventListener('click', () => roomAction('start-oldmaid'));\n  oldmaidShuffleBtn.addEventListener('click', async () => {\n    if (oldmaidShuffleBtn.disabled || !state) return;\n    oldmaidShuffleBtn.disabled = true;\n    await roomAction('shuffle-oldmaid', { expectedRevision: state.game.revision });\n  });\n\n  liarRoundsSelect.addEventListener('change'", 'app-oldmaid-listeners')
save(p, s)

p = 'public/styles.css'; s = load(p)
s += '''
/* v1.6.25: old maid only; shared room/chat styles remain unchanged. */
.oldmaidPanel{display:grid;gap:12px;min-width:0}.oldmaidPanel.hidden{display:none}
.oldmaidHeader,.oldmaidMyHeader{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.oldmaidHeader strong{font-size:1rem}.oldmaidResult{padding:12px;border-radius:12px;background:#fef3c7;color:#713f12;font-weight:800}
.oldmaidCounts{display:flex;gap:6px;flex-wrap:wrap}.oldmaidCount{padding:6px 9px;border-radius:9px;background:#f1f5f9;color:#334155;font-size:.85rem}
.oldmaidCount.active{background:#dbeafe;color:#1d4ed8;font-weight:800}.oldmaidOpponents{display:grid;gap:10px}
.oldmaidOpponent{padding:10px;border:2px solid #cbd5e1;border-radius:12px;min-width:0}.oldmaidOpponent.target{border-color:#2563eb;background:#eff6ff}
.oldmaidCards{display:flex;gap:7px;flex-wrap:wrap;align-items:center;min-width:0;max-height:300px;overflow-y:auto;padding:4px 0}
.oldmaidCard{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;flex:0 0 57px;width:57px;height:77px;border-radius:8px;border:2px solid #94a3b8;font-weight:800;font-size:1rem}
.oldmaidFace{background:white;color:#172554}.oldmaidFace.joker{color:#7c3aed}
.oldmaidBack{background:#1e40af;color:white;font-size:1.8rem;cursor:pointer}
.oldmaidBack.selectable{border-color:#eab308;box-shadow:0 0 0 2px #fde68a}.oldmaidBack.selected{background:#16a34a;border-color:#166534}
.oldmaidBack:disabled{cursor:default;opacity:.68}.oldmaidHistory{max-height:170px;overflow-y:auto;font-size:.88rem;color:#475569}
.oldmaidHistory p{margin:4px 0}.oldmaidPanel h3{margin:4px 0;font-size:1rem}.oldmaidPanel h3 small{font-weight:400;font-size:.75rem}
@media(max-width:600px){.oldmaidCard{flex-basis:49px;width:49px;height:68px}.oldmaidCards{gap:5px}.oldmaidOpponent{padding:8px}.oldmaidHeader button,.oldmaidMyHeader button{min-height:44px}}
'''
save(p, s)

for path in ['package.json', 'package-lock.json']:
    data = json.loads(load(path))
    if data['version'] != '1.6.24': raise SystemExit(f'{path}: baseline version changed')
    data['version'] = '1.6.25'
    if path.endswith('lock.json'): data['packages']['']['version'] = '1.6.25'
    save(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')

p = 'lib/release-announcements.js'; s = load(p)
notice = '''  {
    key: 'v1.6.25',
    title: '[업데이트] v1.6.25 도둑잡기 추가',
    body: '신규 도둑잡기를 추가했습니다. 2~6명이 조커 포함 53장을 나눠 같은 계급의 카드 두 장씩 자동으로 버리고, 차례에 다음 참가자의 뒷면 카드를 선택해 뽑습니다. 자신의 카드를 섞을 수 있으며 참가자별 남은 카드 수와 최근 행동을 확인할 수 있습니다. 마지막 조커 보유자가 패배합니다. 관전·재접속·재대결과 기존 방 채팅을 지원합니다.',
    publishedAt: '2026-09-18T00:00:00+09:00',
  },
'''
if "key: 'v1.6.25'" in s: raise SystemExit('duplicate release notice')
s = once(s, '\n];', '\n' + notice + '];', 'release-notice')
save(p, s)

# Only expectations changed by adding one registered game or bumping the cache version.
for path in (root / 'test').glob('*.js'):
    text = path.read_text(encoding='utf-8')
    text = text.replace(r'1\.6\.24', r'1\.6\.25').replace('1.6.24', '1.6.25')
    if path.name in ('baseball.test.js', 'connect4.test.js'):
        import re
        text = re.sub(r"(['\"]liar['\"]\s*,\s*)(['\"]omok['\"])", r"\1'oldmaid', \2", text)
    if path.name == 'announcements.test.js':
        text = text.replace('data-game-option=/g) || []).length, 11', 'data-game-option=/g) || []).length, 12')
    if path.name == 'lobby-compact-effects.test.js':
        text = text.replace('games.length, 11', 'games.length, 12')
        text = text.replace('selectedIds.length, 11', 'selectedIds.length, 12')
        text = text.replace('pictionary|liar)', 'pictionary|liar|oldmaid)')
        text = text.replace('all ten games', 'all twelve games')
    path.write_text(text, encoding='utf-8')

print('v1.6.25 old maid integration patch applied')
