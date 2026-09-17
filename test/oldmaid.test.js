'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../lib/games/oldmaid');
const card = (rank, id) => ({ rank, id, suit: '♠' });
function fixture(hands, turn = '1') {
  return { ...game.create(), status: 'playing', seatOrder: Object.keys(hands), hands,
    turn, target: game.nextActive({ seatOrder: Object.keys(hands), hands }, turn), revision: 4 };
}

test('2 to 6 seats, 53 unique cards, one joker and automatic initial pairs', () => {
  const cards = game.deck();
  assert.equal(cards.length, 53);
  assert.equal(new Set(cards.map(c => c.id)).size, 53);
  assert.equal(cards.filter(c => c.rank === 'JOKER').length, 1);
  for (const n of [2, 6]) {
    const state = game.create();
    assert.equal(game.start(state, Array.from({ length: n }, (_, i) => String(i + 1))).legal, true);
    const hands = Object.values(state.hands).flat();
    assert.equal(hands.length + state.discardedPairs * 2, 53);
    assert.equal(new Set(hands.map(c => c.id)).size, hands.length);
    assert.equal(hands.filter(c => c.rank === 'JOKER').length, 1);
    for (const hand of Object.values(state.hands)) {
      assert.equal(new Set(hand.filter(c => c.rank !== 'JOKER').map(c => c.rank)).size,
        hand.filter(c => c.rank !== 'JOKER').length);
    }
    assert.equal(game.start(state, ['1', '2']).legal, false);
  }
  for (const seats of [[], ['1'], ['1','1'], ['1','7'], ['1','2','3','4','5','6','7']]) {
    assert.equal(game.start(game.create(), seats).legal, false);
  }
});

test('rank-only pairing discards two pairs from four cards but never joker', () => {
  const hand = [card('7','a'), card('7','b'), card('7','c'), card('7','d'), card('JOKER','joker')];
  assert.equal(game.removePairs(hand), 2);
  assert.deepEqual(hand.map(c => c.id), ['joker']);
});

test('draw transfers exactly one and auto-pairs, then skips empty seats clockwise', () => {
  const state = fixture({ '1':[card('A','a'),card('JOKER','joker')], '2':[card('A','b'),card('3','c')], '3':[], '4':[card('4','d')] });
  const before = Object.values(state.hands).flat().length;
  assert.deepEqual(game.draw(state,'1','4',0,4), { legal:false, reason:'bad-target' });
  assert.equal(game.draw(state,'1','2',0,4).legal, true);
  assert.equal(Object.values(state.hands).flat().length, before - 2);
  assert.deepEqual(state.hands['1'].map(c => c.id), ['joker']);
  assert.equal(state.turn, '2');
  assert.equal(state.target, '4');
  assert.equal(state.history[0].pairs, 1);
  assert.equal(Object.hasOwn(game.publicState(state),'hands'), false);
});

test('wrong turn, invalid index, stale shuffle/draw and duplicate requests do not mutate', () => {
  const state = fixture({ '1':[card('JOKER','joker')], '2':[card('A','a'),card('K','k')] });
  const before = JSON.stringify(state);
  assert.equal(game.draw(state,'2','1',0,4).legal, false);
  assert.equal(game.draw(state,'1','2',-1,4).legal, false);
  assert.equal(game.draw(state,'1','2',2,4).legal, false);
  assert.equal(game.shuffleHand(state,'2',3).legal, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(game.shuffleHand(state,'2',4).legal, true);
  assert.equal(state.revision, 5);
  assert.equal(game.draw(state,'1','2',0,4).reason, 'stale');
  assert.equal(game.draw(state,'1','2',0,5).legal, true);
  assert.equal(game.draw(state,'1','2',0,5).legal, false);
});

test('shuffle changes only own order, preserves cards and never exposes opponent faces', () => {
  const state = fixture({ '1':[card('JOKER','joker'),card('A','a'),card('Q','q')], '2':[card('K','k')] });
  const ownBefore = state.hands['1'].map(c => c.id);
  const otherBefore = JSON.stringify(state.hands['2']);
  assert.equal(game.shuffleHand(state,'1',4).legal, true);
  assert.deepEqual(new Set(state.hands['1'].map(c=>c.id)), new Set(ownBefore));
  assert.notDeepEqual(state.hands['1'].map(c=>c.id), ownBefore);
  assert.equal(JSON.stringify(state.hands['2']), otherBefore);
  const publicData = game.publicState(state);
  assert.equal(JSON.stringify(publicData).includes('joker'), false);
  assert.equal(JSON.stringify(publicData).includes('"rank"'), false);
  assert.equal(game.handFor(state, null), null);
  assert.equal(game.handFor(state, 'spectator'), null);
  assert.deepEqual(game.handFor(state, '1'), state.hands['1']);
  assert.notStrictEqual(game.handFor(state, '1')[0], state.hands['1'][0]);
});

test('final joker owner loses, remaining players win, rematch resets everything', () => {
  const state = fixture({ '1':[card('JOKER','joker'),card('A','a')], '2':[card('A','b')] });
  const answer = game.draw(state,'1','2',0,4);
  assert.equal(answer.finished, true);
  assert.equal(state.status,'finished');
  assert.equal(state.loser,'1');
  assert.deepEqual(state.winner,['2']);
  assert.equal(game.draw(state,'1','2',0,5).legal,false);
  const oldRound = state.round;
  game.reset(state);
  assert.equal(state.status,'selecting');
  assert.equal(state.round,oldRound+1);
  assert.deepEqual(state.hands,{});
  assert.deepEqual(state.history,[]);
  assert.equal(state.loser,null);
  assert.equal(state.revision,0);
});
