from pathlib import Path

compact_old = "['baseball','bingo','cityking','connect4','dots','omok','omok2v2','othello','pictionary','yut']"
compact_new = "['baseball','bingo','cityking','connect4','dots','liar','omok','omok2v2','othello','pictionary','yut']"
spaced_old = "['baseball', 'bingo', 'cityking', 'connect4', 'dots', 'omok', 'omok2v2', 'othello', 'pictionary', 'yut']"
spaced_new = "['baseball', 'bingo', 'cityking', 'connect4', 'dots', 'liar', 'omok', 'omok2v2', 'othello', 'pictionary', 'yut']"

for path in Path('test').glob('*.js'):
    text = path.read_text(encoding='utf-8')
    text = text.replace(r'1\.6\.23', r'1\.6\.24')
    text = text.replace('1.6.23', '1.6.24')
    text = text.replace(compact_old, compact_new).replace(spaced_old, spaced_new)
    text = text.replace('(html.match(/data-game-option=/g) || []).length, 10', '(html.match(/data-game-option=/g) || []).length, 11')
    text = text.replace('assert.equal(games.length, 10);', 'assert.equal(games.length, 11);')
    text = text.replace('connect4|yut|bingo|dots|cityking|othello|baseball|pictionary)', 'connect4|yut|bingo|dots|cityking|othello|baseball|pictionary|liar)')
    text = text.replace('assert.equal(selectedIds.length, 10);', 'assert.equal(selectedIds.length, 11);')
    path.write_text(text, encoding='utf-8')
