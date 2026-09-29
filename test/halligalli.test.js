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
  assert.equal(h.tick(game, 5999), false);
  assert.equal(h.tick(game, 6000), true); // v1.7.5: 자동 뒤집기 5초
  assert.equal(game.flipId, 1);
  assert.notEqual(game.turn, initialTurn);
  h.disconnect(game, initialTurn, 7000);
  assert.equal(h.tick(game, 66999), true); // another automatic flip may also have occurred
  assert.equal(game.eliminated.includes(initialTurn), false);
  assert.equal(h.tick(game, 67000), true);
  assert.equal(game.eliminated.includes(initialTurn), true);
  const tie = h.create();
  h.start(tie, ['1','2'], 1000);
  assert.equal(h.tick(tie, tie.endsAt), true);
  assert.deepEqual(new Set(tie.winner), new Set(['1','2']));
});

// v1.7.5: 무응답 자동 뒤집기는 서버 마감(deadlineAt) 5초. 직접 뒤집으면 마감이 새로 5초로 잡힌다.
test('할리갈리 무응답 자동 뒤집기: 마감은 정확히 5초이고 직접 뒤집으면 중복되지 않는다', () => {
  assert.equal(h.AUTO_FLIP_MS, 5000);
  const game = h.create();
  h.start(game, ['1', '2', '3'], 10_000);
  const first = game.turn;
  assert.equal(game.deadlineAt, 15_000, '시작 직후 마감 = 5초 뒤');
  assert.equal(h.tick(game, 14_999), false, '5초 전에는 자동으로 뒤집지 않는다');
  assert.equal(game.moveCount, 0);
  // 마감 시각에 서버가 대신 뒤집고 다음 사람에게 새 5초를 준다.
  assert.equal(h.tick(game, 15_000), true);
  assert.equal(game.moveCount, 1);
  assert.equal(game.lastFlip.seat, first);
  assert.notEqual(game.turn, first);
  assert.equal(game.deadlineAt, 20_000);
  // 5초 전에 직접 뒤집기: 옛 마감 시각이 되어도 다시 뒤집지 않는다.
  const second = game.turn;
  assert.equal(h.flip(game, second, 17_000).legal, true);
  assert.equal(game.moveCount, 2);
  assert.equal(game.deadlineAt, 22_000);
  assert.equal(h.tick(game, 20_000), false);
  assert.equal(game.moveCount, 2);
  assert.equal(h.tick(game, 22_000), true);
  assert.equal(game.moveCount, 3);
});

test('할리갈리 접속 끊김: 끊긴 참가자 차례도 5초마다 진행되고 60초 뒤 탈락하며 종 판정은 그대로다', () => {
  const game = h.create();
  h.start(game, ['1', '2', '3'], 0);
  game.turn = '1';
  game.deadlineAt = 5000;
  h.disconnect(game, '1', 0);
  assert.equal(h.tick(game, 5000), true);
  assert.equal(game.moveCount, 1, '끊긴 사람의 차례도 자동으로 넘어간다');
  assert.equal(game.lastFlip.seat, '1');
  assert.equal(game.deadlineAt, 10_000);
  // 60초가 지나면 탈락 처리되고 진행 중인 판은 남은 사람으로 이어진다.
  game.deadlineAt = 1_000_000;
  h.tick(game, 60_000);
  assert.deepEqual(game.eliminated, ['1']);
  assert.equal(game.status, 'playing');
  // 종 잠금·판정 규칙은 그대로.
  game.faces['2'] = [{ fruit: '딸기', count: 2 }];
  game.faces['3'] = [{ fruit: '딸기', count: 3 }];
  game.flipId = 5; game.lockUntil = 61_000; game.ringSeats = []; game.bellSettledFlip = null;
  assert.equal(h.ring(game, '2', 5, 60_999).ignored, 'locked');
  assert.equal(h.ring(game, '2', 5, 61_000).correct, true);
});
