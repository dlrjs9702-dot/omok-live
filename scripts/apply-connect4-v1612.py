#!/usr/bin/env python3
from pathlib import Path


def replace_once(filename, before, after):
    p = Path(filename)
    text = p.read_text(encoding='utf-8')
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{filename}: expected exactly one integration anchor, found {count}: {before[:90]!r}')
    p.write_text(text.replace(before, after, 1), encoding='utf-8')

replace_once('lib/games/index.js',
    "const baseball = require('./baseball');\n",
    "const baseball = require('./baseball');\nconst connect4 = require('./connect4');\n")
replace_once('lib/games/index.js',
    '  [baseball.id, baseball],\n',
    '  [baseball.id, baseball],\n  [connect4.id, connect4],\n')
replace_once('test/baseball.test.js',
    "['baseball','omok','omok2v2','othello']",
    "['baseball','connect4','omok','omok2v2','othello']")

replace_once('server.js', "version: '1.6.11'", "version: '1.6.12'")
replace_once('server.js', '게임 서버 v1.6.10 실행:', '게임 서버 v1.6.12 실행:')
replace_once('server.js',
    "room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공') : (seat === 'black' ? '흑' : '백')",
    "room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공') : room.gameType === 'connect4' ? (seat === 'black' ? '빨강' : '노랑') : (seat === 'black' ? '흑' : '백')")

option = '''            <div class="gameOption" data-game-option="connect4">
              <button type="button" class="gameChoice" data-game="connect4"><strong>사목 (4목)</strong></button>
              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>7열×6행. 빨강이 먼저 시작하며 번갈아 열을 누르면 맨 아래 빈칸부터 돌이 쌓입니다. 같은 색 돌 4개를 가로·세로·대각선으로 먼저 연결하면 승리합니다. 가득 찬 열에는 둘 수 없고 판이 다 차면 무승부입니다.</p></details>
            </div>
'''
replace_once('public/index.html',
    '            <div class="gameOption" data-game-option="othello">',
    option + '            <div class="gameOption" data-game-option="othello">')
for old, new in [('styles.css?v=1.6.11', 'styles.css?v=1.6.12'),
                 ('app.js?v=1.6.11', 'app.js?v=1.6.12'),
                 ('session-lock.js?v=1.6.9', 'session-lock.js?v=1.6.12')]:
    replace_once('public/index.html', old, new)

replace_once('public/app.js',
    "return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구' : (type === 'othello' ? '오셀로' : '오목');",
    "return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구' : type === 'connect4' ? '사목 (4목)' : (type === 'othello' ? '오셀로' : '오목');")
replace_once('public/app.js',
    "selectedGameType = ['othello', 'baseball', 'omok2v2'].includes(type) ? type : 'omok';",
    "selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4'].includes(type) ? type : 'omok';")
replace_once('public/app.js',
    "selectedGameType = ['othello', 'baseball', 'omok2v2'].includes(state?.gameType) ? state.gameType : 'omok';",
    "selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4'].includes(state?.gameType) ? state.gameType : 'omok';")

for color, name in [('black', '빨강'), ('white', '노랑')]:
    old = f"if (choice === '{color}') return state?.gameType === 'baseball' ? '{'선공' if color == 'black' else '후공'}' : (isTeamGame() ? '{'흑팀' if color == 'black' else '백팀'}' : '{'흑' if color == 'black' else '백'}');"
    new = old.replace(" : (isTeamGame()", f" : state?.gameType === 'connect4' ? '{name}' : (isTeamGame()")
    replace_once('public/app.js', old, new)
    old = f"if (value === '{color}') return state?.gameType === 'baseball' ? '{'선공' if color == 'black' else '후공'}' : (isTeamGame() ? '{'흑팀' if color == 'black' else '백팀'}' : '{'흑' if color == 'black' else '백'}');"
    new = old.replace(" : (isTeamGame()", f" : state?.gameType === 'connect4' ? '{name}' : (isTeamGame()")
    replace_once('public/app.js', old, new)

