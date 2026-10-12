'use strict';

// v1.10.68 순발력 게임 (한판마당 자료, IDEAS 「자료 적용 결정」 ①): the five games run in the browser (public/reflex), so the
// score is the browser's word. The server opens each round (its id and start time) and pays a finished round only when
// it took at least as long as the game can take, the score is one a person can make, and the day's cap is not reached.
const LEVELS = Object.freeze({ easy: '쉬움', normal: '보통', hard: '어려움' });
const POINTS = Object.freeze({ easy: 1000, normal: 1500, hard: 2000 }); // a finished round, by level
const DAILY_CAP = 20000; // all five games together, per account and Seoul day
const RUN_MS = 60 * 60 * 1000; // a round not reported within the hour is forgotten

// higher: a bigger score is better (else a smaller one: ms). minMs: the shortest a round can really last. min..max: the
// scores a person can make; `paid` is the least score that earns points (a round nobody played earns nothing).
const GAMES = Object.freeze({
  whack: Object.freeze({ name: '두더지 잡기', levels: true, higher: true, minMs: 15000, min: 0, max: 3000, paid: 100 }),
  reaction: Object.freeze({ name: '반응속도', levels: false, higher: false, minMs: 7000, min: 100, max: 5000 }),
  colorfind: Object.freeze({ name: '다른 색 찾기', levels: true, higher: true, minMs: 15000, min: 0, max: 400, paid: 5 }),
  numbers: Object.freeze({ name: '숫자 터치', levels: true, higher: false, minMs: 0, min: 0, max: 600000 }),
  rhythm: Object.freeze({ name: '비트 탭', levels: true, higher: true, minMs: 20000, min: 0, max: 60000, paid: 3000 }),
});
const NUMBERS = Object.freeze({ easy: { n: 16, preview: 5 }, normal: { n: 25, preview: 4 }, hard: { n: 36, preview: 3 } });

function levelOf(game, level) {
  if (!GAMES[game]) return null;
  if (!GAMES[game].levels) return 'normal';
  return Object.hasOwn(LEVELS, level) ? level : null;
}

// 'ok' | why it is not paid ('fast': sooner than the game allows, 'score': no person makes it, 'low': too little played)
function judge(game, level, score, elapsedMs) {
  const g = GAMES[game];
  if (!Number.isSafeInteger(score) || score < g.min || score > g.max) return 'score';
  let minMs = g.minMs;
  if (game === 'numbers') { // the time is the score (with 1 s added per wrong tap, never lived through): no faster than
    // 0.1 s a number, after the preview (Codex review: the penalty is not real time)
    const L = NUMBERS[level];
    if (score < L.n * 100) return 'score';
    minMs = L.preview * 1000 + L.n * 100;
  }
  if (elapsedMs < minMs) return 'fast';
  if (g.higher && score < g.paid) return 'low'; // reaction and numbers are only reported once finished
  return 'ok';
}

module.exports = { LEVELS, POINTS, DAILY_CAP, RUN_MS, GAMES, levelOf, judge };
