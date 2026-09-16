'use strict';
const fs = require('node:fs');
function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, content) { fs.writeFileSync(file, content); }
function once(value, before, after, description) {
  const n = value.split(before).length - 1;
  if (n !== 1) throw new Error(`${description}: expected 1 anchor, found ${n}`);
  return value.replace(before, after);
}

let server = read('server.js');
server = once(server,
  "      roomCode: isHost ? room.code : null,\n    },",
  "      roomCode: isHost ? room.code : null,\n      // A secret is only ever sent back to its owning player, never to other players or spectators.\n      mySecret: room.gameType === 'baseball' && seat ? room.game.secrets[seat] : null,\n    },",
  'private player view');
server = once(server,
  "  if (action === 'move') {\n",
  `  if (action === 'set-secret') {
    if (room.gameType !== 'baseball') return sendError(res, 400, 'WRONG_GAME', '숫자야구 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 비밀 숫자를 정할 수 없습니다.');
    const engine = getGame('baseball');
    const verdict = engine.setSecret(room.game, seat, body.secret);
    if (!verdict.legal) return sendError(res, verdict.reason === 'invalid-number' ? 400 : 409, 'INVALID_SECRET', engine.moveError(verdict.reason));
    appendSystemMessage(room, \\`\${session.label || '플레이어'}님이 비밀 숫자 준비를 완료했습니다.\\`);
    if (verdict.ready) appendSystemMessage(room, '양쪽 비밀 숫자 준비 완료! 선공부터 추측하세요.');
  }

  if (action === 'guess') {
    if (room.gameType !== 'baseball') return sendError(res, 400, 'WRONG_GAME', '숫자야구 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 숫자를 추측할 수 없습니다.');
    const engine = getGame('baseball');
    const verdict = engine.applyGuess(room.game, body.guess, seat, nowIso());
    if (!verdict.legal) return sendError(res, verdict.reason === 'invalid-number' ? 400 : 409, 'INVALID_GUESS', engine.moveError(verdict.reason));
  }

  if (action === 'move') {\n`,
  'baseball endpoints');
server = once(server,
  "    if (!seat || room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '기권할 수 없는 상태입니다.');",
  "    if (!seat || (room.game.status !== 'playing' && !(room.gameType === 'baseball' && room.game.status === 'setup'))) return sendError(res, 409, 'NOT_PLAYING', '기권할 수 없는 상태입니다.');",
  'baseball setup resignation');
server = once(server,
  "  match = pathname.match(/^\\/api\\/room\\/(choose-role|move|resign|next-round|rematch)$/);",
  "  match = pathname.match(/^\\/api\\/room\\/(choose-role|set-secret|guess|move|resign|next-round|rematch)$/);",
  'route allowlist');
server = server.replaceAll('1.6.4', '1.6.5');
write('server.js', server);

let html = read('public/index.html');
html = once(html,
  `            <button type="button" class="gameChoice" data-game="othello">
              <strong>오셀로</strong><small>8×8 · 돌 뒤집기 · 자동 패스</small>
            </button>`,
  `            <button type="button" class="gameChoice" data-game="othello">
              <strong>오셀로</strong><small>8×8 · 돌 뒤집기 · 자동 패스</small>
            </button>
            <button type="button" class="gameChoice" data-game="baseball">
              <strong>숫자야구</strong><small>3자리 · 각자 비밀 숫자 · 스트라이크/볼</small>
            </button>`,
  'third lobby game');
