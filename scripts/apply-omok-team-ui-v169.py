from pathlib import Path


def patch(path, old, new, count=1):
    p=Path(path)
    src=p.read_text()
    n=src.count(old)
    if n != count: raise RuntimeError(f'{path}: expected {count} matches, found {n}: {old[:110]!r}')
    p.write_text(src.replace(old,new,count))

html='public/index.html'
app='public/app.js'
css='public/styles.css'
patch(html, '            <div class="gameOption" data-game-option="othello">', '''            <div class="gameOption" data-game-option="omok2v2">
              <button type="button" class="gameChoice" data-game="omok2v2"><strong>오목 2vs2</strong></button>
              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>4인 팀전! 흑팀 1번 → 백팀 2번 → 흑팀 3번 → 백팀 4번 순서로 반복합니다. 네 자리가 모두 정해지면 시작하며 기존 15×15 오목과 금수 규칙은 그대로입니다. 승리하면 같은 팀 두 명이 함께 승리합니다. 누군가 연결이 끊기면 복귀할 때까지 일시정지합니다.</p></details>
            </div>
            <div class="gameOption" data-game-option="othello">''')
patch(html, '          <div class="players" aria-label="플레이어 상태">', '          <div id="standardPlayers" class="players" aria-label="플레이어 상태">')
patch(html, '''          <div id="roleChooser" class="roleChooser hidden">''', '''          <div id="teamPlayers" class="teamPlayers hidden" aria-label="4인 팀 선수와 착수 순서"></div>

          <div id="roleChooser" class="roleChooser hidden">''')
patch(html, '            <div class="roleButtons">', '            <div id="standardRoleButtons" class="roleButtons">')
patch(html, '''              <button id="chooseSpectatorBtn" class="rolePick spectatorPick"><span class="spectatorIcon">◎</span>관전 선택</button>
            </div>
          </div>''', '''              <button id="chooseSpectatorBtn" class="rolePick spectatorPick"><span class="spectatorIcon">◎</span>관전 선택</button>
            </div>
            <div id="teamRoleButtons" class="teamRoleButtons hidden" aria-label="4인 자리 선택">
              <button type="button" data-team-seat="1" class="rolePick teamRolePick blackPick">⚫ 1번 · 흑팀</button>
              <button type="button" data-team-seat="2" class="rolePick teamRolePick whitePick">⚪ 2번 · 백팀</button>
              <button type="button" data-team-seat="3" class="rolePick teamRolePick blackPick">⚫ 3번 · 흑팀</button>
              <button type="button" data-team-seat="4" class="rolePick teamRolePick whitePick">⚪ 4번 · 백팀</button>
              <button id="teamSpectatorBtn" type="button" class="rolePick spectatorPick">◎ 관전 선택</button>
            </div>
          </div>''')
patch(html, '''            <button id="nextRoundBtn" class="primary hidden">다음 판 준비</button>''', '''            <button id="nextRoundBtn" class="primary hidden">다음 판 준비</button>
            <button id="endGameBtn" class="ghost hidden">중단된 대국 종료</button>''')
patch(html, '''            <button id="sideNextRoundBtn" class="primary hidden">다음 판 준비</button>''', '''            <button id="sideNextRoundBtn" class="primary hidden">다음 판 준비</button>
            <button id="sideEndGameBtn" class="ghost hidden">중단된 대국 종료</button>''')
