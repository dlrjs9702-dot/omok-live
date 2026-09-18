from pathlib import Path


def change(filename, old, new):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{filename}: expected one anchor, found {count}: {old[:90]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


# 1. Merge the two Omok lobby choices without touching either server-side engine.
html = 'public/index.html'
change(html, '''            <div class="gameOption" data-game-option="omok2v2">
              <button type="button" class="gameChoice" data-game="omok2v2"><strong>오목 2vs2</strong></button>
            </div>
''', '')
change(html, '''              <button type="button" class="gameChoice" data-game="cityking"><strong>랜드킹</strong></button>''',
      '''              <button type="button" class="gameChoice" data-game="cityking"><strong>랜드킹(패치중)</strong></button>''')
change(html, '''          <fieldset id="baseballDigitChoices" class="baseballDigitChoices hidden">''', '''          <fieldset id="omokModeChoices" class="baseballDigitChoices" aria-label="오목 대전 방식">
            <legend>오목 대전 방식</legend>
            <label><input type="radio" name="omokMode" value="1v1" checked /> 1vs1 · 기본</label>
            <label><input type="radio" name="omokMode" value="2v2" /> 2vs2 · 팀전</label>
          </fieldset>
          <fieldset id="baseballDigitChoices" class="baseballDigitChoices hidden">''')

app = 'public/app.js'
change(app, "  const baseballDigitChoices = document.getElementById('baseballDigitChoices');",
      "  const baseballDigitChoices = document.getElementById('baseballDigitChoices');\n  const omokModeChoices = document.getElementById('omokModeChoices');")
change(app, '''  function isTeamGame() { return state?.gameType === 'omok2v2'; }''', '''  function omokMode() {
    return document.querySelector('input[name="omokMode"]:checked')?.value === '2v2' ? '2v2' : '1v1';
  }
  function gameDisplayName(type) {
    return type === 'omok' ? '오목 · 1vs1' : type === 'omok2v2' ? '오목 · 2vs2' : gameName(type);
  }
  function isTeamGame() { return state?.gameType === 'omok2v2'; }''')
change(app, '''    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;
    baseballDigitChoices.classList.toggle('hidden', selectedGameType !== 'baseball');
    gameRulesSelect.value = selectedGameType;
    showGameRule(selectedGameType);''', '''    const resolvedType = selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType;
    selectedGameText.textContent = `${gameDisplayName(resolvedType)} 방을 만듭니다.`;
    omokModeChoices.classList.toggle('hidden', selectedGameType !== 'omok');
    baseballDigitChoices.classList.toggle('hidden', selectedGameType !== 'baseball');
    gameRulesSelect.value = resolvedType;
    showGameRule(resolvedType);''')
change(app, '''        gameType: selectedGameType,
        visibility,
        title: roomTitleInput.value,''', '''        gameType: selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType,
        visibility,
        title: roomTitleInput.value,''')
change(app, '''      name.textContent = room.title || `${room.host || '방장'}의 ${room.gameName || gameName(room.gameType)}방`;
      const info = document.createElement('small');
      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : room.status === 'paused' ? '일시정지' : '대국 중';
      info.textContent = `${status} · 선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명`;''', '''      const displayedGame = gameDisplayName(room.gameType);
      name.textContent = room.title || `${room.host || '방장'}의 ${displayedGame}방`;
      const info = document.createElement('small');
      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : room.status === 'paused' ? '일시정지' : '대국 중';
      info.textContent = `${displayedGame} · ${status} · 선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명`;''')
change(app, '''    const gameLabel = state.gameName || gameName(state.gameType);''', '''    const gameLabel = ['omok', 'omok2v2'].includes(state.gameType)
      ? gameDisplayName(state.gameType) : (state.gameName || gameName(state.gameType));''')
change(app, '''  gameRulesSelect.addEventListener('change', () => showGameRule(gameRulesSelect.value));''', '''  gameRulesSelect.addEventListener('change', () => showGameRule(gameRulesSelect.value));
  omokModeChoices.addEventListener('change', () => {
    if (selectedGameType === 'omok') selectGame('omok');
  });''')

# 2. The Land King upgrade is presentation-only. No game engine, rules or API changes.
change(html, '''            <p id="cityEvent" class="cityEvent">파랑과 빨강이 정해지면 파랑부터 시작합니다.</p>''', '''            <div id="cityOverview" class="cityOverview" aria-live="polite">
              <strong id="cityTurnSummary">진행 0/50 · 남은 50턴</strong>
              <div id="cityDice" class="cityDice" aria-label="주사위 결과"><span id="cityDieFirst">⚀</span><span id="cityDieSecond">⚀</span></div>
            </div>
            <div id="cityAssets" class="cityAssets" aria-label="플레이어별 자산 현황"></div>
            <label class="cityTileLabel" for="cityTileSelect">도시 및 칸 정보 선택</label>
            <select id="cityTileSelect" class="cityTileSelect" aria-label="랜드킹 도시 선택"></select>
            <div id="cityTileDetails" class="cityTileDetails" aria-live="polite">
              <strong id="cityTileName">게임판의 도시를 선택하세요.</strong>
              <dl>
                <div><dt>매입가</dt><dd id="cityTilePrice">-</dd></div>
                <div><dt>통행료</dt><dd id="cityTileToll">-</dd></div>
                <div><dt>소유자</dt><dd id="cityTileOwner">-</dd></div>
              </dl>
            </div>
            <p id="cityEvent" class="cityEvent">파랑과 빨강이 정해지면 파랑부터 시작합니다.</p>''')
change(app, "  const citySkipBtn = document.getElementById('citySkipBtn');", '''  const citySkipBtn = document.getElementById('citySkipBtn');
  const cityTurnSummary = document.getElementById('cityTurnSummary');
  const cityDieFirst = document.getElementById('cityDieFirst');
  const cityDieSecond = document.getElementById('cityDieSecond');
  const cityAssets = document.getElementById('cityAssets');
  const cityTileSelect = document.getElementById('cityTileSelect');
  const cityTileName = document.getElementById('cityTileName');
  const cityTilePrice = document.getElementById('cityTilePrice');
  const cityTileToll = document.getElementById('cityTileToll');
  const cityTileOwner = document.getElementById('cityTileOwner');''')
change(app, "  let selectedGameType = 'omok';", '''  let selectedGameType = 'omok';
  let citySelectedTileIndex = null;
  let cityLastRollKey = null;
  let cityAnimation = null;
  let cityAnimationFrame = null;''')
change(app, '''    cityControls.classList.toggle('hidden', !city);
    if (city) renderCityControls();''', '''    cityControls.classList.toggle('hidden', !city);
    canvasWrap.classList.toggle('cityBoard', city);
    if (city) renderCityControls();
    else {
      citySelectedTileIndex = null;
      cityLastRollKey = null;
      cityAnimation = null;
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimationFrame = null;
    }''')
change(app, '''  function renderCityControls() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');''', '''  function renderCityControls() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    const turn = Math.max(0, Number(g.turnCount) || 0);
    const limit = Number(g.turnLimit) || 50;
    const name = color => state.players?.[color]?.label || (color === 'black' ? '파랑' : '빨강');
    cityTurnSummary.textContent = `진행 ${turn}/${limit}턴 · 남은 ${Math.max(0, limit - turn)}턴 · ${g.turn ? name(g.turn) + ' 차례' : '대국 종료'}`;
    cityAssets.replaceChildren();
    for (const color of ['black', 'white']) {
      const player = g.players?.[color];
      if (!player) continue;
      const card = document.createElement('div');
      card.className = `cityAssetCard ${color}${g.status === 'playing' && g.turn === color ? ' isTurn' : ''}`;
      const heading = document.createElement('strong');
      heading.textContent = `${name(color)}${seat === color ? ' · 나' : ''}${g.turn === color && g.status === 'playing' ? ' · 현재 차례' : ''}`;
      const metrics = document.createElement('span');
      metrics.textContent = `현금 ${player.cash} · 도시 ${player.properties?.length || 0}개 · 순자산 ${g.scores?.[color] ?? player.cash} · 위치 ${player.position}번`;
      card.append(heading, metrics);
      cityAssets.appendChild(card);
    }
    if (cityTileSelect.options.length !== (g.tiles?.length || 0)) {
      cityTileSelect.replaceChildren();
      for (const tile of g.tiles || []) {
        const option = document.createElement('option');
        option.value = String(tile.index);
        option.textContent = `${tile.index}번 · ${tile.name}`;
        cityTileSelect.appendChild(option);
      }
    }
    const roll = g.lastRoll;
    cityDieFirst.textContent = roll ? '⚀⚁⚂⚃⚄⚅'[0] : '⚀';
    cityDieFirst.textContent = roll ? String.fromCodePoint(0x267f + roll.first) : '⚀';
    cityDieSecond.textContent = roll ? String.fromCodePoint(0x267f + roll.second) : '⚀';
    const rollKey = roll ? `${g.round}:${roll.at}:${roll.color}:${roll.from}:${roll.to}` : null;
    if (rollKey && cityLastRollKey !== null && cityLastRollKey !== rollKey) {
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimation = { color: roll.color, from: roll.from, position: roll.from, steps: roll.total, started: performance.now() };
      citySelectedTileIndex = roll.to;
      cityControls.classList.remove('isRolling');
      void cityControls.offsetWidth;
      cityControls.classList.add('isRolling');
      const advance = timestamp => {
        if (!cityAnimation || state?.gameType !== 'cityking') return;
        const elapsed = timestamp - cityAnimation.started;
        cityAnimation.position = (cityAnimation.from + Math.min(cityAnimation.steps, Math.floor(elapsed / 110))) % 24;
        drawCityBoard();
        if (elapsed < cityAnimation.steps * 110 + 140) cityAnimationFrame = requestAnimationFrame(advance);
        else { cityAnimation = null; cityAnimationFrame = null; cityControls.classList.remove('isRolling'); drawCityBoard(); }
      };
      cityAnimationFrame = requestAnimationFrame(advance);
    }
    cityLastRollKey = rollKey;
    if (citySelectedTileIndex === null || !g.tiles?.[citySelectedTileIndex])
      citySelectedTileIndex = g.pendingProperty ?? g.players?.[g.turn]?.position ?? roll?.to ?? 0;
    cityTileSelect.value = String(citySelectedTileIndex);
    const tile = g.tiles?.[citySelectedTileIndex];
    cityTileName.textContent = tile ? `${tile.index}번 · ${tile.name}` : '칸 정보 없음';
    cityTilePrice.textContent = tile?.type === 'property' ? `${tile.price}` : '-';
    cityTileToll.textContent = tile?.type === 'property' ? `${tile.toll}` : '-';
    const owner = tile ? g.owners?.[tile.index] : null;
    cityTileOwner.textContent = tile?.type !== 'property' ? '해당 없음' : owner ? name(owner) : '미소유';''')
# Use the engine-provided tile and position data; canvas clicks only change local selection.
change(app, '''  function drawCityBoard() {
    const g = state.game;''', '''  function selectCityTileFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    let selected = null;
    let best = 52 * 52;
    for (const tile of state?.game?.tiles || []) {
      const [cx, cy] = cityCellPosition(tile.index);
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      if (distance <= best) { best = distance; selected = tile.index; }
    }
    if (selected === null) return;
    citySelectedTileIndex = selected;
    renderCityControls();
    drawCityBoard();
  }

  function drawCityBoard() {
    const g = state.game;''')
change(app, '''      ctx.strokeRect(x - 39, y - 39, 78, 78);
      ctx.fillStyle = '#172033';''', '''      ctx.strokeRect(x - 39, y - 39, 78, 78);
      if (tile.index === citySelectedTileIndex) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 33, y - 33, 66, 66);
      }
      if (g.turn && g.status === 'playing' && g.players?.[g.turn]?.position === tile.index) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 43, y - 43, 86, 86);
      }
      ctx.fillStyle = '#172033';''')
change(app, '''      const [x, y] = cityCellPosition(player.position);
      const offset = color === 'black' ? -16 : 16;''', '''      const animatedPosition = cityAnimation?.color === color ? cityAnimation.position : player.position;
      const [x, y] = cityCellPosition(animatedPosition);
      const offset = color === 'black' ? -16 : 16;''')
change(app, '''  canvas.addEventListener('pointerup', (ev) => {
    const p = canvasPoint(ev);''', '''  canvas.addEventListener('pointerup', (ev) => {
    if (state?.gameType === 'cityking') { selectCityTileFromPointer(ev); return; }
    const p = canvasPoint(ev);''')
change(app, '''  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));''', '''  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));
  cityTileSelect.addEventListener('change', () => {
    if (state?.gameType !== 'cityking') return;
    const index = Number(cityTileSelect.value);
    if (!Number.isInteger(index) || !state.game.tiles?.[index]) return;
    citySelectedTileIndex = index;
    renderCityControls();
    drawCityBoard();
  });''')

css = Path('public/styles.css')
css.write_text(css.read_text(encoding='utf-8') + '''
/* v1.6.28: Land King-only information and responsive controls. */
.cityBoard canvas{cursor:pointer;touch-action:manipulation}
.cityControls{min-width:0}
.cityOverview{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:10px 0;padding:11px 13px;border:1px solid #334155;border-radius:12px;background:#0f172a}
.cityOverview>strong{font-size:.85rem;color:#e2e8f0;font-variant-numeric:tabular-nums}
.cityDice{display:flex;gap:7px;font-size:1.6rem;color:#facc15;line-height:1}
.cityControls.isRolling .cityDice span{animation:cityRollPulse .56s ease-in-out}
@keyframes cityRollPulse{0%{transform:rotate(-22deg) scale(.8)}55%{transform:rotate(30deg) scale(1.25)}100%{transform:rotate(0) scale(1)}}
.cityAssets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0}
.cityAssetCard{display:grid;gap:6px;min-width:0;padding:11px 13px;border:1px solid #334155;border-radius:11px;background:#0f172a}
.cityAssetCard strong{font-size:.86rem;overflow-wrap:anywhere}.cityAssetCard span{font-size:.77rem;color:#cbd5e1;line-height:1.5;overflow-wrap:anywhere}
.cityAssetCard.black{border-left:4px solid #2563eb}.cityAssetCard.white{border-left:4px solid #ef4444}
.cityAssetCard.isTurn{outline:2px solid #facc15;background:#172554}
.cityTileLabel{display:block;margin:13px 0 6px;font-size:.81rem;font-weight:850;color:#cbd5e1}
.cityTileSelect{width:100%;min-height:44px;padding:9px 12px;border:1px solid #475569;border-radius:10px;color:#f8fafc;background:#0f172a;font:inherit}
.cityTileSelect:focus-visible{outline:2px solid #facc15;outline-offset:2px}
.cityTileDetails{margin:9px 0;padding:12px 13px;border:1px solid #475569;border-radius:12px;background:#111c30}
.cityTileDetails>strong{display:block;margin-bottom:9px;font-size:.93rem;color:#fde68a}
.cityTileDetails dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0}
.cityTileDetails dl div{display:grid;gap:3px;min-width:0}.cityTileDetails dt{font-size:.69rem;color:#94a3b8}.cityTileDetails dd{margin:0;font-size:.84rem;font-weight:850;overflow-wrap:anywhere}
.cityControls .cityActionRow button,.cityControls .cityBuyRow button{min-height:44px}
@media(max-width:600px){.cityAssets{grid-template-columns:1fr}.cityOverview{padding:10px}.cityTileDetails dl{gap:5px}.cityTileDetails dd{font-size:.76rem}.cityControls .cityActionRow,.cityControls .cityBuyRow{flex-wrap:wrap}.cityControls .cityActionRow button{flex:1 1 150px}.cityControls .cityBuyRow button{flex:1 1 120px}}
@media(prefers-reduced-motion:reduce){.cityControls.isRolling .cityDice span{animation:none}}
''', encoding='utf-8')

# Targeted UI and engine-compatibility regression tests.
Path('test/omok-city-ui.test.js').write_text('''\
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getGame } = require('../lib/games');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Omok has one lobby choice with 1vs1 default and 2vs2 mapped to existing engine', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  assert.equal((html.match(/data-game="omok"/g) || []).length, 1);
  assert.doesNotMatch(html, /data-game="omok2v2"/);
  assert.match(html, /name="omokMode" value="1v1" checked/);
  assert.match(html, /name="omokMode" value="2v2"/);
  assert.match(app, /selectedGameType === 'omok' && omokMode\(\) === '2v2' \? 'omok2v2'/);
  assert.match(app, /'오목 · 1vs1'/);
  assert.match(app, /'오목 · 2vs2'/);
  assert.equal(getGame('omok').id, 'omok');
  assert.equal(getGame('omok2v2').id, 'omok2v2');
});

test('Land King only gains clickable tile details, net-worth board and visual movement', () => {
  const html = read('public/index.html');
  const app = read('public/app.js');
  const css = read('public/styles.css');
  assert.match(html, /data-game="cityking"><strong>랜드킹\(패치중\)/);
  for (const id of ['cityTurnSummary', 'cityAssets', 'cityTileSelect', 'cityTileName', 'cityTilePrice', 'cityTileToll', 'cityTileOwner'])
    assert.ok(html.includes(`id="${id}"`), id);
  assert.match(app, /function selectCityTileFromPointer\(/);
  assert.match(app, /function drawCityBoard\(/);
  assert.match(app, /requestAnimationFrame\(advance\)/);
  assert.match(app, /citySelectedTileIndex/);
  assert.match(css, /\.cityAssetCard\.isTurn/);
  assert.match(css, /\.cityTileSelect\{[^}]*min-height:44px/);
  const city = getGame('cityking');
  const game = city.create();
  assert.equal(city.TILES.length, 24);
  assert.equal(city.TILES.filter(tile => tile.type === 'property').length, 10);
  assert.equal(city.TURN_LIMIT, 50);
  assert.equal(game.players.black.cash, 1500);
});
''', encoding='utf-8')

# Version/notice last, only after the two scoped changes above have applied.
for filename in ('package.json', 'package-lock.json', 'server.js', 'public/index.html'):
    p = Path(filename)
    original = p.read_text(encoding='utf-8')
    if '1.6.27' not in original: raise RuntimeError(f'{filename}: old release version absent')
    p.write_text(original.replace('1.6.27', '1.6.28'), encoding='utf-8')
for p in Path('test').glob('*.js'):
    original = p.read_text(encoding='utf-8')
    updated = original.replace(r'1\.6\.27', r'1\.6\.28').replace('1.6.27', '1.6.28')
    if updated != original: p.write_text(updated, encoding='utf-8')
notices = Path('lib/release-announcements.js')
text = notices.read_text(encoding='utf-8')
assert "key: 'v1.6.27'" in text and "key: 'v1.6.28'" not in text and text.endswith('];\n')
notices.write_text(text[:-3] + '''  {
    key: 'v1.6.28',
    title: '[업데이트] v1.6.28 오목 선택 통합 및 랜드킹 UI 개선',
    body: '로비의 오목과 오목 2vs2 선택 버튼을 하나로 합치고 1vs1(기본)·2vs2 방식을 선택할 수 있게 했습니다. 공개방 및 게임방에서도 대전 방식을 구분해 표시합니다. 랜드킹의 도시 정보·소유자, 플레이어별 현금·도시·순자산, 현재 차례·남은 턴을 보기 쉽게 정리하고 주사위·이동 표시 및 모바일 터치 조작을 개선했습니다. 랜드킹 게임 선택에는 패치중 표기를 추가했으며 게임 규칙은 변경하지 않았습니다.',
    publishedAt: '2026-09-18T10:38:00+09:00',
  },
];
''', encoding='utf-8')
print('v1.6.28 guarded omok and city UI patch applied')
