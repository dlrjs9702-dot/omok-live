'use strict';
const fs = require('node:fs');
const staged = new Map();
function replace(file, needle, replacement, expected = 1) {
  const old = staged.has(file) ? staged.get(file) : fs.readFileSync(file, 'utf8');
  const count = old.split(needle).length - 1;
  if (count !== expected) throw Error(`${file}: expected ${expected} matches, got ${count}: ${needle.slice(0, 80)}`);
  staged.set(file, old.split(needle).join(replacement));
}
replace('test/announcements.test.js', 'assert.equal((html.match(/data-game-option=/g) || []).length, 12);', 'assert.equal((html.match(/data-game-option=/g) || []).length, 13);');
replace('test/baseball.test.js', "'othello','pictionary','yut'", "'othello','pictionary','twentyquestions','yut'");
replace('test/connect4.test.js', "'othello', 'pictionary', 'yut'", "'othello', 'pictionary', 'twentyquestions', 'yut'", 2);
replace('test/lobby-compact-effects.test.js', 'assert.equal(games.length, 13);', 'assert.equal(games.length, 14);');
replace('test/lobby-compact-effects.test.js', 'assert.equal(selectedIds.length, 13);', 'assert.equal(selectedIds.length, 14);');
replace('test/lobby-compact-effects.test.js', 'pictionary|liar|oldmaid|marathon)', 'pictionary|liar|oldmaid|marathon|twentyquestions)');
const oldCanvas = String.raw`assert.match(app, /canvasWrap\.classList\.toggle\('hidden', baseball \|\| bingo \|\| pictionary \|\| liar \|\| oldmaid \|\| marathon\)/);`;
const newCanvas = String.raw`assert.match(app, /canvasWrap\.classList\.toggle\('hidden', baseball \|\| bingo \|\| pictionary \|\| liar \|\| oldmaid \|\| marathon \|\| twenty\)/);`;
replace('test/marathon-ui.test.js', oldCanvas, newCanvas);
for (const [file, content] of staged) fs.writeFileSync(file, content, 'utf8');
console.log('Fourteenth-game regression assertions updated:', [...staged.keys()].join(', '));