patch(html, 'v=1.6.8', 'v=1.6.9', count=3)
patch(app, "  const blackPlayer = document.getElementById('blackPlayer');", "  const standardPlayers = document.getElementById('standardPlayers');\n  const teamPlayers = document.getElementById('teamPlayers');\n  const standardRoleButtons = document.getElementById('standardRoleButtons');\n  const teamRoleButtons = document.getElementById('teamRoleButtons');\n  const teamSeatButtons = [...document.querySelectorAll('[data-team-seat]')];\n  const teamSpectatorBtn = document.getElementById('teamSpectatorBtn');\n  const blackPlayer = document.getElementById('blackPlayer');")
patch(app, "  const sideResignBtn = document.getElementById('sideResignBtn');", "  const sideResignBtn = document.getElementById('sideResignBtn');\n  const endGameBtn = document.getElementById('endGameBtn');\n  const sideEndGameBtn = document.getElementById('sideEndGameBtn');")
patch(app, "  function gameName(type) {\n    return type === 'baseball' ? '숫자야구' : (type === 'othello' ? '오셀로' : '오목');\n  }", "  function gameName(type) {\n    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구' : (type === 'othello' ? '오셀로' : '오목');\n  }\n\n  function isTeamGame() { return state?.gameType === 'omok2v2'; }\n  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }")
patch(app, "    selectedGameType = ['othello', 'baseball'].includes(type) ? type : 'omok';", "    selectedGameType = ['othello', 'baseball', 'omok2v2'].includes(type) ? type : 'omok';")
patch(app, "      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : '대국 중';\n      info.textContent = `${status} · 선수 ${room.playerCount || 0}/2 · 접속 ${room.connectedCount || 0}명`;", "      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : room.status === 'paused' ? '일시정지' : '대국 중';\n      info.textContent = `${status} · 선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명`;")
patch(app, "    selectedGameType = ['othello', 'baseball'].includes(state?.gameType) ? state.gameType : 'omok';", "    selectedGameType = ['othello', 'baseball', 'omok2v2'].includes(state?.gameType) ? state.gameType : 'omok';")
patch(app, '''  function choiceKo(choice) {
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';''', '''  function choiceKo(choice) {
    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : (isTeamGame() ? '흑팀' : '흑');''')
patch(app, "    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : '백';", "    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : (isTeamGame() ? '백팀' : '백');")
patch(app, '''  function seatKo(value) {
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : '백';''', '''  function seatKo(value) {
    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : (isTeamGame() ? '흑팀' : '흑');
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : (isTeamGame() ? '백팀' : '백');''')
patch(app, "  function participantRoleText(p) {\n    if (p.seat === 'black')", "  function participantRoleText(p) {\n    if (isTeamGame() && ['1','2','3','4'].includes(p.seat)) return seatKo(p.seat);\n    if (p.seat === 'black')")
patch(app, "  function renderRoleChooser() {", '''  function renderTeamPlayers() {
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
  }

  function renderRoleChooser() {''')
