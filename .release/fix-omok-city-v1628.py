from pathlib import Path


def replace_one(filename, before, after):
    file = Path(filename)
    text = file.read_text(encoding='utf-8')
    if text.count(before) != 1:
        raise RuntimeError(f'{filename}: expected exactly one occurrence: {before[:90]!r}')
    file.write_text(text.replace(before, after, 1), encoding='utf-8')

# The old Omok team mode remains an engine and rules option, but no longer has
# a second lobby game button.
replace_one('test/omok-team.test.js',
            '  assert.match(html, /data-game="omok2v2"/);',
            '''  assert.doesNotMatch(html, /data-game="omok2v2"/);
  assert.match(html, /name="omokMode" value="2v2"/);
  assert.match(app, /omokMode\\(\\) === '2v2' \\? 'omok2v2'/);''')

# Full-suite assertions still assume two separate Omok lobby buttons.
replace_one('test/announcements.test.js',
            '  assert.equal((html.match(/data-game-option=/g) || []).length, 12);',
            '  assert.equal((html.match(/data-game-option=/g) || []).length, 11);')
replace_one('test/lobby-compact-effects.test.js',
            r'  assert.match(app, /gameRulesSelect\.value = selectedGameType;/);',
            r'  assert.match(app, /gameRulesSelect\.value = resolvedType;/);')

# The v1.6.27 CSS section comment is preserved; only cache URLs advance.
replace_one('test/chat-height.test.js',
            "css.indexOf('/* v1.6.28: keep room chat')",
            "css.indexOf('/* v1.6.27: keep room chat')")

# Drop a redundant assignment that is immediately overwritten, without
# changing dice roll behavior.
replace_one('public/app.js',
            "    cityDieFirst.textContent = roll ? '⚀⚁⚂⚃⚄⚅'[0] : '⚀';\n", '')
print('Aligned Omok button count, rules selection and historical CSS marker tests')
