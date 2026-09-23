'use strict';
// One-time targeted integration. Exact anchors prevent accidental edits to unrelated games.
const fs = require('node:fs');
const files = new Map();
const read = file => {
  if (!files.has(file)) files.set(file, fs.readFileSync(file, 'utf8'));
  return files.get(file);
};
function replace(file, needle, replacement) {
  const old = read(file);
  const at = old.indexOf(needle);
  if (at < 0 || old.indexOf(needle, at + needle.length) >= 0) {
    throw Error(`${file}: missing or non-unique guarded anchor: ${needle.slice(0, 90)}`);
  }
  files.set(file, old.slice(0, at) + replacement + old.slice(at + needle.length));
}
const insertBefore = (file, anchor, insertion) => replace(file, anchor, insertion + anchor);
const server = 'server.js';
const client = 'public/app.js';
const html = 'public/index.html';
const registry = 'lib/games/index.js';
if (read(registry).includes("require('./twentyquestions-adapter')")) {
  console.log('Twenty Questions integration already present; no changes needed.');
  process.exit(0);
}
replace(registry, "const marathon = require('./marathon');", "const marathon = require('./marathon');\nconst twentyquestions = require('./twentyquestions-adapter');");
replace(registry, '  [marathon.id, marathon],', '  [marathon.id, marathon],\n  [twentyquestions.id, twentyquestions],');
replace('lib/match-result.js', "new Set(['bingo', 'pictionary', 'oldmaid', 'cityking'])", "new Set(['bingo', 'pictionary', 'oldmaid', 'cityking', 'twentyquestions'])");

replace(server, "const isPictionary = (room) => room.gameType === 'pictionary';", "const isPictionary = (room) => room.gameType === 'pictionary';\nconst isTwenty = (room) => room.gameType === 'twentyquestions';");
replace(server, '|| isMarathon(room);\n// Marathon', '|| isMarathon(room) || isTwenty(room);\n// Marathon');
replace(server, '(isPictionary(room) || isLiar(room)) ? PICTIONARY_SEATS', '(isPictionary(room) || isLiar(room) || isTwenty(room)) ? PICTIONARY_SEATS');
replace(server, "const currentTurnSeat = (room) => (isTeam(room) ? room.game.nextSeat : room.game.turn) || null;", "const currentTurnSeat = (room) => isTwenty(room)\n  ? (['secret', 'answering', 'judging'].includes(room.game.phase) ? room.game.drawerSeat : getGame('twentyquestions').currentTurn(room.game))\n  : (isTeam(room) ? room.game.nextSeat : room.game.turn) || null;");
replace(server, "p.rejoinable = Boolean(findSeat(room, token) && room.game.status === 'playing');", "p.rejoinable = Boolean(findSeat(room, token) && (room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended')));");
replace(server, "['pictionary', 'liar'].includes(gameEngine.id)", "['pictionary', 'liar', 'twentyquestions'].includes(gameEngine.id)");
replace(server, "if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';", "if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';");
replace(server, "myWord: isPictionary(room) ? getGame('pictionary').wordFor(room.game, seat) : null,", "myWord: isPictionary(room) ? getGame('pictionary').wordFor(room.game, seat) : null,\n      myTwentySecret: isTwenty(room) ? getGame('twentyquestions').secretFor(room.game, seat) : null,");
replace(server, "if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room)) return;", "if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room) || isTwenty(room)) return;");
replace(server, "if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room)) {", "if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room) || isTwenty(room)) {");
replace(server, "isLiar(room) || isOldMaid(room) || isCityKing(room) ? `${seat}번`", "isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) ? `${seat}번`");
replace(server, "isLiar(room) || isOldMaid(room) || isCityKing(room)) && seat", "isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room)) && seat");
replace(server, "if (!isNumberedSeatGame(room) || room.game.status !== 'playing') continue;", "if (!isNumberedSeatGame(room) || !(room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended'))) continue;");

