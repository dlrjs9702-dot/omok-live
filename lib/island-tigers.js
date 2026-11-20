'use strict';
// 1.10.376 N2a-2 별마루섬 호랑이 (notes docs/island-expansion-20261115.md 「별마루섬 호랑이」, 2차 결정, 이름·특징, 152d/152e, 잡히면 시장님 앞):
// two tigers, 우레 and 안개, only on 별마루섬 inside its fence, moved here on the server -- every screen draws the same two. They roam
// their own ground (우레 the peak's slopes, 안개 the swamps), rest at their hours (우레 12~14시 on his rock, 안개 4~6시 by a swamp),
// and chase whoever comes near: a few low steps (Stalk), then a run -- faster than a run, slower than a bike, a bike in a swamp
// caught. Never into the camp or the lookout, nor within 12 m of a gate; after 10 s they give up (and may start again at once).
// A pounce lands its front paws about 0.84 s in: whoever is there then is caught (the tail is not part of it).
// Pure: the island's terrain and props come in; the server feeds the people and acts on what comes out.
const TIGERS = Object.freeze([
  // (377 사용자: 「속도를 11까지」「크기를 지금의 1.5배로」 -- 2.4x the file: the clips' no-slide paces (walk, run, stalk), the paws' reach, the
  // catch's round and the leap all 1.5 times what they were at 1.6x)
  Object.freeze({ id: 'ure', name: '우레', model: 'byeolmaru.tiger', speed: 13 /* (377 사용자 「우레 속도 1 업」; 382 결정 16 A 쫓을 때 +1) */, turn: 2.6, walk: 2.5, run: 10.92, stalk: 0.89, warn: 25, see: 25, pounceAt: 5.1, leap: 4.6, paw: 2.1, catchR: 2.4, rest: [12, 14], restClip: 'Nap', home: 'rock' }),
  Object.freeze({ id: 'angae', name: '안개', model: 'byeolmaru.tiger_angae', speed: 12 /* (382 결정 16 A 쫓을 때 +1) */, turn: 7.0, walk: 1.99, run: 8.74, stalk: 0.7, warn: 12, see: 18, pounceAt: 4.5, leap: 3.69, paw: 1.73, catchR: 2.1, rest: [4, 6], restClip: 'Doze', home: 'swamp' }),
]);
const SCALE = 2.4; const BODY = 0.9; /* (half the body's width at 2.4x -- off every solid by this) */
const GIVE_UP_S = 25; /* (377 사용자 「포기를 25초까지」) */ const RUN_S = 0.6; /* (the Run clip's length) */ const STALK_S = 1.8; const POUNCE_S = 1.3; const PAW_S = 0.84; const LEAP_FROM = 0.42;
const CORNER_R = 2.4; /* (381 ③: the round a sharp turn is taken on, m -- speed ≤ turn rate × this) */
const CORNER_RAD = Number(process.env.TIGER_CORNER_RAD) || 1.0; /* (382: only a real corner, 57° and more, slows it -- at 29° 우레 ran at a runner's 6.2 m/s through every bend of the woods) */
const CORNER_R_TREES = 3.4; /* (382 결정 16 A: a little wider by a trunk -- the hips not swung into it) */
const BIG_ROCK_R = 0.45; /* (382 결정 17 A) */
const LOST_SEE = 3;
const STILL_V = 2.5; /* (382: under this, m/s, one counts as standing for the near attacks) */
const GRID_BODY = 0.9; /* (382: the ground's cells off every solid by the chest's 0.9 -- tried 1.1 and 1.3: the woods closed up, half the catches, no fewer trunks touched) */
const SAFE_PEAK_R = 14; const GATE_R = 12; const FENCE_IN = 4; const INSIDE = FENCE_IN + 2; const ROCK_LIFT = 1.44; /* (152e README: 우레 on his rock, 0.9 x 1.6) */
const KEEP_USES = new Set(['tool', 'bike', 'pet', 'errand']);
const kstHour = (ms) => new Date(ms + 9 * 3600000).getUTCHours();
const restingAt = (def, ms) => { const h = kstHour(ms); return h >= def.rest[0] && h < def.rest[1]; };
const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// the leap of a pounce (377 사용자 「제자리 멈춰서 ... 앞으로 좀 멀리 뛰어오르게」): on from the run's own speed, straight across `len` till the paws
// land at 0.84 s, there after (the clip's own root motion taken out on the screens -- they draw this same line)
const leapAt = (s, len) => (s <= 0 ? 0 : s >= PAW_S ? len : (len * s) / PAW_S);
/* (382 사용자 결정 12 공격 패턴, assets 159 attack-timing.json: the server picks the attack and judges it; every screen plays the clip from the same
   start). Times in s; points in m at 2.4x in the tiger's own frame where the attack began (forward / right, right = its .R side = -90° of its yaw;
   TurnSwipe(L): after its turn). The claws judged on the line from where they strike to where the paw lands; the Lunge's jaws on the line from
   the chest to the mouth */
const s01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const ATTACKS = Object.freeze({
  Swipe: Object.freeze({ len: 1.0, hit: 0.4333, turn: 0 }),
  TurnSwipe: Object.freeze({ len: 1.1, hit: 0.5667, turn: -1 }), /* (its root turns -90° from 0.06 to 0.50 s: to its right) */
  TurnSwipeL: Object.freeze({ len: 1.1, hit: 0.5667, turn: 1 }),
  Lunge: Object.freeze({ len: 1.1, hit: 0.5, turn: 0 }),
});
const REACH = Object.freeze({
  ure: Object.freeze({ claw: [2.573, 0.484], paw: [2.508, 0.346], clawR: 1.1, mouth: 4.53, lunge: 1.21, mouthR: 1.2 }),
  angae: Object.freeze({ claw: [2.059, 0.387], paw: [2.007, 0.277], clawR: 0.9, mouth: 3.62, lunge: 0.97, mouthR: 1.0 }),
});
const turnAt = (kind, s) => (ATTACKS[kind]?.turn || 0) * (Math.PI / 2) * s01(0.06, 0.5, s); /* (TurnSwipe: 0 -> -π/2 -- three's rotation.y, the server's yaw) */
const lungeAt = (id, s) => REACH[id].lunge * s01(0.14, 0.52, s);
const segDistTo = (q, ax, az, bx, bz) => { const dx = bx - ax; const dz = bz - az; const l2 = dx * dx + dz * dz || 1; const u = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l2)); return Math.hypot(q.x - ax - u * dx, q.z - az - u * dz); };

