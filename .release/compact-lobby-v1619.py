from pathlib import Path
import html as html_utils
import json
import re


def edit(path, fn):
    file = Path(path)
    before = file.read_text(encoding='utf-8')
    after = fn(before)
    assert after != before, f'No changes in {path}'
    file.write_text(after, encoding='utf-8')
    print('Updated', path)


def once(text, old, new):
    count = text.count(old)
    assert count == 1, (old[:95], count)
    return text.replace(old, new, 1)

rules = {}
names = {}
ids = ['omok', 'omok2v2', 'connect4', 'yut', 'dots', 'cityking', 'othello', 'baseball']
pattern = re.compile(r'<div class="gameOption" data-game-option="(?P<id>[^\"]+)">\s*<button type="button" class="gameChoice(?: selected)?" data-game="(?P=id)"><strong>(?P<name>[^<]+)</strong></button>\s*<details class="gameRuleDetails"><summary>자세히 보기</summary><p>(?P<rule>[^<]+)</p></details>\s*</div>')


def patch_html(source):
    matches = list(pattern.finditer(source))
    found = [m.group('id') for m in matches]
    assert found == ids, ('Unexpected game set/order', found)
    for match in matches:
        game_id = match.group('id')
        rules[game_id] = html_utils.unescape(match.group('rule'))
        names[game_id] = html_utils.unescape(match.group('name'))
    options = '\n'.join(f'                  <option value="{game_id}">{html_utils.escape(names[game_id])}</option>' for game_id in ids)
    old = '<div class="helpHeading"><h2>게임 선택</h2><details class="helpDisclosure"><summary>자세히 보기</summary><p>방을 만들 게임을 먼저 선택하세요. 방 비밀번호로 참가할 때는 해당 방의 게임이 자동으로 열립니다.</p></details></div>'
    new = ('<div class="helpHeading"><h2>게임 선택</h2><details id="gameRulesDisclosure" class="helpDisclosure">\n'
           '            <summary>자세히 보기</summary>\n'
           '            <p>방을 만들 게임을 먼저 선택하세요. 방 비밀번호로 참가할 때는 해당 방의 게임이 자동으로 열립니다.</p>\n'
           '            <div class="gameRulesPanel">\n'
           '              <label for="gameRulesSelect">게임 규칙 설명</label>\n'
           '              <select id="gameRulesSelect" aria-controls="gameRulesText">\n'
           f'{options}\n'
           '              </select>\n'
           f'              <p id="gameRulesText" class="gameRulesText" aria-live="polite">{html_utils.escape(rules["omok"])}</p>\n'
           '            </div>\n'
           '          </details></div>')
    source = once(source, old, new)
    source, count = re.subn(r'^              <details class="gameRuleDetails"><summary>자세히 보기</summary><p>[^<]+</p></details>\n', '', source, flags=re.MULTILINE)
    assert count == 8, ('Removed game details', count)
    assert source.count('id="gameRulesSelect"') == 1
    assert source.count('class="gameRuleDetails"') == 0
    assert source.count('class="helpDisclosure"') == 3
    assert source.count('data-game-option=') == 8
    assert source.count('1.6.18') == 3, ('Cache URLs', source.count('1.6.18'))
    return source.replace('1.6.18', '1.6.19')


edit('public/index.html', patch_html)
assert list(rules) == ids


