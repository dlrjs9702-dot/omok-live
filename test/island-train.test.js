'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const T = require('../public/plaza/island-terrain.js');
const R = require('../public/plaza/island-train.js');
const { boot } = require('../test-support/test-server');

test('관광열차: 해안2역·8자1노선·4대, 보행 여유와 중앙 입체 교차', () => {
  assert.deepEqual(Object.keys(R.STATIONS), ['B', 'D']);
  assert.deepEqual(Object.keys(R.LINES), ['tour']);
  assert.deepEqual(R.TRAINS.map(t => t.id), [1,2,3,4]); assert.equal(R.PLATFORMS.length,2);
  for(const st of Object.values(R.STATIONS)) assert.ok(T.walkable(...st.entry));
  const r=R.LINES.tour.route;
  for(let i=0;i<r.S.length;i++) {
    const p=R.pointAt('tour',r.S[i]);
    for(const w of [-1.56,0,1.56]) {const x=p.x+Math.cos(p.yaw)*w,z=p.z-Math.sin(p.yaw)*w;
      if(T.walkable(x,z)) assert.ok(p.y-R.CAR.under-T.heightAt(x,z)>=R.CLEAR,'보행 여유');}
  }
  const center=r.S.filter((_,i)=>Math.hypot(r.xs[i],r.zs[i])<1).map(s=>R.pointAt('tour',s).y);
  assert.ok(Math.max(...center)-Math.min(...center)>5.5,'중앙광장을 높이가 다른 두 구간으로 통과');
  for(const p of R.PLATFORMS) assert.ok(Math.abs(p.y-p.car.y-.55)<1e-9);
});

test('관광열차 시간표: 반바퀴120초·이동114초·정차6초·회차240초·60초 간격', () => {
  assert.equal(R.CYCLE,240);assert.equal(R.TRAVEL,114);assert.equal(R.DWELL,6);
  const at=(id,s)=>R.timetableAt(id,s*1000);
  assert.equal(at(1,0).stop,null);assert.equal(at(1,114).stop,'D');assert.equal(at(1,119.9).stop,'D');
  assert.equal(at(1,120).stop,null);assert.equal(at(1,234).stop,'B');assert.equal(at(1,240).from,'B');
  assert.deepEqual(R.TRAINS.map(t=>t.offset),[0,60,120,180]);
  const traffic=R.createTraffic(0);
  for(let sec=0;sec<960;sec+=.25) {
    for(const c of traffic.advance(sec*1000).clocks) {assert.equal(c.held,false);assert.equal(c.cursor,sec*1000);}
    const keys=traffic.reservations().flatMap(r=>r.keys);assert.equal(new Set(keys).size,keys.length);
  }
});

test('관광열차 안전정지: 막힌 블록과 후속열차 대기, 해제 뒤 위치 보존', () => {
  const traffic=R.createTraffic(0);traffic.block('tour:zone:0',true);
  const stopped=traffic.advance(300000);
  assert.equal(stopped.clocks[0].cursor,0);assert.equal(stopped.clocks[0].held,true);
  assert.ok(stopped.clocks.every(c=>c.held),'후속열차도 점유 블록 앞에서 대기');
  const keys=traffic.reservations().flatMap(r=>r.keys);assert.equal(new Set(keys).size,keys.length);
  const cars=stopped.clocks.map(c=>{const st=R.timetableAt(c.id,c.cursor);return R.pointAt(st.line,st.s);});
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++) assert.ok(Math.hypot(cars[i].x-cars[j].x,cars[i].y-cars[j].y,cars[i].z-cars[j].z)>8,'역 점유 시 후속열차는 접안 전에 대기');
  traffic.block('tour:zone:0',false);const resumed=traffic.advance(301000);
  assert.equal(resumed.clocks[0].cursor,1000);
  R.setService(stopped);assert.equal(R.trainAt(1,400000).s,R.timetableAt(1,0).s);
  R.setService(resumed);assert.ok(Math.abs(R.trainAt(1,301500).s-R.timetableAt(1,1500).s)<1e-8);
  R.setService(null);
});

