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
    // v1.10.223: after these two the mayor puts up to three to a day's vote (`soon`: 224's, not on the ballot yet)
    Object.freeze({ id: 'promenade', name: '물가 거리 가로등과 벤치', short: '물가 거리', thing: '물가 거리', goal: 2000000 }),
    Object.freeze({ id: 'night_lights', name: '섬 야경 조명', short: '야경 조명', thing: '야경 조명', goal: 2500000 }),
    Object.freeze({ id: 'bridge', name: '동쪽 강 새 다리', short: '새 다리', thing: '새 다리', goal: 3000000 }), // (v1.10.224)
    Object.freeze({ id: 'lookout', name: '능선 전망대', short: '전망대', thing: '전망대', goal: 2500000 }), // (v1.10.224)
  ]);
  const ORDER = Object.freeze(['fountain', 'flower_path']); // (the first two in order; then the vote)
  const VOTE_MAX = 3;
  const opened = (s, id) => s.open.some((o) => o.id === id);
  const candidates = (s) => PROJECTS.filter((p) => !p.soon && !opened(s, p.id)).map((p) => p.id).slice(0, VOTE_MAX);
  // the day's vote counted: most ballots, a tie to the one first on the list; none cast -- the first
  const tally = (v) => { const n = Object.fromEntries(v.choices.map((id) => [id, 0])); for (const id of Object.values(v.ballots || {})) if (id in n) n[id] += 1; return v.choices.reduce((a, b) => (n[b] > n[a] ? b : a), v.choices[0]); };
  const counts = (v) => { const n = Object.fromEntries(v.choices.map((id) => [id, 0])); for (const id of Object.values(v.ballots || {})) if (id in n) n[id] += 1; return n; };
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
    if (!s.cur && !s.works) {
      const start = (id) => { s.cur = id; s.raised = 0; s.donors = {}; };
      const fixed = ORDER.find((id) => !opened(s, id));
      if (fixed) start(fixed);
      else if (s.vote && s.vote.day < day) { const won = tally(s.vote); s.vote = null; if (won && !opened(s, won)) start(won); } // (yesterday's vote: its winner begun)
      else if (!s.vote) { const c = candidates(s); if (c.length === 1) start(c[0]); else if (c.length) s.vote = { day, choices: c, ballots: {} }; } // (the mayor's three for today)
    }
    fill(s, day, goalOf);
    return s;
  }
  // a 기부 of `amount` by userId (their game name): into the one filling, the rest (or all, with none) saved for the next;
  // a request (`req`) counts once -- sent again after the points were taken but this failed, it is put in then (Codex 6차 P3)
  function give(state, { userId, name, amount, req }, day, goalOf) {
    const s = roll(state, day, goalOf);
    if (req) { if ((s.reqs ||= []).includes(req)) return s; s.reqs.push(req); if (s.reqs.length > 300) s.reqs.splice(0, s.reqs.length - 300); }
    if (!s.cur) { s.saved += amount; return s; }
    const part = Math.min(amount, goalOf(s.cur) - s.raised); s.raised += part; s.saved += amount - part;
    const d = (s.donors[userId] ||= { name: name || '섬 사람', total: 0 }); d.name = name || d.name; d.total += part;
    fill(s, day, goalOf);
    return s;
  }
  // what everyone sees (and mine: what I gave to the one filling)
  // a ballot for today's vote (one each, changed until the day ends): the state, or null (no vote today, not on it)
  function vote(state, userId, id, day, goalOf) {
    const s = roll(state, day, goalOf);
    if (!s.vote || s.vote.day !== day || !s.vote.choices.includes(id)) return null;
    s.vote.ballots[userId] = id; return s;
  }
  function view(s, goalOf, userId = null) {
    const p = s.cur && byId(s.cur);
    return { cur: p ? { id: p.id, name: p.name, goal: goalOf(p.id), raised: s.raised, mine: (userId && s.donors[userId]?.total) || 0 } : null,
      saved: s.saved, works: s.works ? { id: s.works.id, name: byId(s.works.id)?.name || s.works.id, day: s.works.day } : null,
      open: s.open.map((o) => ({ id: o.id, name: byId(o.id)?.name || o.id, day: o.day, top: o.top })),
      vote: s.vote ? { day: s.vote.day, choices: s.vote.choices.map((id) => ({ id, name: byId(id)?.name || id, goal: goalOf(id), votes: counts(s.vote)[id] })), mine: (userId && s.vote.ballots[userId]) || null } : null };
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
  // v1.10.223 물가 거리: lamps and benches along 윤슬만's shore walk (walk 1), beside it every 12 m -- clear of the
  // pier and the dock; each bench a seat (`pm-<k>`, sat on once the street is open)
  const shore = (Terrain.walkCurves || []).find((w) => Math.hypot(w.pts[0][0] + 59, w.pts[0][1] - 13) < 3) || null;
  const along = (w, from, step, end, fn) => { if (!w) return []; const p = w.pts; const at = [0]; for (let i = 1; i < p.length; i += 1) at.push(at[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); const out = []; for (let s = from; s <= at[at.length - 1] - end; s += step) { const i = Math.max(1, at.findIndex((a) => a >= s)); const dx = p[i][0] - p[i - 1][0]; const dz = p[i][1] - p[i - 1][1]; const l = Math.hypot(dx, dz) || 1; const r = fn(p[i][0], p[i][1], dx / l, dz / l, w.w); if (r) out.push(r); } return out; };
  const NO_GO = [{ x: 0, z: -8, r: 7 }, { x: 0, z: 3.5, r: 7 }]; // (the pier's foot, the dock)
  const PROMENADE = Object.freeze(along(shore, 8, 12, 4, (x, z, ux, uz, w) => { const off = w / 2 + 0.7; const px = x + uz * off; const pz = z - ux * off; if (!Terrain.walkable(px, pz) || NO_GO.some((n) => Math.hypot(px - n.x, pz - n.z) < n.r)) return null; return Object.freeze({ x: +px.toFixed(2), z: +pz.toFixed(2), yaw: +Math.atan2(-uz, ux).toFixed(3) }); /* (the land side of the walk -- the railing and the sand on the other -- facing the water across it) */ }));
  const PROMENADE_SEATS = Object.freeze(PROMENADE.map((u, k) => Object.freeze({ id: `pm-${k}`, x: +(u.x + Math.cos(u.yaw) * 0.35).toFixed(2), z: +(u.z - Math.sin(u.yaw) * 0.35).toFixed(2), yaw: u.yaw, project: 'promenade', name: '앉기' })));
  // v1.10.223 야경 조명: bulb strings across the road from 대청마당 down to the pier (walk 0) every 10 m, and lights on the ground
  // round the fountain and the lighthouse -- lit at night only
  const pierRoad = (Terrain.walkCurves || []).find((w) => Math.hypot(w.pts[0][0], w.pts[0][1] + 54) < 3) || null;
  const STRINGS = Object.freeze(along(pierRoad, 6, 10, 6, (x, z, ux, uz) => Object.freeze({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: +Math.atan2(uz, -ux).toFixed(3) })));
  const L = (Terrain.PLACES || {}).lighthouse || { x: -96, z: 144 };
  const UPLIGHTS = Object.freeze([...[0, 1, 2, 3].map((k) => ({ x: C.x + Math.sin(k * Math.PI / 2 + Math.PI / 4) * 3.8, z: C.z + Math.cos(k * Math.PI / 2 + Math.PI / 4) * 3.8, yaw: k * Math.PI / 2 + Math.PI / 4 + Math.PI })),
    ...[0, 1, 2].map((k) => ({ x: L.x + Math.sin(k * 2.1) * 4.2, z: L.z + Math.cos(k * 2.1) * 4.2, yaw: k * 2.1 + Math.PI }))].map((u) => Object.freeze({ x: +u.x.toFixed(2), z: +u.z.toFixed(2), yaw: +u.yaw.toFixed(3) })));
  const besideUnit = (u, d) => ({ x: +(u.x + Math.sin(u.yaw) * d).toFixed(2), z: +(u.z + Math.cos(u.yaw) * d).toFixed(2), yaw: u.yaw });
  const pm = PROMENADE[Math.floor(PROMENADE.length / 2)] || { x: 0, z: -4, yaw: 0 }; const st = STRINGS[0] || { x: 0, z: -48, yaw: 0 };
  const more = { /* (let: 224 adds to it) */
    promenade: Object.freeze({ fence: Object.freeze([pm, PROMENADE[Math.floor(PROMENADE.length / 2) + 1] || pm].map((u) => Object.freeze({ ...u }))), sign: Object.freeze(besideUnit(pm, -2.2)), keeper: Object.freeze(besideUnit(pm, -3.4)), plaque: Object.freeze(besideUnit(PROMENADE[0] || pm, -1.6)) }),
    night_lights: Object.freeze({ fence: Object.freeze([Object.freeze({ x: st.x + 2.6, z: st.z, yaw: Math.PI / 2 }), Object.freeze({ x: st.x - 2.6, z: st.z, yaw: Math.PI / 2 })]), sign: Object.freeze({ x: st.x + 3.4, z: st.z + 1.6, yaw: Math.PI }), keeper: Object.freeze({ x: st.x - 3.4, z: st.z + 1.6, yaw: 0 }), plaque: Object.freeze({ x: st.x + 2.6, z: st.z - 1.2, yaw: Math.PI }) }),
  };
  // v1.10.224 동쪽 강 새 다리 (총괄 2026-11-01 「A 강 어귀」): over 은하내's mouth, the one place its banks are low and level (up the
  // river it runs in a gorge); a walk from 잔치마루's walk to its south end, across it 강 어귀 낚시터 -- the little rise between
  // the river and the sea, reached only by it (its edges the sea's and the river's fishing water). 10 m, its middle 1.1 m up
  // (the terrain's own bridge rule once open)
  const BRIDGE = Object.freeze({ x: 161.4, z: -15, ux: -0.414, uz: 0.91, half: 5, w: 2.6, rise: 1.1, yaw: -0.427 });
  const FISHING_SPOT = Object.freeze({ x: 163.9, z: -21.6, name: '강 어귀 낚시터' });
  const bridgeEntry = (T) => { const e0 = T.heightAt(BRIDGE.x - BRIDGE.ux * BRIDGE.half, BRIDGE.z - BRIDGE.uz * BRIDGE.half); const e1 = T.heightAt(BRIDGE.x + BRIDGE.ux * BRIDGE.half, BRIDGE.z + BRIDGE.uz * BRIDGE.half); const ends = Math.max(e0, e1);
    return { x: BRIDGE.x, z: BRIDGE.z, ux: BRIDGE.ux, uz: BRIDGE.uz, half: BRIDGE.half, w: BRIDGE.w, arch: BRIDGE.rise, base: ends - 0.43 + 0.04, get deck() { return this.base + 0.43; }, project: 'bridge' }; }; // (the 윤슬다리's arch rule: its top 0.43 over base)
  // v1.10.224 능선 전망대: on the ridge top beside the ridge walk (walk 35), well off the railway and 영웅마루역; its front (the coin
  // telescope) to the west -- the rugged far ridge out at sea; one climbs at its back (SPACE there: through the telescope)
  const LOOKOUT = Object.freeze({ x: -43, z: -136, yaw: Math.PI / 2, door: Object.freeze({ x: -40.2, z: -136 }), aim: Object.freeze({ x: -305, y: 22, z: -115 }) });
  const at = (t, v, turn) => Object.freeze({ x: +(BRIDGE.x + BRIDGE.ux * t + BRIDGE.uz * v).toFixed(2), z: +(BRIDGE.z + BRIDGE.uz * t - BRIDGE.ux * v).toFixed(2), yaw: +(BRIDGE.yaw + turn).toFixed(3) }); // (along it t, across it v)
  more.bridge = Object.freeze({ fence: Object.freeze([at(-BRIDGE.half - 0.6, 0, Math.PI / 2), at(BRIDGE.half + 0.6, 0, Math.PI / 2)]),
    sign: at(BRIDGE.half + 2.4, 2.4, 0), keeper: at(BRIDGE.half + 2.4, -2.4, 0), plaque: at(BRIDGE.half + 1.6, 2.0, 0) }); // (all on its near bank, the walk's side)
  more.lookout = Object.freeze({ fence: Object.freeze([0, 1, 2, 3].map((k) => { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; return Object.freeze({ x: +(LOOKOUT.x + Math.sin(a) * 3.4).toFixed(2), z: +(LOOKOUT.z + Math.cos(a) * 3.4).toFixed(2), yaw: +(a + Math.PI / 2).toFixed(3) }); })),
    sign: Object.freeze({ x: LOOKOUT.x + 4.4, z: LOOKOUT.z + 2.2, yaw: -Math.PI / 2 }), keeper: Object.freeze({ x: LOOKOUT.x + 4.2, z: LOOKOUT.z - 2.4, yaw: Math.PI / 2 }), plaque: Object.freeze({ x: LOOKOUT.x + 3.4, z: LOOKOUT.z + 1.6, yaw: -Math.PI / 2 }) }); // (its back to the walk: east)
  const ALL_SITES = Object.freeze({ ...SITES, ...more });
  const WORKS_N = 19; // 바위: on a works day at its fence, not walking (gamecenter-notes docs/resident-roster-20261027.md 「섬 공사 있는 날」)
  return { BRIDGE, FISHING_SPOT, bridgeEntry, LOOKOUT, PROJECTS, ORDER, VOTE_MAX, byId, fresh, roll, give, vote, view, nextDay, PLANTERS, PROMENADE, PROMENADE_SEATS, STRINGS, UPLIGHTS, SITES: ALL_SITES, WORKS_N };
}));
