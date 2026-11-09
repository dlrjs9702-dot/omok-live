// v1.10.278 주민 내기 (gamecenter-notes docs/resident-bets-design-20261025.md, 「2026-11-08 갱신」 first): an islander off duty
// asks for a bet -- a score game (the browser's game, the server's reflex check) or a match (an AI room in their name); a light
// stake; won: twice back, a draw (a match): back, lost or left: gone. Who likes which games and how well, the day's game, the
// targets, the stakes one may pick, what a result pays. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandBets = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const NAMES = Object.freeze({ whack: '두더지 잡기', reaction: '반응속도', colorfind: '다른 색 찾기', numbers: '숫자 터치', rhythm: '비트 탭', stairs: '하늘 계단', omok: '오목', connect4: '사목', othello: '오델로' });
  const MATCH = Object.freeze(['omok', 'connect4', 'othello']); // (lib/room-ai.js GAMES: the server plays the islander's seat)
  // a score game: its level (reflex's), whether more is better, the islander's mark by skill (theirs to beat; a time: under it).
  // ponytail: first guesses from lib/reflex.js's ranges -- set them by the real records' spread after a week of bets
  const SCORE = Object.freeze({
    whack: Object.freeze({ level: 'normal', higher: true, target: Object.freeze({ easy: 900, normal: 1500, hard: 2100 }) }),
    colorfind: Object.freeze({ level: 'normal', higher: true, target: Object.freeze({ easy: 12, normal: 20, hard: 28 }) }),
    rhythm: Object.freeze({ level: 'normal', higher: true, target: Object.freeze({ easy: 8000, normal: 14000, hard: 22000 }) }),
    stairs: Object.freeze({ level: 'normal', higher: true, target: Object.freeze({ easy: 40, normal: 80, hard: 130 }) }),
    reaction: Object.freeze({ level: 'normal', higher: false, target: Object.freeze({ easy: 450, normal: 340, hard: 270 }) }),
    numbers: Object.freeze({ level: 'normal', higher: false, target: Object.freeze({ easy: 35000, normal: 25000, hard: 18000 }) }),
  });
  // the 27 (island-cast RESIDENTS): two games each -- score and match mixed over the island -- how well, and the face when they
  // lose (a calm one shrugs, a child cries, the rest facepalm)
  const P = (games, skill, lose = 'facepalm') => Object.freeze({ games: Object.freeze(games), skill, lose });
  const PROFILES = Object.freeze([
    P(['colorfind', 'connect4'], 'normal'), P(['omok', 'reaction'], 'hard', 'shrug'), P(['numbers', 'othello'], 'normal'), P(['rhythm', 'whack'], 'easy'),
    P(['othello', 'colorfind'], 'easy', 'shrug'), P(['numbers', 'omok'], 'hard'), P(['whack', 'stairs'], 'normal'), P(['stairs', 'reaction'], 'normal'),
    P(['colorfind', 'othello'], 'hard'), P(['whack', 'stairs'], 'easy', 'cry'), P(['omok', 'colorfind'], 'normal', 'shrug'), P(['reaction', 'connect4'], 'normal'),
    P(['colorfind', 'rhythm'], 'normal'), P(['whack', 'connect4'], 'easy'), P(['stairs', 'rhythm'], 'easy', 'cry'), P(['colorfind', 'numbers'], 'normal', 'shrug'),
    P(['reaction', 'othello'], 'normal'), P(['rhythm', 'stairs'], 'hard'), P(['reaction', 'numbers'], 'normal'), P(['whack', 'connect4'], 'normal'),
    P(['numbers', 'othello'], 'hard', 'shrug'), P(['omok', 'othello'], 'hard', 'shrug'), P(['connect4', 'reaction'], 'normal'), P(['omok', 'whack'], 'normal'),
    P(['numbers', 'colorfind'], 'easy'), P(['numbers', 'connect4'], 'normal'), P(['othello', 'rhythm'], 'easy'),
    P(['colorfind', 'reaction'], 'normal'), /* 27 다래 */
  ]);
  const STAKES = Object.freeze([1000, 5000, 10000]);
  const LIMITS = Object.freeze({ dailyWinMax: 30000, scoreStakeMax: 5000, stakeMax: 10000 }); // (the economy table's defaults: bet:*)
  const HOLD_MS = 10 * 60 * 1000; // (an islander held while a bet runs -- let go when it ends or after this)
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const profileOf = (n) => PROFILES[n] || null;
  // the day's game of islander n (the same all day, on every screen): one of the two they like
  function gameOf(n, day) { const p = profileOf(n); return p ? p.games[hash(`${day}|${n}`) % p.games.length] : null; }
  const kindOf = (game) => (MATCH.includes(game) ? 'match' : SCORE[game] ? 'score' : null);
  // v1.10.291 내기 목표를 기록의 탑에서 (사용자 「680이 최고인데 1500이라고 주장해」, notes docs/bet-targets-real-20261109.md): the
  // marks from the game's all-time 1st at its bet level -- more is better: x 0.9 / 0.75 / 0.55 (hard / normal / easy); a time:
  // divided by them; fewer than 3 recorders: the table's easy is the base; never harder than the table; to 10 (under 100: to 1).
  // The server works them out once a Seoul day (`goals`), and a bet keeps the mark it started with.
  const SKILL = Object.freeze({ hard: 0.9, normal: 0.75, easy: 0.55 });
  function goalsOf(game, best = null, recorders = 0) {
    const g = SCORE[game]; if (!g) return null;
    const base = recorders >= 3 && Number.isFinite(best) && best > 0 ? best : g.target.easy;
    const nice = (v) => (v >= 100 ? Math.round(v / 10) * 10 : Math.round(v));
    const out = {}; for (const [skill, f] of Object.entries(SKILL)) { const v = nice(g.higher ? base * f : base / f); out[skill] = g.higher ? Math.min(v, g.target[skill]) : Math.max(v, g.target[skill]); }
    return Object.freeze(out);
  }
  function targetOf(game, skill, goals = null) { return goals?.[skill] ?? SCORE[game]?.target[skill] ?? null; }
  // what my score did against the mark (a time: under it wins) -- `t` the bet's own mark
  function beat(game, skill, score, t = targetOf(game, skill)) { const g = SCORE[game]; if (!g || t == null || !Number.isFinite(score)) return false; return g.higher ? score > t : score < t; }
  // the stakes I may pick: those under the game's cap that I can pay; none once today's winnings reached the cap (a game for fun)
  function stakesFor(game, balance, wonToday = 0, limits = LIMITS) {
    if (wonToday >= limits.dailyWinMax) return [];
    const cap = kindOf(game) === 'score' ? Math.min(limits.scoreStakeMax, limits.stakeMax) : limits.stakeMax;
    return STAKES.filter((s) => s <= cap && s <= balance);
  }
  // what a result pays back (the stake was taken first): won -- twice, its winnings no more than today's room under the cap;
  // a draw -- the stake; lost -- nothing. `net`: what it adds to today's winnings.
  function payout(stake, result, wonToday = 0, limits = LIMITS) {
    if (!stake) return { pay: 0, net: 0 };
    if (result === 'draw') return { pay: stake, net: 0 };
    if (result !== 'win') return { pay: 0, net: 0 };
    const net = Math.max(0, Math.min(stake, limits.dailyWinMax - wonToday)); return { pay: stake + net, net };
  }
  // the islander's words (총괄's story/resident-bet-lines file, each in their own voice, comes over these by key; {game} {rule} {me})
  const LINES = Object.freeze({ offer: Object.freeze(['심심한데 내기 한 판 할래?', '{game} 한 판 어때? 가볍게 걸고.']), pick: '{game}(으)로 하자. {rule}',
    win: '내가 이겼다! 다음에 또 하자.', lose: '졌다… {me}님 잘하는구나.', draw: '비겼네. 판돈은 돌려줄게.', revenge: '어제는 졌지만 오늘은 복수전이야!',
    busy: '지금 근무 중이라, 쉬는 날 한 판 해요!', fun: '오늘은 네가 너무 잘한다, 재미로만 하자.' });
  const UNIT = Object.freeze({ whack: '점', colorfind: '개', rhythm: '점', stairs: '칸' });
  const shown = (game, v) => (game === 'reaction' ? `${v}ms` : game === 'numbers' ? `${Math.round(v / 100) / 10}초` : `${v.toLocaleString('ko-KR')}${UNIT[game] || '점'}`);
  function rule(game, skill, t = targetOf(game, skill)) {
    if (t == null) return '나 꽤 둬.';
    if (game === 'reaction' || game === 'numbers') return `난 아까 ${shown(game, t)} ${game === 'reaction' ? '나왔어' : '걸렸어'}. 더 빠르면 네가 이겨.`;
    return `난 아까 ${shown(game, t)} 냈어. 넘으면 네가 이겨.`;
  }
  // (v1.10.291: the bet window's 「역대 최고 680점 · 나는 610점」 -- what the mark stands on)
  function recordLine(game, best, t) { if (!SCORE[game] || t == null) return ''; return `${Number.isFinite(best) ? `역대 최고 ${shown(game, best)} · ` : ''}나는 ${shown(game, t)}`; }
  // a line of islander n: theirs from `own` (the lines file: { [n]: { key: text | [texts] } }) or the default; k picks among several
  function lineOf(n, key, vals = {}, own = null, k = 0) {
    const src = own?.[n]?.[key] ?? LINES[key]; const s = Array.isArray(src) ? src[Math.abs(k) % src.length] : src || '';
    return s.replace(/\{(\w+)\}/g, (m, name) => (vals[name] != null ? String(vals[name]) : ''));
  }
  // the islander's face (assets 263·264 emotes) at each moment of a bet; their win: their photo pose's (island-cast photoPose)
  const EMOTE = Object.freeze({ offer: 'wave', pick: 'think', draw: 'nod', revenge: 'angry' });
  return Object.freeze({ NAMES, MATCH, SCORE, PROFILES, STAKES, LIMITS, HOLD_MS, LINES, EMOTE, profileOf, gameOf, kindOf, SKILL, goalsOf, targetOf, beat, stakesFor, payout, rule, recordLine, lineOf });
}));
