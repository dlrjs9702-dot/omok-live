'use strict';
// 1.10.341 지하 도박장 (notes docs/underground-den-20261116.md; 사용자 113C·115A·116A·117B·118·119B·121A·122A·123A, 140A·141A·142A;
// review-plan §1-5~7): under the stock exchange, four games played with chips (테드 changes points to chips and back, one for one),
// one play at most 5,000 chips, the house keeping about 5 % on average (gone). The day's password, on a note hidden on a bench.
// A raid: only while someone is below, about once in 40 minutes of someone's stay, 6 a day at most -- the 관공서 shut, its four
// walking over; 10~15 s before they come down a hint below (lights, 테드's cough); whoever is below then (or comes down while they
// search): every chip held taken, the 구치소 till midnight unless the gambling essay is passed. Pure here; the server keeps state.
const crypto = require('node:crypto');

const BET_MAX = 5000; const BET_MIN = 1; const CHIPS_MAX = 10_000_000;
const RAID = Object.freeze({ tick: 5000, meanMs: 40 * 60000, perDay: 6, hint: 12000, search: 20000, walkSpeed: 1.6 });

// ---- the games: (rand) -> outcome; settle(bet, pick, outcome) -> chips back (the stake included; 0 lost) ----
const ri = (rand, n) => Math.min(n - 1, Math.floor(rand() * n));
const DICE_PICKS = Object.freeze(['big', 'small', 'odd', 'even']); const DICE_BACK = 1.96; // (a triple loses all four: 4.7 %)
const dice = (rand) => { const d = [1 + ri(rand, 6), 1 + ri(rand, 6), 1 + ri(rand, 6)]; return { dice: d, sum: d[0] + d[1] + d[2], triple: d[0] === d[1] && d[1] === d[2] }; };
const diceWins = (pick, o) => !o.triple && ({ big: o.sum >= 11, small: o.sum <= 10, odd: o.sum % 2 === 1, even: o.sum % 2 === 0 })[pick] === true;
// card hi-lo: a card shown (1..13), the next drawn (1..13); higher or lower -- the same loses; paid 0.95 over its chance
const HILO_PICKS = Object.freeze(['high', 'low']);
const hiloChance = (shown, pick) => (pick === 'high' ? (13 - shown) / 13 : (shown - 1) / 13);
const hiloBack = (shown, pick) => { const p = hiloChance(shown, pick); return p > 0 ? Math.floor((0.95 / p) * 100) / 100 : 0; };
const hiloWins = (pick, shown, next) => (pick === 'high' ? next > shown : next < shown);
// roulette: 19 places, 0 green, 1..18 red (odd) and black (even) -- an even-chance bet 2x, a number 18x (5.3 %)
const ROULETTE_N = 19;
const RED = (n) => n > 0 && n % 2 === 1;
const ROULETTE_PICKS = Object.freeze(['red', 'black', 'odd', 'even', 'low', 'high']);
const rouletteWins = (pick, n) => (typeof pick === 'number' ? n === pick : n > 0 && ({ red: RED(n), black: !RED(n), odd: n % 2 === 1, even: n % 2 === 0, low: n <= 9, high: n >= 10 })[pick] === true);
const rouletteBack = (pick) => (typeof pick === 'number' ? 18 : 2);
// slots: three reels of six (0 seven, 1 cherry, 2 bell, 3 bar, 4 star, 5 lemon -- assets 147 README)
const SYMBOLS = Object.freeze(['세븐', '체리', '종', '바', '별', '레몬']);
const TRIPLE = Object.freeze([43, 15, 12, 10, 8, 5]);
function slotsBack(r) {
  if (r[0] === r[1] && r[1] === r[2]) return TRIPLE[r[0]];
  const cherries = r.filter((s) => s === 1).length;
  return cherries === 2 ? 2.5 : cherries === 1 ? 1 : 0;
}
const GAMES = Object.freeze(['dice', 'hilo', 'roulette', 'slots']);