const actions = `  // Twenty Questions integrated: host-only setup, private drawer secret and server-owned adjudication.
  if (action.startsWith('twenty-')) {
    if (!isTwenty(room)) return sendError(res, 400, 'WRONG_GAME', '스무고개 방에서만 사용할 수 있습니다.');
    const engine = getGame('twentyquestions');
    if (['twenty-start', 'twenty-next'].includes(action) && room.hostSessionToken !== session.token) {
      return sendError(res, 403, 'HOST_ONLY', '방장만 게임 시작과 다음 라운드를 진행할 수 있습니다.');
    }
    if (action === 'twenty-start') {
      const occupied = seatsFor(room).filter(n => room.players[n]);
      if (occupied.length < 2 || occupied.length > 8) return sendError(res, 409, 'INVALID_TWENTY_START', '2~8명이 자리를 선택해야 합니다.');
      const configured = engine.configure(room.game, body.mode, Number(body.totalRounds));
      if (!configured.legal) return sendError(res, 409, 'INVALID_TWENTY_CONFIG', engine.moveError(configured.reason));
      const verdict = engine.beginRound(room.game, occupied);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_START', engine.moveError(verdict.reason));
      for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
      appendSystemMessage(room, \`스무고개 시작! \${room.game.totalRounds}판 · \${room.game.mode === 'cooperative' ? '협동전' : '개인전'} · 카테고리: \${room.game.category}\`);
    } else if (action === 'twenty-next') {
      if (room.game.status !== 'round-ended') return sendError(res, 409, 'INVALID_TWENTY_NEXT', '라운드 결과가 나온 뒤 다음 라운드를 시작할 수 있습니다.');
      const verdict = engine.nextRound(room.game);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_NEXT', engine.moveError(verdict.reason));
      appendSystemMessage(room, \`스무고개 \${room.game.roundNumber}/\${room.game.totalRounds}라운드 시작 · 카테고리: \${room.game.category}\`);
    } else {
      const playerSeat = findSeat(room, session.token);
      if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 질문·출제·판정을 할 수 없습니다.');
      syncGamePause(room);
      if (room.game.paused) return sendError(res, 409, 'GAME_PAUSED', '응답이 없는 참가자가 있어 일시정지 중입니다.');
      let verdict;
      if (action === 'twenty-secret') {
        verdict = engine.setSecret(room.game, playerSeat, body.secret);
        if (verdict.legal) appendSystemMessage(room, \`\${session.label || '출제자'}님이 정답을 설정했습니다. 첫 질문을 시작하세요.\`);
      } else if (action === 'twenty-question') {
        verdict = engine.submitQuestion(room.game, playerSeat, body.question);
        if (verdict.legal) appendSystemMessage(room, \`\${session.label || '도전자'}님이 질문을 제출했습니다.\`);
      } else if (action === 'twenty-answer') {
        verdict = engine.answerQuestion(room.game, playerSeat, body.reply);
        if (verdict.legal) appendSystemMessage(room, \`출제자가 \${body.reply}(으)로 답했습니다.\`);
      } else if (action === 'twenty-guess') {
        verdict = engine.submitGuess(room.game, playerSeat, body.guess);
        if (verdict.legal) appendSystemMessage(room, \`\${session.label || '도전자'}님이 정답을 제출했습니다. 출제자의 판정을 기다립니다.\`);
      } else if (action === 'twenty-judge') {
        verdict = engine.judgeGuess(room.game, playerSeat, body.correct);
        if (verdict.legal) {
          appendSystemMessage(room, body.correct ? '정답입니다! 이번 라운드가 종료됐습니다.' : '오답입니다. 다음 도전자 차례입니다.');
          if (verdict.finished) appendSystemMessage(room, \`스무고개 종료! 공동 승자를 포함한 최종 점수가 확정됐습니다.\`);
        }
      } else return sendError(res, 400, 'BAD_TWENTY_ACTION', '알 수 없는 스무고개 행동입니다.');
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_ACTION', engine.moveError(verdict.reason));
    }
  }

`;
insertBefore(server, "  if (action === 'choose-role') {", actions);
replace(server, "if (room.gameType === 'pictionary') return sendError(res, 400, 'WRONG_GAME', '그림 맞히기는 그리기와 정답 제출 기능을 이용해 주세요.');", "if (room.gameType === 'pictionary') return sendError(res, 400, 'WRONG_GAME', '그림 맞히기는 그리기와 정답 제출 기능을 이용해 주세요.');\n    if (isTwenty(room)) return sendError(res, 400, 'WRONG_GAME', '스무고개는 질문과 정답 제출 기능을 이용해 주세요.');");
replace(server, "isOldMaid(room) || isMarathon(room)) {\n      room.game.winner = assignedSeatsFor(room).filter(s => s !== seat);", "isOldMaid(room) || isMarathon(room) || isTwenty(room)) {\n      room.game.winner = assignedSeatsFor(room).filter(s => s !== seat);");
replace(server, 'choose-role|set-oldmaid-mode|', 'choose-role|twenty-start|twenty-next|twenty-secret|twenty-question|twenty-answer|twenty-guess|twenty-judge|set-oldmaid-mode|');

