// 백화점 개편 A안 (v1.10.211): now up on the roof, the 4th floor -- a garden under the sky (assets 82 roof.floor), the yard
// wider (roof.pet_yard 14 x 10, its 2 m gate at its front), the lift's own small house, the counter assets 82's
// mall.counter__f4.
// 묶음 2-2 펫샵 (gamecenter-notes docs/pet-shop-20261020.md, 사용자 2026-10-20 「펫샵을 따로 두기, 3층에. 돌아다니는 펫을
// 선택해서 데려가는 거」): the 백화점's 3rd floor -- ten pets a day (v1.10.191, docs/petshop-yard-unify-20261027.md: six of
// kind x coat, assets 60, and four specials -- 메타몽 and the transformations, sold at the counter before) walking about a fenced play yard, the same for everyone and where each is at a moment the same on every screen and the server (petAt: their
// rounds are worked out from the day); walk to one, SPACE, name it, it follows -- gone for everyone till the next day.
// The room is its own far off the island, like the 2nd floor. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandPetShop = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const KINDS = Object.freeze({ puppy: '강아지', kitten: '고양이', bird: '어깨 새' });
  const COATS = Object.freeze({ puppy: ['tan', 'white', 'black', 'choco'], kitten: ['grey', 'cheese', 'black', 'white'], bird: ['green', 'yellow', 'blue', 'pink'] }); // (first: the coat they had before)
  const COAT_NAME = Object.freeze({ tan: '갈색', white: '흰색', black: '검정', choco: '초코', grey: '고등어', cheese: '치즈', green: '초록', yellow: '노랑', blue: '파랑', pink: '분홍' });
  const coatOf = (kind, coat) => (COATS[kind]?.includes(coat) ? coat : COATS[kind]?.[0] || null);
  // (문제 기록 3회차 21 + 메타몽) the special ones: each transformation small (`tf_<id>`, the IP characters too) and 메타몽; one
  // of each kind a person. An IP one (`ip`) is never given away. They walk with their owner as the others do, one coat each.
  // (v1.10.191 사용자 「모든 펫을 동일하게 하루하루 랜덤으로 풀어놓고」: on sale at the counter no more -- four a day in the yard)
  // (built on first use: on the page the transformations' script comes after this one)
  let catalogList = null;
  const catalog = () => catalogList ||= Object.freeze([{ kind: 'ditto', name: '메타몽', ip: true }, ...((typeof module === 'object' && module.exports ? require('./character-transformations.js') : globalThis.CharacterTransformations)?.characters || [])
    .map((c) => ({ kind: `tf_${c.id}`, name: c.label, ip: Boolean(c.ip), transform: c.id }))].map((p) => Object.freeze(p)));
  const catalogOf = (kind) => catalog().find((p) => p.kind === kind) || null;
  const known = (kind) => Boolean(KINDS[kind] || catalogOf(kind));
  const nameOf = (kind, coat) => (catalogOf(kind) ? catalogOf(kind).name : `${KINDS[kind]} (${COAT_NAME[coatOf(kind, coat)]})`);
  const ROOM = Object.freeze({ x: 180, z: -330, y: 0.4, w: 30, d: 20 });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inRoom = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  const LIFT = Object.freeze({ lx: -13.4, lz: 0, yaw: 0, stand: Object.freeze([-10.9, 0]), house: true }); // (roof.lift_house: its door toward +x, its `stand` anchor 2.5 m off)
  // the play yard (assets 82 roof.pet_yard, 14 x 10 m, its 2 m gate at its front, local -Z): the pets keep inside it
  const PEN = Object.freeze({ lx: 1, lz: 1, w: 14, d: 10, gate: 2, scale: 1 });
  const PROPS = Object.freeze([ // what stands (room-local): id, x, z, yaw, its footprint w x d (walked round) -- assets 82 README
    ['petshop.cat_tower__beige', 7, 4.2, 0, 1.2, 1.2], ['petshop.cat_tower__grey', -4, 4.2, 0, 1.2, 1.2], ['petshop.bird_perch', 6.6, -1.6, 0, 0.8, 0.8],
    ['roof.yard_tree', 1, 3.4, 0, 0.6, 0.6], ['petshop.pet_bed__pink', -4.2, -1.8, 0, 0, 0], ['petshop.pet_bed__blue', -1.2, 4.9, 0, 0, 0], ['petshop.pet_bed__brown', 3.8, 4.9, 0, 0, 0],
    ['petshop.food_bowls', -4.6, 1.6, 0, 0, 0], ['petshop.toys', 2.2, -0.6, 0, 0, 0],
    ['mall.counter__f4', 11.6, -5.6, 0, 2.3, 0.85], ['roof.shade', 12.4, 4.5, 0, 1.2, 1.2], ['roof.lift_house', -13.4, 0, 0, 3.4, 3.4], ['mall.lift_panel', -11.87, -0.95, -Math.PI / 2, 0, 0],
    ['roof.flowerbed_long__6', -6, 9.3, 0, 6.06, 0.86], ['roof.flowerbed_long__6', 6, 9.3, 0, 6.06, 0.86], ['roof.flowerbed_long__4', 14.3, -1, Math.PI / 2, 0.86, 4.06], ['roof.flowerbed_long__4', -9, -9.2, 0, 4.06, 0.86],
    ['furn.garden_bench__oak', -4, -7.6, Math.PI, 1.6, 0.6], ['furn.garden_bench__oak', 6, -7.6, Math.PI, 1.6, 0.6], ['petshop.sign', 0, 9.8, 0, 0, 0],
  ].map(([id, x, z, yaw, w, d]) => Object.freeze({ id, x, z, yaw, w, d })));
  const COUNTER_KEEPER = Object.freeze([11.6, -4.6, 0]); // (the counter's `keeper` anchor, 1 m behind it)
  const FIXTURES = Object.freeze([ // the yard's fence (its gate open), what stands, the lift
    { x: PEN.lx, z: PEN.lz + PEN.d / 2, w: PEN.w, d: 0.2 }, { x: PEN.lx - PEN.w / 2, z: PEN.lz, w: 0.2, d: PEN.d }, { x: PEN.lx + PEN.w / 2, z: PEN.lz, w: 0.2, d: PEN.d },
    { x: PEN.lx - (PEN.w + PEN.gate) / 4, z: PEN.lz - PEN.d / 2, w: (PEN.w - PEN.gate) / 2, d: 0.2 }, { x: PEN.lx + (PEN.w + PEN.gate) / 4, z: PEN.lz - PEN.d / 2, w: (PEN.w - PEN.gate) / 2, d: 0.2 },
    ...PROPS.filter((p) => p.w).map((p) => ({ x: p.x, z: p.z, w: p.w, d: p.d })), // (the lift's house among them)
  ].map((f) => Object.freeze(f)));
  const COUNT = 10; const SPECIALS = 4; const SPEED = 0.7; const REACH = 1.8;
  const seeded = (text) => { let s = 2166136261; for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const shuffle = (list, rnd) => { for (let i = list.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return list; };
  // the specials in one shuffled ring, four a day on round it: any six days in a row show all 23 (24 places), none twice a day
  let ring = null;
  const specialRing = () => ring ||= shuffle(catalog().map((p) => p.kind), seeded('petshop:specials'));
  // the day's ten: each kind twice in two coats, then the day's four specials (no coat)
  function displayOf(day) {
    const rnd = seeded(`petshop:${day}`); const n = Math.round(Date.parse(`${day}T00:00:00Z`) / 86400000) || 0; const r = specialRing();
    const basic = Object.entries(COATS).flatMap(([kind, coats]) => shuffle([...coats], rnd).slice(0, 2).map((coat) => ({ kind, coat })));
    const special = Array.from({ length: SPECIALS }, (_, k) => ({ kind: r[(((n * SPECIALS + k) % r.length) + r.length) % r.length], coat: null }));
    return [...basic, ...special].map((p, i) => Object.freeze({ slot: `pet${i}`, ...p }));
  }
  // a pet's round in the yard for a day: walk to the next of six spots, stop there a few seconds, on and round
  const rounds = new Map();
  function roundOf(day, slot) {
    const key = `${day}:${slot}`; if (rounds.has(key)) return rounds.get(key);
    const rnd = seeded(`petshop:${key}`); const pts = []; const m = 0.9;
    while (pts.length < 6) {
      const lx = PEN.lx - PEN.w / 2 + m + rnd() * (PEN.w - 2 * m); const lz = PEN.lz - PEN.d / 2 + m + rnd() * (PEN.d - 2 * m);
      if (PROPS.some((p) => p.w && Math.abs(lx - p.x) < p.w / 2 + 0.4 && Math.abs(lz - p.z) < p.d / 2 + 0.4)) continue;
      pts.push([lx, lz]);
    }
    const legs = []; let t = 0;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i]; const b = pts[(i + 1) % pts.length]; const stop = 2.5 + rnd() * 4;
      legs.push({ t0: t, t1: t + stop, a, b: a }); t += stop;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]); legs.push({ t0: t, t1: t + len / SPEED, a, b, moving: true }); t += len / SPEED;
    }
    const r = { legs, period: t, phase: rnd() * t }; rounds.set(key, r); if (rounds.size > 64) rounds.delete(rounds.keys().next().value);
    return r;
  }
  // where a pet is at server time `ms` (world): x, z, yaw (its front -Z toward where it goes), moving
  function petAt(day, slot, ms) {
    const r = roundOf(day, slot); const t = (((ms / 1000 + r.phase) % r.period) + r.period) % r.period;
    const leg = r.legs.find((l) => t >= l.t0 && t < l.t1) || r.legs[0]; const k = leg.moving ? (t - leg.t0) / (leg.t1 - leg.t0) : 0;
    const lx = leg.a[0] + (leg.b[0] - leg.a[0]) * k; const lz = leg.a[1] + (leg.b[1] - leg.a[1]) * k;
    const next = leg.moving ? leg.b : (r.legs[r.legs.indexOf(leg) + 1] || r.legs[0]).b; const w = world(lx, lz); const n = world(next[0], next[1]);
    return { x: w.x, z: w.z, yaw: Math.atan2(-(n.x - w.x), -(n.z - w.z)) || 0, moving: Boolean(leg.moving) };
  }
  // where one may stand: inside the walls (0.45 m off them), out of the fence and what stands (0.35 m round it)
  function clamp(x, z) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const e = world(LIFT.stand[0], LIFT.stand[1]);
    let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.45, Math.min(ROOM.w / 2 - 0.45, lx)); lz = Math.max(-ROOM.d / 2 + 0.45, Math.min(ROOM.d / 2 - 0.45, lz));
    const hit = (x, z) => FIXTURES.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.35 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.35 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.35; const hz = f.d / 2 + 0.35;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.45 && Math.abs(z) <= ROOM.d / 2 - 0.45) || ways[0];
    }
    return world(lx, lz);
  }
  return { KINDS, COATS, COAT_NAME, coatOf, nameOf, catalog, catalogOf, known, ROOM, LIFT, PEN, PROPS, COUNTER_KEEPER, FIXTURES, COUNT, SPECIALS, REACH, world, local, inRoom, clamp, displayOf, petAt };
}));
