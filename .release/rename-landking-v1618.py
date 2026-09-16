from pathlib import Path
from datetime import datetime, timezone

root = Path.cwd()
rename_files = ['lib/games/cityking.js', 'public/app.js', 'public/index.html', 'public/styles.css', 'server.js', 'lib/release-announcements.js', 'test/cityking.test.js', 'test/new-games-server.test.js']
for name in rename_files:
    file = root / name
    before = file.read_text(encoding='utf-8')
    after = before.replace('도시왕', '랜드킹').replace('City King', 'Land King').replace('CITY KING', 'LAND KING')
    if after == before:
        raise RuntimeError(f'Expected a game name in {name}')
    file.write_text(after, encoding='utf-8')
    print(f'Renamed visible name in {name}')

rule_changes = {
    'lib/games/cityking.js': (
        "rules: '독자 규칙의 2인 도시 보드게임.",
        "rules: '랜드킹은 독자 규칙의 2인 도시 보드게임입니다."
    ),
    'public/index.html': (
        '독자 규칙의 도시 보드게임입니다.',
        '랜드킹은 독자 규칙의 도시 보드게임입니다.'
    ),
}
for name, (old, new) in rule_changes.items():
    file = root / name
    text = file.read_text(encoding='utf-8')
    assert text.count(old) == 1, (name, 'rules text mismatch', text.count(old))
    file.write_text(text.replace(old, new), encoding='utf-8')

version_files = ['package.json', 'package-lock.json', 'public/index.html', 'server.js', 'test/connect4.test.js', 'test/new-games-server.test.js', 'public/styles.css']
for name in version_files:
    file = root / name
    old = file.read_text(encoding='utf-8')
    assert '1.6.17' in old, (name, 'missing old version')
    file.write_text(old.replace('1.6.17', '1.6.18'), encoding='utf-8')

city_test = root / 'test/cityking.test.js'
city_text = city_test.read_text(encoding='utf-8')
assert r'1\.6\.17' in city_text
city_test.write_text(city_text.replace(r'1\.6\.17', r'1\.6\.18'), encoding='utf-8')

notice = root / 'lib/release-announcements.js'
text = notice.read_text(encoding='utf-8')
assert text.count("key: 'v1.6.17'") == 1 and "key: 'v1.6.18'" not in text
assert text.rstrip().endswith('];')
now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
entry = """  {
    key: 'v1.6.18',
    title: '[업데이트] v1.6.18 랜드킹 이름 변경',
    body: '도시 매입·통행료·이벤트를 즐기는 게임의 이름을 랜드킹으로 변경했습니다. 게임 선택, 규칙 안내, 게임판, 오류 메시지까지 새 이름으로 통일했습니다. 기존 게임 방식과 입장 파일은 그대로 유지됩니다.',
    publishedAt: 'PUBLISHED_AT',
  },
""".replace('PUBLISHED_AT', now)
text = text.rstrip()[:-2].rstrip() + '\n' + entry + '];\n'
assert '도시왕' not in text
notice.write_text(text, encoding='utf-8')

test = root / 'test/cityking.test.js'
text = test.read_text(encoding='utf-8')
old = "  assert.equal(getGame('cityking'), cityking);"
new = "  assert.equal(getGame('cityking'), cityking);\n  assert.equal(cityking.name, '랜드킹');\n  assert.match(cityking.rules, /랜드킹/);"
assert text.count(old) == 1
text = text.replace(old, new)
old = '  assert.match(html, /data-game="cityking"/);'
new = '''  assert.match(html, /data-game="cityking"/);
  assert.match(html, /<strong>랜드킹<\/strong>/);
  assert.match(js, /ctx\.fillText\('랜드킹'/);
  assert.doesNotMatch(html, /도시왕/);
  assert.doesNotMatch(js, /도시왕/);
  assert.doesNotMatch(server, /도시왕/);
  const notices = require('../lib/release-announcements');
  assert.ok(notices.some(item => item.key === 'v1.6.17' && item.title.includes('랜드킹')));
  assert.ok(notices.some(item => item.key === 'v1.6.18' && item.title.includes('랜드킹')));'''
assert text.count(old) == 1
text = text.replace(old, new)
test.write_text(text, encoding='utf-8')

for name in rename_files:
    assert '도시왕' not in (root / name).read_text(encoding='utf-8') or name == 'test/cityking.test.js', f'old name remains in {name}'
assert 'cityking' in (root / 'lib/games/index.js').read_text(encoding='utf-8'), 'game ID inadvertently removed'
print('All user-facing game names updated to 랜드킹; stable cityking identifier preserved; version v1.6.18')
