'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('../lib/games/halligalli');

test('할리갈리 카드 56장 분포·균등 배분 및 제한 시간', () => {
  const deck = h.deck();
  assert.equal(deck.length, 56);
  for (const fruit of ['딸기', '바나나', '라임', '자두']) {
    for (let count = 1; count <= 5; count++) {
      assert.equal(deck.filter(card => card.fruit === fruit && card.count === count).length, [5,3,3,2,1][count - 1]);
    }
  }
  const game = h.create();
  assert.equal(h.setTime(game, 10).legal, true);
  h.start(game, ['1','2','3','4','5','6'], 1000);
  assert.ok(Object.values(game.piles).every(cards => cards.length === 9));
  assert.equal(game.endsAt, 601000);
  game.piles['1'].push({ fruit: '라임', count: 1 });
  assert.equal(h.tick(game, 601000), true);
  assert.deepEqual(game.winner, ['1']);
});

test('할리갈리 종은 0.3초 잠금 뒤 정확히 다섯 개에 처음 친 사람만 성공한다', () => {
  const game = h.create();
  h.start(game, ['1','2'], 1000);
  game.faces['1'].push({ fruit: '딸기', count: 2 });
  game.faces['2'].push({ fruit: '딸기', count: 3 });
  game.flipId = 1;
  game.lockUntil = 1300;
  assert.equal(h.ring(game, '1', 1, 1299).ignored, 'locked');
  const before = game.piles['1'].length;
  assert.equal(h.ring(game, '1', 1, 1300).correct, true);
  assert.equal(game.piles['1'].length, before + 2);
  assert.deepEqual(game.lastBell.transfers, [
    { from: '1', to: '1', count: 1, top: { fruit: '딸기', count: 2 } },
    { from: '2', to: '1', count: 1, top: { fruit: '딸기', count: 3 } },
  ]);
  assert.equal(game.lastBell.totalTransferred, 2);
  assert.equal(JSON.stringify(h.publicState(game)).includes('"piles"'), false);
  assert.equal(h.ring(game, '2', 1, 1300).ignored, 'late');
  assert.equal(game.piles['2'].length, before);
});

test('할리갈리 오판은 카드 부족 시 있는 만큼만 순서대로 주고, 0장도 차례 전 종으로 회복할 수 있다', () => {
  const game = h.create();
  h.start(game, ['1','2','3'], 1000);
  game.flipId = 1;
  game.lockUntil = 0;
  game.piles['1'] = [game.piles['1'][0]];
  assert.equal(h.ring(game, '1', 1, 1400).correct, false);
  assert.deepEqual(game.lastBell.transfers, [{ from: '1', to: '2', count: 1 }]);
  assert.equal(game.lastBell.totalTransferred, 1);
  assert.equal(game.piles['1'].length, 0);
  assert.equal(game.piles['2'].length, 19);
  assert.equal(game.piles['3'].length, 18);
  game.faces['2'].push({ fruit: '라임', count: 5 });
  game.flipId++;
  game.ringSeats = [];
  assert.equal(h.ring(game, '1', 2, 1500).correct, true);
  assert.equal(game.piles['1'].length, 1);
  assert.equal(game.eliminated.includes('1'), false);
});

test('할리갈리 자동 뒤집기·접속 끊김 60초·시간 종료 공동 승리', () => {
  const game = h.create();
  h.start(game, ['1','2','3'], 1000);
  const initialTurn = game.turn;
  assert.equal(h.tick(game, 3999), false);
  assert.equal(h.tick(game, 4000), true);
  assert.equal(game.flipId, 1);
  assert.notEqual(game.turn, initialTurn);
  h.disconnect(game, initialTurn, 5000);
  assert.equal(h.tick(game, 64999), true); // another automatic flip may also have occurred
  assert.equal(game.eliminated.includes(initialTurn), false);
  assert.equal(h.tick(game, 65000), true);
  assert.equal(game.eliminated.includes(initialTurn), true);
  const tie = h.create();
  h.start(tie, ['1','2'], 1000);
  assert.equal(h.tick(tie, tie.endsAt), true);
  assert.deepEqual(new Set(tie.winner), new Set(['1','2']));
});
