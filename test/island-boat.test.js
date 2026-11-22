'use strict';
// 1.10.390 N3-b 자연 구역 탐방선 (public/plaza/island-boat.js; notes docs/n3-plan-20261120.md §4-2, 사용자 결정 37): the boats' rules -- always
// four, back to two and two when quiet, crossed both ways both stay, four seats then the next boat, the queue in order, no two in one
// berth, the waiting spot then a berth -- and their water: both lanes and every berth over water, off the land, the bridge's piers and the
// train's pillars
const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../public/plaza/island-boat.js');
const T = require('../public/plaza/island-terrain.js'); const R = require('../public/plaza/island-train.js');
const D = T.dalmaru; const SEA = D.SEA ?? -0.6;
const landD = (x, z) => Math.max(D.coastDist(x, z), D.newIsleCoast(x, z)); // (> 0 on land; < 0 the distance out over the water)

test('탐방선 물길: 두 줄 모두 1 m마다 물 위, 뭍에서 선체 2 m 넘게, 다리 기둥·열차 기둥에서 2 m 넘게, 다리 밑 8 m/s로 약 28초', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const E = T.bridges.find((b) => b.high); const piers = [-16, -9, 9, 16].flatMap((u) => [-3.0, 3.0].map((v) => ({ x: E.x + u, z: E.z + v, r: 0.8 }))); /* (1.10.407 assets 170: the wide one's piers at v ±3.0, their feet 0.8) */
  const pillars = (R.PILLARS || []).map((p) => ({ x: p.x ?? p[0], z: p.z ?? p[1] }));
  for (const [from, to] of [['dal', 'byeol'], ['byeol', 'dal']]) {
    /* (1.10.409 결정 75 · assets 172: a rider's crossing -- off a boarding berth ahead (a metre sideways first), the lane, into the other side's
       unloading berth ahead (its last metre sideways); dock-maneuver §5 about 42 ~ 45 s, here its own pieces' paces) */
    const p = B.pathOf(from, 0, to, 2); assert.ok(p.ms > 36000 && p.ms < 55000, `${from}: ${p.ms}`);
    const bad = [];
    for (const s of p.samples) {
      if (s.kind !== 'lane') continue; /* (the berths' own ways: the next test, hull by hull) */
      const off = -landD(s.x, s.z) - B.NODES.beam / 2 - 0.1; if (off < 2) bad.push(`land ${s.x.toFixed(1)},${s.z.toFixed(1)} ${off.toFixed(1)}`);
      for (const o of piers) if (Math.hypot(s.x - o.x, s.z - o.z) - o.r - 1.6 < 2) bad.push(`pier ${s.x.toFixed(1)},${s.z.toFixed(1)}`);
      for (const o of pillars) if (Math.hypot(s.x - o.x, s.z - o.z) - 1.6 < 2) bad.push(`pillar ${s.x.toFixed(1)},${s.z.toFixed(1)}`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${from} -> ${to}`);
  }
  // the two ways apart: no point of one within 3.5 m of the other's (the boats 3.2 wide) but at the ends
  const a = B.pathOf('dal', 0, 'byeol', 2).samples; const b = B.pathOf('byeol', 0, 'dal', 2).samples;
  const close = a.filter((s) => s.kind === 'lane' && b.some((q) => q.kind === 'lane' && Math.hypot(q.x - s.x, q.z - s.z) < 3.5)); assert.deepEqual(close.length, 0);
});

/* (1.10.409 결정 75 · dock-maneuver §4 시험: every way -- each crossing from each berth to the unloading one or the waiting spot, the empty boat's shift
   into each boarding berth, the waiting spot's way in -- every sample's hull deep enough (but the old shallow stretch under the high bridge, as before),
   off both floats and arms, sideways a metre at most each time, the bow the way it goes ahead (15°) and astern (180° ± 15°)) */
test('172 넓은 부두 길: 모든 길 선체 깊은 물 · 뜬 판·팔과 안 겹침 · 옆으로 1 m까지 · 앞으로 15° / 뒤로 180° ± 15°', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const hull = (s) => { const out = []; const sn = Math.sin(s.yaw); const c = Math.cos(s.yaw); for (let u = -4; u <= 4; u += 0.5) for (const v of [-1.6, 0, 1.6]) out.push([s.x + sn * u + c * v, s.z + c * u - sn * v]); return out; };
  const onFloat = (x, z) => (T.DOCKS || []).some((k) => k.rects.some((r) => Math.abs((x - r.x) * r.ux + (z - r.z) * r.uz) <= r.half && Math.abs(-(x - r.x) * r.uz + (z - r.z) * r.ux) <= r.w / 2));
  const ways = []; for (const [f, t] of [['dal', 'byeol'], ['byeol', 'dal']]) for (const k of [0, 1, 2]) for (const to of [2, -1]) ways.push([`${f}:${k}>${t}:${to}`, B.pathOf(f, k, t, to)]);
  for (const id of ['dal', 'byeol']) { ways.push([`${id} moor`, B.moorPath(id)]); for (const k of [0, 1]) ways.push([`${id} shift ${k}`, B.shiftPath(id, k)]); }
  const bad = [];
  for (const [name, p] of ways) {
    let sideRun = 0;
    p.samples.forEach((s, i) => {
      if (Math.hypot(s.x - 59.35, s.z - 140) > 20) for (const [x, z] of hull(s)) if (T.ground(x, z) >= SEA - 1.0) { bad.push(`${name} shallow ${x.toFixed(1)},${z.toFixed(1)}`); break; }
      for (const [x, z] of hull(s)) if (onFloat(x, z)) { bad.push(`${name} float ${x.toFixed(1)},${z.toFixed(1)}`); break; }
      if (!i) return; const a = p.samples[i - 1]; const ds = Math.hypot(s.x - a.x, s.z - a.z);
      sideRun = s.kind === 'side' ? sideRun + ds : 0; if (sideRun > 1 + 1e-6) bad.push(`${name} sideways ${sideRun.toFixed(2)}`);
      if (s.kind === 'side' || ds < 1e-6) return; const go = Math.atan2(s.x - a.x, s.z - a.z); const want = s.kind === 'astern' ? s.yaw + Math.PI : s.yaw;
      const off = Math.abs(Math.atan2(Math.sin(go - want), Math.cos(go - want))) * 180 / Math.PI; if (off > 15) bad.push(`${name} bow ${off.toFixed(0)}° at ${s.x.toFixed(1)},${s.z.toFixed(1)}`);
    });
    const e = p.samples.at(-1); if (name.endsWith(':2') || name.includes('moor')) { const id = name.includes('moor') ? name.split(' ')[0] : name.split('>')[1].split(':')[0]; const u = B.DOCKS[id].berths[2]; if (Math.hypot(e.x - u.x, e.z - u.z) > 0.05) bad.push(`${name} ends off its berth`); }
    if (name.includes('shift')) { const [id, , k] = name.split(' '); const u = B.DOCKS[id].berths[+k]; if (Math.hypot(e.x - u.x, e.z - u.z) > 0.05) bad.push(`${name} ends ${Math.hypot(e.x - u.x, e.z - u.z).toFixed(2)} m off its berth`); }
  }
  assert.deepEqual(bad.slice(0, 10), []);
  /* (dock-maneuver §5: the empty boat's shift about 41 s into the outer berth, 45 s into the inner) */
  for (const id of ['dal', 'byeol']) { const s0 = B.shiftPath(id, 0).ms; const s1 = B.shiftPath(id, 1).ms; assert.ok(s0 > 35000 && s0 < 48000 && s1 > s0, `${id} shift ${s0} ${s1}`); }
});

test('탐방선 대는 자리: 선착장마다 셋 + 앞바다 대기, 선체(8 × 3.2) 모두 물 위·바닥 1 m 넘게 깊음, 서로 안 겹침, 뜬 판과도 안 겹침', { skip: !T.dalmaru && '달마루섬 전용' }, () => {
  const hull = (b) => { const out = []; for (let u = -4; u <= 4; u += 0.5) for (const v of [-1.6, 0, 1.6]) out.push({ x: b.x + Math.sin(b.yaw) * u + Math.cos(b.yaw) * v, z: b.z + Math.cos(b.yaw) * u - Math.sin(b.yaw) * v }); return out; };
  for (const d of Object.values(B.DOCKS)) {
    const spots = [...d.berths, d.offshore];
    for (const s of spots) for (const p of hull(s)) { assert.ok(landD(p.x, p.z) < -0.3, `${d.id} hull on land ${p.x.toFixed(1)},${p.z.toFixed(1)}`); assert.ok(T.ground(p.x, p.z) < SEA - 1.0, `${d.id} shallow ${p.x.toFixed(1)},${p.z.toFixed(1)} ${T.ground(p.x, p.z).toFixed(2)}`); assert.ok(!T.onDock?.(p.x, p.z) && !(T.DOCKS || []).some((k) => k.rects.some((r) => Math.abs((p.x - r.x) * r.ux + (p.z - r.z) * r.uz) <= r.half && Math.abs(-(p.x - r.x) * r.uz + (p.z - r.z) * r.ux) <= r.w / 2)), `${d.id} on the float`); }
    for (let i = 0; i < spots.length; i += 1) for (let j = i + 1; j < spots.length; j += 1) assert.ok(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z) > 3.4, `${d.id} ${i} ${j}`);
    const f = d.float; const realFloat = (d.id === 'dal' ? T.DOCK : T.DOCK2); assert.ok(Math.hypot(realFloat.x - f.x, realFloat.z - f.z) < 0.01, `${d.id} float as the island's`);
    for (const k of [0, 1, 2]) { const e = B.exitOf(d.id, k); assert.ok(T.walkable(e.x, e.z), `${d.id} exit ${k}`); assert.ok(Math.hypot(e.x - d.berths[k].x, e.z - d.berths[k].z) < (k < 2 ? 5 : 7), `${d.id} exit ${k} by its boat`); } /* (the third lies off the float's end) */
  }
});

// a crowd of callers on a fleet whose crossings are quick (scale 10): the rules hold at every step, quiet it ends two and two
function run(fleet, events, until) {
  let now = 0; const seen = [];
  const check = () => { assert.equal(fleet.boats.length, 4); for (const d of ['dal', 'byeol']) { const at = fleet.boats.filter((b) => b.at === d && b.phase !== 'sail' && b.phase !== 'wait'); const berths = at.map((b) => b.berth); assert.equal(new Set(berths).size, berths.length, `berth twice at ${d}`); assert.ok(berths.every((k) => k >= 0 && k < 3)); } };
  for (; now <= until; now += 250) { for (const e of events.filter((x) => x.at === now)) seen.push(e.fn(now)); B.tick(fleet, now); check(); }
  return { now, seen };
}
test('탐방선 규칙: 늘 4척, 조용해지면 2척 / 2척, 엇갈려 건너면 둘 다 머묾, 4자리 넘으면 다음 배, 배 없으면 온 순서대로', () => {
  { const f = B.createFleet({ now: 0, scale: 10 }); // 엇갈려 건넘
    const r = run(f, [{ at: 0, fn: (n) => B.board(f, 'dal', 'a', n) }, { at: 0, fn: (n) => B.board(f, 'byeol', 'b', n) }], 20000);
    assert.ok(r.seen.every((x) => x.ok)); assert.deepEqual(['dal', 'byeol'].map((d) => f.boats.filter((b) => b.at === d && b.phase === 'docked').length), [2, 2]); assert.equal(B.riderOf(f, 'a'), null); }
  { const f = B.createFleet({ now: 0, scale: 10 }); // 한쪽에서만 둘 → 건너편 4척 → 2척이 빈 배로 돌아감
    run(f, [{ at: 0, fn: (n) => B.board(f, 'dal', 'a', n) }, { at: 1000, fn: (n) => B.board(f, 'dal', 'b', n) }], 60000); /* (409: the shifts and the waiting spot take their time) */
    assert.deepEqual(['dal', 'byeol'].map((d) => f.boats.filter((b) => b.at === d && b.phase === 'docked').length), [2, 2]); }
  { const f = B.createFleet({ now: 0, scale: 10 }); // 5명: 4명이 차면 바로, 5번째는 옆 배
    const res = ['a', 'b', 'c', 'd', 'e'].map((t) => B.board(f, 'dal', t, 0)); assert.ok(res.every((x) => x.ok));
    assert.equal(res[0].boat.phase, 'sail', 'full: it goes at once'); assert.notEqual(res[4].boat.id, res[0].boat.id); assert.equal(res[4].boat.phase, 'hold'); }
  { const f = B.createFleet({ now: 0, scale: 10 }); // 배가 없을 때: 줄, 온 순서대로 태움
    const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']; const at0 = names.map((t) => B.board(f, 'dal', t, 0));
    assert.ok(at0.slice(0, 8).every((x) => x.ok)); assert.ok(at0[8].queued && at0[8].place === 1 && at0[9].place === 2 && at0[8].etaMs > 0);
    const boarded = []; let now = 0; for (; now < 30000 && boarded.length < 2; now += 250) boarded.push(...B.tick(f, now).boarded.map((x) => x.token));
    assert.deepEqual(boarded, ['i', 'j']); }
  { const f = B.createFleet({ now: 0 }); const r = B.board(f, 'dal', 'a', 0); assert.equal(r.boat.phase, 'hold'); // 떠나기 전 내리기
    assert.ok(B.leave(f, 'a', 1000).ok); assert.equal(r.boat.phase, 'docked'); B.board(f, 'dal', 'a', 2000); B.tick(f, 2000 + B.HOLD); assert.equal(B.leave(f, 'a', 2000 + B.HOLD + 10).error, 'SAILING'); }
  { const f = B.createFleet({ now: 0 }); const v = B.view(f, 0); assert.ok(!JSON.stringify(v).includes('"a"')); B.board(f, 'dal', 'secret-token', 0); assert.ok(!JSON.stringify(B.view(f, 10)).includes('secret-token'), 'no tokens to the pages'); }
});

test('탐방선 자세: 떠날 때 대는 자리에서, 다리 밑을 지나, 닿을 때 대는 자리 방향으로; 의자 자리는 배와 같이 움직임', () => {
  const f = B.createFleet({ now: 0 }); const r = B.board(f, 'dal', 'a', 0); B.tick(f, B.HOLD); const b = r.boat; assert.equal(b.phase, 'sail');
  const p0 = B.poseAt(b, B.HOLD); const berth = B.DOCKS.dal.berths[b.berthFrom]; assert.ok(Math.hypot(p0.x - berth.x, p0.z - berth.z) < 0.01); assert.ok(Math.abs(p0.yaw - berth.yaw) < 1e-6);
  const p = B.pathOf(b.from, b.berthFrom, b.to, b.berthTo); let under = false; for (let t = 0; t < p.ms; t += 200) { const q = B.poseAt(b, B.HOLD + t); if (Math.hypot(q.x - 59.35, q.z - 140) < 5) under = true; }
  assert.ok(under, 'under the bridge'); const end = B.poseAt(b, B.HOLD + p.ms); const to = b.berthTo >= 0 ? B.DOCKS.byeol.berths[b.berthTo] : B.DOCKS.byeol.offshore; assert.ok(Math.hypot(end.x - to.x, end.z - to.z) < 0.01 && Math.abs(Math.atan2(Math.sin(end.yaw - to.yaw), Math.cos(end.yaw - to.yaw))) < 1e-6);
  const s = B.seatAt(p0, 0); assert.ok(Math.hypot(s.x - p0.x, s.z - p0.z) < 1.2); assert.ok(Math.abs(s.y - (0.8 - B.SEAT_DROP)) < 1e-9);
});
