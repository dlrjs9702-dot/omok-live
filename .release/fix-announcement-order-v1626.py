from pathlib import Path


def change(path, old, new):
    file = Path(path)
    content = file.read_text(encoding='utf-8')
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one anchor, found {count}: {old[:65]!r}')
    file.write_text(content.replace(old, new, 1), encoding='utf-8')


store = 'lib/announcement-store.js'
change(store, 'function map(row) {', '''// Pinned notices remain first. Release notices use semantic patch versions rather
// than potentially inaccurate publication timestamps; ordinary notices use dates.
function releaseVersion(row) {
  const match = /^v(\\d+)\\.(\\d+)\\.(\\d+)$/.exec(String(row.releaseKey || row.release_key || ''));
  return match ? match.slice(1).map(Number) : null;
}

function compareAnnouncements(a, b) {
  const pinOrder = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
  if (pinOrder) return pinOrder;
  const left = releaseVersion(a);
  const right = releaseVersion(b);
  if (Boolean(left) !== Boolean(right)) return left ? -1 : 1;
  if (left) {
    for (let i = 0; i < 3; i += 1) {
      if (left[i] !== right[i]) return right[i] - left[i];
    }
  }
  return String(b.createdAt || b.created_at || '').localeCompare(String(a.createdAt || a.created_at || ''));
}

function map(row) {''')
change(store, '''    return this.rows.slice().sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50).map(row => ({ ...row }));''',
       '''    return this.rows.slice().sort(compareAnnouncements).slice(0, 50).map(row => ({ ...row }));''')
change(store, '''    const result = await this.pool.query('SELECT id, title, body, pinned, release_key, created_at, updated_at FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 50');
    return result.rows.map(map);''',
       '''    const result = await this.pool.query('SELECT id, title, body, pinned, release_key, created_at, updated_at FROM announcements ORDER BY pinned DESC, created_at DESC');
    return result.rows.map(map).sort(compareAnnouncements).slice(0, 50);''')

# Update the release version without altering historical publication dates or text.
for filename in ('package.json', 'package-lock.json', 'server.js', 'public/index.html'):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    if '1.6.25' not in text:
        raise RuntimeError(f'{filename}: old version missing')
    path.write_text(text.replace('1.6.25', '1.6.26'), encoding='utf-8')

notices = Path('lib/release-announcements.js')
text = notices.read_text(encoding='utf-8')
assert "key: 'v1.6.25'" in text and "key: 'v1.6.26'" not in text
assert text.endswith('];\n')
text = text[:-3] + '''  {
    key: 'v1.6.26',
    title: '[업데이트] v1.6.26 공지사항 버전순 정렬 수정',
    body: '업데이트 공지가 등록 시각과 관계없이 높은 버전부터 표시되도록 정렬을 수정했습니다. 고정 공지는 계속 맨 위에, 일반 공지는 최신 작성순으로 표시되며 기존 공지 내용과 날짜는 변경되지 않습니다.',
    publishedAt: '2026-09-18T09:20:00+09:00',
  },
];
'''
notices.write_text(text, encoding='utf-8')

# Existing tests check the currently released health/cache version.
for path in Path('test').glob('*.js'):
    text = path.read_text(encoding='utf-8')
    newer = text.replace(r'1\\.6\\.25', r'1\\.6\\.26').replace('1.6.25', '1.6.26')
    if newer != text:
        path.write_text(newer, encoding='utf-8')

Path('test/announcement-order.test.js').write_text('''\
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
''', encoding='utf-8')
print('v1.6.26 announcement order patch applied')
