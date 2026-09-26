'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const baseball = require('../lib/games/baseball');
const { getGame, hasGame, listGames } = require('../lib/games');

test('number baseball is registered alongside existing games', () => {
  assert.equal(hasGame('baseball'), true);
  assert.equal(getGame('baseball').name, '숫자야구');
  assert.deepEqual(listGames().map(x => x.id).sort(), ['baseball','bingo','cityking','connect4','davinci','dots','gostop','halligalli','liar','marathon','oldmaid', 'omok','omok2v2','othello','pictionary','rpg','twentyquestions','yut']);
});

test('three distinct digits, leading zero forbidden and zero elsewhere allowed', () => {
  for (const number of ['123','102','901','987']) assert.equal(baseball.validNumber(number), true);
  for (const number of ['012','111','122','12','1234','abc','1e2','1 2',123]) assert.equal(baseball.validNumber(number), false);
});

test('four-digit mode keeps the same leading-zero and duplicate rules', () => {
  for (const number of ['1234', '1023', '9876']) assert.equal(baseball.validNumber(number, 4), true);
  for (const number of ['0123', '1123', '123', '12345']) assert.equal(baseball.validNumber(number, 4), false);
  assert.deepEqual(baseball.score('1234', '1243', 4), { strikes: 2, balls: 2 });
});

test('scores exact positions as strikes and other digits as balls', () => {
  assert.deepEqual(baseball.score('123','123'), { strikes: 3, balls: 0 });
  assert.deepEqual(baseball.score('123','132'), { strikes: 1, balls: 2 });
  assert.deepEqual(baseball.score('123','456'), { strikes: 0, balls: 0 });
  assert.deepEqual(baseball.score('102','210'), { strikes: 0, balls: 3 });
  assert.deepEqual(baseball.score('123','124'), { strikes: 2, balls: 0 });
});

test('both secrets are required, submitted only once; own guesses score against opponent', () => {
  const game = baseball.create();
  assert.equal(game.status,'selecting');
  baseball.start(game);
  assert.equal(game.status,'setup');
  assert.equal(baseball.setSecret(game, 'black','123').legal,true);
  assert.equal(game.status,'setup');
  assert.equal(baseball.setSecret(game, 'black','456').reason,'already-set');
  assert.equal(baseball.setSecret(game, 'white','012').reason,'invalid-number');
  assert.equal(baseball.setSecret(game, 'white','456').ready,true);
  assert.equal(game.status,'playing');
  assert.equal(game.turn,'black');
  assert.equal(baseball.applyGuess(game, '456','white','now').reason,'not-your-turn');
  assert.equal(baseball.applyGuess(game, '124','black','now').strikes,0);
  assert.equal(game.turn,'white');
  assert.equal(baseball.applyGuess(game, '132','white','now').balls,2);
  assert.equal(game.turn,'black');
  assert.equal(baseball.applyGuess(game, '456','black','now').finished,true);
  assert.equal(game.winner,'black');
  assert.equal(game.status,'finished');
  assert.equal(baseball.applyGuess(game, '789','white','now').reason,'not-playing');
});

test('four-digit room keeps its selected digit count through the next round', () => {
  const game = baseball.create({ digitCount: 4 });
  assert.equal(game.digitCount, 4);
  baseball.start(game);
  assert.equal(baseball.setSecret(game, 'black', '1234').legal, true);
  assert.equal(baseball.setSecret(game, 'white', '4567').ready, true);
  const win = baseball.applyGuess(game, '4567', 'black', 'now');
  assert.equal(win.finished, true);
  assert.equal(win.strikes, 4);
  baseball.reset(game);
  assert.equal(game.round, 2);
  assert.equal(game.digitCount, 4);
});

test('public state does not reveal either private secret, including after victory', () => {
  const game = baseball.create(); baseball.start(game);
  baseball.setSecret(game,'black','917'); baseball.setSecret(game,'white','362');
  const pending = JSON.stringify(baseball.publicState(game));
  assert.ok(!pending.includes('917'));
  assert.ok(!pending.includes('362'));
  assert.deepEqual(baseball.publicState(game).ready,{ black:true, white:true });
  baseball.applyGuess(game,'362','black','now');
  const finished = JSON.stringify(baseball.publicState(game));
  assert.ok(!finished.includes('917'));
  assert.ok(finished.includes('362')); // Winning guess is public, no separate secret field.
  assert.equal(baseball.publicState(game).guesses[0].strikes,3);
  baseball.reset(game);
  assert.equal(game.round,2);
  assert.equal(game.status,'selecting');
  assert.deepEqual(game.secrets,{ black:null, white:null });
  assert.equal(game.moves.length,0);
});

// The secret/guess inputs start at minlength="3" maxlength="3" in the static HTML. Raising
// minLength past the still-3 maxLength (or lowering maxLength past a still-raised minLength)
// throws a DOMException in real browsers, which used to abort renderRoom() mid-render for a
// 4-digit room and silently break the SSE reconnect (game start + chat both looked frozen).
test('client input length is always relaxed to 0 before either bound is raised, so 3<->4 never crosses', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const fn = app.match(/function renderBaseball\(\)[\s\S]*?\n  \}\n/)[0];
  const loop = fn.match(/for \(const input of \[baseballSecretInput, baseballGuessInput\]\)[\s\S]*?\n    \}/)[0];
  assert.match(loop, /input\.minLength = 0;/);
  const minZero = loop.indexOf('input.minLength = 0;');
  const maxSet = loop.indexOf('input.maxLength = digitCount;');
  const minSet = loop.lastIndexOf('input.minLength = digitCount;');
  assert.ok(minZero < maxSet && maxSet < minSet, 'minLength must be relaxed to 0, then maxLength, then minLength, in that order');
});
