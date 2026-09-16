const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { JsonAccessStore, PostgresAccessStore } = require('../lib/access-store');

test('취소된 입장 키는 같은 토큰으로 복구할 수 있고 영구 삭제하면 사라진다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-access-store-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonAccessStore(path.join(dir, 'access-keys.json'));
  await store.init();

  const token = 'a'.repeat(48);
  const created = await store.create('테스트 기기', token);
  assert.equal((await store.validateAndRecord(token)).id, created.id);

  const revoked = await store.revoke(created.id);
  assert.ok(revoked.revokedAt);
  assert.equal(await store.validateAndRecord(token), null);

  const restored = await store.restore(created.id);
  assert.equal(restored.revokedAt, null);
  assert.equal((await store.validateAndRecord(token)).id, created.id);

  await store.remove(created.id);
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.validateAndRecord(token), null);
});


test('관리자 메모는 저장과 재시작 후에도 유지되고 복구 후에도 남는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-note-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'access-keys.json');
  const store = new JsonAccessStore(file);
  await store.init();
  const token = 'b'.repeat(48);
  const created = await store.create('테스트', token);
  assert.equal(created.adminNote, '');
  assert.equal((await store.setNote(created.id, '우성 회사 PC')).adminNote, '우성 회사 PC');
  const restarted = new JsonAccessStore(file);
  await restarted.init();
  assert.equal((await restarted.list())[0].adminNote, '우성 회사 PC');
  await restarted.revoke(created.id);
  await restarted.restore(created.id);
  assert.equal((await restarted.list())[0].adminNote, '우성 회사 PC');
  assert.equal((await restarted.setNote(created.id, '')).adminNote, '');
  assert.equal(await restarted.setNote('not-a-key', '메모'), null);
});

test('기존 JSON 입장키는 메모가 없어도 조회하고 입력할 수 있다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-legacy-note-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'access-keys.json');
  await fs.writeFile(file, JSON.stringify({ keys: [{id: 'legacy', label: '기존 사용자', tokenHash: 'hash', revokedAt: null}] }));
  const store = new JsonAccessStore(file);
  await store.init();
  assert.equal((await store.list())[0].adminNote, '');
  await store.setNote('legacy', '기존 메모 입력');
  assert.equal((await store.list())[0].adminNote, '기존 메모 입력');
});

test('PostgreSQL은 기존 테이블에 메모 컬럼을 추가하고 매개변수로 저장한다', async () => {
  const queries = [];
  const store = new PostgresAccessStore('postgres://mock:mock@localhost:5432/mock');
  store.pool = { query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: params ? [{ id: params[0], label: '테스트', admin_note: params[1] }] : [] };
  }};
  await store.init();
  assert.match(queries[1].sql, /ADD COLUMN IF NOT EXISTS admin_note/);
  const result = await store.setNote('test-uuid', '관리자 메모');
  assert.equal(result.adminNote, '관리자 메모');
  assert.deepEqual(queries[2].params, ['test-uuid', '관리자 메모']);
  assert.match(queries[2].sql, /RETURNING .*admin_note/);
});
