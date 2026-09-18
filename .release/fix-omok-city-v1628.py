from pathlib import Path

path = Path('test/omok-team.test.js')
text = path.read_text(encoding='utf-8')
old = '  assert.match(html, /data-game="omok2v2"/);'
new = '''  assert.doesNotMatch(html, /data-game="omok2v2"/);
  assert.match(html, /name="omokMode" value="2v2"/);
  assert.match(app, /omokMode\\(\\) === '2v2' \\? 'omok2v2'/);'''
if text.count(old) != 1:
    raise RuntimeError('legacy Omok test anchor missing or duplicated')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# A single redundant die assignment in the first patch is immediately overwritten.
app_path = Path('public/app.js')
app = app_path.read_text(encoding='utf-8')
unused = "    cityDieFirst.textContent = roll ? '⚀⚁⚂⚃⚄⚅'[0] : '⚀';\n"
if app.count(unused) != 1:
    raise RuntimeError('die display anchor missing or duplicated')
app_path.write_text(app.replace(unused, '', 1), encoding='utf-8')
print('updated legacy selector assertion and removed redundant die assignment')
