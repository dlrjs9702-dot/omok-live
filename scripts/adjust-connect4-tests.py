#!/usr/bin/env python3
from pathlib import Path

def replace_once(file, old, new):
    path = Path(file)
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise RuntimeError(f'{file}: expected one stale test expectation, got {text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')

replace_once('test/announcements.test.js',
    '''assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 4);''',
    '''assert.equal((html.match(/class="gameRuleDetails"/g) || []).length, 5);''')
replace_once('test/omok-team.test.js',
    r'assert.match(html, /v=1\.6\.9/);',
    r'assert.match(html, /v=1\.6\.12/);')
print('Updated only two stale UI tests: five games and current script cache version.')