// one play: { game, bet, pick, shown? (hilo: the card the table shows -- dealt before) } -> { error } | { outcome, back }
function play({ game, bet, pick, shown }, rand) {
  if (!GAMES.includes(game)) return { error: 'GAME' };
  if (!Number.isSafeInteger(bet) || bet < BET_MIN || bet > BET_MAX) return { error: 'BET' };
  if (game === 'dice') { if (!DICE_PICKS.includes(pick)) return { error: 'PICK' }; const o = dice(rand); return { outcome: o, back: diceWins(pick, o) ? Math.floor(bet * DICE_BACK) : 0 }; }
  if (game === 'hilo') {
    if (!HILO_PICKS.includes(pick) || !Number.isInteger(shown) || shown < 1 || shown > 13 || hiloChance(shown, pick) <= 0) return { error: 'PICK' };
    const next = 1 + ri(rand, 13); return { outcome: { shown, next }, back: hiloWins(pick, shown, next) ? Math.floor(bet * hiloBack(shown, pick)) : 0 };
  }
  if (game === 'roulette') {
    const p = typeof pick === 'number' || /^\d+$/.test(String(pick)) ? Number(pick) : pick;
    if (!(ROULETTE_PICKS.includes(p) || (Number.isInteger(p) && p >= 0 && p < ROULETTE_N))) return { error: 'PICK' };
    const n = ri(rand, ROULETTE_N); return { outcome: { n, red: RED(n) }, back: rouletteWins(p, n) ? bet * rouletteBack(p) : 0 };
  }
  const reels = [ri(rand, 6), ri(rand, 6), ri(rand, 6)]; return { outcome: { reels }, back: Math.floor(bet * slotsBack(reels)) };
}
// the exact return of each bet (tests: the house keeps about 5 %)
function expected(game, pick, shown = 7) {
  if (game === 'dice') { let n = 0; for (let a = 1; a <= 6; a += 1) for (let b = 1; b <= 6; b += 1) for (let c = 1; c <= 6; c += 1) { const o = { sum: a + b + c, triple: a === b && b === c }; if (diceWins(pick, o)) n += DICE_BACK; } return n / 216; }
  if (game === 'hilo') return hiloChance(shown, pick) * hiloBack(shown, pick);
  if (game === 'roulette') { let n = 0; for (let k = 0; k < ROULETTE_N; k += 1) if (rouletteWins(pick, k)) n += rouletteBack(pick); return n / ROULETTE_N; }
  let n = 0; for (let a = 0; a < 6; a += 1) for (let b = 0; b < 6; b += 1) for (let c = 0; c < 6; c += 1) n += slotsBack([a, b, c]); return n / 216;
}

// ---- the day's password and where its note is: from the server's own key, the Seoul day ----
const WORDS = Object.freeze(['달빛 재즈', '젖은 우산', '레몬 사탕', '검은 고양이', '빗소리', '늦은 기차', '푸른 등대', '낡은 축음기', '금빛 단추', '안개 낀 부두', '마지막 춤', '녹슨 열쇠', '은빛 동전', '밤의 피아노', '붉은 우체통', '조용한 골목']);
const hmac = (key, ...parts) => crypto.createHmac('sha256', String(key)).update(parts.join('|')).digest();
const wordOf = (key, day) => WORDS[hmac(key, 'den-word', day).readUInt32BE(0) % WORDS.length];
const noteSpot = (key, day, spots) => (spots.length ? spots[hmac(key, 'den-note', day).readUInt32BE(0) % spots.length] : null);
const sameWord = (a, b) => String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, '');

// ---- a raid: the chance a tick, its times from its start ----
const raidChance = (tickMs = RAID.tick, meanMs = RAID.meanMs) => 1 - Math.exp(-tickMs / meanMs);
// { start, arrive, hintAt, searchEnd, end } from the start and the walk's length (m) -- the four there and back
function raidTimes(start, walkM, speed = RAID.walkSpeed) {
  const walk = Math.round((walkM / speed) * 1000); const arrive = start + walk; const searchEnd = arrive + RAID.search;
  return { start, arrive, hintAt: arrive - RAID.hint, searchEnd, end: searchEnd + walk, walk };
}
const raidPhase = (r, now) => (!r || now >= r.end ? null : now < r.arrive ? 'walk' : now < r.searchEnd ? 'search' : 'back');

module.exports = { BET_MAX, BET_MIN, CHIPS_MAX, RAID, GAMES, DICE_PICKS, DICE_BACK, HILO_PICKS, ROULETTE_N, ROULETTE_PICKS, SYMBOLS, TRIPLE, RED, hiloBack, hiloChance, slotsBack, play, expected, WORDS, wordOf, noteSpot, sameWord, raidChance, raidTimes, raidPhase };
