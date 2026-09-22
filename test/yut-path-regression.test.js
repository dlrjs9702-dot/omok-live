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
  // From 27, a throw of 5 overshoots the finish line by one step (v1.6.68) -- see the dedicated
  // finish-line test below for the exact-vs-overshoot rule this all follows.
  assert.deepEqual(destinations(27, 'shortcut10').map(x => [x.status, x.position]), [
    ['board',23], ['board',28], ['board',29], ['board','finishLine'], ['finished',null],
  ]);
});

test('a piece resting exactly on center always departs toward home via the short 10-side diagonal', () => {
  // Whether the piece reached 23 via the 5-side diagonal or the 10-side one, its NEXT move must
  // leave through 28/29 toward the finish -- never back out through 24/25 toward the 15 corner,
  // which used to be the "goes the wrong way / the long way around" bug.
  const viaFive = destinations(23, 'shortcut5').map(x => [x.status, x.position]);
  const viaTen = destinations(23, 'shortcut10').map(x => [x.status, x.position]);
  // A throw of 3 lands exactly on the finish line; 4 and 5 overshoot it and finish outright.
  const expected = [
    ['board',28], ['board',29], ['board','finishLine'], ['finished',null], ['finished',null],
  ];
  assert.deepEqual(viaFive, expected);
  assert.deepEqual(viaTen, expected);
});

// v1.6.68: landing EXACTLY on the finish line rests there (a separate later move is what
// actually finishes it) -- but a throw that has steps left over after reaching it has overshot,
// and finishes outright in that same throw. Traditional Yut Nori rule (confirmed by the user):
// from the cell right before the finish line, only an exact 도 stops there -- 개 or more finishes.
test('reaching the finish line rests there only on an exact throw; a throw with steps to spare overshoots and finishes outright', () => {
  // From 15 the finish line is exactly 5 away, so no throw (max 5) can overshoot it -- all five
  // amounts land short of or exactly on it.
  assert.deepEqual(destinations(15).map(x => [x.status, x.position]), [
    ['board',16], ['board',17], ['board',18], ['board',19], ['board','finishLine'],
  ]);
  // From 19 the finish line is exactly 1 away: only 도(1) is exact and rests there; 개(2) and up
  // all overshoot it and finish immediately, regardless of how much they overshoot by.
  assert.deepEqual(destinations(19).map(x => [x.status, x.position]), [
    ['board','finishLine'], ['finished',null], ['finished',null], ['finished',null], ['finished',null],
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

// v1.6.57: destination() now also returns the full node-by-node path a piece walks (see the
// forwardDestination/backwardDestination comment), not just the final resting spot, so the client
// can animate the move one step at a time instead of teleporting straight to the result. This is
// server-authoritative real judged path data, the same one the existing move logic already
// computes -- never a client-side guess.
test('a forward move\'s path starts at the current position and lists every node visited, ending at the result', () => {
  assert.deepEqual(yut.destination(piece(1, 'outer'), 3).path, [1, 2, 3, 4]);
});

test('a path that turns onto a shortcut mid-throw lists the shortcut nodes it actually crosses', () => {
  // Stopped exactly on 5 (the shortcut5 entrance), so the very next departure turns onto the
  // diagonal -- the path must show 5 -> 21 -> 22, not continue along the outer ring.
  assert.deepEqual(yut.destination(piece(5, 'outer'), 2).path, [5, 21, 22]);
});

test('a path that overshoots the finish line walks through it into "finished", not stopping short', () => {
  // From 19, a throw of 5 overshoots the 1-step-away finish line by 4 -- the path shows the piece
  // actually passing through the finish line on its way to finishing, not stopping there.
  assert.deepEqual(yut.destination(piece(19, 'outer'), 5).path, [19, 'finishLine', 'finished', 'finished', 'finished', 'finished']);
  // An exact throw (1, from 19) still just rests at the finish line.
  assert.deepEqual(yut.destination(piece(19, 'outer'), 1).path, [19, 'finishLine']);
});

test("a piece entering from home paths from the start corner up to its landing spot", () => {
  const home = { id: 'black-1', color: 'black', status: 'home', position: null, route: 'outer' };
  assert.deepEqual(yut.destination(home, 3).path, [0, 1, 2, 3]);
});

test('a back-do path lists the nodes walked in actual travel order (current position first, oldest-visited last)', () => {
  assert.deepEqual(yut.destination(piece(4, 'outer'), -1).path, [4, 3]);
});

test("a piggybacked group's shared destination carries one path for the whole stack, matching the mover's own walk", () => {
  const game = yut.create();
  yut.start(game);
  game.pieces.black[0] = { id: 'black-1', color: 'black', status: 'board', position: 1, route: 'outer' };
  game.pieces.black[1] = { id: 'black-2', color: 'black', status: 'board', position: 1, route: 'outer' };
  game.phase = 'move';
  game.pendingSteps = 2;
  const option = yut.legalMoves(game, 'black').find(move => move.pieceId === 'black-1');
  assert.deepEqual(option.carried, ['black-1', 'black-2']);
  assert.deepEqual(option.destination.path, [1, 2, 3]);
});
