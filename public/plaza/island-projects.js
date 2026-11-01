// v1.10.222 섬 가꾸기 사업 (gamecenter-notes docs/spending-sinks-20261025.md ①, 222~224 나누기 총괄 2026-11-01): the island's
// shared works, one at a time -- its goal filled by everyone's 기부 (the points gone, as before); filled, that Seoul day its
// works (the fence and the sign, 바위 by it), the next day open, a plaque before it with who gave. 222: the order fixed
// (the fountain, then the flower path); while none is filling (a works day, after the last) the gifts are saved for the next,
// and so is what overflows a goal. Pure -- the server keeps the state (worldValue 'projects'), the page draws it; where each
// one stands is here too. Browser and server.
(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./island-terrain') : root.IslandTerrain);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandProjects = api;
}(typeof self !== 'undefined' ? self : this, (Terrain) => {
  const PROJECTS = Object.freeze([
    Object.freeze({ id: 'fountain', name: '대청마당 분수 새 단장', short: '분수', thing: '분수', goal: 1000000 }),
    Object.freeze({ id: 'flower_path', name: '벚꽃 꽃길', short: '꽃길', thing: '꽃길', goal: 1500000 }),
  ]);
  const ORDER = Object.freeze(PROJECTS.map((p) => p.id)); // (223: the next chosen by a vote)
  const byId = (id) => PROJECTS.find((p) => p.id === id) || null;
  const fresh = () => ({ cur: ORDER[0], raised: 0, donors: {}, saved: 0, works: null, open: [] });
  const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const ranked = (donors) => Object.values(donors || {}).sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name)));
  const clone = (s) => JSON.parse(JSON.stringify(s || fresh()));
  function fill(s, day, goalOf) { // (the savings poured in; a goal reached: that day's works)
    if (!s.cur) return;
    const part = Math.min(s.saved, Math.max(0, goalOf(s.cur) - s.raised)); s.raised += part; s.saved -= part;
    if (s.raised >= goalOf(s.cur)) { s.works = { id: s.cur, day, donors: s.donors }; s.cur = null; s.raised = 0; s.donors = {}; }
  }
  // the state as of `day` (a Seoul date): yesterday's works open, the next in order begun with the savings
  function roll(state, day, goalOf) {
    const s = clone(state);
    if (s.works && s.works.day < day) {
      const list = ranked(s.works.donors);
      s.open.push({ id: s.works.id, day: nextDay(s.works.day), top: list.slice(0, 3).map((d) => d.name), names: list.map((d) => d.name) });
      s.works = null;
    }
    if (!s.cur && !s.works) { const next = ORDER.find((id) => !s.open.some((o) => o.id === id)); if (next) { s.cur = next; s.raised = 0; s.donors = {}; } }
    fill(s, day, goalOf);
    return s;
  }
  // a 기부 of `amount` by userId (their game name): into the one filling, the rest (or all, with none) saved for the next
  function give(state, { userId, name, amount }, day, goalOf) {
    const s = roll(state, day, goalOf);
    if (!s.cur) { s.saved += amount; return s; }
    const part = Math.min(amount, goalOf(s.cur) - s.raised); s.raised += part; s.saved += amount - part;
    const d = (s.donors[userId] ||= { name: name || '섬 사람', total: 0 }); d.name = name || d.name; d.total += part;
    fill(s, day, goalOf);
    return s;
  }
  // what everyone sees (and mine: what I gave to the one filling)
  function view(s, goalOf, userId = null) {
    const p = s.cur && byId(s.cur);
    return { cur: p ? { id: p.id, name: p.name, goal: goalOf(p.id), raised: s.raised, mine: (userId && s.donors[userId]?.total) || 0 } : null,
      saved: s.saved, works: s.works ? { id: s.works.id, name: byId(s.works.id)?.name || s.works.id, day: s.works.day } : null,
      open: s.open.map((o) => ({ id: o.id, name: byId(o.id)?.name || o.id, day: o.day, top: o.top })) };
  }

  // -- where they stand -------------------------------------------------------------------------------------------------
  const C = Terrain.PLAZA_C || { x: 0, z: -84 };
  // the flower path: 대청마당's north-east road toward the east river (walk 9), planters both sides of it every 4.5 m, its
  // last 7 m left clear (the 224 bridge's way on), clear of the walk itself
  const road = (Terrain.walkCurves || []).find((w) => Math.hypot(w.pts[0][0] - 44, w.pts[0][1] + 86) < 3) || null;
  const PLANTERS = (() => {
    if (!road) return [];
    const p = road.pts; const at = [0]; for (let i = 1; i < p.length; i += 1) at.push(at[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
    const len = at[at.length - 1]; const out = [];
    for (let s = 3; s <= len - 7; s += 4.5) {
      const i = Math.max(1, at.findIndex((a) => a >= s)); const dx = p[i][0] - p[i - 1][0]; const dz = p[i][1] - p[i - 1][1]; const l = Math.hypot(dx, dz) || 1;
      const ux = dx / l; const uz = dz / l; const off = road.w / 2 + 0.75; const yaw = Math.atan2(ux, uz) + Math.PI / 2; // (the planter's length along the road)
      for (const side of [1, -1]) out.push(Object.freeze({ x: +(p[i][0] + uz * off * side).toFixed(2), z: +(p[i][1] - ux * off * side).toFixed(2), yaw: +yaw.toFixed(3) }));
    }
    return Object.freeze(out);
  })();
  const HEAD = road ? { x: road.pts[2][0], z: road.pts[2][1], ux: road.pts[6][0] - road.pts[2][0], uz: road.pts[6][1] - road.pts[2][1] } : { x: C.x + 44, z: C.z - 2, ux: 1, uz: 0 };
  const side = (() => { const l = Math.hypot(HEAD.ux, HEAD.uz) || 1; return { ux: HEAD.ux / l, uz: HEAD.uz / l }; })();
  // per project: its works (fence pieces), the sign, where 바위 stands that day, the plaque once open
  const SITES = Object.freeze({
    fountain: Object.freeze({
      fence: Object.freeze([0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; return Object.freeze({ x: +(C.x + Math.sin(a) * 4.1).toFixed(2), z: +(C.z + Math.cos(a) * 4.1).toFixed(2), yaw: +(a + Math.PI / 2).toFixed(3) }); })),
      sign: Object.freeze({ x: C.x + 1.6, z: C.z + 5.2, yaw: Math.PI }), keeper: Object.freeze({ x: C.x - 1.6, z: C.z + 5.4, yaw: 0 }), plaque: Object.freeze({ x: C.x, z: C.z + 4.4, yaw: Math.PI }), // (signs: their face to the south, where one comes from)
    }),
    flower_path: Object.freeze({
      fence: Object.freeze([-1, 1].map((k) => Object.freeze({ x: +(HEAD.x + side.uz * 2.6 * k).toFixed(2), z: +(HEAD.z - side.ux * 2.6 * k).toFixed(2), yaw: +Math.atan2(side.ux, side.uz).toFixed(3) }))),
      sign: Object.freeze({ x: +(HEAD.x + side.uz * 3.6).toFixed(2), z: +(HEAD.z - side.ux * 3.6).toFixed(2), yaw: +Math.atan2(side.ux, side.uz).toFixed(3) }), // (its face to the plaza)
      keeper: Object.freeze({ x: +(HEAD.x - side.uz * 3.4).toFixed(2), z: +(HEAD.z + side.ux * 3.4).toFixed(2), yaw: +Math.atan2(-side.ux, -side.uz).toFixed(3) }),
      plaque: Object.freeze({ x: +(HEAD.x + side.uz * 2.4 - side.ux * 0.6).toFixed(2), z: +(HEAD.z - side.ux * 2.4 - side.uz * 0.6).toFixed(2), yaw: +Math.atan2(side.ux, side.uz).toFixed(3) }),
    }),
  });
  const WORKS_N = 19; // 바위: on a works day at its fence, not walking (gamecenter-notes docs/resident-roster-20261027.md 「섬 공사 있는 날」)
  return { PROJECTS, ORDER, byId, fresh, roll, give, view, nextDay, PLANTERS, SITES, WORKS_N };
}));
