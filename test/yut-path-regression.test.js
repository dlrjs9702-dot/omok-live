'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const yut = require('../lib/games/yut');

function piece(position, route = 'outer') {
  return { id: 'black-1', color: 'black', status: 'board', position, route };
}

function destinations(position, route = 'outer') {
  return [1,2,3,4,5].map(steps => yut.destination(piece(position, route), steps));
}

test('outer ordinary points consume do/ge/geol/yut/mo exactly', () => {
  assert.deepEqual(destinations(1).map(x => x.position), [2,3,4,5,6]);
});

test('passing a shortcut entrance does not turn unless the piece had stopped on the branch', () => {
  assert.deepEqual(destinations(4).map(x => x.position), [5,6,7,8,9]);
  assert.equal(yut.destination(piece(5, 'outer'), 1).position, 21);
  assert.equal(yut.destination(piece(10, 'outer'), 1).position, 26);
});

test('a piece merely passing through center mid-throw keeps following its own diagonal, unchanged', () => {
  // None of these stop exactly on 23 (the center), so they must not re-route: passing through
  // center is not the same as stopping on it.
  assert.deepEqual(destinations(21, 'shortcut5').map(x => x.position), [22,23,24,25,15]);
  assert.deepEqual(destinations(22, 'shortcut5').map(x => x.position), [23,24,25,15,16]);
  assert.deepEqual(destinations(24, 'shortcut5').map(x => x.position), [25,15,16,17,18]);
  assert.deepEqual(destinations(25, 'shortcut5').map(x => x.position), [15,16,17,18,19]);
  assert.deepEqual(destinations(26, 'shortcut10').map(x => x.position), [27,23,28,29,'finishLine']);
  assert.deepEqual(destinations(27, 'shortcut10').map(x => [x.status, x.position]), [
    ['board',23], ['board',28], ['board',29], ['board','finishLine'], ['board','finishLine'],
  ]);
});

test('a piece resting exactly on center always departs toward home via the short 10-side diagonal', () => {
  // Whether the piece reached 23 via the 5-side diagonal or the 10-side one, its NEXT move must
  // leave through 28/29 toward the finish -- never back out through 24/25 toward the 15 corner,
  // which used to be the "goes the wrong way / the long way around" bug.
  const viaFive = destinations(23, 'shortcut5').map(x => [x.status, x.position]);
  const viaTen = destinations(23, 'shortcut10').map(x => [x.status, x.position]);
  const expected = [
    ['board',28], ['board',29], ['board','finishLine'], ['board','finishLine'], ['board','finishLine'],
  ];
  assert.deepEqual(viaFive, expected);
  assert.deepEqual(viaTen, expected);
});

test('reaching the finish line rests there; only a later move from it actually finishes', () => {
  // Landing exactly on 19, or overshooting past it, both stop AT the finish line -- never
  // straight through to "finished" in the same throw.
  assert.deepEqual(destinations(15).map(x => [x.status, x.position]), [
    ['board',16], ['board',17], ['board',18], ['board',19], ['board','finishLine'],
  ]);
  assert.deepEqual(destinations(19).map(x => [x.status, x.position]), [
    ['board','finishLine'], ['board','finishLine'], ['board','finishLine'], ['board','finishLine'], ['board','finishLine'],
  ]);
  // A piece already resting on the finish line finishes on ANY next move, regardless of amount.
  const atFinishLine = { id: 'black-1', color: 'black', status: 'board', position: 'finishLine', route: 'outer' };
  assert.deepEqual([1,2,3,4,5].map(steps => yut.destination(atFinishLine, steps).status),
    ['finished','finished','finished','finished','finished']);
});

test('home pieces use all five throw amounts correctly', () => {
  const home = { id: 'black-1', color: 'black', status: 'home', position: null, route: 'outer' };
  assert.deepEqual([1,2,3,4,5].map(steps => yut.destination(home, steps).position), [1,2,3,4,5]);
});

test('stacked pieces resting on center move together toward home and grant bonus throw', () => {
  const game = yut.create();
  yut.start(game);
  game.pieces.black[0] = { id:'black-1', color:'black', status:'board', position:23, route:'shortcut5' };
  game.pieces.black[1] = { id:'black-2', color:'black', status:'board', position:23, route:'shortcut5' };
  game.pieces.white[0] = { id:'white-1', color:'white', status:'board', position:29, route:'shortcut10' };
  game.phase = 'move';
  game.pendingSteps = 2;
  game.lastThrow = { name:'개', steps:2 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.deepEqual(game.pieces.black.slice(0,2).map(p => [p.position,p.route]), [[29,'shortcut10'],[29,'shortcut10']]);
  assert.equal(game.pieces.white[0].status, 'home');
  assert.equal(result.captured.length, 1);
  assert.equal(result.bonus, true);
  assert.equal(game.turn, 'black');
  assert.equal(game.phase, 'throw');
});

test('landing on a friendly piece at center normalizes the joined stack to the center departure route', () => {
  const game = yut.create();
  yut.start(game);
  game.pieces.black[0] = { id:'black-1', color:'black', status:'board', position:22, route:'shortcut5' };
  game.pieces.black[1] = { id:'black-2', color:'black', status:'board', position:23, route:'shortcut10' };
  game.phase = 'move';
  game.pendingSteps = 1;
  game.lastThrow = { name:'도', steps:1 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.equal(game.pieces.black[0].position, 23);
  assert.equal(game.pieces.black[1].position, 23);
  // Both pieces now carry whichever route the arriving move actually used (the mover's own
  // 5-side diagonal); that stored value no longer matters for direction, since a piece resting
  // on 23 always departs via the 10-side diagonal regardless of how it got there (checked next).
  assert.equal(game.pieces.black[0].route, 'shortcut5');
  assert.equal(game.pieces.black[1].route, 'shortcut5');
  // And their next move together must leave via the short 10-side diagonal.
  game.turn = 'black';
  game.phase = 'move';
  game.pendingSteps = 1;
  const next = yut.applyMove(game, 'black-1', 'black', 'later');
  assert.equal(next.legal, true);
  assert.deepEqual(game.pieces.black.slice(0,2).map(p => p.position), [28, 28]);
});