test('관광열차 서버: 탑승창·4좌석 경합·이동 잠금·운행중 하차 금지·두 해안역·이탈 좌석 해제', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'train-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const riders = []; for (let i = 0; i < 5; i++) riders.push(await server.enter(await server.issue('승객' + i)));
  const a = riders[0]; const A = R.stationOf('B'); const C = R.stationOf('D');
  for(const stop of ['A','C']) assert.equal((await req('/api/island/train/platform',a,{stop,line:'tour'})).status,400,'폐쇄 역 탑승 금지');
  const shiftTo = (sec) => { const now = Date.now(); const target = Math.ceil(now / 240000) * 240000 + sec * 1000; return req('/api/test/train-shift', a, { ms: target - now }); };
  for (const rider of riders) await req('/api/plaza/state', rider, { ...A.spot, yaw: 0, moving: false });
  for (const rider of riders) assert.equal((await req('/api/island/train/platform', rider, { stop: 'B', line: 'tour' })).status, 200);
  const deck = R.PLATFORMS.find(p => p.station === 'B' && p.line === 'tour');
  const walked = await req('/api/plaza/state', a, { x: deck.x, z: deck.z, moving: true });
  assert.ok(Math.hypot(walked.data.x - deck.x, walked.data.z - deck.z) < .01, '승강장 안에서 이동');
  const escaped = await req('/api/plaza/state', a, { x: 0, z: 0, moving: true });
  assert.equal(escaped.data.corrected, true);
  const bounded = R.platformClamp('tour', 'B', escaped.data.x, escaped.data.z);
  assert.ok(Math.hypot(bounded.x - escaped.data.x, bounded.z - escaped.data.z) < 1e-8, '선로·공중으로 이동 금지');
  assert.equal((await req('/api/island/train/platform', a, { stop: 'D', line: 'tour' })).data.error, 'TOO_FAR');
  await shiftTo(40);
  assert.equal((await req('/api/island/train/board', a, { stop: 'B' })).data.error, 'NO_TRAIN');
  assert.equal((await req('/api/island/train/board', a, { stop: 'nowhere' })).status, 400);
  await shiftTo(236);
  assert.equal((await req('/api/island/train/board', a, { stop: 'B', line: 'outer' })).status, 400);
  const seats = new Set();
  for (const rider of riders.slice(0, 4)) { const on = await req('/api/island/train/board', rider, { stop: 'B', line: 'tour' }); assert.equal(on.status, 200, JSON.stringify(on.data)); assert.equal(on.data.train, 1); seats.add(on.data.seat); }
  assert.equal(seats.size, 4);
  assert.equal((await req('/api/island/train/board', riders[4], { stop: 'B' })).data.error, 'TRAIN_FULL');
  assert.equal((await req('/api/island/train/board', a, { stop: 'B' })).data.error, 'ALREADY_RIDING');
  const pose = await req('/api/plaza/state', a, { x: 0, z: 0, yaw: 0, moving: true });
  assert.equal(pose.data.ride.id, 1); assert.equal(pose.data.corrected, false); assert.ok(pose.data.trainService);
  await shiftTo(280); assert.equal((await req('/api/island/train/alight', a, {})).data.error, 'MOVING');
  const above = await req('/api/plaza/state', a, { x: 0, z: 0 });
  await req('/api/island/train/platform', riders[4], { stop: 'B', line: 'ground' });
  const below = await req('/api/plaza/state', riders[4], { x: above.data.x, z: above.data.z });
  assert.equal(below.data.corrected, false, '공중 탑승자가 지상 보행자 충돌을 만들지 않음');
  await shiftTo(356); const off = await req('/api/island/train/alight', a, {});
  assert.equal(off.status, 200, JSON.stringify(off.data)); assert.equal(off.data.stop, 'D'); assert.equal(off.data.platform.station, 'D'); assert.equal(off.data.platform.line, 'tour');
  assert.equal((await req('/api/island/train/platform', a, { stop: 'D', line: 'tour' })).status, 200);
  await shiftTo(356); const transfer = await req('/api/island/train/board', a, { stop: 'D', line: 'tour' });
  assert.equal(transfer.status, 200, JSON.stringify(transfer.data)); assert.equal(transfer.data.train, 1);
  await req('/api/plaza/leave', a, {});
  assert.equal((await req('/api/island/train/alight', a, {})).data.error, 'NOT_RIDING');
  const after = await req('/api/plaza/state', a, { ...C.spot, yaw: 0, moving: false }); assert.equal(after.data.ride, null); assert.equal(after.data.platform, null);
  assert.equal((await req('/api/island/train/board', a, { stop: 'D', line: 'tour' })).data.error, 'TOO_FAR', '지상에서 공중 좌석 직접 탑승 금지');
});

