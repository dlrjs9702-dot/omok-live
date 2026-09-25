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
