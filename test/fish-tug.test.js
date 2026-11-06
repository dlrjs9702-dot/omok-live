'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../public/fish-tug.js');
const F = require('../lib/island-fishing');

// v1.10.259 대어 줄다리기 (docs/fishing-minigames-20261104.md 3절): holding throughout snaps the line, never holding lets it go,
// letting go while it fights (a standard player: 0.2 s late) lands every big one in 10~20 s; holds out of order or claimed
// before the request came are refused
const seeded = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const standard = (p, late = 200) => { // held except while it fights, let go `late` ms into each fight
  const holds = []; let down = 0;
  for (const f of p.fights) { if (f.at + late > down) holds.push([down, f.at + late]); down = f.at + f.len; }
  holds.push([down, null]); return holds.filter(([d]) => d <= T.LIMIT_MS);
};
test('줄다리기: 계속 누르면 끊김, 안 누르면 도망, 힘쓸 때 떼면 잡힘(대어별 10~20초), 꾸민 입력 거절', () => {
  const bigs = Object.keys(F.SPECIES).filter((sp) => F.SPECIES[sp].grade === 'big');
  assert.equal(bigs.length, 11); assert.deepEqual(Object.keys(T.STRENGTH).sort(), [...bigs].sort());
  assert.ok(T.STRENGTH.king_catfish >= T.STRENGTH.giant_squid && T.STRENGTH.golden_carp === Math.min(...Object.values(T.STRENGTH)));
  const table = [];
  for (const sp of bigs) {
    const times = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const p = T.plan(sp, seeded(seed));
      assert.equal(T.run(p, [[0, null]]).end, 'snap', `${sp} 계속 누르기`);
      assert.equal(T.run(p, []).end, 'escaped', `${sp} 안 누르기`);
      const r = T.run(p, standard(p)); assert.equal(r.end, 'caught', `${sp} ${seed} 표준`); times.push(r.t);
      assert.ok(r.t >= T.fastestMs(p));
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length / 1000; table.push(`${sp} ${T.STRENGTH[sp]} → ${avg.toFixed(1)}s`);
    assert.ok(avg >= 10 && avg <= 20, `${sp} 평균 ${avg.toFixed(1)}s`);
  }
  console.log(`대어별 세기 → 평균 걸린 시간 (표준: 힘쓸 때 0.2초 늦게 떼기)\n${table.join('\n')}`);
  // the server's judge: the same holds from its clock; claimed before the request came, or out of order, refused
  const p = T.plan('salmon', seeded(9)); const holds = standard(p); const r = T.run(p, holds);
  assert.equal(T.judge(p, holds, r.t + 100).end, 'caught');
  assert.equal(T.judge(p, holds, r.t - T.LATE_MS - 500).end, 'bad', '도착보다 이른 잡기');
  assert.equal(T.judge(p, [[500, 400]], 30000).end, 'bad'); assert.equal(T.judge(p, [[1000, 2000], [1500, 3000]], 30000).end, 'bad'); assert.equal(T.judge(p, 'x', 30000).end, 'bad');
  assert.equal(T.judge(p, [[0, null]], 30000).end, 'snap'); assert.equal(T.judge(p, [], 30000).end, 'escaped');
});

// the server: a big one's arrows answer 「대어다!」 with the plan (nothing in the bag yet); holds that land it before they could
// have come are refused; the same holds sent when they could have come land it -- into the bag; a snapped line, nothing
test('줄다리기 서버: 대어다! 계획, 이른 잡기 거절, 제때 잡기는 가방에, 끊기면 없음', async (t) => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path');
  const { boot } = require('../test-support/test-server'); const Terr = require('../public/plaza/island-terrain.js');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fish-tug-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server; const s = await server.enter(await server.issue('줄다리기')); assert.ok(s, server.logs());
  await req('/api/plaza/state', s, { x: Terr.PIER.x, z: Terr.PIER.z, yaw: 0, moving: false }); await req('/api/test/island/give', s, { itemId: 'fishing_rod', qty: 1 });
  const bite = async () => { const c = (await req('/api/island/fish/start', s, {})).data; await req('/api/test/fish/bite', s, { species: 'salmon' }); const r = await req('/api/island/fish/finish', s, { fishId: c.fishId, presses: c.seq.slice(0, 12).map((dir, i) => ({ dir, t: i * 150 })) }); return { c, r }; };
  const salmon = async () => ((await req('/api/island/bag', s)).data.items || []).find((e) => e.itemId === 'fish_salmon')?.qty || 0;
  let { c, r } = await bite(); assert.equal(r.status, 200); assert.equal(r.data.tug.name, '연어'); assert.equal(await salmon(), 0, '줄다리기 전에는 가방에 없음');
  const plan = r.data.tug.plan; const holds = standard(plan); const end = T.run(plan, holds); assert.equal(end.end, 'caught');
  const early = await req('/api/island/fish/tug', s, { fishId: c.fishId, holds }); assert.equal(early.status, 409, '이른 잡기');
  ({ c, r } = await bite()); const plan2 = r.data.tug.plan; const holds2 = standard(plan2); const end2 = T.run(plan2, holds2);
  await req('/api/test/fish/bite', s, { tugAge: end2.t + 200 }); // (as if that long has passed since the 「대어다!」)
  const landed = await req('/api/island/fish/tug', s, { fishId: c.fishId, holds: holds2 }); assert.equal(landed.status, 200, JSON.stringify(landed.data));
  assert.deepEqual([landed.data.species, landed.data.grade], ['salmon', 'big']); assert.equal(await salmon(), 1);
  ({ c, r } = await bite()); await req('/api/test/fish/bite', s, { tugAge: 26000 });
  const snapped = await req('/api/island/fish/tug', s, { fishId: c.fishId, holds: [[0, null]] }); assert.deepEqual([snapped.status, snapped.data.error], [409, 'FISH_SNAP']); assert.equal(await salmon(), 1);
});
