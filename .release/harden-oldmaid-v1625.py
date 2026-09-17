from pathlib import Path

engine = Path('lib/games/oldmaid.js')
s = engine.read_text(encoding='utf-8')
old = 'function reset(game) { Object.assign(game, create({ round: (game.round || 1) + 1 })); }'
new = 'function reset(game) {\n  const revision = game.revision + 1;\n  Object.assign(game, create({ round: (game.round || 1) + 1 }));\n  game.revision = revision;\n}'
assert s.count(old) == 1, 'Old Maid reset anchor has changed'
engine.write_text(s.replace(old, new, 1), encoding='utf-8')
unit = Path('test/oldmaid.test.js')
s = unit.read_text(encoding='utf-8')
old = '  const oldRound = state.round;\n  game.reset(state);'
new = '  const oldRound = state.round;\n  const previousRevision = state.revision;\n  game.reset(state);'
assert s.count(old) == 1
s = s.replace(old, new, 1)
assert s.count('  assert.equal(state.revision,0);') == 1
s = s.replace('  assert.equal(state.revision,0);', '  assert.equal(state.revision,previousRevision+1);', 1)
unit.write_text(s, encoding='utf-8')
print('Old Maid rematch revision is monotonic')
