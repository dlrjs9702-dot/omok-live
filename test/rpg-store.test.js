'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonRpgStore } = require('../lib/rpg-store');

test('원정 저장소: 자동/수동 칸 분리·seq 멱등·신원별 목록·lease·정리', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rpg-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'saves.json');
  const store = new JsonRpgStore(file);
  await store.init();
  const base = { runId: 'r1', schemaVersion: 1, party: { 1: 'guest:a', 2: 'guest:b' } };

  assert.deepEqual(await store.save({ ...base, slot: 'auto', seq: 1, state: { time: 1 } }), { saved: true });
  assert.deepEqual(await store.save({ ...base, slot: 'auto', seq: 1, state: { time: 999 } }), { saved: false }, '같은 seq 재전송은 무시');
  assert.deepEqual(await store.save({ ...base, slot: 'auto', seq: 0, state: { time: 0 } }), { saved: false }, '오래된 seq는 무시');
  assert.deepEqual(await store.save({ ...base, slot: 'manual', seq: 2, state: { time: 2 } }), { saved: true });
  assert.deepEqual(await store.save({ ...base, slot: 'auto', seq: 3, state: { time: 3 } }), { saved: true });
  const loaded = await store.load('r1');
  assert.deepEqual([loaded.auto.state.time, loaded.manual.state.time], [3, 2], '자동저장이 수동 칸을 덮지 않는다');
  await assert.rejects(store.save({ ...base, slot: 'other', seq: 9, state: {} }));

  const reopened = new JsonRpgStore(file);
  await reopened.init();
  assert.equal((await reopened.load('r1')).auto.state.time, 3, '파일에서 다시 읽힌다');

  assert.equal((await store.listForIdentity('guest:a')).length, 1);
  assert.equal((await store.listForIdentity('guest:zzz')).length, 0);

  assert.equal(await store.acquireLease('r1', 'room-1', 1000), true);
  assert.equal(await store.acquireLease('r1', 'room-2', 1000), false, '다른 방은 이어받을 수 없다');
  assert.equal(await store.acquireLease('r1', 'room-1', 1000), true, '같은 방은 갱신');
  await store.releaseLease('r1', 'room-1');
  assert.equal(await store.acquireLease('r1', 'room-2', 1000), true);
  await store.releaseLease('r1', 'room-2');

  assert.equal(await store.purge(60_000), 0);
  assert.equal(await store.purge(-1), 1, '오래된 원정은 정리된다');
  assert.equal((await store.listForIdentity('guest:a')).length, 0);
});