def patch_js(source):
    rule_map = json.dumps(rules, ensure_ascii=False, indent=4)
    entry = "  function selectGame(type) {"
    source = once(source, entry, ('  // Shared rules viewer: one disclosure and one selector for all eight games.\n'
                               '  const gameRulesSelect = document.getElementById(\'gameRulesSelect\');\n'
                               '  const gameRulesText = document.getElementById(\'gameRulesText\');\n'
                               f'  const gameRules = Object.freeze({rule_map});\n'
                               '  function showGameRule(type) {\n'
                               "    gameRulesText.textContent = gameRules[type] || '';\n"
                               '  }\n\n'
                               + entry))
    source = once(source, '    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;',
                  '    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;\n'
                  '    gameRulesSelect.value = selectedGameType;\n'
                  '    showGameRule(selectedGameType);')
    source = once(source,
                  "  for (const button of gameChoiceButtons) button.addEventListener('click', () => selectGame(button.dataset.game));",
                  "  gameRulesSelect.addEventListener('change', () => showGameRule(gameRulesSelect.value));\n"
                  "  for (const button of gameChoiceButtons) button.addEventListener('click', () => selectGame(button.dataset.game));")
    source = once(source, '      title.textContent = item.title;', '      title.textContent = item.title;\n      title.title = item.title;')
    source = once(source, "  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }",
                  "  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }\n"
                  "  // Winner is the same black/white color for all eight games; 2v2 seat numbers map to team colors.\n"
                  '  function resultOutcome(game, playerSeat, gameType) {\n'
                  "    if (game?.status !== 'finished' || !playerSeat || !['black', 'white'].includes(game.winner)) return null;\n"
                  "    const color = gameType === 'omok2v2' ? seatColor(playerSeat) : playerSeat;\n"
                  "    if (!['black', 'white'].includes(color)) return null;\n"
                  "    return color === game.winner ? 'win' : 'loss';\n"
                  '  }')
    source = once(source, "    state = null;\n    document.title = '게임센터';\n    showView('lobby');",
                  "    state = null;\n    lastResultEffectKey = null;\n    clearResultEffect();\n    document.title = '게임센터';\n    showView('lobby');")
    source = once(source, '    state = next;\n    selectedGameType = ',
                  '    state = next;\n    lastResultEffectKey = null;\n    clearResultEffect();\n    selectedGameType = ')
    source = once(source,
                  "    const myColor = seat ? (team ? seatColor(seat) : seat) : null;\n    const outcome = g.status === 'finished' && myColor ? (myColor === g.winner ? 'win' : 'loss') : null;",
                  '    const outcome = resultOutcome(g, seat, state.gameType);')
    source = once(source,
                  "    baseballPanel.classList.toggle('hidden', !baseball);",
                  "    baseballPanel.classList.toggle('hidden', !baseball);\n"
                  "    baseballPanel.classList.toggle('resultWinPanel', baseball && outcome === 'win');\n"
                  "    baseballPanel.classList.toggle('resultLossPanel', baseball && outcome === 'loss');")
    source = once(source,
                  "    else baseballHint.textContent = g.winner ? `${seatKo(g.winner)} 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.` : '이번 판이 끝났습니다.';",
                  "    else if (g.status === 'finished' && seat) baseballHint.textContent = resultOutcome(g, seat, state.gameType) === 'win'\n"
                  "      ? '🏆 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.'\n"
                  "      : '패배! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.';\n"
                  "    else baseballHint.textContent = g.winner ? `${seatKo(g.winner)} 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.` : '이번 판이 끝났습니다.';")
    assert source.count('showResultEffect(outcome, g);') == 1
    assert 'resultOutcome(g, seat, state.gameType)' in source
    return source


edit('public/app.js', patch_js)


def patch_css(source):
    return source + '''

/* v1.6.19: compact one-line announcements, condensed game picker and one shared rules viewer. */
.noticeCard{margin-bottom:12px;padding:0 14px 8px}
.noticeBar{min-height:40px}
.noticeTab{padding:6px 2px;font-size:.89rem}
.announcementList{max-height:240px;gap:4px;margin-top:6px}
.announcementRow{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:0 7px;align-items:center;min-height:33px;padding:4px 8px;border-radius:8px}
.announcementHead{grid-column:1;grid-row:1;min-width:0;align-items:center;gap:6px}
.announcementHead strong{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;line-height:1.4}
.announcementHead time{flex:0 0 auto;font-size:.62rem}
.announcementPin{margin-right:5px;padding:1px 4px;font-size:.58rem}
.announcementDetails{min-width:0;margin:0}
.announcementDetails:not([open]){grid-column:2;grid-row:1}
.announcementDetails[open]{grid-column:1/-1;grid-row:2;margin-top:5px;padding:5px 1px 1px;border-top:1px solid #273449}
.announcementRow:has(.announcementDetails[open]) .announcementHead strong{white-space:normal;overflow-wrap:anywhere}
.announcementDetails summary{font-size:.68rem;white-space:nowrap}
.announcementDetails p{font-size:.78rem;line-height:1.5;margin:5px 0 2px}
.announcementActions{grid-column:3;grid-row:1;gap:3px;margin:0}
.announcementActions button{padding:3px 5px;font-size:.62rem}
.gamePicker{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0 6px}
.gameOption{display:block}
.gameOption .gameChoice{width:100%;min-height:34px;padding:6px 7px;line-height:1.2;border-radius:8px}
.gameOption .gameChoice strong{font-size:.83rem}
.gameRulesPanel{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:7px 10px;padding:8px 0 1px}
.gameRulesPanel label{font-size:.77rem;font-weight:800;color:#cbd5e1}
.gameRulesPanel select{min-width:0;width:100%;padding:6px 8px;border:1px solid #475569;border-radius:8px;background:#0f172a;color:#f8fafc;font:inherit;font-size:.78rem}
.gameRulesPanel select:focus-visible{outline:2px solid #60a5fa;outline-offset:2px}
.helpDisclosure .gameRulesText{grid-column:1/-1;margin:1px 0 4px;padding:9px 10px;background:#0f172a;border:1px solid #273449;border-radius:9px;font-size:.76rem;line-height:1.5;color:#e2e8f0}
.baseballPanel.resultWinPanel{border-color:#eab308;box-shadow:inset 0 0 0 1px rgba(250,204,21,.3),0 0 24px rgba(250,204,21,.16)}
.baseballPanel.resultLossPanel{border-color:#dc2626;box-shadow:inset 0 0 0 1px rgba(239,68,68,.26),0 0 24px rgba(127,29,29,.18)}
@media(max-width:520px){.noticeCard{padding:0 9px 7px}.announcementRow{gap:0 4px;padding:4px 5px}.announcementHead{gap:4px}.announcementHead strong{font-size:.72rem}.announcementHead time{font-size:.56rem}.announcementDetails summary{font-size:.61rem}.announcementActions button{padding:3px 4px;font-size:.58rem}.gamePicker{gap:5px}.gameOption .gameChoice{min-height:32px;padding:5px 6px}.gameOption .gameChoice strong{font-size:.78rem}.gameRulesPanel{grid-template-columns:1fr;gap:5px}.helpDisclosure .gameRulesText{grid-column:1}}
'''


