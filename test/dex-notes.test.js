'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const N = require('../lib/island-dex-notes');
const F = require('../lib/island-fishing');
const I = require('../lib/island-insects');
const T = require('../public/plaza/island-terrain.js');
const Together = require('../lib/island-together');
const M = require('../public/plaza/island-museum.js');
const { boot } = require('../test-support/test-server');

// v1.10.257 잡기 카드·설명 (docs/catch-card-20261103.md 2·4절): every fish and insect its line (40 letters or fewer) and its
// island story (two lines, a big fish three, 46 or fewer each); where and when from the tables, never empty
test('설명 글: 물고기·곤충 모두, 줄 길이, 곳·때는 표에서', () => {
  const ids = [...Object.keys(F.SPECIES).map((s) => `fish_${s}`), ...Object.keys(I.SPECIES).map((s) => `insect_${s}`)];
  assert.equal(ids.length, 62); // (v1.10.259: 50 fish and 12 insects)
  for (const id of ids) {
    const n = N.DEX_NOTES[id]; assert.ok(n, id);
    assert.ok(n.line.length <= 40, `${id} line ${n.line.length}`);
    assert.equal(n.story.length, F.SPECIES[id.slice(5)]?.grade === 'big' ? 3 : 2, id);
    for (const l of n.story) assert.ok(l.length <= 46, `${id} ${l.length}: ${l}`);
    const w = N.whereText(N.whereOf(id)); assert.ok(w.length > 3, id); assert.doesNotMatch(n.line + n.story.join(''), /\d+ ?cm|\d+P/, `${id}: 곳·때·크기·값은 글에 안 씀`);
  }
  assert.equal(N.whereText(N.whereOf('fish_squid')), '바깥 바다·윤슬만 · 여름·가을 · 밤'); // (총괄 #407: the waters of the same seasons together)
  assert.equal(N.whereText(N.whereOf('fish_sturgeon')), '거울호수 · 가을·겨울 · 낮·밤');
  assert.equal(N.whereText(N.whereOf('insect_snail')), '섬 풀밭 · 봄·여름·가을 · 비 올 때');
  assert.equal(N.whereText({ places: [{ place: '강', seasons: '봄' }, { place: '거울호수', seasons: '여름' }, { place: '폭포 웅덩이', seasons: '봄' }], when: '낮·밤' }), '강·폭포 웅덩이 · 봄 / 거울호수 · 여름 · 낮·밤');
  assert.equal(N.whereOf('fish_nope'), null);
});

// the server: a catch tells the best before it and the museum's on show; the 도감 gives the note, where and when, the size
// range -- its story only once found
test('잡기 카드 서버: 지난 최고·박물관 크기, 도감 설명(찾은 것만 이야기)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dex-notes-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const s = await server.enter(await server.issue('설명왕')); assert.ok(s, server.logs());
  await req('/api/plaza/state', s, { x: T.PIER.x, z: T.PIER.z, yaw: 0, moving: false }); await req('/api/test/island/give', s, { itemId: 'fishing_rod', qty: 1 });
  const catchOne = async (size) => { const c = (await req('/api/island/fish/start', s, {})).data; await req('/api/test/fish/bite', s, { species: 'mackerel', size }); return (await req('/api/island/fish/finish', s, { fishId: c.fishId, presses: c.seq.slice(0, c.arrows).map((dir, i) => ({ dir, t: i * 150 })) })).data; };
  const first = await catchOne(30.2); assert.deepEqual([first.firstTime, first.best, first.prevBest, first.museumSize], [true, true, null, null]);
  const second = await catchOne(41.5); assert.deepEqual([second.firstTime, second.best, second.prevBest], [false, true, 30.2]);
  assert.deepEqual([(await catchOne(25)).best, (await catchOne(26)).prevBest], [false, 41.5]);
  // on show in the museum: the next catch knows its size
  const door = Together.museumDoor(T.MUSEUM); await req('/api/plaza/state', s, { x: door.x, z: door.z, yaw: 0, moving: false }); await req('/api/island/museum/enter', s, {});
  const desk = M.world(M.TALK.lx, M.TALK.lz); await req('/api/plaza/state', s, { x: desk.x, z: desk.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/museum/donate', s, { itemId: 'fish_mackerel' })).status, 200);
  const exit = M.world(M.ROOM.exit.lx, M.ROOM.exit.lz); await req('/api/plaza/state', s, { x: exit.x, z: exit.z, yaw: 0, moving: false }); await req('/api/island/museum/leave', s, {});
  await req('/api/plaza/state', s, { x: T.PIER.x, z: T.PIER.z, yaw: 0, moving: false });
  assert.equal((await catchOne(28)).museumSize, 41.5);
  const dex = (await req('/api/island/dex', s)).data.entries;
  const mack = dex.find((e) => e.id === 'fish_mackerel'); const tuna = dex.find((e) => e.id === 'fish_giant_tuna'); const snail = dex.find((e) => e.id === 'insect_snail');
  assert.deepEqual([mack.note.line, mack.note.story.length, mack.where.length > 3, mack.sizes], [N.DEX_NOTES.fish_mackerel.line, 2, true, F.SIZES.mackerel]);
  assert.deepEqual([tuna.note.story, Boolean(tuna.note.line), Boolean(tuna.where)], [null, true, true], '못 잡은 것은 이야기 숨김');
  assert.deepEqual([snail.note.story, snail.sizes], [null, undefined]);
  assert.equal(dex.find((e) => e.kind === 'photo')?.note, undefined);
});
