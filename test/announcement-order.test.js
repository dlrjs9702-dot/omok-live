'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { JsonAnnouncementStore, PostgresAnnouncementStore } = require('../lib/announcement-store');

const input = [
  { id: 'old', title: 'v1.6.9', body: '', pinned: false, releaseKey: 'v1.6.9', createdAt: '2026-09-18T10:00:00Z' },
  { id: '25', title: 'v1.6.25', body: '', pinned: false, releaseKey: 'v1.6.25', createdAt: '2026-09-18T00:00:00Z' },
  { id: '24', title: 'v1.6.24', body: '', pinned: false, releaseKey: 'v1.6.24', createdAt: '2026-09-18T01:25:00Z' },
  { id: 'manual', title: '일반 공지', body: '', pinned: false, releaseKey: null, createdAt: '2026-09-19T10:00:00Z' },
  { id: 'pinned', title: '고정 공지', body: '', pinned: true, releaseKey: null, createdAt: '2026-09-01T00:00:00Z' },
];
const expected = ['pinned', '25', '24', 'old', 'manual'];

test('JSON notices: pinned first, release versions descending despite inconsistent timestamps, then ordinary notices', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'notice-order-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const store = new JsonAnnouncementStore(path.join(dir, 'notices.json'));
  await store.init();
  store.rows = input.map(row => ({ ...row }));
  assert.deepEqual((await store.list()).map(row => row.id), expected);
});

test('Postgres notices use same ordering and apply the 50-item limit after version sorting', async () => {
  const store = new PostgresAnnouncementStore('postgres://example.invalid/db');
  const rows = [...input.map(row => ({ id: row.id, title: row.title, body: row.body, pinned: row.pinned,
    release_key: row.releaseKey, created_at: row.createdAt, updated_at: row.createdAt }))];
  for (let i = 1; i <= 55; i += 1) rows.push({ id: `extra${i}`, title: `v1.7.${i}`, body: '', pinned: false,
    release_key: `v1.7.${i}`, created_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-01T00:00:00Z' });
  store.pool = { async query(sql) {
    assert.match(sql, /ORDER BY pinned DESC, created_at DESC/);
    assert.doesNotMatch(sql, /LIMIT 50/);
    return { rows };
  } };
  const items = await store.list();
  assert.equal(items.length, 50);
  assert.equal(items[0].id, 'pinned');
  assert.equal(items[1].id, 'extra55');
  assert.equal(items.at(-1).id, 'extra7');
});
