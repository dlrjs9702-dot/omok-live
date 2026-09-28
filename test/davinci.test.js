'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../lib/games/davinci');

test('다빈치 코드: 무작위 타일의 숫자는 본인 응답에만 포함된다', () => {
  const game = engine.create();
  assert.equal(engine.start(game, ['1', '2'], 1000).legal, true);
  assert.equal(game.pile.length, 15);
  for (const tiles of Object.values(game.hands)) {
    assert.equal(tiles.length, 4);
    assert.deepEqual(tiles, [...tiles].sort((a, b) => a.number - b.number || (a.color === 'black' ? -1 : 1)));
  }
  const publicView = engine.publicState(game);
  for (const tiles of Object.values(publicView.hands)) for (const tile of tiles) {
    assert.equal(Object.hasOwn(tile, 'number'), false);
    assert.ok(!tile.id.includes(String(game.hands['1'][0].number)) || tile.id.length > 20);
  }
  assert.equal(Object.hasOwn(publicView.drawn, 'number'), false);
  assert.ok(engine.tilesFor(game, '1').every(tile => Number.isInteger(tile.number)));
  assert.equal(engine.drawnFor(game, game.turn).number, game.drawn.number);
  assert.equal(engine.drawnFor(game, game.turn === '1' ? '2' : '1'), null);
});

test('다빈치 코드: 추측, 멈춤, 더미 소진 후 공개, 시간 만료', () => {
  const game = engine.create();
  engine.start(game, ['1', '2', '3'], 1000);
  let actor = game.turn;
  let target = game.seatOrder.find(seat => seat !== actor);
  let tile = game.hands[target][0];
  assert.equal(engine.guess(game, actor, target, tile.id, tile.number, game.revision, 1200).correct, true);
  assert.equal(tile.revealed, true);
  assert.equal(game.phase, 'continue');
  assert.equal(engine.stop(game, actor, game.revision, 1300).legal, true);
  assert.equal(game.hands[actor].length, 5);
  assert.equal(game.turn !== actor, true);
  actor = game.turn;
  target = game.seatOrder.find(seat => seat !== actor);
  tile = game.hands[target].find(t => !t.revealed);
  assert.equal(engine.guess(game, actor, target, tile.id, (tile.number + 1) % 12, game.revision, 1500).correct, false);
  assert.equal(game.hands[actor].some(t => t.revealed), true);
  game.pile = [];
  game.drawn = null;
  actor = game.turn;
  target = game.seatOrder.find(seat => seat !== actor && game.hands[seat].some(t => !t.revealed));
  tile = game.hands[target].find(t => !t.revealed);
  assert.equal(engine.guess(game, actor, target, tile.id, (tile.number + 1) % 12, game.revision, 1600).legal, true);
  assert.equal(game.phase, 'reveal-own');
  assert.equal(engine.tick(game, game.deadlineAt - 1), false);
  assert.equal(engine.tick(game, game.deadlineAt), true);
  assert.equal(game.hands[actor].some(t => t.revealed), true);
});

test('다빈치 코드: 현재 추리 대상은 숫자 없이 모두에게 보이고 추측 뒤 해제된다', () => {
  const game = engine.create();
  engine.start(game, ['1', '2'], 1000);
  const actor = game.turn;
  const target = game.seatOrder.find(seat => seat !== actor);
  const tile = game.hands[target].find(item => !item.revealed);

  assert.equal(engine.select(game, actor, target, tile.id, game.revision).legal, true);
  assert.deepEqual(game.selection, { seat: actor, target, tileId: tile.id });
  const publicView = engine.publicState(game);
  assert.deepEqual(publicView.selection, { seat: actor, target, tileId: tile.id });
  assert.equal(Object.hasOwn(publicView.hands[target].find(item => item.id === tile.id), 'number'), false);

  assert.equal(engine.guess(game, actor, target, tile.id, tile.number, game.revision, 1200).legal, true);
  assert.equal(game.selection, null);
  assert.deepEqual(engine.publicState(game).lastGuess, {
    seat: actor, target, tileId: tile.id, number: tile.number, correct: true, submittedAt: 1200,
  });
});