edit('public/styles.css', patch_css)


def patch_announcements(source):
    assert "key: 'v1.6.18'" in source and "key: 'v1.6.19'" not in source
    note = '''  {
    key: 'v1.6.19',
    title: '[업데이트] v1.6.19 공지·게임 선택 화면 간소화',
    body: '공지사항 목록을 한 줄 중심으로 압축하고 내용과 수정·삭제 버튼을 간결하게 배치했습니다. 게임 선택 버튼 높이를 줄이고, 개별 규칙 버튼 8개를 없애 게임 선택 자세히 보기 안의 통합 게임 규칙 선택 메뉴로 옮겼습니다. 8개 게임 모두 승패 효과 연결을 점검하고 숫자야구 결과 표시와 방 이동 시 효과 정리를 보완했습니다.',
    publishedAt: '2026-09-17T00:00:00+09:00',
  },
'''
    return once(source, '\n];', '\n' + note + '];')


edit('lib/release-announcements.js', patch_announcements)


def patch_pkg(source):
    assert source.count('"version": "1.6.18"') in (1, 2), 'Unexpected package version count'
    return source.replace('"version": "1.6.18"', '"version": "1.6.19"')


edit('package.json', patch_pkg)
edit('package-lock.json', patch_pkg)


def patch_server(source):
    assert source.count('v1.6.18') == 1, ('Server version count', source.count('v1.6.18'))
    return source.replace('v1.6.18', 'v1.6.19')


edit('server.js', patch_server)


def patch_announcement_test(source):
    source = once(source, '  assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 8);',
                  '  assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 0);\n'
                  '  assert.equal((html.match(/data-game-option=/g) || []).length, 8);\n'
                  '  assert.match(html, /id="gameRulesDisclosure" class="helpDisclosure"/);\n'
                  '  assert.match(html, /id="gameRulesSelect"/);')
    return source


edit('test/announcements.test.js', patch_announcement_test)
updated_versions = []
for path in Path('test').glob('*.test.js'):
    original = path.read_text(encoding='utf-8')
    changed = original.replace(r'1\.6\.18', r'1\.6\.19').replace('v1.6.18', 'v1.6.19') if path.name != 'announcements.test.js' else original
    if changed != original:
        path.write_text(changed, encoding='utf-8')
        updated_versions.append(path.name)
assert {'connect4.test.js', 'dots.test.js', 'omok-team.test.js', 'reissue-guest-file.test.js', 'yut.test.js'}.issubset(updated_versions), updated_versions
print('Version expectations updated:', ', '.join(updated_versions))