// 잡히면 (사용자 「소지품 중 무작위로 2개」, 총괄 기본값): two random things in the bag's own slots, one of each -- never a tool, a bike, a pet,
// an errand's good, one that is an islander's or an event's, nor what is in the fish or insect box
function losable(e, Items) {
  if (!e || !(e.qty > 0) || Items.inBox?.(e)) return false;
  const def = Items.itemDef(e.itemId); if (!def) return false;
  if (KEEP_USES.has(def.use) || Items.TOOL_KIND?.[e.itemId] || def.at === 'owner' || e.itemId === 'wallet' || e.meta?.eventId) return false;
  return true;
}
function losePick(bag, Items, rand = Math.random, n = 2) {
  const pool = (bag || []).filter((e) => losable(e, Items)); const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

function createTigers({ T, P, rand = Math.random } = {}) {
  const D = T.dalmaru; const I = D.NEW_ISLE; const camp = I.camp; const peak = I.peak;
  const gates = (P.FENCE || []).filter((f) => P.FENCE_KINDS[f[3]] === 'fence_gate').map(([x, z]) => ({ x, z }));
  const safeAt = (x, z) => Math.hypot(x - camp.x, z - camp.z) < camp.r + 2 || Math.hypot(x - peak.x, z - peak.z) < SAFE_PEAK_R;
  const gateNear = (x, z, r = GATE_R) => gates.some((g) => Math.hypot(x - g.x, z - g.z) < r);
  const inside = (x, z) => D.newIsleCoast(x, z) > FENCE_IN;
  // where a person can be chased: on the island inside its fence, out of the camp, the lookout and the gates' 12 m
  const huntable = (x, z) => T.onIsle2(x, z) && inside(x, z) && !safeAt(x, z) && !gateNear(x, z);

  // ---- the ground they may tread: 1 m cells, off every solid by BODY (their body 1.8 m across at 2.4x), 2 m in from the fence,
  // never the camp, the lookout or a gate's 12 m; only the largest piece joined up (built a slice at a time) ----
  const R = I.r + 14; const x0 = I.x - R; const z0 = I.z - R; const N = Math.ceil(2 * R); const NN = N * N;
  const cells = new Uint8Array(NN); /* 0 not yet, 1 blocked, 2 free, 3 free and joined */ let built = 0; let ready = false;
  /* (382 사용자 결정 17 A: the tigers -- only they -- go round the bigger rocks people walk over (0.45 m round and up: a 2.4x body over one is
     seen through it); the smallest pebbles stay underfoot) */
  let rockHash = null;
  const rocksNear = (x, z, m) => {
    if (!rockHash) { rockHash = new Map(); for (const o of (T.nature?.().rocks || [])) { const r = 0.8 * o.s; if (r < BIG_ROCK_R || !T.onIsle2(o.x, o.z)) continue; const k = `${Math.floor(o.x / 8)},${Math.floor(o.z / 8)}`; if (!rockHash.has(k)) rockHash.set(k, []); rockHash.get(k).push({ x: o.x, z: o.z, r }); } }
    const cx = Math.floor(x / 8); const cz = Math.floor(z / 8);
    for (let i = cx - 1; i <= cx + 1; i += 1) for (let j = cz - 1; j <= cz + 1; j += 1) for (const o of rockHash.get(`${i},${j}`) || []) if (Math.hypot(o.x - x, o.z - z) < o.r + m) return true;
    return false;
  };
  const clearT = (x, z, m) => T.isle2Clear(x, z, m) && !rocksNear(x, z, m);
  const freeAt = (x, z) => D.newIsleCoast(x, z) > INSIDE && T.walkable(x, z) && clearT(x, z, GRID_BODY) && !safeAt(x, z) && !gateNear(x, z);
  /* (381 ① 사용자 「크기를 키워서 나무에 끼는 구간」: the body is head, chest and hips -- about 4 m long at 2.4x. A cell is walked through only
     along a way (of 4: x, z and the two diagonals) where the cells before and after it are clear too -- a gap a 1.8 m chest fits but not
     the length (between two trees, a turn round a trunk) is off the way; a cell with no such way is not theirs at all) */
  const axis = new Uint8Array(NN); /* bit a: the body fits along way a here */
  const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const axisOf = (di, dj) => (dj === 0 ? 0 : di === 0 ? 1 : di === dj ? 2 : 3);
  const stepOk = (c, n, di, dj) => (axis[n] >> axisOf(di, dj)) & 1 && (axis[c] >> axisOf(di, dj)) & 1;
  function warm(budgetMs = Infinity) {
    if (ready) return true; const until = Date.now() + budgetMs;
    while (built < NN) { const i = built % N; const j = (built - i) / N; cells[built] = freeAt(x0 + i + 0.5, z0 + j + 0.5) ? 2 : 1; built += 1; if ((built & 255) === 0 && Date.now() >= until) return false; }
    for (let c = 0; c < NN; c += 1) { /* (the ways: the cells before and after free too -- the chest's 0.9 there keeps the head and hips clear) */
      if (cells[c] !== 2) continue; const ci = c % N; const cj = (c - ci) / N; let m = 0;
      AXES.forEach(([di, dj], a) => { const f = (k) => { const ni = ci + di * k; const nj = cj + dj * k; return ni >= 0 && nj >= 0 && ni < N && nj < N && cells[nj * N + ni] >= 2; }; if (f(1) && f(-1)) m |= 1 << a; });
      axis[c] = m;
    }
    for (let c = 0; c < NN; c += 1) if (cells[c] === 2 && !axis[c]) cells[c] = 1;
    // the largest joined piece (by the body's own steps)
    const seen = new Int32Array(NN).fill(-1); const q = new Int32Array(NN); let best = -1; let bestN = 0;
    for (let s = 0; s < NN; s += 1) {
      if (cells[s] !== 2 || seen[s] >= 0) continue; let h = 0; let t = 0; q[t++] = s; seen[s] = s;
      while (h < t) { const c = q[h++]; const ci = c % N; const cj = (c - ci) / N; for (const [di, dj] of NB) { const ni = ci + di; const nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (cells[n] === 2 && seen[n] < 0 && stepOk(c, n, di, dj) && !(di && dj && (cells[cj * N + ni] < 2 || cells[nj * N + ci] < 2))) { seen[n] = s; q[t++] = n; } } }
      if (t > bestN) { bestN = t; best = s; }
    }
    for (let c = 0; c < NN; c += 1) if (cells[c] === 2 && seen[c] === best) cells[c] = 3;
    ready = true; return true;
  }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  /* (381 ② 끼임: a cell a tiger got stuck by is off their way for a while -- each tiger's own) */
  const shut = (t, c, now) => (t && c >= 0 && t.shut.get(c) > now);
  const cellOf = (x, z) => { const i = Math.floor(x - x0); const j = Math.floor(z - z0); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; };
  const open = (x, z) => { const c = cellOf(x, z); return c >= 0 && cells[c] === 3; };
  const centre = (c) => { const i = c % N; return { x: x0 + i + 0.5, z: z0 + (c - i) / N + 0.5 }; };
  // the nearest open cell to a point (within r cells), or -1
  function nearestOpen(x, z, r = 6) {
    const c0 = cellOf(x, z); if (c0 >= 0 && cells[c0] === 3) return c0; let best = -1; let bd = Infinity;
    const ci = Math.floor(x - x0); const cj = Math.floor(z - z0);
    for (let j = cj - r; j <= cj + r; j += 1) for (let i = ci - r; i <= ci + r; i += 1) { if (i < 0 || j < 0 || i >= N || j >= N || cells[j * N + i] !== 3) continue; const d = (i + 0.5 - (x - x0)) ** 2 + (j + 0.5 - (z - z0)) ** 2; if (d < bd) { bd = d; best = j * N + i; } }
    return best;
  }
  // steps from every open cell to `goal` (8 ways, each a step; 381: only along a way the body fits, not through a cell shut for this tiger)
  /* (383 Codex 371~380 #14: `stopAt` -- the tiger's own cell: the spread ends a few steps past it (the way it walks lies inside that), not over the whole
     island; one queue for every spread) */
  const FLOW_MARGIN = 6; const fq = new Int32Array(NN);
  function flowTo(goal, into, t = null, now = 0, stopAt = -1) {
    const dist = into || new Int32Array(NN); dist.fill(-1); if (goal < 0) return dist; const q = fq; let h = 0; let k = 0; q[k++] = goal; dist[goal] = 0; let limit = Infinity;
    while (h < k) { const c = q[h++]; if (dist[c] > limit) break; if (c === stopAt) limit = dist[c] + FLOW_MARGIN; const ci = c % N; const cj = (c - ci) / N; for (const [di, dj] of NB) { const ni = ci + di; const nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (cells[n] !== 3 || dist[n] >= 0 || !stepOk(c, n, di, dj) || shut(t, n, now)) continue; if (di && dj && (cells[cj * N + ni] < 2 || cells[nj * N + ci] < 2)) continue; /* (no corner cut past a solid -- as the joined piece was found) */ dist[n] = dist[c] + 1; q[k++] = n; } }
    return dist;
  }
  // a point a few cells down the flow from (x, z) -- where to head for
  function downhill(dist, x, z, steps = 6) {
    let c = nearestOpen(x, z, 3); if (c < 0 || dist[c] < 0) return null; let seen = centre(c); /* (the farthest one down the way still in a straight clear line -- or first the middle of its own cell) */
    for (let k = 0; k < steps && dist[c] > 0; k += 1) { const ci = c % N; const cj = (c - ci) / N; let next = c; for (const [di, dj] of NB) { const ni = ci + di; const nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (di && dj && (cells[cj * N + ni] < 2 || cells[nj * N + ci] < 2)) continue; /* (as the flow: no corner cut) */ if (!stepOk(c, n, di, dj)) continue; if (dist[n] >= 0 && dist[n] < dist[next]) next = n; } if (next === c) break; c = next; const p = centre(c); if (clearLine(x, z, p.x, p.z)) seen = p; else break; }
    return seen;
  }
  const lineOf = (ok) => (ax, az, bx, bz) => { const d = Math.hypot(bx - ax, bz - az); const n = Math.ceil(d / 0.5); for (let k = 1; k <= n; k += 1) if (!ok(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) return false; return true; };
  const clearLine = lineOf(open);
  // a leap's way, and a step back onto their ground after one: as a person's (off the solids by 0.35), inside the fence, out of the safe places
  const passable = (x, z) => D.newIsleCoast(x, z) > FENCE_IN + 1 && T.walkable(x, z) && T.isle2Clear(x, z, 0.35) && !safeAt(x, z) && !gateNear(x, z);
  const leapLine = lineOf(passable);

  // ---- their homes: 우레's rock (on it to nap), 안개's swamps (by one to doze, the reeds to lie in) ----
  const rock = P.ROCK ? { x: P.ROCK[0], z: P.ROCK[1] } : { x: peak.x - 18, z: peak.z };
  const swamps = (P.SWAMPS || []).map(([x, z]) => ({ x, z }));
  const reeds = (P.REEDS || []).map(([x, z]) => ({ x, z }));
  const anchorOf = (def) => (def.home === 'rock' ? [rock, { x: peak.x - 30, z: peak.z + 20 }, { x: peak.x + 25, z: peak.z - 28 }] : swamps.length ? swamps : [{ x: I.x, z: I.z }]);
  function roamGoal(def) {
    const a = anchorOf(def); const base = a[Math.floor(rand() * a.length)];
    for (let k = 0; k < 30; k += 1) { const r = 6 + rand() * 30; const ang = rand() * Math.PI * 2; const c = nearestOpen(base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r, 4); if (c >= 0) return centre(c); }
    const c = nearestOpen(base.x, base.z, 20); return c >= 0 ? centre(c) : null;
  }
  const restSpot = (def) => { if (def.home === 'rock') { const c = nearestOpen(rock.x, rock.z, 8); return { stand: c >= 0 ? centre(c) : rock, lie: { x: rock.x, z: rock.z }, lift: ROCK_LIFT }; }
    const s = swamps[0] || { x: I.x, z: I.z }; const c = nearestOpen(s.x, s.z, 14); const p = c >= 0 ? centre(c) : s; return { stand: p, lie: p, lift: 0 }; };

  // ---- state ----
  let on = true; let clockShift = 0; const seenAt = new Map(); /* token -> { x, z, at, vx, vz } (how fast each one goes) */
  const tigers = TIGERS.map((def) => ({ def, x: 0, z: 0, yaw: 0, mode: 'wait', clip: 'Idle', clipAt: 0, sp: 0, lift: 0, until: 0, goal: null, flow: null, flowAt: 0, flowGoal: -1, target: null, chaseFrom: 0, pounce: null, placed: false,
    shut: new Map() /* (381 ②: cell -> till when) */, prog: null, stuckN: 0, back: null, lastSeen: null, role: null }));
  const setClip = (t, clip, now) => { if (t.clip !== clip) { t.clip = clip; t.clipAt = now; } };
  function place(t, x, z, now) { const c = nearestOpen(x, z, 20); const p = c >= 0 ? centre(c) : { x, z }; Object.assign(t, { x: p.x, z: p.z, mode: 'idle', until: now + 2000, target: null, pounce: null, attack: null, back: null, role: null, lift: 0, sp: 0, placed: true }); setClip(t, 'Idle', now); }
  /* (383 Codex #14: the same goal's cell and the tiger still on its spread -- the way kept, nothing worked out again; `force` after its cells were shut) */
  function toGoal(t, goal, now, force = false) {
    if (goal !== t.goal) t.goalStuck = 0; t.goal = goal; const c = goal ? nearestOpen(goal.x, goal.z, 4) : -1; const here = nearestOpen(t.x, t.z, 3);
    if (!force && c >= 0 && c === t.flowGoal && t.flow && here >= 0 && t.flow[here] >= 0) { t.flowAt = now; return; }
    t.flowGoal = c; t.flow = c >= 0 ? flowTo(c, t.flow, t, now, here) : null; t.flowAt = now;
  }
  /* (381 ①: head and hips clear of the solids where the body would stand, facing (fx, fz) -- 1.3 m ahead, 1.2 m behind the chest (the grid's
     ways keep the room for it; a step that does not fit waits, and a wait of a second is a 끼임 below)) */
  const HEAD = 1.3; const HIPS = 1.2; const HEAD_R = 0.55; const HIPS_R = 0.6;
  const partsIn = (x, z, fx, fz) => { const l = Math.hypot(fx, fz) || 1; const ux = fx / l; const uz = fz / l; return (clearT(x, z, BODY) ? 0 : 1) + (clearT(x + ux * HEAD, z + uz * HEAD, HEAD_R) ? 0 : 1) + (clearT(x - ux * HIPS, z - uz * HIPS, HIPS_R) ? 0 : 1); }; /* (chest, head, hips: how many touch a solid) */
  const hipsIn = (x, z, yaw) => !clearT(x - Math.sin(yaw) * HIPS, z - Math.cos(yaw) * HIPS, HIPS_R);
  // a step toward (gx, gz) at up to `v` m/s, turning at its own rate (우레 slows on a sharp turn -- he swings wide)
  function stepToward(t, gx, gz, v, dt) {
    const want = Math.atan2(gx - t.x, gz - t.z); const diff = angleTo(t.yaw, want); let turn = Math.max(-t.def.turn * dt, Math.min(t.def.turn * dt, diff));
    /* (382 결정 16 A: a turn that would swing the hips into a solid turns less -- half, then a quarter -- never stops the step) */
    if (!hipsIn(t.x, t.z, t.yaw)) for (let k = 0; k < 2 && hipsIn(t.x, t.z, t.yaw + turn); k += 1) turn /= 2;
    t.yaw = Math.atan2(Math.sin(t.yaw + turn), Math.cos(t.yaw + turn)); /* (kept within one turn) */
    const k = Math.max(0.25, Math.cos(Math.min(Math.PI / 2, Math.abs(diff)))); let sp = v * (t.def.turn < 4 ? k : Math.max(0.6, k));
    if (Math.abs(diff) > CORNER_RAD) sp = Math.min(sp, t.def.turn * (clearT(t.x, t.z, BODY + 1.6) ? CORNER_R : CORNER_R_TREES)); /* (381 ③ 모퉁이 감속: a sharp turn slowed to a ~2.4 m circle -- 우레 no longer swings 4.6 m wide; 382 a little wider by a trunk) */
    const d = Math.hypot(gx - t.x, gz - t.z); const step = Math.min(d, sp * dt); const off = !open(t.x, t.z); /* (landed off their ground after a leap: back onto it) */
    /* (on, or toward the aim, or sliding along a side past a corner -- 381 ①: the first whose head and hips stay clear, else the one least in) */
    let best = null; let bestIn = 4;
    for (const [fx, fz] of [[Math.sin(t.yaw), Math.cos(t.yaw)], [Math.sin(want), Math.cos(want)], [Math.sign(Math.sin(want)), 0], [0, Math.sign(Math.cos(want))]]) {
      const nx = t.x + fx * step; const nz = t.z + fz * step; if (!(open(nx, nz) || (off && passable(nx, nz)))) continue;
      const n = partsIn(nx, nz, Math.sin(t.yaw), Math.cos(t.yaw)); if (n < bestIn) { best = [nx, nz]; bestIn = n; if (!n) break; }
    }
    if (best) {
      t.x = best[0]; t.z = best[1]; t.sp = step / Math.max(dt, 1e-3);
      /* (382 결정 16 A: the step drawn a little toward the middle of its cell, across the way it goes -- the grid's room is kept there) */
      const cx = Math.floor(t.x - x0) + x0 + 0.5; const cz = Math.floor(t.z - z0) + z0 + 0.5; const px = Math.cos(t.yaw); const pz = -Math.sin(t.yaw); const side = (cx - t.x) * px + (cz - t.z) * pz;
      const nx = t.x + px * side * 0.25; const nz = t.z + pz * side * 0.25; if (open(nx, nz) && partsIn(nx, nz, Math.sin(t.yaw), Math.cos(t.yaw)) <= bestIn) { t.x = nx; t.z = nz; }
      return d - step;
    }
    t.sp = 0; return d;
  }
  /* (381 ② 끼임: moving and not 0.5 m on in a second -- back off 1.5 m the way it came, the cells ahead shut to it for 8 s, a new way to
     the same goal) */
  const STUCK_MS = 1000; const SHUT_MS = 8000; const BACK_MS = 700;
  /* (`left`, the steps still to the goal where it has one fixed (a walk about, to its rest, a search): no nearer by half a metre in a second is
     stuck, swinging on the spot too; a chase by the ground covered) */
  function watchStuck(t, now, left = null) {
    const fixed = Number.isFinite(left);
    if (!t.prog || t.prog.fixed !== fixed || (fixed ? left < t.prog.left - 0.5 : Math.hypot(t.x - t.prog.x, t.z - t.prog.z) > 0.5)) { t.prog = { x: t.x, z: t.z, left, fixed, at: now }; return false; }
    if (now - t.prog.at < STUCK_MS) return false;
    t.stuckN += 1; t.goalStuck = (t.goalStuck || 0) + 1; t.prog = { x: t.x, z: t.z, left, fixed, at: now };
    for (const k of [1, 2, 3]) { const c = cellOf(t.x + Math.sin(t.yaw) * k, t.z + Math.cos(t.yaw) * k); if (c >= 0 && c !== cellOf(t.x, t.z)) t.shut.set(c, now + SHUT_MS); }
    for (const [c, until] of t.shut) if (until <= now) t.shut.delete(c);
    t.back = { until: now + BACK_MS, yaw: t.yaw };
    if (t.goal) toGoal(t, t.goal, now, true); /* (383 #14: its cells shut -- a new way) */
    return true;
  }
  function backOff(t, now, dt) {
    if (!t.back || now >= t.back.until) { t.back = null; return false; }
    const step = t.def.walk * 1.4 * dt; const nx = t.x - Math.sin(t.back.yaw) * step; const nz = t.z - Math.cos(t.back.yaw) * step;
    if (open(nx, nz)) { t.x = nx; t.z = nz; t.sp = step / Math.max(dt, 1e-3); } else { t.back = null; t.sp = 0; } /* (only onto their own ground: never back into a trunk) */
    return true;
  }
  // follow the flow to the goal (or straight at it when the line is clear and short)
  function walkFlow(t, v, dt, near = null) {
    if (!t.flow) { t.sp = 0; return Infinity; }
    const g = near && Math.hypot(near.x - t.x, near.z - t.z) < 6 && clearLine(t.x, t.z, near.x, near.z) ? near : downhill(t.flow, t.x, t.z);
    if (!g) { t.sp = 0; return Infinity; }
    t.aim = g; stepToward(t, g.x, g.z, v, dt); const c = cellOf(t.x, t.z); return c >= 0 && t.flow[c] >= 0 ? t.flow[c] : Infinity;
  }

  /* (381 ③ 가로채기: where the one chased will be by the time the tiger is there -- their pace over the gap's time, at most 1.5 s on; kept to
     where they may be chased) */
  function leadPoint(t, p, s) {
    const d = Math.hypot(p.x - t.x, p.z - t.z); const lead = Math.min(1.5, d / t.def.speed); const x = p.x + s.vx * lead; const z = p.z + s.vz * lead;
    return huntable(x, z) ? { x, z } : { x: p.x, z: p.z };
  }
  /* (381 ④ 협공: the farther of two on the same one -- by their safe place's way in when one is within 30 m (outside it: the safe places stay
     theirs), else 8 m ahead of where they run, or across from the other tiger when they stand) */
  const SAFES = [{ x: camp.x, z: camp.z, r: camp.r + 2 }, { x: peak.x, z: peak.z, r: SAFE_PEAK_R }, ...gates.map((g) => ({ x: g.x, z: g.z, r: GATE_R }))];
  function blockPoint(p, s, other) {
    let safe = null; let sd = 30; for (const k of SAFES) { const d = Math.hypot(p.x - k.x, p.z - k.z) - k.r; if (d < sd) { sd = d; safe = k; } }
    let x; let z;
    if (safe) { const d = Math.hypot(p.x - safe.x, p.z - safe.z) || 1; x = safe.x + ((p.x - safe.x) / d) * (safe.r + 4); z = safe.z + ((p.z - safe.z) / d) * (safe.r + 4); }
    else { const v = Math.hypot(s.vx, s.vz); if (v > 1) { x = p.x + (s.vx / v) * 8; z = p.z + (s.vz / v) * 8; } else { const d = Math.hypot(p.x - other.x, p.z - other.z) || 1; x = p.x + ((p.x - other.x) / d) * 4; z = p.z + ((p.z - other.z) / d) * 4; } }
    return huntable(x, z) && nearestOpen(x, z, 4) >= 0 ? { x, z } : { x: p.x, z: p.z };
  }
  function huntTarget(t, people) {
    let best = null; let bd = t.def.see;
    for (const p of people) { if (!huntable(p.x, p.z)) continue; const d = Math.hypot(p.x - t.x, p.z - t.z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  // one tick: every tiger moves on; returns what happened ({ type: 'catch', tiger, token })
  function tick(now, people = []) {
    const events = []; if (!on || !warm(0) && !ready) return events;
    for (const p of people) { const s = seenAt.get(p.token); if (s && now > s.at) { const secs = (now - s.at) / 1000; const vx = (p.x - s.x) / secs; const vz = (p.z - s.z) / secs; const k = Math.min(1, (now - s.at) / 400);
      if (Math.hypot(vx, vz) > 15) { s.vx = 0; s.vz = 0; } else { s.vx += (vx - s.vx) * k; s.vz += (vz - s.vz) * k; } /* (a jump -- moved by the server, the unstuck move: no speed) */ s.x = p.x; s.z = p.z; s.at = now; } else if (!s) seenAt.set(p.token, { x: p.x, z: p.z, at: now, vx: 0, vz: 0 }); }
    for (const token of seenAt.keys()) if (!people.some((p) => p.token === token)) seenAt.delete(token);
    const byToken = new Map(people.map((p) => [p.token, p]));
    for (const t of tigers) {
      const def = t.def; const dt = Math.min(0.25, Math.max(0, (now - (t.at || now)) / 1000)); t.at = now;
      if (!t.placed) { const g = roamGoal(def) || { x: I.x, z: I.z }; place(t, g.x, g.z, now); continue; }
      const resting = restingAt(def, now + clockShift);
      // the pounce plays through, whatever else
      if (t.mode === 'pounce') {
        const s = (now - t.pounce.at) / 1000; const along = leapAt(s, t.pounce.len); t.x = t.pounce.fx + Math.sin(t.pounce.yaw) * along; t.z = t.pounce.fz + Math.cos(t.pounce.yaw) * along; t.sp = 0;
        if (!t.pounce.checked && s >= PAW_S) {
          t.pounce.checked = true; const p = byToken.get(t.target); const px = t.x + Math.sin(t.yaw) * def.paw; const pz = t.z + Math.cos(t.yaw) * def.paw;
          /* (379: from its chest to its paws -- one already under the tiger is caught too, not passed over) */
          const segDist = (q) => { const ax = t.x; const az = t.z; const dx = px - ax; const dz = pz - az; const l2 = dx * dx + dz * dz || 1; const u = Math.max(0, Math.min(1, ((q.x - ax) * dx + (q.z - az) * dz) / l2)); return Math.hypot(q.x - ax - u * dx, q.z - az - u * dz); };
          if (p && huntable(p.x, p.z) && segDist(p) <= def.catchR) { events.push({ type: 'catch', tiger: def, token: p.token }); t.pounce.caught = true; }
        }
        if (s >= POUNCE_S) { if (t.pounce.caught) { t.mode = 'cool'; t.until = now + 4500; t.target = null; setClip(t, 'Growl', now); } else { t.mode = 'chase'; setClip(t, 'Run', now); } t.pounce = null; }
        continue;
      }
      // (382) a swipe, a turning swipe or a lunge plays through: the lunge on its curve, the turn by its own; judged once at its hit
      if (t.mode === 'attack') {
        const a = t.attack; const A = ATTACKS[a.kind]; const R = REACH[def.id]; const s = (now - a.at) / 1000; t.sp = 0;
        const yawEnd = a.yaw + turnAt(a.kind, 1); t.yaw = a.yaw + turnAt(a.kind, s);
        if (a.kind === 'Lunge') { const along = lungeAt(def.id, s); t.x = a.fx + Math.sin(a.yaw) * along; t.z = a.fz + Math.cos(a.yaw) * along; }
        if (!a.checked && s >= A.hit) {
          a.checked = true; const p = byToken.get(t.target); const fx = Math.sin(yawEnd); const fz = Math.cos(yawEnd); const rx = -Math.cos(yawEnd); const rz = Math.sin(yawEnd); /* (its right: -90° of its yaw) */
          const side = a.kind === 'TurnSwipeL' ? -1 : 1; const at = (f, r) => ({ x: a.fx + fx * f + rx * r * side, z: a.fz + fz * f + rz * r * side });
          let hitIt = false;
          if (p && huntable(p.x, p.z)) {
            if (a.kind === 'Lunge') { const m = at(R.mouth, 0); hitIt = segDistTo(p, t.x, t.z, m.x, m.z) <= R.mouthR; }
            else { const c0 = at(1.2, R.claw[1]); const c1 = at(R.claw[0], R.claw[1]); const c2 = at(R.paw[0], R.paw[1]); hitIt = Math.min(segDistTo(p, c0.x, c0.z, c1.x, c1.z), segDistTo(p, c1.x, c1.z, c2.x, c2.z)) <= R.clawR; } /* (from the shoulder out to the claws, then down to where the paw lands: one right under its head is struck too) */
          }
          if (hitIt) { events.push({ type: 'catch', tiger: def, token: p.token, attack: a.kind }); a.caught = true; }
        }
        if (s >= A.len) { t.yaw = yawEnd; if (a.caught) { t.mode = 'cool'; t.until = now + 4500; t.target = null; setClip(t, 'Growl', now); } else { t.mode = 'chase'; setClip(t, 'Run', now); } t.attack = null; }
        continue;
      }
      if (resting && !['rest', 'toRest'].includes(t.mode)) { t.mode = 'toRest'; t.target = null; t.rest = restSpot(def); toGoal(t, t.rest.stand, now); }
      if (!resting && ['rest', 'toRest'].includes(t.mode)) { t.mode = 'idle'; t.until = now + 1500; t.lift = 0; if (t.rest?.lift) { const c = nearestOpen(t.x, t.z, 8); if (c >= 0) { const p = centre(c); t.x = p.x; t.z = p.z; } } setClip(t, 'Look', now); }
      if (t.mode === 'toRest') { if (backOff(t, now, dt)) { setClip(t, 'Walk', now); continue; } const left = walkFlow(t, def.walk, dt); setClip(t, 'Walk', now); watchStuck(t, now, left); const near = Math.hypot(t.x - t.rest.stand.x, t.z - t.rest.stand.z); if (t.sp > 0 || near > 8) t.movedAt = now; /* (there, or stuck a while by it) */
        if (left <= 1 || near < 2.5 || now - (t.movedAt || now) > 2000) { t.mode = 'rest'; t.x = t.rest.lie.x; t.z = t.rest.lie.z; t.lift = t.rest.lift; t.sp = 0; setClip(t, def.restClip, now); } continue; }
      if (t.mode === 'rest') { t.sp = 0; continue; }
      // a chase: the target still there and huntable, under 10 s
      if (t.mode === 'stalk' || t.mode === 'chase') {
        const p = byToken.get(t.target);
        if ((now - t.chaseFrom) / 1000 > GIVE_UP_S) { t.mode = 'cool'; t.until = now + 2000; t.target = null; t.role = null; t.sp = 0; setClip(t, 'Look', now); continue; }
        if (p && huntable(p.x, p.z) && Math.hypot(p.x - t.x, p.z - t.z) <= def.see * LOST_SEE) t.lastSeen = { x: p.x, z: p.z }; /* (382: 3x its sight -- at 1.8x a bike was gone during 안개's stalk) */
        else { /* (381 ③ 놓치면: to where they were last seen, and a look round there) */
          t.role = null; t.target = null; if (t.lastSeen) { t.mode = 'search'; t.lookUntil = 0; t.until = now + 12000; toGoal(t, t.lastSeen, now); setClip(t, 'Walk', now); } else { t.mode = 'cool'; t.until = now + 2000; t.sp = 0; setClip(t, 'Look', now); } continue; }
        // (381 ③ 가로채기 / ④ 협공) where to head for: where they will be -- or, the second of two on the same one, ahead of them or by their safe place's way in
        const s = seenAt.get(p.token) || { vx: 0, vz: 0 };
        const other = tigers.find((o) => o !== t && o.placed && (o.mode === 'stalk' || o.mode === 'chase') && o.target === t.target);
        t.role = other ? (Math.hypot(p.x - t.x, p.z - t.z) <= Math.hypot(p.x - other.x, p.z - other.z) ? 'drive' : 'block') : null;
        const aimAt = t.role === 'block' ? blockPoint(p, s, other) : leadPoint(t, p, s);
        if (now - t.flowAt > 400 || t.flowGoal !== nearestOpen(aimAt.x, aimAt.z, 3)) toGoal(t, aimAt, now);
        if (t.mode === 'stalk') { /* (its low steps till 1.8 s -- cut short when the one stalked runs or comes within 8 m) */
          walkFlow(t, def.stalk, dt, p); setClip(t, 'Stalk', now); const fleeing = Math.hypot(s.vx, s.vz) > 3;
          if (now - t.chaseFrom >= STALK_S * 1000 || fleeing || Math.hypot(p.x - t.x, p.z - t.z) < 8) { t.mode = 'chase'; setClip(t, 'Run', now); } continue; }
        if (backOff(t, now, dt)) { setClip(t, 'Run', now); continue; }
        { /* (382 사용자 결정 12 「달리면서는 덮치기, 멈춰 있고 바로 앞이면 앞발치기 같은 걸로」, assets 159): close by -- before this tick's step -- right ahead a
             swipe, at its side a turning swipe (its right: TurnSwipe, its left: TurnSwipeL), a little way ahead from a near stand a lunge; the pounce
             only on the run, 4.5 m and more ahead (379's 「within 4.5 m whichever way」 is the turning swipe now) */
          const d0 = Math.hypot(p.x - t.x, p.z - t.z); const side = angleTo(t.yaw, Math.atan2(p.x - t.x, p.z - t.z)); const ah = Math.abs(side);
          const still = Math.hypot(s.vx, s.vz) < STILL_V; /* (the near ones for one standing or barely moving -- one running away is the pounce's: a swipe lands 0.43 s on, 2.7 m behind a runner) */
          const RR = REACH[def.id]; const clawTo = RR.claw[0] + 0.5 * RR.clawR; const jawTo = RR.mouth + 0.5 * RR.mouthR; /* (each tiger its own reach: 우레 3.1 / 6.1 m, 안개 2.5 / 4.1 m) */
          const pick = !still ? null : d0 <= clawTo && ah < 0.6 ? 'Swipe' : d0 <= clawTo + 0.4 && ah >= Math.PI / 3 && ah <= (5 * Math.PI) / 6 ? (side < 0 ? 'TurnSwipe' : 'TurnSwipeL')
            : d0 > clawTo && d0 <= jawTo && ah < 0.5 && t.sp <= 3 && leapLine(t.x, t.z, t.x + Math.sin(t.yaw) * RR.lunge, t.z + Math.cos(t.yaw) * RR.lunge) ? 'Lunge' : null;
          if (pick) { t.mode = 'attack'; t.attack = { kind: pick, at: now, fx: t.x, fz: t.z, yaw: t.yaw, checked: false }; setClip(t, pick, now); continue; }
        }
        walkFlow(t, def.speed, dt, Math.hypot(p.x - t.x, p.z - t.z) < 6 ? p : aimAt); setClip(t, 'Run', now);
        if (Math.hypot(p.x - t.x, p.z - t.z) > 3) watchStuck(t, now);
        // the pounce: close enough and ahead -- aimed where the one chased will be when the paws land
        const d = Math.hypot(p.x - t.x, p.z - t.z); const ahead = Math.abs(angleTo(t.yaw, Math.atan2(p.x - t.x, p.z - t.z)));
        /* (377: the leap up to 2.5 times the clip's -- a lunge -- and only once it reaches where the one chased will be; till then the run goes on) */
        const ex = p.x + s.vx * PAW_S; const ez = p.z + s.vz * PAW_S; const reach = Math.hypot(ex - t.x, ez - t.z) - def.paw;
        /* (379 assets 158 검수: into the Pounce only from the Run's 0.40~0.55 s -- else the 0.1 s blend sinks the feet 10~40 cm; the screens play the Run
           from the server's start at speed/run, the same moment) */
        const runPhase = ((((now - t.clipAt) / 1000) * (def.speed / def.run)) % RUN_S + RUN_S) % RUN_S; const stride = t.clip === 'Run' && runPhase >= 0.4 && runPhase <= 0.55;
        /* (382 사용자 결정 12 「달리면서는 덮치기, 멈춰 있고 바로 앞이면 앞발치기 같은 걸로」, assets 159): close by -- right ahead a swipe, at its side a
           turning swipe (its right: TurnSwipe, its left: TurnSwipeL), a little way ahead from a near stand a lunge; the pounce only on the run, 4.5 m
           and more ahead (379's 「within 4.5 m whichever way」 is the turning swipe now) */
        if (stride && d <= Math.max(def.pounceAt * 2, 10) && ahead < 0.6 && d >= (Math.hypot(s.vx, s.vz) < STILL_V ? 4.5 : 2.5) && reach <= def.speed * PAW_S + def.leap) { /* (382: 4.5 m and on at one standing; one running away from 2.5 m) */ /* (377: on from the run -- up to the run's own 0.84 s and the clip's leap more) */
          const yaw = Math.atan2(ex - t.x, ez - t.z);
          const want = Math.max(1, reach); let len = want;
          while (len > 1 && !leapLine(t.x, t.z, t.x + Math.sin(yaw) * len, t.z + Math.cos(yaw) * len)) len -= 0.5;
          if (len < want - 1) continue; /* (something in the way: on with the run till the way is clear) */
          t.yaw = yaw; t.mode = 'pounce'; t.pounce = { at: now, fx: t.x, fz: t.z, yaw, len: Math.round(len * 100) / 100, checked: false }; setClip(t, 'Pounce', now);
        }
        continue;
      }
      if (t.mode === 'search') { /* (381 ③: to the last place seen, then 3 s looking round -- anyone huntable in sight and the stalk begins again) */
        const prey = huntTarget(t, people); if (prey) { t.mode = 'stalk'; t.target = prey.token; t.chaseFrom = now; t.lookUntil = 0; toGoal(t, prey, now); setClip(t, 'Stalk', now); continue; }
        if (!t.lookUntil) { if (backOff(t, now, dt)) { setClip(t, 'Walk', now); continue; } const left = walkFlow(t, def.walk * 1.6, dt); setClip(t, 'Walk', now); watchStuck(t, now, left); if (left <= 2 || !Number.isFinite(left) || now >= t.until || t.goalStuck >= 3) { t.lookUntil = now + 3000; t.sp = 0; setClip(t, 'Look', now); } }
        else if (now >= t.lookUntil) { t.lookUntil = 0; t.lastSeen = null; t.mode = 'cool'; t.until = now + 1500; t.sp = 0; } else t.sp = 0;
        continue;
      }
      if (t.mode === 'cool') { t.sp = 0; if (now >= t.until) { t.mode = 'idle'; t.until = now; } else continue; }
      // roaming: someone near -- the stalk begins
      const prey = huntTarget(t, people);
      if (prey) { t.mode = 'stalk'; t.target = prey.token; t.chaseFrom = now; toGoal(t, prey, now); setClip(t, 'Stalk', now); continue; }
      if (t.mode === 'idle') { t.sp = 0; if (now >= t.until) { const g = roamGoal(def); if (g) { t.mode = 'roam'; toGoal(t, g, now); setClip(t, 'Walk', now); } else t.until = now + 3000; } continue; }
      if (t.mode === 'roam') {
        if (backOff(t, now, dt)) { setClip(t, 'Walk', now); continue; }
        const left = walkFlow(t, def.walk, dt); watchStuck(t, now, left);
        if (left <= 1 || !Number.isFinite(left) || t.goalStuck >= 3) { /* (381 ②: three times stuck on the way -- another place) */ t.mode = 'idle'; t.sp = 0; t.until = now + 3000 + rand() * 5000; const inReeds = def.home === 'swamp' && reeds.some((r) => Math.hypot(r.x - t.x, r.z - t.z) < 5); setClip(t, inReeds ? 'Crouch' : rand() < 0.5 ? 'Look' : 'Idle', now); }
        else setClip(t, 'Walk', now);
      }
    }
    return events;
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const view = () => (on ? tigers.filter((t) => t.placed).map((t) => ({ id: t.def.id, x: r2(t.x), z: r2(t.z), yaw: Math.round(t.yaw * 1000) / 1000, clip: t.clip, at: t.clipAt, sp: r2(t.sp), lift: t.lift, ...(t.pounce ? { leap: { x: r2(t.pounce.fx), z: r2(t.pounce.fz), yaw: Math.round(t.pounce.yaw * 1000) / 1000, len: t.pounce.len, at: t.pounce.at } } : {}),
    ...(t.attack ? { attack: { kind: t.attack.kind, x: r2(t.attack.fx), z: r2(t.attack.fz), yaw: Math.round(t.attack.yaw * 1000) / 1000, at: t.attack.at } } : {}) /* (382: every screen plays it from the same start) */ })) : []);
  return {
    TIGERS, warm, ready: () => ready, tick, view, huntable, safeAt, gateNear, open, nearestOpen,
    setOn: (v) => { on = Boolean(v); }, isOn: () => on, setClockShift: (ms) => { clockShift = Number(ms) || 0; },
    place: (id, x, z, now, yaw) => { const t = tigers.find((k) => k.def.id === id); if (t) { warm(); place(t, x, z, now); if (Number.isFinite(yaw)) t.yaw = yaw; } return Boolean(t); }, /* (382: facing `yaw` -- tests) */
    state: () => tigers.map((t) => ({ id: t.def.id, x: r2(t.x), z: r2(t.z), yaw: Math.round(t.yaw * 100) / 100, mode: t.mode, clip: t.clip, target: t.target, placed: t.placed, aim: t.aim ? { x: r2(t.aim.x), z: r2(t.aim.z) } : null, role: t.role, stuck: t.stuckN })),
    seen: (token) => seenAt.get(token) || null,
    cellCount: () => { let n = 0; for (let c = 0; c < NN; c += 1) if (cells[c] === 3) n += 1; return n; },  };
}

module.exports = { TIGERS, SCALE, GIVE_UP_S, STALK_S, POUNCE_S, PAW_S, LEAP_FROM, leapAt, ATTACKS, REACH, turnAt, lungeAt, s01, kstHour, restingAt, losable, losePick, createTigers };