test('다빈치 코드: 오답 피드백은 추측 숫자만 공개하고 만료된다', () => {
  const game = engine.create();
  engine.start(game, ['1', '2'], 1000);
  const actor = game.turn;
  const target = game.seatOrder.find(seat => seat !== actor);
  const tile = game.hands[target].find(item => !item.revealed);
  const guessedNumber = (tile.number + 1) % 12;

  assert.equal(engine.select(game, actor, target, tile.id, game.revision).legal, true);
  assert.equal(engine.guess(game, actor, target, tile.id, guessedNumber, game.revision, 1200).correct, false);
  const publicView = engine.publicState(game);
  assert.deepEqual(publicView.lastGuess, {
    seat: actor, target, tileId: tile.id, number: guessedNumber, correct: false, submittedAt: 1200,
  });
  assert.equal(Object.hasOwn(publicView.hands[target].find(item => item.id === tile.id), 'number'), false);
  assert.equal(engine.expireFeedback(game, 2099), false);
  assert.equal(engine.expireFeedback(game, 2100), true);
  assert.equal(engine.publicState(game).lastGuess, null);
});

test('다빈치 코드: 논리적으로 불가능한 숫자도 거부하지 않고 일반 오답으로 처리한다', () => {
  const game = engine.create();
  engine.start(game, ['1', '2'], 1000);
  const actor = game.turn;
  const target = actor === '1' ? '2' : '1';
  const t = (color, number, revealed = false) => ({ id: `${color}${number}`, color, number, revealed });
  // Actor holds black 7; target's hidden black 4 sits between a revealed black 2 and black 9.
  game.hands[actor] = [t('white', 1), t('black', 7), t('white', 10)];
  game.hands[target] = [t('black', 2, true), t('black', 4), t('black', 9, true)];
  game.drawn = t('white', 5);
  game.pile = game.pile.filter(tile => !['black2', 'black4', 'black9', 'black7', 'white1', 'white10', 'white5'].includes(tile.id));
  // 7 is visible to the actor (own rack) and 11 is out of sort order -- both are ordinary wrong guesses.
  const wrong = engine.guess(game, actor, target, 'black4', 7, game.revision, 1100);
  assert.equal(wrong.legal, true);
  assert.equal(wrong.correct, false);
  assert.deepEqual(game.history.at(-1), { seat: actor, target, id: 'black4', number: 7, correct: false });
  assert.equal(game.hands[actor].find(tile => tile.id === 'white5')?.revealed, true, '오답 규칙: 뽑은 타일 공개');
  assert.notEqual(game.turn, actor, '오답 규칙: 차례 넘김');
  // Next player guesses the actor's hidden tile with 11 (after white 10: impossible) -- still legal.
  engine.expireFeedback?.(game, 5000);
  const next = game.turn;
  const outOfOrder = engine.guess(game, next, actor, 'white1', 11, game.revision, 6000);
  assert.equal(outOfOrder.legal, true);
  assert.equal(outOfOrder.correct, false);
  // Only a real game-state problem is rejected: out of range, revealed tile, own tile.
  engine.expireFeedback?.(game, 9000);
  const who = game.turn;
  const other = who === '1' ? '2' : '1';
  assert.equal(engine.guess(game, who, other, game.hands[other].find(tile => tile.revealed).id, 0, game.revision, 9100).legal, false);
  assert.equal(engine.guess(game, who, other, game.hands[other].find(tile => !tile.revealed).id, 12, game.revision, 9100).legal, false);
  // Correct guess still reveals the tile as before.
  const hidden = game.hands[other].find(tile => !tile.revealed);
  const right = engine.guess(game, who, other, hidden.id, hidden.number, game.revision, 9200);
  assert.equal(right.correct, true);
  assert.equal(hidden.revealed, true);
});
