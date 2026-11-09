'use strict';
// 293 관리자 계정 탭 (notes docs/admin-jail-292-20261109.md 6-6): 초성 검색, 거르기(마지막 접속 기준), 정렬, 태그
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/admin-accounts.js');

test('계정 찾기: 초성 검색, 접속 기준 거르기, 정렬, 태그 칩 수, 「3시간 전」', () => {
  const now = Date.parse('2026-11-09T12:00:00Z'); const iso = (h) => new Date(now - h * 3600000).toISOString();
  const keys = [
    { id: '1', label: '우성', loginId: 'woosung', realName: '김우성', lastSeenAt: iso(3), createdAt: iso(500), points: 120000, tags: ['fam'], messenger: true },
    { id: '2', label: '다래', loginId: 'darae', lastSeenAt: iso(24 * 12), createdAt: iso(100), points: 5000, debt: 20000, jail: { admin: false } },
    { id: '3', label: '바람', loginId: '', adminNote: '시험 계정', lastSeenAt: iso(24 * 40), createdAt: iso(10), points: 0, presence: { online: false } },
    { id: '4', label: '노을', loginId: 'noeul', lastSeenAt: iso(0.01), createdAt: iso(1), points: 9000, presence: { online: true }, tags: ['fam'] },
    { id: '5', label: '취소된', loginId: 'gone', revokedAt: iso(5), lastSeenAt: iso(5) },
    { id: '6', label: '신청중', pendingAt: iso(1) },
  ];
  assert.equal(A.choseong('우성 abc'), 'ㅇㅅ abc');
  const names = (o) => A.view(keys, { now, ...o }).rows.map((k) => k.label);
  assert.deepEqual(names({ q: 'ㅇㅅ' }), ['우성']); assert.deepEqual(names({ q: 'WOO' }), ['우성']); assert.deepEqual(names({ q: '시험' }), ['바람']); assert.deepEqual(names({ q: '김우' }), ['우성']);
  assert.deepEqual(names({}), ['노을', '우성', '다래', '바람'], '최근 접속(접속 중 먼저), 취소·신청 빠짐');
  assert.deepEqual(names({ sort: 'points' }), ['우성', '노을', '다래', '바람']); assert.deepEqual(names({ sort: 'joined' }), ['노을', '바람', '다래', '우성']); assert.deepEqual(names({ sort: 'name' }), ['노을', '다래', '바람', '우성']);
  assert.deepEqual(names({ chip: 'online' }), ['노을']); assert.deepEqual(names({ chip: 'today' }), ['노을', '우성']); assert.deepEqual(names({ chip: 'week' }), ['노을', '우성']);
  assert.deepEqual(names({ chip: 'away' }), ['바람']); assert.deepEqual(names({ chip: 'debt' }), ['다래']); assert.deepEqual(names({ chip: 'jail' }), ['다래']); assert.deepEqual(names({ chip: 'noid' }), ['바람']); assert.deepEqual(names({ chip: 'revoked' }), ['취소된']);
  const v = A.view(keys, { now, tags: [{ id: 'fam', name: '가족', color: 'green' }] });
  assert.deepEqual(v.chips.filter((c) => ['all', 'revoked', 'tag:fam'].includes(c.id)).map((c) => [c.id, c.count]), [['all', 4], ['revoked', 1], ['tag:fam', 2]]);
  assert.deepEqual(names({ chip: 'tag:fam' }), ['노을', '우성']);
  assert.deepEqual([A.ago(iso(0.01), now), A.ago(iso(3), now), A.ago(iso(30), now), A.ago(iso(24 * 12), now), A.ago(null, now)], ['방금', '3시간 전', '어제', '12일 전', '없음']);
  assert.deepEqual([A.pointsShort(123456), A.pointsShort(9000)], ['12.3만', '9,000']);
});

test('계정 목록 서버: 한 번에 포인트·체납·구치소·집·태그, 태그 만들고 붙이고 지우면 계정에서도 빠짐, 관리자만', async (t) => {
  const fs = require('node:fs/promises'); const os = require('node:os'); const path = require('node:path');
  const rmAtExit = require('../test-support/rm-at-exit'); const { boot } = require('../test-support/test-server');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'admin-keys-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('분류손님'));
  assert.equal((await req('/api/admin/tags', a, { action: 'add', name: '가족', color: 'green' })).status, 403);
  assert.equal((await req('/api/admin/tags', server.admin, { action: 'add', name: ' ', color: 'green' })).data.error, 'NO_NAME');
  for (const [name, color] of [['가족', 'green'], ['시험계정이름은열자넘음', 'nope']]) assert.equal((await req('/api/admin/tags', server.admin, { action: 'add', name, color })).status, 200);
  const tags = (await req('/api/admin/tags', server.admin)).data.tags; assert.deepEqual(tags.map((g) => [g.name, g.color]), [['가족', 'green'], ['시험계정이름은열자넘', 'red']], '10자, 모르는 색은 첫 색');
  const key = () => req('/api/admin/keys', server.admin).then((r) => r.data.keys.find((k) => k.label === '분류손님'));
  const id = (await key()).id;
  assert.deepEqual((await req(`/api/admin/keys/${id}/tags`, server.admin, { tags: [tags[0].id, tags[1].id, 'nope', tags[0].id] })).data.tags, [tags[0].id, tags[1].id]);
  await req('/api/test/jail', a, { debt: 12000 });
  const k = await key(); assert.deepEqual([k.tags, k.debt, k.jail, k.hasHome, typeof k.points, Boolean(k.lastSeenAt)], [[tags[0].id, tags[1].id], 12000, null, false, 'number', true], '(294) 체납만으로는 구치소 아님');
  await req('/api/test/jail', a, { veteran: true }); await req('/api/plaza/leave', a, {}); await req('/api/plaza/state', a, { x: 0, z: 6, yaw: 0 }); /* (294: now in the cell -- 구치소) */
  assert.deepEqual((await key()).jail, { admin: false });
  assert.equal((await req('/api/admin/tags', server.admin, { action: 'delete', id: tags[0].id })).status, 200);
  assert.deepEqual((await key()).tags, [tags[1].id], '지운 태그는 계정에서도 빠짐');
  assert.equal((await req('/api/admin/tags', server.admin, { action: 'edit', id: tags[1].id, name: '주의', color: 'red' })).data.tags[0].name, '주의');
});
