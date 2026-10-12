// 논리 퍼즐 공용 (화면과 무관한 순수 함수) — 스도쿠 · 네모로직 · 다리 잇기 · 회로 연결
// 같은 시드면 어느 기기에서나 같은 문제가 나오도록 Math.random 대신 시드 난수를 쓴다.

/** 시드 난수 (mulberry32) — 0 이상 1 미만 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 글자열 → 32비트 시드 (FNV-1a) */
export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
export const randInt = (rnd, n) => Math.floor(rnd() * n);
export function shuffled(rnd, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = randInt(rnd, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** 한국 날짜 'YYYY-MM-DD' (오늘의 문제는 모두 한국 날짜 기준 — 랭킹 주간과 같은 기준) */
export const kstDate = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
/** 2026-01-01부터 며칠째인지 (그림 문제를 날마다 돌려 쓸 때) */
export const dayIndex = (date) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse('2026-01-01T00:00:00Z')) / 864e5);
/** 오늘의 문제 시드: 게임 · 난이도 · 날짜가 같으면 같은 문제 */
export const dailySeed = (game, level, date) => hashStr(`${game}|${level}|${date}`);
/** 오늘의 문제 생성 규칙 버전 [버전, 시작 날짜] — 생성 코드 · 예비 문제(pz-bank.js) · 네모로직 그림 순서를 바꾸면
 *  새 버전을 '내일 이후 날짜'부터로 더한다 (같은 날은 오전 앱 · 오후 앱 모두 같은 문제). 서버는 지원하는 버전만 확인한다 (server/pzdaily.js) */
export const PZ_VERSIONS = [[1, '2026-01-01']];
export const pzVersion = (date) => PZ_VERSIONS.reduce((v, [n, from]) => (date >= from ? n : v), PZ_VERSIONS[0][0]);
/** 문제 식별자: 게임 · 난이도 · 날짜 · 생성 규칙 버전 (진행 저장 · 문제 저장본이 다른 문제에 쓰이지 않게) */
export const puzzleId = (game, level, date) => `${game}.${level}.${date}.v${pzVersion(date)}`;
/** 오늘의 문제 기록으로 낼 수 있는 날짜인지 (서버 econ.js pzDateOk와 같은 규칙: 끝낸 날 또는 시작한 날 · 시계 차이 10분) */
export const pzDateOk = (date, endMs, scoreMs) => date === kstDate(endMs) || date === kstDate(endMs - scoreMs - 10 * 60e3);