replace_once('public/app.js',
    "    const baseball = state.gameType === 'baseball';\n    const team = isTeamGame();\n    standardRoleButtons.classList.toggle('hidden', team);",
    "    const baseball = state.gameType === 'baseball';\n    const connect4 = state.gameType === 'connect4';\n    const team = isTeamGame();\n    roleChooser.classList.toggle('connectFourRole', connect4);\n    standardRoleButtons.classList.toggle('hidden', team);")
replace_once('public/app.js',
    "    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : '흑 선택';\n    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : '백 선택';",
    "    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : connect4 ? '빨강 선택' : '흑 선택';\n    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : connect4 ? '노랑 선택' : '백 선택';")
replace_once('public/app.js',
    "    roleChooser.querySelector('small').textContent = baseball\n      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'\n      : '매 판 새로 선택합니다. 흑·백이 모두 정해지면 나머지 참가자는 자동 관전됩니다.';",
    "    roleChooser.querySelector('small').textContent = baseball\n      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'\n      : connect4 ? '빨강·노랑 선수를 선택하세요. 두 사람이 정해지면 게임이 시작됩니다. 열을 눌러 돌을 떨어뜨리세요.'\n      : '매 판 새로 선택합니다. 흑·백이 모두 정해지면 나머지 참가자는 자동 관전됩니다.';")
replace_once('public/app.js',
    "    standardPlayers.classList.toggle('hidden', team);\n    teamPlayers.classList.toggle('hidden', !team);",
    "    standardPlayers.classList.toggle('hidden', team);\n    standardPlayers.classList.toggle('connectFourPlayers', state.gameType === 'connect4');\n    teamPlayers.classList.toggle('hidden', !team);")
replace_once('public/app.js',
    "      if (!choice) boardOverlay.textContent = team ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';",
    "      if (!choice) boardOverlay.textContent = team ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : state.gameType === 'connect4' ? '빨강 · 노랑 · 관전 중 역할을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';")
replace_once('public/app.js',
    "    if (state?.gameType === 'baseball') return;\n    if (state?.gameType === 'othello') return drawOthelloBoard();",
    "    if (state?.gameType === 'baseball') return;\n    if (state?.gameType === 'connect4') return drawConnect4Board();\n    if (state?.gameType === 'othello') return drawOthelloBoard();")

board = r'''  // Connect Four uses a 7x6 gravity board, independent of the Omok and Othello geometry.
  function connect4Layout() {
    const cell = (canvas.width - 40) / 7;
    return { cell, left: (canvas.width - cell * 7) / 2, top: 103 };
  }

  function drawConnect4Board() {
    const w = canvas.width;
    const h = canvas.height;
    const { cell, left, top } = connect4Layout();
    const g = state.game;
    const surface = ctx.createLinearGradient(0, 0, w, h);
    surface.addColorStop(0, '#101d34');
    surface.addColorStop(1, '#071224');
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    const boardGradient = ctx.createLinearGradient(left, top, left + 7 * cell, top + 6 * cell);
    boardGradient.addColorStop(0, '#3577ee');
    boardGradient.addColorStop(1, '#1742a0');
    ctx.fillStyle = boardGradient;
    ctx.fillRect(left, top, cell * 7, cell * 6);
    ctx.strokeStyle = '#80aaff';
    ctx.lineWidth = 3;
    ctx.strokeRect(left + 1.5, top + 1.5, cell * 7 - 3, cell * 6 - 3);

    const winners = new Set((g.winningLine || []).map(([x, y]) => `${x},${y}`));
    const last = g.lastMove;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 7; x++) {
        const cx = left + (x + .5) * cell;
        const cy = top + (y + .5) * cell;
        const radius = cell * .40;
        const color = g.board[y][x];
        ctx.save();
        ctx.fillStyle = '#0b1c38';
        ctx.beginPath(); ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2); ctx.fill();
        if (color) {
          ctx.shadowColor = 'rgba(0,0,0,.36)';
          ctx.shadowBlur = 7;
          ctx.shadowOffsetY = 3;
          const disc = ctx.createRadialGradient(cx - radius * .35, cy - radius * .36, 2, cx, cy, radius);
          if (color === 'black') {
            disc.addColorStop(0, '#ffa1ab');
            disc.addColorStop(.45, '#f43f5e');
            disc.addColorStop(1, '#9f1239');
          } else {
            disc.addColorStop(0, '#fff5b0');
            disc.addColorStop(.48, '#facc15');
            disc.addColorStop(1, '#ca8a04');
          }
          ctx.fillStyle = disc;
          ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          if (winners.has(`${x},${y}`)) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(cx, cy, radius * .77, 0, Math.PI * 2); ctx.stroke();
          } else if (last?.x === x && last?.y === y) {
            ctx.fillStyle = color === 'black' ? '#ffffff' : '#6b3e03';
            ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('열을 눌러 돌을 떨어뜨리세요', w / 2, 25);
    for (let x = 0; x < 7; x++) {
      const cx = left + (x + .5) * cell;
      ctx.fillStyle = '#9eb8e8';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(String(x + 1), cx, top - 16);
    }
    if (hover && canPlace(hover.x, hover.y)) {
      const x = hover.x;
      const cx = left + (x + .5) * cell;
      let landing = 5;
      while (landing >= 0 && g.board[landing][x]) landing--;
      ctx.save();
      ctx.fillStyle = seat === 'black' ? 'rgba(244,63,94,.75)' : 'rgba(250,204,21,.78)';
      ctx.beginPath(); ctx.arc(cx, top - 55, cell * .25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(left + x * cell + 3, top + 3, cell - 6, 6 * cell - 6);
      if (landing >= 0) {
        ctx.globalAlpha = .34;
        ctx.beginPath(); ctx.arc(cx, top + (landing + .5) * cell, cell * .37, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

'''
replace_once('public/app.js', '  function drawOmokBoard() {', board + '  function drawOmokBoard() {')
replace_once('public/app.js',
    "    if (state?.gameType === 'othello') {\n      const cell = canvas.width / 8;",
    "    if (state?.gameType === 'connect4') {\n      const { cell, left, top } = connect4Layout();\n      const x = Math.floor((px - left) / cell);\n      if (x < 0 || x >= 7 || py < top - 74 || py >= top + 6 * cell) return null;\n      return { x, y: 0 }; // Column-only input: the server computes the gravity landing row.\n    }\n    if (state?.gameType === 'othello') {\n      const cell = canvas.width / 8;")