replace(html, '                  <option value="marathon">마라톤</option>', '                  <option value="marathon">마라톤</option>\n                  <option value="twentyquestions">스무고개</option>');
insertBefore(html, '            <div class="gameOption" data-game-option="marathon">', '            <div class="gameOption" data-game-option="twentyquestions">\n              <button type="button" class="gameChoice" data-game="twentyquestions"><strong>스무고개</strong></button>\n            </div>\n');
const mainPanel = `          <section id="twentyPanel" class="twentyPanel hidden" aria-label="스무고개">
            <div class="twentyHeading"><h3>❔ 스무고개</h3><strong id="twentyProgress">라운드 준비 중</strong></div>
            <p id="twentyCategory" class="twentyCategory">무작위 카테고리를 기다리는 중입니다.</p>
            <p id="twentyStatus" class="twentyStatus" role="status">참가자를 기다리는 중입니다.</p>
            <p id="twentyMySecret" class="twentyPrivate">정답은 출제자에게만 보입니다.</p>
            <p id="twentyRoundResult" class="twentyResult hidden" role="status"></p>
            <p id="twentyFinalResult" class="twentyResult hidden" role="status"></p>
            <h4>누적 점수</h4><div id="twentyScoreboard" class="twentyScoreboard"></div>
            <h4>공식 질문 · 최대 20개</h4><ol id="twentyQuestionLog" class="twentyQuestionLog" aria-live="polite"></ol>
            <h4>정답 제출 기록</h4><div id="twentyGuessLog" class="twentyGuessLog" aria-live="polite"></div>
          </section>

`;
insertBefore(html, '          <section id="marathonPanel"', mainPanel);
const sidePanel = `            <section id="twentyActionPanel" class="twentyActionPanel hidden" aria-label="스무고개 행동">
              <div id="twentyHostSetup" class="twentyHostSetup hidden">
                <label for="twentyModeSelect">진행 방식</label><select id="twentyModeSelect"><option value="individual">개인전</option><option value="cooperative">협동전</option></select>
                <label for="twentyRoundsSelect">진행 라운드 · 1~10 자유 선택</label>
                <select id="twentyRoundsSelect">${Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}라운드</option>`).join('')}</select>
                <div id="twentyRecommendations" class="twentyRecommendations" aria-label="공평한 출제 횟수 추천"></div>
                <button id="twentyStartBtn" type="button" class="primary">스무고개 시작</button>
              </div>
              <form id="twentySecretForm" class="stackForm hidden" autocomplete="off">
                <label for="twentySecretInput">내 카테고리에 맞는 비밀 정답 · 출제자 전용</label>
                <input id="twentySecretInput" type="text" maxlength="100" autocomplete="off" required placeholder="정답을 입력하세요" />
                <button type="submit" class="primary">정답 확정 · 비공개</button>
              </form>
              <form id="twentyQuestionForm" class="stackForm hidden" autocomplete="off">
                <label for="twentyQuestionInput">내 차례 · 질문하기</label>
                <input id="twentyQuestionInput" type="text" maxlength="200" autocomplete="off" required placeholder="예/아니오로 답할 수 있는 질문" />
                <button type="submit" class="primary">질문 제출</button>
              </form>
              <form id="twentyGuessForm" class="stackForm hidden" autocomplete="off">
                <label for="twentyGuessInput">내 차례 · 질문 대신 정답 제출 / 최종 정답 기회</label>
                <input id="twentyGuessInput" type="text" maxlength="100" autocomplete="off" required placeholder="내가 생각한 정답" />
                <button type="submit" class="secondary">정답 제출</button>
              </form>
              <div id="twentyAnswerBox" class="twentyJudgeBox hidden">
                <strong>도전자의 질문</strong><p id="twentyPendingQuestion">질문 대기 중</p>
                <div id="twentyAnswerButtons" class="twentyAnswerButtons"><button type="button" class="secondary" data-twenty-answer="예">예</button><button type="button" class="secondary" data-twenty-answer="아니오">아니오</button><button type="button" class="secondary" data-twenty-answer="비슷함">비슷함</button><button type="button" class="secondary" data-twenty-answer="애매함">애매함</button></div>
              </div>
              <div id="twentyJudgeBox" class="twentyJudgeBox hidden">
                <strong>정답 판정 · 출제자 전용</strong><p id="twentyPendingGuess">정답 대기 중</p>
                <div class="twentyAnswerButtons"><button id="twentyJudgeCorrect" type="button" class="primary">정답</button><button id="twentyJudgeWrong" type="button" class="secondary">오답</button></div>
              </div>
              <button id="twentyNextBtn" type="button" class="primary hidden">다음 라운드 시작</button>
            </section>

