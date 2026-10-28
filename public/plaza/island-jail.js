// R4 구치소 반성문 (gamecenter-notes IDEAS #future-jail, backlog R4, assets 67): a small stone building by 관공서; inside,
// its own room far off the island (like the 민원실): a barred cell at the back, the warden's desk, two benches for
// onlookers, today's essays on a board. One in arrears for the island tax starts the day in the cell; the warden says a
// sentence over his head and it is typed into the island chat, word for word, within 20 s -- three (two for one close to
// him) and the cell opens. Anyone may come in and watch from outside the bars. Room-local metres from assets 67 (the door
// at local -Z), the room turned half round in the world like the others. Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandJail = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const ROOM = Object.freeze({ x: 50, z: -330, y: 0.4, w: 14, d: 10, entry: Object.freeze({ lx: 0, lz: -4.1 }), exit: Object.freeze({ lx: 0, lz: -4.5 }) });
  const world = (lx, lz) => ({ x: Math.round((ROOM.x - lx) * 100) / 100, z: Math.round((ROOM.z - lz) * 100) / 100 });
  const local = (x, z) => ({ lx: ROOM.x - x, lz: ROOM.z - z });
  const inJail = (x, z, pad = 0) => Math.abs(x - ROOM.x) <= ROOM.w / 2 + pad && Math.abs(z - ROOM.z) <= ROOM.d / 2 + pad;
  // the cell (assets 67 jail.cell: its front edge at z +1, 4 m back to the room's wall, 5 m across) and where one stands in it
  const CELL = Object.freeze({ x0: -2.5, x1: 2.5, z0: 1, z1: 5, door: Object.freeze({ lx: -0.55, lz: 1, w: 1.08 }), inside: Object.freeze({ x0: -2.4, x1: 2.4, z0: 1.1, z1: 4.9 }), stand: Object.freeze({ lx: 0, lz: 3 }) });
  const WARDEN = Object.freeze({ lx: 3.8, lz: 0.05, yaw: Math.PI }); // (behind the desk, facing the room's door -- local -Z)
  const PROPS = Object.freeze([ // id, x, z, yaw (room-local, assets 67 README)
    ['jail.desk', 3.8, -0.6, 0], ['jail.bench', -3.2, -2.6, 0], ['jail.bench', 0.2, -3.0, 0], ['jail.board', -6.4, -0.5, -Math.PI / 2] /* (its papers toward the room) */,
  ].map(([id, x, z, yaw]) => Object.freeze({ id, x, z, yaw })));
  const FIXTURES = Object.freeze([ // what one walks round outside the cell: x, z centre, w, d
    { x: 0, z: 3, w: 5, d: 4 } /* the cell */, { x: 3.8, z: -0.6, w: 1.8, d: 0.8 } /* the desk */, { x: 3.8, z: 0.05, w: 0.6, d: 0.6 } /* the warden */,
    { x: -3.2, z: -2.6, w: 1.8, d: 0.5 }, { x: 0.2, z: -3.0, w: 1.8, d: 0.5 }, { x: -6.4, z: -0.5, w: 0.3, d: 1.5 },
  ].map((f) => Object.freeze(f)));
  const TALK = Object.freeze({ lx: 3.8, lz: -1.6 }); // where one talks to the warden from (before the desk)
  // where one may stand: an inmate (the cell shut) in the cell; anyone else in the room, out of the cell and what stands
  // ('free': one let out today, the cell open -- in it too)
  function clamp(x, z, inmate = false) {
    const fin = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    if (inmate === true) {
      const s = world(CELL.stand.lx, CELL.stand.lz); let { lx, lz } = local(fin(x, s.x), fin(z, s.z)); const c = CELL.inside;
      return world(Math.max(c.x0 + 0.35, Math.min(c.x1 - 0.35, lx)), Math.max(c.z0 + 0.35, Math.min(c.z1 - 0.35, lz)));
    }
    const e = world(ROOM.entry.lx, ROOM.entry.lz);
    let { lx, lz } = local(fin(x, e.x), fin(z, e.z));
    lx = Math.max(-ROOM.w / 2 + 0.45, Math.min(ROOM.w / 2 - 0.45, lx)); lz = Math.max(-ROOM.d / 2 + 0.45, Math.min(ROOM.d / 2 - 0.45, lz));
    const stands = inmate === 'free' ? FIXTURES.slice(1) : FIXTURES;
    const hit = (x, z) => stands.find((f) => Math.abs(x - f.x) < f.w / 2 + 0.35 - 1e-6 && Math.abs(z - f.z) < f.d / 2 + 0.35 - 1e-6);
    for (let pass = 0, f = hit(lx, lz); f && pass < 4; pass += 1, f = hit(lx, lz)) {
      const hx = f.w / 2 + 0.35; const hz = f.d / 2 + 0.35;
      const ways = [[f.x - hx, lz], [f.x + hx, lz], [lx, f.z - hz], [lx, f.z + hz]].sort((p, q) => Math.hypot(p[0] - lx, p[1] - lz) - Math.hypot(q[0] - lx, q[1] - lz));
      [lx, lz] = ways.find(([x, z]) => !hit(x, z) && Math.abs(x) <= ROOM.w / 2 - 0.45 && Math.abs(z) <= ROOM.d / 2 - 0.45) || ways[0];
    }
    return world(lx, lz);
  }
  const inCell = (x, z, pad = 0) => { const { lx, lz } = local(x, z); const c = CELL.inside; return lx >= c.x0 - pad && lx <= c.x1 + pad && lz >= c.z0 - pad && lz <= c.z1 + pad; };

  // the essay: the day's sentences (the same for everyone that day), 20 s each; typed as said -- spaces at the ends, a run
  // of spaces as one, and a full stop at the end not counted
  const SECONDS = 20;
  const POOL = Object.freeze(['나는 섬의 주민세를 성실히 내겠습니다.', '받은 포인트는 세금부터 내겠습니다.', '내일 자정 전에 관공서에 가겠습니다.',
    '세금은 섬을 가꾸는 데 쓰입니다.', '다시는 세금을 미루지 않겠습니다.', '섬 주민으로서 약속을 지키겠습니다.', '관공서 세금 창구를 기억하겠습니다.',
    '잡초를 뽑아 세금을 마련하겠습니다.', '낚시로 번 포인트로 세금을 내겠습니다.', '체납은 부끄러운 일입니다.', '시장님께 죄송하다고 말하겠습니다.',
    '세금을 내면 철창이 열립니다.', '나는 성실한 섬 주민이 되겠습니다.', '오늘부터 가계부를 쓰겠습니다.', '포인트를 아껴 쓰겠습니다.',
    '이웃들에게 부끄럽지 않게 살겠습니다.', '세금 고지서를 꼭 읽겠습니다.', '구치소장님께 다시 오지 않겠다고 약속합니다.', '다음 달에는 미리 내겠습니다.',
    '섬의 길과 다리는 세금으로 만듭니다.', '세금은 모두를 위한 것입니다.', '나는 약속을 지키는 사람입니다.', '이번이 마지막 반성문입니다.']);
  const dayNumber = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
  function sentencesOf(day, count = 3) {
    // (Codex 검토 #12: a day that is no date, or more than the pool -- never a loop without end: a sound start, at most
    // as many tries as the pool has)
    const n = Math.max(0, Math.min(POOL.length, Math.floor(Number(count) || 0))); const d = dayNumber(day);
    const out = []; let k = (Number.isFinite(d) ? d : 0) * 7;
    for (let tries = 0; out.length < n && tries < POOL.length * 2; tries += 1) { const s = POOL[((k % POOL.length) + POOL.length) % POOL.length]; if (!out.includes(s)) out.push(s); k += 5; }
    return out;
  }
  const normalize = (text) => String(text || '').replace(/[.。]+\s*$/, '').replace(/\s+/g, ' ').trim();
  const same = (typed, sentence) => normalize(typed) === normalize(sentence);
  return { ROOM, CELL, WARDEN, PROPS, FIXTURES, TALK, world, local, inJail, inCell, clamp, SECONDS, POOL, sentencesOf, normalize, same };
}));
