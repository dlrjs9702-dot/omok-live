'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');

// (Codex 검토 2026-10-25 #2) two players at the same insect at once: one gets it, the other is told it is gone -- the
// insect is taken before the bag's wait, not after. A few insects, each raced by a fresh pair standing by it (a first
// pose is taken where it is said), two tries each at once.
test('곤충 동시 잡기: 두 계정이 같은 곤충을 동시에 잡으면 한쪽만', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bug-race-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const first = await server.enter(await server.issue('곤충손0')); assert.ok(first, server.logs());
  const list = (await req('/api/island/insects', first)).data.list.slice(0, 4); assert.ok(list.length > 0);
  for (const [k, bug] of list.entries()) {
    const pair = [await server.enter(await server.issue(`곤충손${k}A`)), await server.enter(await server.issue(`곤충손${k}B`))];
    for (const s of pair) { await req('/api/test/island/give', s, { itemId: 'bugnet', qty: 1 }); await req('/api/plaza/state', s, { x: bug.x, z: bug.z, yaw: 0, moving: false }); }
    const replies = await Promise.all([0, 1, 0, 1].map((i) => req('/api/island/insect/catch', pair[i], { id: bug.id })));
    const won = replies.map((r, i) => (r.status === 200 ? i % 2 : null)).filter((x) => x !== null);
    assert.equal(new Set(won).size, 1, `${bug.id}: ${replies.map((r) => `${r.status} ${r.data.error || ''}`).join(' / ')}`);
    for (const r of replies) if (r.status !== 200) assert.equal(r.data.error, 'BUG_GONE');
    const bags = await Promise.all(pair.map(async (s) => ((await req('/api/island/bag', s)).data.items || []).filter((e) => e.itemId.startsWith('insect_')).reduce((n, e) => n + e.qty, 0)));
    assert.deepEqual(bags.sort(), [0, 1], `${bug.id}: 한 사람만 가방에`);
  }
  assert.ok(!(await req('/api/island/insects', first)).data.list.some((x) => list.some((y) => y.id === x.id)), '모두에게서 사라짐');
  // (Codex 검토 #8) running up to one (faster than a walk, by the server's own poses): it flies off, for everyone
  const left = (await req('/api/island/insects', first)).data.list; const bug = left[0]; assert.ok(bug);
  const runner = await server.enter(await server.issue('달리는손')); await req('/api/test/island/give', runner, { itemId: 'bugnet', qty: 1 });
  await req('/api/plaza/state', runner, { x: bug.x - 0.9, z: bug.z, yaw: 0, moving: true });
  await new Promise((r) => setTimeout(r, 120));
  await req('/api/plaza/state', runner, { x: bug.x, z: bug.z, yaw: 0, moving: true }); // (0.9 m in about 0.12 s: a run)
  const ran = await req('/api/island/insect/catch', runner, { id: bug.id });
  assert.deepEqual([ran.status, ran.data.error], [409, 'BUG_SCARED']);
  assert.ok(!(await req('/api/island/insects', first)).data.list.some((x) => x.id === bug.id), '달아남');
});