// The entire docking corridor must clear the platform, including the rotating carriage corners.
test('열차 접근: 승강기 다리·길 여유, 해상 기둥만 1/3, 긴 순항 선로와 승강장 출발 여유', () => {
  for (const id of Object.keys(R.STATIONS)) {
    const lift = R.liftOf(id); assert.ok(T.walkDist(lift.x, lift.z) >= 3.2);
    assert.ok(T.nature().rocks.every(p=>T.segDist(p.x,p.z,...R.STATIONS[id].entry,lift.x,lift.z)>=1+p.s),'접근로 돌 간섭 제거');
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) assert.equal(Boolean(T.onBridge(lift.x + dx, lift.z + dz)), false, id + ' bridge clearance');
  }
  assert.ok(R.LINES.tour.route.LENGTH > 2200);
  assert.ok(R.PILLARS.every(p => T.coastDist(p.x, p.z) < 0)); assert.equal(R.PILLARS.length, 28, '기존 해상84개에서1/3');
  for (const L of Object.values(R.LINES)) {
    const r=L.route;
    for(let i=0;i<r.S.length;i+=3) for(let j=i+3;j<r.S.length;j+=3) {
      const gap=Math.min(r.S[j]-r.S[i],r.LENGTH-r.S[j]+r.S[i]); if(gap<20) continue;
      if(Math.hypot(r.xs[i]-r.xs[j],r.zs[i]-r.zs[j])<3.5) assert.ok(Math.abs(r.ys[i]-r.ys[j])>=4,'같은 선로의 평면 교차 금지');
    }
  }
  for (const [line,L] of Object.entries(R.LINES)) for(let s=0;s<L.route.LENGTH;s++) {
    const a=R.pointAt(line,s-3),b=R.pointAt(line,s+3);
    const turn=Math.abs(Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw)));
    assert.ok(turn <= 6/18, line + ' 전체 코스 완만한 회전');
  }
  for (const p of R.PLATFORMS) {
    const r = R.LINES[p.line].route;
    for (let i = 0; i < r.S.length; i++) {
      const q = R.pointAt(p.line, r.S[i]); if (Math.abs(q.y + .575 - p.y) > .6) continue;
      const dx = q.x - p.x, dz = q.z - p.z;
      const axes = [p.yaw, p.yaw + Math.PI / 2, q.yaw, q.yaw + Math.PI / 2];
      const separate = axes.some(a => { const ux = Math.cos(a), uz = -Math.sin(a);
        const radius = (yaw, w, l) => Math.abs(Math.cos(yaw) * ux - Math.sin(yaw) * uz) * w + Math.abs(Math.sin(yaw) * ux + Math.cos(yaw) * uz) * l;
        return Math.abs(dx * ux + dz * uz) >= radius(p.yaw, 1.65, 2.65) + radius(q.yaw, 1.56, 2.26) - .001;
      });
      assert.ok(separate, p.station + ':' + p.line + ' carriage intersects platform at ' + r.S[i]);
    }
  }
});