html = once(html,
  `          <div class="canvasWrap">
            <canvas id="board" width="720" height="720" aria-label="오목판"></canvas>
            <div id="boardOverlay" class="boardOverlay hidden"></div>
          </div>`,
  `          <div id="canvasWrap" class="canvasWrap">
            <canvas id="board" width="720" height="720" aria-label="게임판"></canvas>
            <div id="boardOverlay" class="boardOverlay hidden"></div>
          </div>

          <section id="baseballPanel" class="baseballPanel hidden" aria-label="숫자야구 경기">
            <p id="baseballReady" class="baseballReady">양쪽 비밀 숫자를 기다리고 있습니다.</p>
            <p id="baseballMySecret" class="baseballMySecret">내 비밀 숫자: 미설정</p>
            <p id="baseballHint" class="baseballHint">플레이어가 정해지면 각자 비밀 숫자를 설정합니다.</p>
            <form id="baseballSecretForm" class="baseballForm hidden" autocomplete="off">
              <label for="baseballSecretInput">내 비밀 숫자 정하기</label>
              <div class="baseballInputRow">
                <input id="baseballSecretInput" type="password" inputmode="numeric" pattern="[1-9][0-9]{2}" minlength="3" maxlength="3" autocomplete="new-password" placeholder="서로 다른 숫자 3개" aria-label="내 비밀 숫자" required />
                <button class="primary" type="submit">비밀 숫자 확정</button>
              </div>
              <small>첫 자리는 0이 아니어야 하며 중복 숫자는 쓸 수 없습니다. 확정 후에는 변경할 수 없습니다.</small>
            </form>
            <form id="baseballGuessForm" class="baseballForm hidden" autocomplete="off">
              <label for="baseballGuessInput">상대의 비밀 숫자 추측하기</label>
              <div class="baseballInputRow">
                <input id="baseballGuessInput" type="text" inputmode="numeric" pattern="[1-9][0-9]{2}" minlength="3" maxlength="3" autocomplete="off" placeholder="예: 123" aria-label="추측할 숫자" required />
                <button class="secondary" type="submit">추측하기</button>
              </div>
            </form>
            <div class="baseballHistoryHead"><h3>추측 기록</h3><small>최신 기록이 위에 표시됩니다</small></div>
            <div id="baseballHistory" class="baseballHistory" aria-live="polite"></div>
          </section>`,
  'baseball gameplay panel');
html = once(html, '<dt>착수 수</dt><dd id="moveCount">', '<dt id="moveCountLabel">착수 수</dt><dd id="moveCount">', 'move label');
html = html.replaceAll('?v=1.6.4', '?v=1.6.5');
write('public/index.html', html);

let css = read('public/styles.css');
css += `

/* Number baseball v1.6.5 — no canvas or extra connections required */
.gameChoice[data-game="baseball"]{grid-column:1/-1}
.baseballPanel{display:grid;gap:16px;background:linear-gradient(155deg,#101d32,#0b1324);border:1px solid #334155;border-radius:18px;padding:22px;min-height:445px}
.baseballReady{margin:0;padding:12px 14px;border:1px solid #334155;border-radius:12px;color:#cbd5e1;font-size:.9rem}
.baseballMySecret{margin:0;background:#172554;border:1px solid #1d4ed8;border-radius:12px;padding:13px 15px;font-size:1.08rem;font-weight:850;color:#dbeafe;letter-spacing:.03em}
.baseballHint{margin:0;color:#e2e8f0;line-height:1.5;font-size:.91rem}
.baseballForm{display:grid;gap:10px;padding:15px;background:#0f172a;border:1px solid #334155;border-radius:14px}
.baseballForm label{font-weight:850;font-size:.92rem}
.baseballInputRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px}
.baseballInputRow input{min-width:0;border:1px solid #475569;border-radius:12px;background:#020617;color:#fff;font-size:1.2rem;font-weight:850;letter-spacing:.12em;padding:11px 13px}
.baseballInputRow input:focus{outline:2px solid #60a5fa;outline-offset:1px}
.baseballForm small{color:#94a3b8;line-height:1.5;font-size:.76rem}
.baseballHistoryHead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.baseballHistoryHead h3{margin:0}.baseballHistoryHead small{color:#94a3b8;font-size:.72rem}
.baseballHistory{display:grid;gap:7px;align-content:start;max-height:360px;min-height:85px;overflow-y:auto}
.baseballHistoryRow{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:10px 12px;background:#0f172a;border:1px solid #273449;border-radius:10px;font-size:.86rem}
.baseballHistoryRow.mine{border-color:#2563eb;background:#122345}
.baseballHistoryRow strong{font-variant-numeric:tabular-nums;font-size:.96rem;letter-spacing:.08em}
.baseballHistoryRow .result{font-weight:900;color:#bfdbfe;white-space:nowrap}
@media(max-width:520px){.baseballPanel{padding:12px;gap:12px;min-height:330px}.baseballInputRow{grid-template-columns:minmax(0,1fr)}.baseballInputRow button{width:100%}.baseballHistoryRow{font-size:.76rem;flex-wrap:wrap}}
`;
write('public/styles.css', css);

let app = read('public/app.js');
app = once(app,
  "  const boardOverlay = document.getElementById('boardOverlay');",
  `  const boardOverlay = document.getElementById('boardOverlay');
  const canvasWrap = document.getElementById('canvasWrap');
  const baseballPanel = document.getElementById('baseballPanel');
  const baseballReady = document.getElementById('baseballReady');
  const baseballMySecret = document.getElementById('baseballMySecret');
  const baseballHint = document.getElementById('baseballHint');
  const baseballSecretForm = document.getElementById('baseballSecretForm');
  const baseballSecretInput = document.getElementById('baseballSecretInput');
  const baseballGuessForm = document.getElementById('baseballGuessForm');
  const baseballGuessInput = document.getElementById('baseballGuessInput');
  const baseballHistory = document.getElementById('baseballHistory');
  const moveCountLabel = document.getElementById('moveCountLabel');`,
  'baseball DOM bindings');