`;
insertBefore(html, '            <div class="marathonStartRow">', sidePanel);
replace(html, '<script src="/app.js?v=1.6.68"></script>', '<script src="/twentyquestions-ui.js?v=1.6.69"></script>\n  <script src="/app.js?v=1.6.69"></script>');
replace(html, '/styles.css?v=1.6.68', '/styles.css?v=1.6.69');
replace(html, '/session-lock.js?v=1.6.68', '/session-lock.js?v=1.6.69');

replace(client, "type === 'marathon' ? '마라톤'", "type === 'marathon' ? '마라톤' : type === 'twentyquestions' ? '스무고개'");
replace(client, "function isMarathonGame() { return state?.gameType === 'marathon'; }", "function isMarathonGame() { return state?.gameType === 'marathon'; }\n  function isTwentyGame() { return state?.gameType === 'twentyquestions'; }");
replace(client, '|| isOldMaidGame() || isCityKingGame() || isMarathonGame(); }', '|| isOldMaidGame() || isCityKingGame() || isMarathonGame() || isTwentyGame(); }');
replace(client, '(isPictionaryGame() || isLiarGame()) ? [', '(isPictionaryGame() || isLiarGame() || isTwentyGame()) ? [');
replace(client, "['bingo', 'cityking', 'pictionary', 'liar', 'oldmaid'].includes(gameType)", "['bingo', 'cityking', 'pictionary', 'liar', 'oldmaid', 'twentyquestions'].includes(gameType)");
insertBefore(client, '    "liar": "3~8명이 참여합니다.', '    "twentyquestions": "2~8인 개인전·협동전. 1~10라운드 및 출제 횟수 추천 선택. 무작위 카테고리를 보고 출제자가 비밀 정답을 정합니다. 도전자는 순서대로 질문 20개 또는 질문 대신 정답을 제출하고, 출제자는 예·아니오·비슷함·애매함으로 답하며 정답을 직접 판정합니다. 오답이면 다음 사람 차례이며 질문 20개 후 모두 최종 정답 기회 1회씩 받습니다. 개인전 정답자는 +1점, 협동전 성공 시 도전자 전원 +1점, 전원 실패 시 출제자 +1점. 최종 최고점 공동 우승 가능.",\n');
replace(client, "'liar', 'oldmaid', 'marathon'].includes(type)", "'liar', 'oldmaid', 'marathon', 'twentyquestions'].includes(type)");
// Keep the normal numbered-seat rendering (same player cards/role controls as Pictionary).
replace(client, '    const marathon = isMarathonGame();\n    // Land King is host-started', '    const marathon = isMarathonGame();\n    const twenty = isTwentyGame();\n    // Land King is host-started');
replace(client, "const currentTurn = pictionary ? state.game.drawerSeat === number : liar ?", "const currentTurn = twenty ? (state.game.turnSeat === number || (state.game.drawerSeat === number && ['secret','answering','judging'].includes(state.game.phase))) : pictionary ? state.game.drawerSeat === number : liar ?");
replace(client, '(bingo || pictionary || liar || oldmaid || city || marathon) ? \'bingoSeat\'', '(bingo || pictionary || liar || oldmaid || city || marathon || twenty) ? \'bingoSeat\'');
replace(client, 'title.textContent = pictionary\n', "title.textContent = twenty ? `${number}번${number === state.game.drawerSeat && state.game.status === 'playing' ? ' · 출제자' : state.game.turnSeat === number && state.game.status === 'playing' ? ' · 질문 차례' : ''}` : pictionary\n");
replace(client, '(pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점`', '(pictionary || liar || twenty) ? ` · ${state.game.scores?.[number] || 0}점`');
replace(client, '    const marathon = isMarathonGame();\n    const team = isTeamGame();', '    const marathon = isMarathonGame();\n    const twenty = isTwentyGame();\n    const team = isTeamGame();');
replace(client, "roleChooser.querySelector('small').textContent = pictionary\n", "roleChooser.querySelector('small').textContent = twenty ? '2~8명이 자리를 선택합니다. 방장이 개인전/협동전과 1~10라운드를 정한 후 시작합니다.' : pictionary\n");
replace(client, '(bingo || pictionary || liar || oldmaid || city) ? `${number}번 자리`', '(bingo || pictionary || liar || oldmaid || city || twenty) ? `${number}번 자리`');
// Limit remaining replacements to the renderRoom function to avoid unintended board changes.
const renderStart = read(client).indexOf('  function renderRoom() {');
const renderEnd = read(client).indexOf('\n  function renderBaseball()', renderStart);
if (renderStart < 0 || renderEnd < 0) throw Error('renderRoom function markers not found');
const before = read(client).slice(0, renderStart);
let render = read(client).slice(renderStart, renderEnd);
const after = read(client).slice(renderEnd);
function inRender(needle, replacement) {
  const at = render.indexOf(needle);
  if (at < 0 || render.indexOf(needle, at + needle.length) >= 0) throw Error('renderRoom anchor missing/duplicate: ' + needle.slice(0, 60));
  render = render.slice(0, at) + replacement + render.slice(at + needle.length);
}
inRender('    const liar = isLiarGame();', '    const liar = isLiarGame();\n    const twenty = isTwentyGame();');
inRender("roundNumber.textContent = pictionary ?", "roundNumber.textContent = twenty ? `${g.roundNumber || 0}/${g.totalRounds || '?'}라운드` : pictionary ?");
inRender("moveCountLabel.textContent = pictionary ?", "moveCountLabel.textContent = twenty ? '진행 행동' : pictionary ?");
inRender('const scores = !pictionary && !liar && g.scores;', 'const scores = !pictionary && !liar && !twenty && g.scores;');
inRender('    if (isMarathonGame()) {\n', "    if (twenty) {\n      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '스무고개 · 방장 시작 대기' : g.status === 'round-ended' ? '라운드 결과 · 다음 라운드 대기' : g.status === 'finished' ? '스무고개 종료' : `스무고개 · ${g.category || '카테고리 선택'} · ${g.phase || '준비'}`);\n    } else if (isMarathonGame()) {\n");
inRender('canvasWrap.classList.toggle(\'hidden\', baseball || bingo || pictionary || liar || oldmaid || marathon);', 'canvasWrap.classList.toggle(\'hidden\', baseball || bingo || pictionary || liar || oldmaid || marathon || twenty);');
inRender('    if (liar) renderLiar();', "    if (liar) renderLiar();\n    document.getElementById('twentyPanel').classList.toggle('hidden', !twenty);\n    document.getElementById('twentyActionPanel').classList.toggle('hidden', !twenty);\n    if (twenty) window.TwentyQuestionsUI.render(state);");
inRender('if (pictionary || liar || oldmaid || marathon) {', 'if (pictionary || liar || oldmaid || marathon || twenty) {');
inRender('    drawBoard();\n  }', '    if (!twenty) drawBoard();\n  }');
files.set(client, before + render + after);
replace(client, "state?.gameType === 'oldmaid') return false;", "state?.gameType === 'oldmaid' || state?.gameType === 'twentyquestions') return false;");
replace(client, "  selectGame('omok');\n  drawBoard();\n  loadSession();", "  window.TwentyQuestionsUI.init(roomAction);\n  selectGame('omok');\n  drawBoard();\n  loadSession();");

