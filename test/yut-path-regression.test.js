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

test('shortcut from top-right keeps the same diagonal through center and rejoins outer at bottom-left', () => {
  assert.deepEqual(destinations(21, 'shortcut5').map(x => x.position), [22,23,24,25,15]);
  assert.deepEqual(destinations(22, 'shortcut5').map(x => x.position), [23,24,25,15,16]);
  assert.deepEqual(destinations(23, 'shortcut5').map(x => x.position), [24,25,15,16,17]);
  assert.deepEqual(destinations(24, 'shortcut5').map(x => x.position), [25,15,16,17,18]);
  assert.deepEqual(destinations(25, 'shortcut5').map(x => x.position), [15,16,17,18,19]);
});

test('shortcut from top-left keeps the same diagonal through center and reaches finish side correctly', () => {
  assert.deepEqual(destinations(26, 'shortcut10').map(x => x.position), [27,23,28,29,null]);
  assert.deepEqual(destinations(27, 'shortcut10').map(x => [x.status, x.position]), [
    ['board',23], ['board',28], ['board',29], ['finished',null], ['finished',null],
  ]);
  assert.deepEqual(destinations(23, 'shortcut10').map(x => [x.status, x.position]), [
    ['board',28], ['board',29], ['finished',null], ['finished',null], ['finished',null],
  ]);
});

test('outer rejoin and finish points keep consuming remaining steps', () => {
  assert.deepEqual(destinations(15).map(x => [x.status, x.position]), [
    ['board',16], ['board',17], ['board',18], ['board',19], ['finished',null],
  ]);
  assert.deepEqual(destinations(19).map(x => x.status), ['finished','finished','finished','finished','finished']);
});

test('home pieces use all five throw amounts correctly', () => {
  const home = { id: 'black-1', color: 'black', status: 'home', position: null, route: 'outer' };
  assert.deepEqual([1,2,3,4,5].map(steps => yut.destination(home, steps).position), [1,2,3,4,5]);
});

test('stacked pieces move together, preserve route, capture opponents and grant bonus throw', () => {
  const game = yut.create();
  yut.start(game);
  game.pieces.black[0] = { id:'black-1', color:'black', status:'board', position:23, route:'shortcut5' };
  game.pieces.black[1] = { id:'black-2', color:'black', status:'board', position:23, route:'shortcut5' };
  game.pieces.white[0] = { id:'white-1', color:'white', status:'board', position:25, route:'shortcut5' };
  game.phase = 'move';
  game.pendingSteps = 2;
  game.lastThrow = { name:'개', steps:2 };
  const result = yut.applyMove(game, 'black-1', 'black', 'now');
  assert.equal(result.legal, true);
  assert.deepEqual(game.pieces.black.slice(0,2).map(p => [p.position,p.route]), [[25,'shortcut5'],[25,'shortcut5']]);
  assert.equal(game.pieces.white[0].status, 'home');
  assert.equal(result.captured.length, 1);
  assert.equal(result.bonus, true);
  assert.equal(game.turn, 'black');
  assert.equal(game.phase, 'throw');
});

test('landing on a friendly piece normalizes the joined stack route for the next move', () => {
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
  assert.equal(game.pieces.black[0].route, 'shortcut5');
  assert.equal(game.pieces.black[1].route, 'shortcut5');
});
