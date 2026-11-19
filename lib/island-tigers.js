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
  Object.freeze({ id: 'ure', name: '우레', model: 'byeolmaru.tiger', speed: 11, turn: 2.6, walk: 2.5, run: 10.92, stalk: 0.89, warn: 25, see: 25, pounceAt: 5.1, leap: 4.6, paw: 2.1, catchR: 2.4, rest: [12, 14], restClip: 'Nap', home: 'rock' }),
  Object.freeze({ id: 'angae', name: '안개', model: 'byeolmaru.tiger_angae', speed: 11, turn: 7.0, walk: 1.99, run: 8.74, stalk: 0.7, warn: 12, see: 18, pounceAt: 4.5, leap: 3.69, paw: 1.73, catchR: 2.1, rest: [4, 6], restClip: 'Doze', home: 'swamp' }),
]);
const SCALE = 2.4; const BODY = 0.9; /* (half the body's width at 2.4x -- off every solid by this) */
const GIVE_UP_S = 25; /* (377 사용자 「포기를 25초까지」) */ const STALK_S = 1.8; const POUNCE_S = 1.3; const PAW_S = 0.84; const LEAP_FROM = 0.42;
const SAFE_PEAK_R = 14; const GATE_R = 12; const FENCE_IN = 4; const INSIDE = FENCE_IN + 2; const ROCK_LIFT = 1.44; /* (152e README: 우레 on his rock, 0.9 x 1.6) */
const KEEP_USES = new Set(['tool', 'bike', 'pet', 'errand']);
const kstHour = (ms) => new Date(ms + 9 * 3600000).getUTCHours();
const restingAt = (def, ms) => { const h = kstHour(ms); return h >= def.rest[0] && h < def.rest[1]; };
const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
// the leap of a pounce (377 사용자 「제자리 멈춰서 ... 앞으로 좀 멀리 뛰어오르게」): on from the run's own speed, straight across `len` till the paws
// land at 0.84 s, there after (the clip's own root motion taken out on the screens -- they draw this same line)
const leapAt = (s, len) => (s <= 0 ? 0 : s >= PAW_S ? len : (len * s) / PAW_S);

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
  const freeAt = (x, z) => D.newIsleCoast(x, z) > INSIDE && T.walkable(x, z) && T.isle2Clear(x, z, BODY) && !safeAt(x, z) && !gateNear(x, z);
  function warm(budgetMs = Infinity) {
    if (ready) return true; const until = Date.now() + budgetMs;
    while (built < NN) { const i = built % N; const j = (built - i) / N; cells[built] = freeAt(x0 + i + 0.5, z0 + j + 0.5) ? 2 : 1; built += 1; if ((built & 255) === 0 && Date.now() >= until) return false; }
    // the largest joined piece
    const seen = new Int32Array(NN).fill(-1); const q = new Int32Array(NN); let best = -1; let bestN = 0;
    for (let s = 0; s < NN; s += 1) {
      if (cells[s] !== 2 || seen[s] >= 0) continue; let h = 0; let t = 0; q[t++] = s; seen[s] = s;
      while (h < t) { const c = q[h++]; const ci = c % N; for (const [di, dj] of NB) { const ni = ci + di; const nj = (c - ci) / N + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (cells[n] === 2 && seen[n] < 0) { seen[n] = s; q[t++] = n; } } }
      if (t > bestN) { bestN = t; best = s; }
    }
    for (let c = 0; c < NN; c += 1) if (cells[c] === 2 && seen[c] === best) cells[c] = 3;
    ready = true; return true;
  }
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
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
  // steps from every open cell to `goal` (8 ways, each a step)
  function flowTo(goal, into) {
    const dist = into || new Int32Array(NN); dist.fill(-1); if (goal < 0) return dist; const q = new Int32Array(NN); let h = 0; let t = 0; q[t++] = goal; dist[goal] = 0;
    while (h < t) { const c = q[h++]; const ci = c % N; const cj = (c - ci) / N; for (const [di, dj] of NB) { const ni = ci + di; const nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (cells[n] !== 3 || dist[n] >= 0) continue; if (di && dj && (cells[cj * N + ni] !== 3 || cells[nj * N + ci] !== 3)) continue; /* (no corner cut past a solid) */ dist[n] = dist[c] + 1; q[t++] = n; } }
    return dist;
  }
  // a point a few cells down the flow from (x, z) -- where to head for
  function downhill(dist, x, z, steps = 6) {
    let c = nearestOpen(x, z, 3); if (c < 0 || dist[c] < 0) return null; let seen = centre(c); /* (the farthest one down the way still in a straight clear line -- or first the middle of its own cell) */
    for (let k = 0; k < steps && dist[c] > 0; k += 1) { const ci = c % N; const cj = (c - ci) / N; let next = c; for (const [di, dj] of NB) { const ni = ci + di; const nj = cj + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue; const n = nj * N + ni; if (di && dj && (cells[cj * N + ni] !== 3 || cells[nj * N + ci] !== 3)) continue; /* (as the flow: no corner cut) */ if (dist[n] >= 0 && dist[n] < dist[next]) next = n; } if (next === c) break; c = next; const p = centre(c); if (clearLine(x, z, p.x, p.z)) seen = p; else break; }
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
  const tigers = TIGERS.map((def) => ({ def, x: 0, z: 0, yaw: 0, mode: 'wait', clip: 'Idle', clipAt: 0, sp: 0, lift: 0, until: 0, goal: null, flow: null, flowAt: 0, flowGoal: -1, target: null, chaseFrom: 0, pounce: null, placed: false }));
  const setClip = (t, clip, now) => { if (t.clip !== clip) { t.clip = clip; t.clipAt = now; } };
  function place(t, x, z, now) { const c = nearestOpen(x, z, 20); const p = c >= 0 ? centre(c) : { x, z }; Object.assign(t, { x: p.x, z: p.z, mode: 'idle', until: now + 2000, target: null, pounce: null, lift: 0, sp: 0, placed: true }); setClip(t, 'Idle', now); }
  function toGoal(t, goal, now) { t.goal = goal; const c = goal ? nearestOpen(goal.x, goal.z, 4) : -1; t.flowGoal = c; t.flow = c >= 0 ? flowTo(c, t.flow) : null; t.flowAt = now; }
  // a step toward (gx, gz) at up to `v` m/s, turning at its own rate (우레 slows on a sharp turn -- he swings wide)
  function stepToward(t, gx, gz, v, dt) {
    const want = Math.atan2(gx - t.x, gz - t.z); const diff = angleTo(t.yaw, want); const turn = Math.max(-t.def.turn * dt, Math.min(t.def.turn * dt, diff)); t.yaw += turn;
    const k = Math.max(0.25, Math.cos(Math.min(Math.PI / 2, Math.abs(diff)))); const sp = v * (t.def.turn < 4 ? k : Math.max(0.6, k));
    const d = Math.hypot(gx - t.x, gz - t.z); const step = Math.min(d, sp * dt); const off = !open(t.x, t.z); /* (landed off their ground after a leap: back onto it) */
    for (const [fx, fz] of [[Math.sin(t.yaw), Math.cos(t.yaw)], [Math.sin(want), Math.cos(want)], [Math.sign(Math.sin(want)), 0], [0, Math.sign(Math.cos(want))]]) { /* (on, or toward the aim, or sliding along a side past a corner) */ const nx = t.x + fx * step; const nz = t.z + fz * step; if (open(nx, nz) || (off && passable(nx, nz))) { t.x = nx; t.z = nz; t.sp = step / Math.max(dt, 1e-3); return d - step; } }
    t.sp = 0; return d;
  }
  // follow the flow to the goal (or straight at it when the line is clear and short)
  function walkFlow(t, v, dt, near = null) {
    if (!t.flow) { t.sp = 0; return Infinity; }
    const g = near && Math.hypot(near.x - t.x, near.z - t.z) < 6 && clearLine(t.x, t.z, near.x, near.z) ? near : downhill(t.flow, t.x, t.z);
    if (!g) { t.sp = 0; return Infinity; }
    t.aim = g; stepToward(t, g.x, g.z, v, dt); const c = cellOf(t.x, t.z); return c >= 0 && t.flow[c] >= 0 ? t.flow[c] : Infinity;
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
          if (p && huntable(p.x, p.z) && Math.hypot(p.x - px, p.z - pz) <= def.catchR) { events.push({ type: 'catch', tiger: def, token: p.token }); t.pounce.caught = true; }
        }
        if (s >= POUNCE_S) { if (t.pounce.caught) { t.mode = 'cool'; t.until = now + 4500; t.target = null; setClip(t, 'Growl', now); } else { t.mode = 'chase'; setClip(t, 'Run', now); } t.pounce = null; }
        continue;
      }
      if (resting && !['rest', 'toRest'].includes(t.mode)) { t.mode = 'toRest'; t.target = null; t.rest = restSpot(def); toGoal(t, t.rest.stand, now); }
      if (!resting && ['rest', 'toRest'].includes(t.mode)) { t.mode = 'idle'; t.until = now + 1500; t.lift = 0; if (t.rest?.lift) { const c = nearestOpen(t.x, t.z, 8); if (c >= 0) { const p = centre(c); t.x = p.x; t.z = p.z; } } setClip(t, 'Look', now); }
      if (t.mode === 'toRest') { const left = walkFlow(t, def.walk, dt); setClip(t, 'Walk', now); const near = Math.hypot(t.x - t.rest.stand.x, t.z - t.rest.stand.z); if (t.sp > 0 || near > 8) t.movedAt = now; /* (there, or stuck a while by it) */
        if (left <= 1 || near < 2.5 || now - (t.movedAt || now) > 2000) { t.mode = 'rest'; t.x = t.rest.lie.x; t.z = t.rest.lie.z; t.lift = t.rest.lift; t.sp = 0; setClip(t, def.restClip, now); } continue; }
      if (t.mode === 'rest') { t.sp = 0; continue; }
      // a chase: the target still there and huntable, under 10 s
      if (t.mode === 'stalk' || t.mode === 'chase') {
        const p = byToken.get(t.target);
        if (!p || !huntable(p.x, p.z) || (now - t.chaseFrom) / 1000 > GIVE_UP_S) { t.mode = 'cool'; t.until = now + 2000; t.target = null; t.sp = 0; setClip(t, 'Look', now); continue; }
        if (now - t.flowAt > 400 || t.flowGoal !== nearestOpen(p.x, p.z, 3)) toGoal(t, p, now);
        if (t.mode === 'stalk') { /* (its low steps till 1.8 s -- cut short when the one stalked runs or comes within 8 m) */
          walkFlow(t, def.stalk, dt, p); setClip(t, 'Stalk', now); const s = seenAt.get(p.token); const fleeing = s && Math.hypot(s.vx, s.vz) > 3;
          if (now - t.chaseFrom >= STALK_S * 1000 || fleeing || Math.hypot(p.x - t.x, p.z - t.z) < 8) { t.mode = 'chase'; setClip(t, 'Run', now); } continue; }
        walkFlow(t, def.speed, dt, p); setClip(t, 'Run', now);
        // the pounce: close enough and ahead -- aimed where the one chased will be when the paws land
        const d = Math.hypot(p.x - t.x, p.z - t.z); const ahead = Math.abs(angleTo(t.yaw, Math.atan2(p.x - t.x, p.z - t.z)));
        /* (377: the leap up to 2.5 times the clip's -- a lunge -- and only once it reaches where the one chased will be; till then the run goes on) */
        const s = seenAt.get(p.token) || { vx: 0, vz: 0 }; const ex = p.x + s.vx * PAW_S; const ez = p.z + s.vz * PAW_S; const reach = Math.hypot(ex - t.x, ez - t.z) - def.paw;
        if (d <= Math.max(def.pounceAt * 2, 10) && ahead < 0.6 && reach <= def.speed * PAW_S + def.leap) { /* (377: on from the run -- up to the run's own 0.84 s and the clip's leap more) */
          const yaw = Math.atan2(ex - t.x, ez - t.z);
          const want = Math.max(1, reach); let len = want;
          while (len > 1 && !leapLine(t.x, t.z, t.x + Math.sin(yaw) * len, t.z + Math.cos(yaw) * len)) len -= 0.5;
          if (len < want - 1) continue; /* (something in the way: on with the run till the way is clear) */
          t.yaw = yaw; t.mode = 'pounce'; t.pounce = { at: now, fx: t.x, fz: t.z, yaw, len: Math.round(len * 100) / 100, checked: false }; setClip(t, 'Pounce', now);
        }
        continue;
      }
      if (t.mode === 'cool') { t.sp = 0; if (now >= t.until) { t.mode = 'idle'; t.until = now; } else continue; }
      // roaming: someone near -- the stalk begins
      const prey = huntTarget(t, people);
      if (prey) { t.mode = 'stalk'; t.target = prey.token; t.chaseFrom = now; toGoal(t, prey, now); setClip(t, 'Stalk', now); continue; }
      if (t.mode === 'idle') { t.sp = 0; if (now >= t.until) { const g = roamGoal(def); if (g) { t.mode = 'roam'; toGoal(t, g, now); setClip(t, 'Walk', now); } else t.until = now + 3000; } continue; }
      if (t.mode === 'roam') {
        const left = walkFlow(t, def.walk, dt);
        if (left <= 1 || !Number.isFinite(left)) { t.mode = 'idle'; t.sp = 0; t.until = now + 3000 + rand() * 5000; const inReeds = def.home === 'swamp' && reeds.some((r) => Math.hypot(r.x - t.x, r.z - t.z) < 5); setClip(t, inReeds ? 'Crouch' : rand() < 0.5 ? 'Look' : 'Idle', now); }
        else setClip(t, 'Walk', now);
      }
    }
    return events;
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const view = () => (on ? tigers.filter((t) => t.placed).map((t) => ({ id: t.def.id, x: r2(t.x), z: r2(t.z), yaw: Math.round(t.yaw * 1000) / 1000, clip: t.clip, at: t.clipAt, sp: r2(t.sp), lift: t.lift, ...(t.pounce ? { leap: { x: r2(t.pounce.fx), z: r2(t.pounce.fz), yaw: Math.round(t.pounce.yaw * 1000) / 1000, len: t.pounce.len, at: t.pounce.at } } : {}) })) : []);
  return {
    TIGERS, warm, ready: () => ready, tick, view, huntable, safeAt, gateNear, open, nearestOpen,
    setOn: (v) => { on = Boolean(v); }, isOn: () => on, setClockShift: (ms) => { clockShift = Number(ms) || 0; },
    place: (id, x, z, now) => { const t = tigers.find((k) => k.def.id === id); if (t) { warm(); place(t, x, z, now); } return Boolean(t); },
    state: () => tigers.map((t) => ({ id: t.def.id, x: r2(t.x), z: r2(t.z), yaw: Math.round(t.yaw * 100) / 100, mode: t.mode, clip: t.clip, target: t.target, placed: t.placed, aim: t.aim ? { x: r2(t.aim.x), z: r2(t.aim.z) } : null })),
    seen: (token) => seenAt.get(token) || null,
    cellCount: () => { let n = 0; for (let c = 0; c < NN; c += 1) if (cells[c] === 3) n += 1; return n; },
  };
}

module.exports = { TIGERS, SCALE, GIVE_UP_S, STALK_S, POUNCE_S, PAW_S, LEAP_FROM, leapAt, kstHour, restingAt, losable, losePick, createTigers };