app = once(app,
  `  function gameName(type) {
    return type === 'othello' ? '오셀로' : '오목';
  }

  function selectGame(type) {
    selectedGameType = type === 'othello' ? 'othello' : 'omok';`,
  `  function gameName(type) {
    return type === 'baseball' ? '숫자야구' : (type === 'othello' ? '오셀로' : '오목');
  }

  function selectGame(type) {
    selectedGameType = ['othello', 'baseball'].includes(type) ? type : 'omok';`,
  'select third game');
app = once(app,
  "    selectedGameType = state?.gameType === 'othello' ? 'othello' : 'omok';",
  "    selectedGameType = ['othello', 'baseball'].includes(state?.gameType) ? state.gameType : 'omok';",
  'room game selection');
app = once(app,
  `  function choiceKo(choice) {
    if (choice === 'black') return '흑';
    if (choice === 'white') return '백';`,
  `  function choiceKo(choice) {
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';
    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : '백';`,
  'choice labels');
app = once(app,
  `  function seatKo(value) {
    if (value === 'black') return '흑';
    if (value === 'white') return '백';`,
  `  function seatKo(value) {
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : '백';`,
  'seat labels');
app = once(app,
  `  function setPlayerCard(el, color, player) {
    const small = el.querySelector('small');`,
  `  function setPlayerCard(el, color, player) {
    el.querySelector('strong').textContent = seatKo(color);
    const small = el.querySelector('small');`,
  'player labels');
app = once(app,
  `    if (p.seat === 'black') return '흑';
    if (p.seat === 'white') return '백';`,
  `    if (p.seat === 'black') return seatKo('black');
    if (p.seat === 'white') return seatKo('white');`,
  'participant labels');
app = once(app,
  `    const selecting = g.status === 'selecting';
    roleChooser.classList.toggle('hidden', !selecting);`,
  `    const selecting = g.status === 'selecting';
    const baseball = state.gameType === 'baseball';
    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : '흑 선택';
    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : '백 선택';
    roleChooser.querySelector('small').textContent = baseball
      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'
      : '매 판 새로 선택합니다. 흑·백이 모두 정해지면 나머지 참가자는 자동 관전됩니다.';
    roleChooser.classList.toggle('hidden', !selecting);`,
  'baseball role picker');
app = once(app,
  `    roundNumber.textContent = \\`\${g.round || 1}판\\`;
    moveCount.textContent = String(g.moveCount || 0);`,
  `    roundNumber.textContent = \\`\${g.round || 1}판\\`;
    moveCountLabel.textContent = state.gameType === 'baseball' ? '추측 횟수' : '착수 수';
    moveCount.textContent = String(g.moveCount || 0);`,
  'number baseball move label');
app = once(app,
  `    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';
    else if (g.status === 'playing') {`,
  `    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';
    else if (g.status === 'setup') statusText.textContent = '비밀 숫자 설정 중';
    else if (g.status === 'playing') {`,
  'secret setup state');
app = once(app,
  `    const finished = ['finished', 'draw'].includes(g.status);
    const canAct = Boolean(seat);
    for (const b of [resignBtn, sideResignBtn]) {
      b.classList.toggle('hidden', !canAct || g.status !== 'playing');
      b.disabled = !canAct || g.status !== 'playing';
    }`,
  `    const finished = ['finished', 'draw'].includes(g.status);
    const canAct = Boolean(seat);
    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));
    for (const b of [resignBtn, sideResignBtn]) {
      b.classList.toggle('hidden', !canResign);
      b.disabled = !canResign;
    }`,
  'setup resignation controls');