patch(app, "    const baseball = state.gameType === 'baseball';\n    chooseBlackBtn.lastChild", "    const baseball = state.gameType === 'baseball';\n    const team = isTeamGame();\n    standardRoleButtons.classList.toggle('hidden', team);\n    teamRoleButtons.classList.toggle('hidden', !team);\n    roleChooser.classList.toggle('hidden', !selecting);\n    if (team) {\n      roleChooser.querySelector('small').textContent = '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';\n      for (const button of teamSeatButtons) {\n        const number = button.dataset.teamSeat;\n        button.disabled = Boolean(state.players[number] && seat !== number);\n        button.classList.toggle('selected', choice === number);\n      }\n      teamSpectatorBtn.classList.toggle('selected', choice === 'spectator');\n      return;\n    }\n    chooseBlackBtn.lastChild")
patch(app, "    roomInvitePanel.classList.toggle('hidden', !(isHost && g.status === 'selecting'));", "    roomInvitePanel.classList.toggle('hidden', !(isHost && g.status === 'selecting'));\n    const team = isTeamGame();\n    standardPlayers.classList.toggle('hidden', team);\n    teamPlayers.classList.toggle('hidden', !team);")
patch(app, "    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';", "    if (g.status === 'selecting') statusText.textContent = team ? '4명 자리 선택 중' : '역할 선택 중';")
patch(app, "    else if (g.status === 'playing') {\n      statusText.textContent = `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;", "    else if (g.status === 'playing') {\n      statusText.textContent = team ? (g.paused\n        ? `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 복귀 대기`\n        : `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`)\n        : `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;")
patch(app, "    setPlayerCard(blackPlayer, 'black', state.players.black);\n    setPlayerCard(whitePlayer, 'white', state.players.white);", "    if (team) renderTeamPlayers();\n    else {\n      setPlayerCard(blackPlayer, 'black', state.players.black);\n      setPlayerCard(whitePlayer, 'white', state.players.white);\n    }")
patch(app, "    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));", "    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));\n    const canEndPaused = team && isHost && g.status === 'playing' && g.paused;\n    for (const b of [endGameBtn, sideEndGameBtn]) {\n      b.classList.toggle('hidden', !canEndPaused);\n      b.disabled = !canEndPaused;\n    }")
patch(app, "      if (!choice) boardOverlay.textContent = '흑 · 백 · 관전 중 역할을 선택하세요';", "      if (!choice) boardOverlay.textContent = team ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';")
patch(app, "    } else if (g.status === 'finished') {\n      boardOverlay.textContent = seat ? (g.winner === seat ? '승리!' : '패배') : `${seatKo(g.winner)} 승리`;", "    } else if (team && g.status === 'playing' && g.paused) {\n      boardOverlay.textContent = `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 플레이어를 기다리는 중`;\n      boardOverlay.classList.remove('hidden');\n    } else if (g.status === 'finished') {\n      boardOverlay.textContent = seat ? ((team ? seatColor(seat) : seat) === g.winner ? '우리 팀 승리!' : (team ? '우리 팀 패배' : '패배')) : `${seatKo(g.winner)} 승리`;")
patch(app, "    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seat);", "    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seatColor(seat));")
patch(app, "    if (!state || !seat || state.game.status !== 'playing' || state.game.turn !== seat) return false;", "    if (!state || !seat || state.game.status !== 'playing') return false;\n    if (isTeamGame() ? (state.game.paused || state.game.nextSeat !== seat) : state.game.turn !== seat) return false;")
patch(app, "  chooseSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));", "  chooseSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));\n  for (const button of teamSeatButtons) button.addEventListener('click', () => roomAction('choose-role', { choice: button.dataset.teamSeat }));\n  teamSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));\n  endGameBtn.addEventListener('click', () => confirm('중단된 대국을 승패 없이 종료할까요?') && roomAction('end-game'));\n  sideEndGameBtn.addEventListener('click', () => confirm('중단된 대국을 승패 없이 종료할까요?') && roomAction('end-game'));")
with Path(css).open('a') as f:
    f.write('''
/* Four-seat team omok v1.6.9. Standard two-player controls remain unchanged. */
.gameOption[data-game-option="baseball"]{grid-column:auto}
.teamPlayers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:14px}
.teamPlayer{min-width:0;display:grid;gap:3px;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:11px 13px}
.teamPlayer.black{border-left:3px solid #64748b}.teamPlayer.white{border-left:3px solid #f8fafc}
.teamPlayer strong{font-size:.84rem}.teamPlayer small{font-size:.74rem;color:#94a3b8;overflow-wrap:anywhere}
.teamPlayer.mySeat{outline:2px solid #60a5fa}.teamPlayer.myTurn{background:#172554;border-color:#60a5fa}
.teamPlayer.disconnected{opacity:.58}
.teamRoleButtons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
.teamRoleButtons .teamRolePick{min-width:0;justify-content:center;font-size:.81rem;padding:10px 7px}
.teamRoleButtons #teamSpectatorBtn{grid-column:1/-1;justify-content:center}
@media(max-width:520px){.teamPlayers{gap:6px}.teamPlayer{padding:9px}.teamPlayer strong{font-size:.76rem}.teamPlayer small{font-size:.67rem}}
''')
print('Team omok lobby and room UI applied')