const css = 'public/styles.css';
files.set(css, read(css) + `\n/* Twenty Questions: scoped layout; existing game/side panel layouts unchanged. */\n.twentyPanel{padding:18px;display:grid;gap:12px;min-width:0}.twentyHeading{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.twentyHeading h3,.twentyPanel h4{margin:0}.twentyCategory{background:#1e3a8a;color:#fff;padding:12px;border-radius:12px;font-weight:800}.twentyStatus,.twentyPrivate,.twentyResult{margin:0;padding:12px;border-radius:12px;background:#1f2937;color:#f1f5f9;line-height:1.5}.twentyPrivate{border:1px solid #64748b}.twentyResult{background:#14532d}.twentyScoreboard{display:grid;gap:8px}.twentyScore{display:flex;justify-content:space-between;gap:10px;padding:9px 12px;border:1px solid #64748b;border-radius:10px}.twentyQuestionLog{display:grid;gap:9px;margin:0;padding:0 0 0 22px;max-height:440px;overflow-y:auto}.twentyQuestionLog li,.twentyGuessLog p{padding:9px;border-bottom:1px solid #475569;line-height:1.5;overflow-wrap:anywhere}.twentyActionPanel{display:grid;gap:12px;padding:12px 0}.twentyHostSetup,.twentyJudgeBox{display:grid;gap:9px}.twentyAnswerButtons,.twentyRecommendations{display:flex;flex-wrap:wrap;gap:8px}.twentyAnswerButtons button{flex:1 1 100px}.twentyActionPanel input,.twentyActionPanel select{width:100%;max-width:100%;box-sizing:border-box}.twentyPanel.hidden,.twentyActionPanel.hidden,.twentyHostSetup.hidden,.twentyJudgeBox.hidden{display:none!important}\n`);

replace('package.json', '"version": "1.6.68"', '"version": "1.6.69"');
const lock = read('package-lock.json');
if ((lock.match(/"version": "1\.6\.31"/g) || []).length !== 2) throw Error('Unexpected package-lock version layout');
files.set('package-lock.json', lock.replace(/^  "version": "1\.6\.31",/m, '  "version": "1.6.69",').replace(/^      "version": "1\.6\.31",/m, '      "version": "1.6.69",'));

replace(server, "version: '1.6.68'", "version: '1.6.69'");
replace(server, '게임 서버 v1.6.68 실행', '게임 서버 v1.6.69 실행');
for (const [file, content] of files) fs.writeFileSync(file, content, 'utf8');
console.log('Twenty Questions integration applied:', [...files.keys()].join(', '));