new_test = r'''\n'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { listGames } = require('../lib/games');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');

test('all eight games expose one shared rules selector with the original full rule text', () => {
  const games = listGames();
  assert.equal(games.length, 8);
  const selectedIds = [...html.matchAll(/<option value="(omok|omok2v2|connect4|yut|dots|cityking|othello|baseball)">/g)].map(m => m[1]);
  assert.equal(selectedIds.length, 8);
  assert.deepEqual(new Set(selectedIds), new Set(games.map(g => g.id)));
  assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 0);
  assert.equal((html.match(/id="gameRulesSelect"/g) || []).length, 1);
  const map = app.match(/const gameRules = Object\.freeze\((\{[\s\S]*?\})\);/);
  assert.ok(map, 'Shared rule definitions must exist');
  const descriptions = JSON.parse(map[1]);
  assert.deepEqual(new Set(Object.keys(descriptions)), new Set(selectedIds));
  for (const id of selectedIds) assert.ok(descriptions[id].length >= 40, `Missing rule text for ${id}`);
  assert.match(app, /gameRulesSelect\.addEventListener\('change', \(\) => showGameRule\(gameRulesSelect\.value\)\)/);
  assert.match(app, /gameRulesSelect\.value = selectedGameType;/);
  assert.match(html, /id="gameRulesDisclosure" class="helpDisclosure"/);
});

test('announcement rows are compact with inline controls and game choice heights are condensed', () => {
  assert.match(css, /\.announcementRow\{display:grid;grid-template-columns:minmax\(0,1fr\) auto auto/);
  assert.match(css, /\.announcementDetails:not\(\[open\]\)\{grid-column:2;grid-row:1\}/);
  assert.match(css, /\.announcementDetails\[open\]\{grid-column:1\/-1;grid-row:2/);
  assert.match(css, /\.announcementActions\{grid-column:3;grid-row:1/);
  assert.match(css, /\.announcementList\{max-height:240px/);
  assert.match(css, /\.gameOption \.gameChoice\{width:100%;min-height:34px/);
  assert.match(html, /styles\.css\?v=1\.6\.19/);
  assert.match(html, /app\.js\?v=1\.6\.19/);
});

test('shared outcome drives win and loss effects for all eight game IDs, 2v2 teammates, and excludes draws and spectators', () => {
  const expression = app.match(/  function resultOutcome\(game, playerSeat, gameType\) \{[\s\S]*?\n  \}/);
  assert.ok(expression, 'Pure shared outcome function missing');
  const resultOutcome = vm.runInNewContext(expression[0] + '\nresultOutcome', {
    seatColor: seat => ['1', '3'].includes(seat) ? 'black' : ['2', '4'].includes(seat) ? 'white' : seat,
  });
  for (const { id } of listGames()) {
    const blackSeat = id === 'omok2v2' ? '1' : 'black';
    const whiteSeat = id === 'omok2v2' ? '2' : 'white';
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, blackSeat, id), 'win', `${id} black winner`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, whiteSeat, id), 'loss', `${id} white loser`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, blackSeat, id), 'loss', `${id} black loser`);
    assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, whiteSeat, id), 'win', `${id} white winner`);
    assert.equal(resultOutcome({ status: 'draw', winner: null }, blackSeat, id), null);
    assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, null, id), null);
  }
  assert.equal(resultOutcome({ status: 'finished', winner: 'black' }, '3', 'omok2v2'), 'win');
  assert.equal(resultOutcome({ status: 'finished', winner: 'white' }, '4', 'omok2v2'), 'win');
  assert.match(app, /const outcome = resultOutcome\(g, seat, state\.gameType\);/);
  assert.match(app, /showResultEffect\(outcome, g\);/);
  assert.match(app, /baseballPanel\.classList\.toggle\('resultWinPanel', baseball && outcome === 'win'\)/);
  assert.match(app, /baseballPanel\.classList\.toggle\('resultLossPanel', baseball && outcome === 'loss'\)/);
  assert.match(app, /function enterLobby\(\) \{[\s\S]*?lastResultEffectKey = null;\n    clearResultEffect\(\);/);
  assert.match(css, /\.baseballPanel\.resultWinPanel/);
  assert.match(css, /\.baseballPanel\.resultLossPanel/);
});
'''.lstrip('\n')
assert not Path('test/lobby-compact-effects.test.js').exists()
Path('test/lobby-compact-effects.test.js').write_text(new_test, encoding='utf-8')
print('Added detailed game-rule, compact-list and eight-game outcome checks')
