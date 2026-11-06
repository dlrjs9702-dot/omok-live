// v1.10.255 두더지 잡기 「헬」 (gamecenter-notes docs/whack-hell-20261106.md): five lives, no clock, every mole 10, no gold
// ones; every ten caught a stage faster (stay and spawn x0.93, bombs +1 %p, one more at once each four stages) down to a
// floor. The one formula for the screen (games/whack.js) and the server (lib/reflex.js: the least time n moles can take)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.WhackHell = api; // (also when a module imports it in Node: the screen's game reads the global)
}(typeof self !== 'undefined' ? self : globalThis, () => {
  'use strict';
  const LIVES = 5; const PER = 10; const POINTS = 10; const MAX = 200000; const K = 0.93;
  const START = Object.freeze({ stay: 1.35, spawn: 1.25, bomb: 0.05, up: 2 }); // (the 「쉬움」 start)
  const FLOOR = Object.freeze({ stay: 0.32, spawn: 0.22, bomb: 0.2, up: 5 }); // (seconds; the most bombs, the most up at once)
  const SPAWN = Object.freeze([0.35, 0.75]); const STAY = Object.freeze([0.7, 1.2]); const FIRST = 0.5; // (the first one's wait)
  const LOSE = Object.freeze({ miss: 1, bomb: 2 });
  const stageOf = (caught) => Math.floor(Math.max(0, caught) / PER);
  /** stage k's: the spawn and stay multipliers, the bomb share, how many may be up */
  const at = (k) => ({ spawn: START.spawn * K ** k, stay: START.stay * K ** k, bomb: Math.min(FLOOR.bomb, START.bomb + 0.01 * k), up: Math.min(FLOOR.up, START.up + Math.floor(k / 4)) });
  /** a spawn wait and a stay at stage k, u in [0,1) the roll (Math.random) -- never under the floor */
  const spawnWait = (k, u) => Math.max(FLOOR.spawn, (SPAWN[0] + (SPAWN[1] - SPAWN[0]) * u) * at(k).spawn);
  const stayFor = (k, u) => Math.max(FLOOR.stay, (STAY[0] + (STAY[1] - STAY[0]) * u) * at(k).stay);
  /** the least ms in which n moles can have come up: the first wait, then the shortest wait each (the mole before it caught,
   *  so its stage as fast as can be) */
  function minMs(n) {
    let s = n > 0 ? FIRST : 0;
    for (let i = 1; i < n; i += 1) s += spawnWait(stageOf(i), 0);
    return Math.floor(s * 1000);
  }
  // (더하기) the run of catches: a catch one more, a miss or a bomb back to none; each 10 in a row shouted (the score the same);
  // a bomb plainer the faster it gets (stage 5 its fuse flickering red, stage 10 a red glow round it); 3·2·1 before the first
  const COMBO_EVERY = 10; const COUNTDOWN = 3; const BOMB_FLICKER = 4; const BOMB_GLOW = 9; // (stage indexes: 단계 5, 단계 10)
  const combo = (run, what) => (what === 'hit' ? run + 1 : 0);
  const shout = (run) => run > 0 && run % COMBO_EVERY === 0;
  return Object.freeze({ LIVES, PER, POINTS, MAX, START, FLOOR, LOSE, stageOf, at, spawnWait, stayFor, minMs, COMBO_EVERY, COUNTDOWN, BOMB_FLICKER, BOMB_GLOW, combo, shout });
}));
