'use strict';

// v1.10.68 순발력 게임 (한판마당 자료, IDEAS 「자료 적용 결정」 ①): the five games run in the browser (public/reflex), so the
// score is the browser's word. The server opens each round (its id and start time) and keeps a finished round's record
// only when it took at least as long as the game can take and the score is one a person can make (G-포인트: no points).
const WhackHell = require('../public/whack-hell.js');
const LEVELS = Object.freeze({ easy: '쉬움', normal: '보통', hard: '어려움', hell: '헬' }); // (v1.10.255: 헬 -- 두더지 잡기 only)
const RUN_MS = 60 * 60 * 1000; // a round not reported within the hour is forgotten

// higher: a bigger score is better (else a smaller one: ms). minMs: the shortest a round can really last. min..max: the
// scores a person can make; `paid` is the least score that earns points (a round nobody played earns nothing).
const GAMES = Object.freeze({
  whack: Object.freeze({ name: '두더지 잡기', levels: true, higher: true, minMs: 15000, min: 0, max: 3000, paid: 100 }),
  reaction: Object.freeze({ name: '반응속도', levels: false, higher: false, minMs: 7000, min: 100, max: 5000 }),
  colorfind: Object.freeze({ name: '다른 색 찾기', levels: true, higher: true, minMs: 15000, min: 0, max: 400, paid: 5 }),
  numbers: Object.freeze({ name: '숫자 터치', levels: true, higher: false, minMs: 0, min: 0, max: 600000 }),
  rhythm: Object.freeze({ name: '비트 탭', levels: true, higher: true, minMs: 20000, min: 0, max: 60000, paid: 3000 }),
  // R7 하늘 계단 (IDEAS #future-stair-dash): steps climbed; paid from 30 steps; a person presses ten a second at most
  stairs: Object.freeze({ name: '하늘 계단', levels: true, higher: true, minMs: 0, min: 0, max: 5000, paid: 30 }),
  // H1 한판마당 자료 2 (08~11, each 점수.md): 숫자 밀기 the time (ms) from 「시작」 to solved -- no faster than SLIDE_MIN per size and never faster than
  // it says; 블록 퍼즐 points, 300 a second at most; 사과 게임 an apple a point (160 at most), 4 a second; 수박 만들기 (점수전) points, 60 a second
  slide: Object.freeze({ name: '숫자 밀기', levels: true, higher: false, minMs: 0, min: 2500, max: 3600000 }),
  blockpuzzle: Object.freeze({ name: '블록 퍼즐', levels: true, higher: true, minMs: 0, min: 0, max: 1000000, paid: 50 }),
  apple10: Object.freeze({ name: '사과 게임', levels: true, higher: true, minMs: 0, min: 0, max: 160, paid: 10 }),
  watermelon: Object.freeze({ name: '수박 만들기', levels: false, higher: true, minMs: 0, min: 0, max: 1000000, paid: 30 }),
});
const SLIDE_MIN = Object.freeze({ easy: 2500, normal: 9000, hard: 25000 }); // (08 점수.md: 3x3 · 4x4 · 5x5)
const RATE = Object.freeze({ blockpuzzle: 300, apple10: 4, watermelon: 60 }); // the most points a second (each 점수.md)
const STAIRS_STEP_MS = 100; // the least time a step can take (the round lasts at least steps x this)
const NUMBERS = Object.freeze({ easy: { n: 16, preview: 5 }, normal: { n: 25, preview: 4 }, hard: { n: 36, preview: 3 } });

function levelOf(game, level) {
  if (!GAMES[game]) return null;
  if (!GAMES[game].levels) return 'normal';
  if (level === 'hell') return game === 'whack' ? 'hell' : null;
  return Object.hasOwn(LEVELS, level) ? level : null;
}

// 'ok' | why it is not paid ('fast': sooner than the game allows, 'score': no person makes it, 'low': too little played)
function judge(game, level, score, elapsedMs) {
  const g = GAMES[game];
  if (game === 'whack' && level === 'hell') { // (v1.10.255) no clock: 10 a mole, and no sooner than that many can come up
    if (!Number.isSafeInteger(score) || score < 0 || score > WhackHell.MAX || score % WhackHell.POINTS) return 'score';
    if (elapsedMs < WhackHell.minMs(score / WhackHell.POINTS)) return 'fast';
    return score < g.paid ? 'low' : 'ok';
  }
  if (!Number.isSafeInteger(score) || score < g.min || score > g.max) return 'score';
  let minMs = g.minMs;
  if (game === 'numbers') { // the time is the score (with 1 s added per wrong tap, never lived through): no faster than
    // 0.1 s a number, after the preview (Codex review: the penalty is not real time)
    const L = NUMBERS[level];
    if (score < L.n * 100) return 'score';
    minMs = L.preview * 1000 + L.n * 100;
  }
  if (game === 'stairs') minMs = score * STAIRS_STEP_MS;
  if (game === 'slide') { if (score < SLIDE_MIN[level]) return 'score'; minMs = score; } // (a solve takes at least the time it reports)
  if (RATE[game]) minMs = Math.ceil((score * 1000) / RATE[game]);
  if (elapsedMs < minMs) return 'fast';
  if (g.higher && score < g.paid) return 'low'; // reaction and numbers are only reported once finished
  return 'ok';
}

module.exports = { LEVELS, RUN_MS, GAMES, levelOf, judge };
