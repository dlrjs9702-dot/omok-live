const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { JsonAccessStore } = require('../lib/access-store');

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