replace_once('public/app.js',
    "    if (state.gameType === 'othello') {\n      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);\n    }",
    "    if (state.gameType === 'othello') {\n      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);\n    }\n    if (state.gameType === 'connect4') {\n      return Number.isInteger(x) && x >= 0 && x < 7 && !state.game.board?.[0]?.[x]\n        && (state.game.legalColumns || []).includes(x);\n    }")
replace_once('public/app.js',
    "    roomAction('move', p);\n  });",
    "    roomAction('move', state?.gameType === 'connect4' ? { x: p.x } : p);\n  });")

css = r'''
/* Connect Four: red/yellow player identity on the existing two-person room UI. */
.connectFourPlayers .player.black .stoneMini,.connectFourRole .blackPick .stoneMini{background:#f43f5e;border-color:#be123c}
.connectFourPlayers .player.white .stoneMini,.connectFourRole .whitePick .stoneMini{background:#facc15;border-color:#ca8a04}
.canvasWrap.connectFour{background:#0b1c38}
'''
css_path = Path('public/styles.css')
css_text = css_path.read_text(encoding='utf-8')
if '/* Connect Four: red/yellow' in css_text:
    raise RuntimeError('Connect Four CSS already present')
css_path.write_text(css_text + '\n' + css, encoding='utf-8')
replace_once('public/app.js',
    "    canvasWrap.classList.toggle('hidden', baseball);",
    "    canvasWrap.classList.toggle('hidden', baseball);\n    canvasWrap.classList.toggle('connectFour', state.gameType === 'connect4');")

for f in ['package.json', 'package-lock.json']:
    p = Path(f)
    text = p.read_text(encoding='utf-8')
    if '"version": "1.6.11"' not in text:
        raise RuntimeError(f'{f}: expected old version missing')
    p.write_text(text.replace('"version": "1.6.11"', '"version": "1.6.12"'), encoding='utf-8')
replace_once('test/reissue-guest-file.test.js',
    r'app\.js\?v=1\.6\.11', r'app\.js\?v=1\.6\.12')
print('Connect Four engine linked, client rendering and role labels integrated, versions and regression assertions updated.')