app = once(app,
  `    if (g.status === 'selecting') {
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = \\`\${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중\\`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {`,
  `    const baseball = state.gameType === 'baseball';
    canvasWrap.classList.toggle('hidden', baseball);
    baseballPanel.classList.toggle('hidden', !baseball);
    if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = \\`\${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중\\`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {`,
  'game-specific board UI');
app = once(app,
  `  function drawBoard() {
    if (state?.gameType === 'othello') return drawOthelloBoard();`,
  `  function drawBoard() {
    if (state?.gameType === 'baseball') return;
    if (state?.gameType === 'othello') return drawOthelloBoard();`,
  'non-canvas game rendering');
app = once(app,
  `  function canPlace(x, y) {
    if (!state || !seat || state.game.status !== 'playing' || state.game.turn !== seat) return false;`,
  `  function canPlace(x, y) {
    if (state?.gameType === 'baseball') return false;
    if (!state || !seat || state.game.status !== 'playing' || state.game.turn !== seat) return false;`,
  'disable canvas for baseball');

app = once(app,
  `  function drawBoard() {`,
  `  function renderBaseball() {
    const g = state.game;
    const ready = g.ready || {};
    baseballReady.textContent = \\`비밀 숫자 준비: 선공 \${ready.black ? '완료' : '대기'} · 후공 \${ready.white ? '완료' : '대기'}\\`;
    baseballMySecret.textContent = seat
      ? (state.me?.mySecret ? \\`내 비밀 숫자: \${state.me.mySecret}\\` : '내 비밀 숫자: 미설정')
      : '관전 중 · 비밀 숫자는 각 플레이어에게만 보입니다.';
    const myReady = Boolean(seat && ready[seat]);
    baseballSecretForm.classList.toggle('hidden', !(g.status === 'setup' && seat && !myReady));
    baseballGuessForm.classList.toggle('hidden', !(g.status === 'playing' && seat && g.turn === seat));
    if (g.status === 'selecting') baseballHint.textContent = '선공·후공을 선택하면 각자 비밀 숫자를 설정할 수 있습니다.';
    else if (g.status === 'setup') baseballHint.textContent = !seat ? '플레이어들의 비밀 숫자 준비를 기다리는 중입니다.' : (myReady ? '비밀 숫자 설정 완료. 상대방이 준비할 때까지 기다려 주세요.' : '상대에게 보이지 않을 비밀 숫자 3개를 입력해 주세요.');
    else if (g.status === 'playing') baseballHint.textContent = seat === g.turn ? '내 차례입니다! 상대의 숫자를 추측해 주세요.' : \\`\${seatKo(g.turn)}이(가) 추측할 차례입니다.\\`;
    else baseballHint.textContent = g.winner ? \\`\${seatKo(g.winner)} 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.\\` : '이번 판이 끝났습니다.';
    baseballHistory.replaceChildren();
    const guesses = g.guesses || [];
    if (!guesses.length) {
      const empty = document.createElement('p');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 추측 기록이 없습니다.';
      baseballHistory.appendChild(empty);
    }
    for (const [i, entry] of [...guesses].reverse().entries()) {
      const item = document.createElement('div');
      item.className = 'baseballHistoryRow' + (entry.color === seat ? ' mine' : '');
      const left = document.createElement('span');
      left.textContent = \\`#\${guesses.length - i} \${seatKo(entry.color)} · \`;
      const digits = document.createElement('strong');
      digits.textContent = entry.guess;
      left.appendChild(digits);
      const result = document.createElement('span');
      result.className = 'result';
      result.textContent = entry.strikes === 0 && entry.balls === 0 ? '아웃' : \\`\${entry.strikes}S \${entry.balls}B\\`;
      item.append(left, result);
      baseballHistory.appendChild(item);
    }
  }

  function drawBoard() {`,
  'baseball dedicated rendering');

app = once(app,
  `  async function sendLobbyChat(event) {`,
  `  function validBaseballInput(value) {
    return /^[1-9][0-9]{2}$/.test(value) && new Set(value).size === 3;
  }

  async function sendBaseballAction(event, action, input, name) {
    event.preventDefault();
    const value = input.value.trim();
    if (!validBaseballInput(value)) return showToast('첫 자리가 0이 아닌 서로 다른 숫자 3개를 입력해 주세요.', 4000);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const data = await api(\\`/api/room/\${action}\\`, { method: 'POST', body: JSON.stringify({ [name]: value }) });
      if (data.state) { state = data.state; renderRoom(); }
      input.value = '';
    } catch (err) { showToast(err.message, 4000); }
    finally { button.disabled = false; }
  }

  async function sendLobbyChat(event) {`,
  'number baseball submissions');
app = once(app,
  `  chatForm.addEventListener('submit', sendChat);`,
  `  chatForm.addEventListener('submit', sendChat);
  baseballSecretForm.addEventListener('submit', (event) => sendBaseballAction(event, 'set-secret', baseballSecretInput, 'secret'));
  baseballGuessForm.addEventListener('submit', (event) => sendBaseballAction(event, 'guess', baseballGuessInput, 'guess'));`,
  'number baseball forms');
write('public/app.js', app);

let pkg = read('package.json');
pkg = once(pkg, '"version": "1.6.4"', '"version": "1.6.5"', 'package version');
write('package.json', pkg);
console.log('Number baseball UI, server routes, privacy and v1.6.5 integration applied.');
