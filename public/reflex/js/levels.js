// 1:1 대결 게임의 AI 난이도 (랭킹도 난이도별로 따로 매긴다)
export const LEVELS = [
  { id: 'easy', name: '쉬움' },
  { id: 'normal', name: '보통' },
  { id: 'hard', name: '어려움' },
];
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const lvName = (id) => (id === 'online' ? '온라인' : LEVELS.find((l) => l.id === id)?.name || '보통'); // 'online': 1:1 대결의 온라인 랭킹 (예전에는 '보통'으로 보였다 — 정원 방문)
/** 게임별 난이도 표에서 현재 난이도 값 꺼내기 */
export const lvPick = (table, id) => table[id] || table.normal;
