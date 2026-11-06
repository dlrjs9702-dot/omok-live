// v1.10.250 기록의 탑 (gamecenter-notes docs/gamehall-ranking-board-20261103.md): the 14 solo games ranked, their board level
// (「보통」, or the nearest a game has), their week's title, and how a record reads -- shared by the server (lib's ranking API)
// and the page (the tower's faces and window)
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SoloRanking = api;
}(typeof self !== 'undefined' ? self : this, () => {
  'use strict';
  // id · 이름 · 높을수록 좋은가 · 난이도들 · 게시판 난이도 · 칭호 · 기록 단위 (public/reflex/js/util.js fmtScore와 같게) · 묶음
  const GAMES = [
    ['whack', '두더지 잡기', true, ['easy', 'normal', 'hard'], 'normal', '두더지 왕', 'pt', 'reflex'],
    ['reaction', '반응속도', false, ['normal'], 'normal', '번개 손', 'ms', 'reflex'],
    ['colorfind', '다른 색 찾기', true, ['easy', 'normal', 'hard'], 'normal', '매의 눈', 'round', 'reflex'],
    ['numbers', '숫자 터치', false, ['easy', 'normal', 'hard'], 'normal', '숫자 사냥꾼', 'sec', 'reflex'],
    ['rhythm', '비트 탭', true, ['easy', 'normal', 'hard'], 'normal', '리듬 천재', 'pt', 'reflex'],
    ['stairs', '하늘 계단', true, ['easy', 'normal', 'hard'], 'normal', '하늘 정복자', 'pt', 'reflex'],
    ['minesweeper', '지뢰찾기', false, ['beginner', 'intermediate', 'expert'], 'intermediate', '지뢰 탐정', 'time', 'puzzle'],
    ['sudoku', '스도쿠', false, ['easy', 'normal', 'hard'], 'normal', '스도쿠 박사', 'sec', 'puzzle'],
    ['nonogram', '네모로직', false, ['easy', 'normal', 'hard'], 'normal', '그림 퍼즐 장인', 'sec', 'puzzle'],
    ['hashi', '다리 잇기', false, ['easy', 'normal', 'hard'], 'normal', '다리 건축가', 'sec', 'puzzle'],
    ['circuit', '회로 연결', false, ['easy', 'normal', 'hard'], 'normal', '회로 마법사', 'sec', 'puzzle'],
    ['klondike', '카드놀이', false, ['easy', 'hard'], 'easy', '카드 정리왕', 'time', 'cards'],
    ['freecell', '프리셀', false, ['easy', 'hard'], 'easy', '프리셀 고수', 'time', 'cards'],
    ['spider', '스파이더', true, ['easy', 'normal', 'hard'], 'normal', '거미줄 마스터', 'pt', 'cards'],
  ].map(([id, name, higher, levels, board, title, unit, group]) => Object.freeze({ id, name, higher, levels, board, title, unit, group }));
  const BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
  // v1.10.251 the week's 1·2·3 a yard trophy (assets 98 yard_trophy_<sym>): each game its symbol; 「게임관의 별」 (three titles or
  // more in a week) the star, gold only
  const TROPHY = Object.freeze({ whack: 'mole', reaction: 'reaction', colorfind: 'color', numbers: 'numbers', rhythm: 'beat', stairs: 'sky', minesweeper: 'mines',
    sudoku: 'sudoku', nonogram: 'nonogram', hashi: 'bridges', circuit: 'circuit', klondike: 'klondike', freecell: 'freecell', spider: 'spider' });
  const STAR = Object.freeze({ id: 'gamestar', title: '게임관의 별', sym: 'star' });
  const METALS = Object.freeze(['gold', 'silver', 'bronze']); const METAL_KO = Object.freeze({ gold: '금', silver: '은', bronze: '동' });
  const trophyGood = (sym, metal) => `yard_trophy_${sym}__${metal}`;
  /** the week's name on a plate: its Monday's month and which week of it (2026-11-09 -> 2026년 11월 2주) */
  const weekLabel = (week) => { const [y, m, d] = String(week).split('-').map(Number); return `${y}년 ${m}월 ${Math.floor((d - 1) / 7) + 1}주`; };
  const LEVEL_NAMES = { easy: '쉬움', normal: '보통', hard: '어려움', beginner: '초급', intermediate: '중급', expert: '고급' };
  const CARD_LEVELS = { klondike: { easy: '1장 넘기기', hard: '3장 넘기기' }, freecell: { easy: '빈칸 4개', hard: '빈칸 3개' }, spider: { easy: '1벌', normal: '2벌', hard: '4벌' } };
  const levelName = (game, level) => CARD_LEVELS[game]?.[level] || LEVEL_NAMES[level] || level;

  /** a record as people read it (util.js fmtScore's units; points with thousands) */
  function format(game, v) {
    if (v == null) return '—';
    switch (BY_ID[game]?.unit) {
      case 'ms': return `${Math.round(v)}ms`;
      case 'sec': return `${(v / 1000).toFixed(1)}초`;
      case 'round': return `${v}라운드`;
      case 'time': { const t = Math.round(v / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
      default: return `${Number(v).toLocaleString('ko-KR')}점`;
    }
  }

  /** rows { userId, best, at } -> ranked: the better record first, a tie to who set it first, then the id; same record same
   *  place is not given (each a place of its own, as the board shows three) */
  function rank(game, rows) {
    const g = BY_ID[game]; const sign = g?.higher ? -1 : 1;
    return [...rows].sort((a, b) => sign * (a.best - b.best) || (a.at || 0) - (b.at || 0) || String(a.userId).localeCompare(String(b.userId)))
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }

  return Object.freeze({ GAMES, BY_ID, LEVEL_NAMES, levelName, format, rank, TROPHY, STAR, METALS, METAL_KO, trophyGood, weekLabel });
}));
