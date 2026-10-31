// v1.10.215 주민 근무표 (gamecenter-notes docs/resident-roster-20261027.md 확정 표, 사용자 「모두가 섬 사람, 돌아가며 근무를
// 설 뿐」): who stands at each post on a Seoul date -- the same for everyone, from the date alone (the server and the screen
// count it alike). Each post has its own people (island-cast RESIDENTS numbers); a day, one of them; one person works at
// most 4 days a Monday-to-Sunday week and not more than 3 days running at the same post; a festival's host is off its
// days. The 관공서's three: two at their desks, one resting (in turn). The station: 철이, on Sundays 반디. Always the same:
// 마루 at the 관공서 gate, 김우성 at the jail, 느티 at the 정자, 한들 at the field. 기록관 (한결·하람·이솔) waits for its
// building: they walk.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./island-calendar') : root.IslandCalendar);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandRoster = api;
}(typeof self !== 'undefined' ? self : this, (Calendar) => {
  const POSTS = Object.freeze([
    Object.freeze({ id: 'mall1', name: '백화점 1층 잡화·생활', who: Object.freeze([11, 6, 3]) }), // 물결 · 다온 · 두리
    Object.freeze({ id: 'mall2', name: '백화점 2층 옷·꾸미기', who: Object.freeze([12, 15, 17]) }), // 빛나 · 고은 · 가락
    Object.freeze({ id: 'mall3', name: '백화점 3층 가구', who: Object.freeze([19, 1]) }), // 바위 · 해송
    Object.freeze({ id: 'roof', name: '백화점 옥상 펫샵', who: Object.freeze([10, 0, 9]) }), // 꽃님 · 봄이 · 가람
    Object.freeze({ id: 'plaza', name: '광장 출석·안내', who: Object.freeze([4, 7, 5]) }), // 노을 · 바람이 · 누리
  ]);
  const CIVIL = Object.freeze([24, 25, 26]); // 단비 (민원) · 한솔 (세금) · 새롬 (은행)
  const FIXED = Object.freeze({ gate: 23, jail: 22, pavilion: 21, farm: 13 }); // 마루 · 김우성 · 느티 · 한들
  const HOSTS = Object.freeze({ harvest: 13, christmas: 7, countdown: 8 }); // (a festival's host by its id: 한들, 바람이, 이솔)
  const MAX_WEEK = 4; const MAX_RUN = 3; const EPOCH = '2026-10-26'; // (a Monday: the table counted on from it)
  const dayNum = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000);
  const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sunday
  const hosting = (n, day) => (Calendar?.FESTIVALS || []).some((f) => HOSTS[f.id.split('-')[0]] === n && day >= f.start && day <= f.end);
  // a fixed shuffle for the ties: the same everywhere
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  // the rotating posts, day by day from EPOCH (kept: a day is counted once)
  const days = new Map(); let last = null; // last: { day, at: { post: n }, run: { post: k }, week: { n: count } }
  function step(prev, day) {
    const monday = weekday(day) === 1; const at = {}; const run = {}; const week = monday || !prev ? {} : { ...prev.week };
    for (const p of POSTS) {
      const free = p.who.filter((n) => !hosting(n, day));
      const ok = (n, relax) => (relax > 1 || (week[n] || 0) < MAX_WEEK) && (relax > 0 || !(prev?.at[p.id] === n && prev.run[p.id] >= MAX_RUN));
      let pick = null;
      for (let relax = 0; relax < 3 && pick == null; relax += 1) { // (a post never empty: the rules eased only when its people cannot keep them)
        const can = free.filter((n) => ok(n, relax));
        if (can.length) pick = can.sort((a, b) => (week[a] || 0) - (week[b] || 0) || hash(`${day}:${p.id}:${a}`) - hash(`${day}:${p.id}:${b}`))[0];
      }
      if (pick == null) pick = p.who[0];
      at[p.id] = pick; run[p.id] = prev?.at[p.id] === pick ? prev.run[p.id] + 1 : 1; week[pick] = (week[pick] || 0) + 1;
    }
    return { day, at, run, week };
  }
  function rotating(day) {
    if (days.has(day)) return days.get(day);
    if (day < EPOCH) return step(null, day); // (before the table: a day on its own)
    let s = last && last.day < day ? last : null; let d = s ? Calendar.addDays(s.day, 1) : EPOCH;
    for (; d <= day; d = Calendar.addDays(d, 1)) { s = days.get(d) || step(s, d); days.set(d, s); }
    if (!last || s.day > last.day) last = s;
    return s;
  }
  // the day's table -> { day, posts: { mall1..plaza: n, civil: [n, n], station: n, gate, jail, pavilion, farm }, resting: n, off: [n] }
  function rosterOf(day) {
    const r = rotating(day); const rest = CIVIL[((dayNum(day) % 3) + 3) % 3];
    const posts = { ...r.at, civil: CIVIL.filter((n) => n !== rest), station: weekday(day) === 0 ? 18 : 16, ...FIXED };
    return { day, posts, resting: rest };
  }
  // where islander n works on `day`: a post id, or null (walking)
  function postOf(n, day) { const { posts } = rosterOf(day); for (const [id, w] of Object.entries(posts)) if (w === n || (Array.isArray(w) && w.includes(n))) return id; return null; }
  // C1 (총괄 2026-10-31 ②): a rotating post's islander is talked to at its counter that day -- a walker does not walk, a story
  // islander's 부탁 is taken there too
  const POST_IDS = POSTS.map((p) => p.id);
  const counterOf = (n, day) => { const p = postOf(n, day); return POST_IDS.includes(p) ? p : null; };
  // C1 ③: the 관공서's desks by their islander; the resting one's work taken at the desk beside it
  const DESK = Object.freeze({ 24: 'civil', 25: 'tax', 26: 'bank' }); const COVER = Object.freeze({ civil: 'tax', tax: 'bank', bank: 'tax' });
  const deskRest = (day) => { const rest = DESK[rosterOf(day).resting]; return { rest, by: COVER[rest] }; };
  // C2 (v1.10.216): who walks the island that day -- everyone not at a post (the resting clerk too, 철이 on a Sunday);
  // 콩이 in October at his Halloween spot
  const walks = (n, day) => postOf(n, day) == null && !(n === 14 && day.slice(5, 7) === '10');
  return { POSTS, CIVIL, FIXED, HOSTS, MAX_WEEK, MAX_RUN, DESK, COVER, rosterOf, postOf, counterOf, deskRest, walks };
}));
