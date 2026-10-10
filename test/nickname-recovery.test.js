'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonPointStore, PostgresPointStore, NICKNAME_FEE } = require('../lib/point-store');
const { JsonAccessStore, PostgresAccessStore } = require('../lib/access-store');
const { recoverNicknamePayments } = require('../lib/nickname-recovery');
const { testDatabase } = require('../test-support/pg-database');

for (const mode of ['JSON', 'PostgreSQL']) test(`${mode}: 개명 환불 재시도 재결제·중복방지·실제 저장 전후 재시작 복구`, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nickname-recovery-'));
  const database = mode === 'PostgreSQL' ? await testDatabase() : null;
  const pools = new Set();
  t.after(async () => {
    for (const pool of pools) await pool.end();
    if (database) await database.stop();
    await fs.rm(dir, { recursive: true, force: true });
  });
  const make = async () => {
    const store = database ? new PostgresPointStore(database.url, { initialGrant: 300000 }) : new JsonPointStore(path.join(dir, 'points.json'), { initialGrant: 300000 });
    if (store.pool) pools.add(store.pool);
    await store.init();
    return store;
  };
  let store = await make();
  const access = database ? new PostgresAccessStore(database.url) : new JsonAccessStore(path.join(dir, 'keys.json'));
  if (access.pool) pools.add(access.pool);
  await access.init();
  const key = await access.create('이전이름', 'recovery-secret');
  const userId = `guest:${key.id}`;
  const now = Date.now();
  const raw = { userId, requestId: 'recovery-name-001', name: '새이름' };
  await store.ensureAccount(userId);
  assert.equal((await store.chargeNickname(raw, now)).applied, true);
  assert.equal(await store.refundNickname(raw), true);
  assert.equal(await store.refundNickname(raw), false);
  const second = await store.chargeNickname(raw, now);
  assert.equal(second.applied, true);
  assert.equal(second.attempt, 2);
  assert.equal((await store.getAccount(userId)).balance, 300000 - NICKNAME_FEE);
  assert.equal((await store.chargeNickname(raw, now)).applied, false);
  assert.equal((await store.chargeNickname({ ...raw, name: '다른이름' }, now)).reason, 'request');
  assert.equal(await store.refundNickname(raw), true);
  assert.equal(await store.refundNickname(raw), false);
  assert.equal((await store.getAccount(userId)).balance, 300000);
  const rows = await store.ledger(userId);
  assert.equal(rows.filter(row => row.reason === 'nickname').length, 2);
  assert.equal(rows.filter(row => row.reason === 'nickname_refund').length, 2);
  assert.equal(new Set(rows.filter(row => row.reason.startsWith('nickname')).map(row => row.idempotencyKey)).size, 4);

  // Abrupt exit after durable payment but before the access-key label write.
  const interrupted = { ...raw, requestId: 'recovery-name-002' };
  await store.chargeNickname(interrupted, now);
  store = await make();
  assert.deepEqual(await recoverNicknamePayments(store, access), { completed: 0, refunded: 1 });
  assert.equal((await store.getAccount(userId)).balance, 300000);
  assert.equal(await store.nicknameState(userId), null);
  assert.equal((await access.list()).find(k => k.id === key.id).label, '이전이름');
  assert.deepEqual(await recoverNicknamePayments(store, access), { completed: 0, refunded: 0 });

  // Abrupt exit after the actual durable label write but before completion acknowledgement.
  await store.chargeNickname(interrupted, now);
  await access.rename(key.id, interrupted.name);
  store = await make();
  assert.deepEqual(await recoverNicknamePayments(store, access), { completed: 1, refunded: 0 });
  assert.equal((await store.getAccount(userId)).balance, 300000 - NICKNAME_FEE);
  assert.equal((await store.nicknameRequest(interrupted.requestId)).pending, false);
  assert.equal((await access.list()).find(k => k.id === key.id).label, interrupted.name);
  assert.deepEqual(await recoverNicknamePayments(store, access), { completed: 0, refunded: 0 });
});
