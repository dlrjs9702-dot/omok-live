'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore } = require('../lib/point-store');
const { testDatabase } = require('../test-support/pg-database');

for (const mode of ['JSON', 'PostgreSQL']) test(`${mode}: 다중스택 지급/판매 멱등·만료분실물 견적·저장된 은퇴미션 복구`, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'island-economy-'));
  const database = mode === 'PostgreSQL' ? await testDatabase() : null;
  const store = database ? new PostgresPointStore(database.url) : new JsonPointStore(path.join(dir, 'points.json'));
  t.after(async () => { if (store.pool) await store.pool.end(); if (database) await database.stop(); await fs.rm(dir, { recursive: true, force: true }); });
  await store.init();
  const userId = 'guest:11111111-1111-4111-8111-111111111111';
  const give = claimId => store.islandGive({ userId, itemId: 'berry', qty: 99, claimId });
  assert.equal((await give('integrity-berry-001')).applied, true);
  assert.equal((await give('integrity-berry-002')).applied, true);
  assert.equal((await give('integrity-berry-002')).applied, false);
  assert.deepEqual((await store.islandBag(userId)).items.map(e => e.qty), [99, 99]);
  const before = (await store.getAccount(userId)).balance;
  const sale = await store.islandSell({ userId, requestId: 'integrity-sale-001', place: 'merchant' }, Date.now());
  assert.equal(sale.paid, 198000);
  assert.equal((await store.islandSell({ userId, requestId: 'integrity-sale-001', place: 'merchant' }, Date.now())).applied, false);
  assert.equal((await store.getAccount(userId)).balance, before + 198000);
  assert.equal((await store.islandBag(userId)).items.length, 0);
  await store.islandGive({ userId, claimId: 'integrity-lost-001', itemId: 'lost', meta: { eventId: 'expired' } });
  assert.equal((await store.islandBag(userId, [])).items[0].at, 'office');
  assert.equal((await store.islandBag(userId, ['expired'])).items[0].at, 'owner');
  assert.equal((await store.islandSell({ userId, requestId: 'integrity-lost-sale-001', place: 'office', activeLost: [] }, Date.now())).paid, 10000);

  const catchRaw = { userId, claimId: 'integrity-fish-cast-001', itemId: 'fish_octopus', dexEntry: 'fish_octopus' };
  const caught = await Promise.all(Array.from({ length: 4 }, () => store.islandGive(catchRaw)));
  assert.equal(caught.filter(r => r.applied).length, 1);
  for (const reply of caught) assert.deepEqual(reply.dex, { entry: 'fish_octopus', count: 1, first: true });
  assert.equal((await store.dexOf(userId)).fish_octopus.count, 1);
  await store.islandGive({ userId, claimId: 'integrity-wallet-full-001', itemId: 'wallet', qty: 15 });
  const herb = { userId, claimId: 'integrity-full-herb-001', itemId: 'herb', dexEntry: 'herb' };
  assert.equal((await store.islandGive(herb)).reason, 'full');
  assert.equal((await store.dexOf(userId)).herb, undefined, 'full bag cannot increment the dex');
  await store.islandSell({ userId, requestId: 'integrity-free-slot-001', place: 'fisher' }, Date.now());
  assert.equal((await store.islandGive(herb)).applied, true, 'rejected claim remains retryable');
  assert.equal((await store.dexOf(userId)).herb.count, 1);
  if (database) {
    const other = 'guest:22222222-2222-4222-8222-222222222222';
    await store.pool.query("ALTER TABLE island_dex ADD CONSTRAINT test_dex_fault CHECK (entry <> 'berry') NOT VALID");
    const raw = { userId: other, claimId: 'integrity-dex-rollback-001', itemId: 'berry', dexEntry: 'berry' };
    await assert.rejects(store.islandGive(raw), /test_dex_fault/);
    assert.equal((await store.islandBag(other)).items.length, 0, 'dex failure rolls bag grant back');
    await store.pool.query('ALTER TABLE island_dex DROP CONSTRAINT test_dex_fault');
    assert.equal((await store.islandGive(raw)).applied, true);
    assert.equal((await store.dexOf(other)).berry.count, 1);
  }

  const previousEnv = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  try { await store.testSetMissions(userId, ['play3', 'win1', 'marathon_play']); }
  finally { if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv; }
  const migrated = await store.missions(userId);
  const replacement = migrated.missions.find(m => !['play3', 'win1'].includes(m.id));
  assert.notEqual(replacement.id, 'marathon_play');
  assert.equal(replacement.reward, 2500);
  assert.equal(migrated.missions.length, 3);
  assert.deepEqual((await store.missions(userId)).missions, migrated.missions, 'assignment persists rather than changing per view');
  const gameType = replacement.id === 'light_play' ? 'yut' : replacement.id.replace(/_play$/, '');
  const match = { userId, matchId: 'integrity-mission-match-001', gameType, result: 'draw', soleWinner: false, clean: true, opponents: [] };
  const done = await store.recordMissionMatch(match);
  assert.equal(done.rewards.find(r => r.id === replacement.id).amount, 2500);
  assert.equal((await store.recordMissionMatch(match)).applied, false);
  assert.equal((await store.ledger(userId)).filter(r => r.reason === 'daily_mission').length, 1);
});
