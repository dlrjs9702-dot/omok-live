'use strict';
// S1 섬 이야기 (gamecenter-notes docs/island-story-bible-20261027.md 5절): the islanders' chapters offered as my 호감도 reaches
// them (one under way on the island at a time), 할 일 a place (seen by my steps) or another islander, back to the asker for
// the story note; the 할 일 card's line, 그만둘래요; the festival stories -- the start one while it is on, the end one after
// it to whoever got a stamp.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const S = require('../public/plaza/island-story');
const T = require('../public/plaza/island-terrain');
const Npcs = require('../public/plaza/island-npcs');
const { boot } = require('../test-support/test-server');
const seoulPhase = (ms) => { const h = new Date(ms + 9 * 3600000).getUTCHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; };
Npcs.setPhaseOf(seoulPhase);
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7]];

test('이야기 글·규칙: 열 명 세 장, 쪽지·제안·할 일, 곳은 섬 위(걸어서 닿음), 조각 여덟, 여는 단계·한 번에 하나', () => {
  assert.equal(S.RESIDENTS.length, 10);
  for (const chs of S.RESIDENTS) {
    assert.equal(chs.length, 3);
    for (const ch of chs) {
      assert.ok(ch.title && ch.task && ch.done && ch.offer.length >= 1 && ch.note.length >= 4, ch.title);
      assert.ok(!`${ch.offer}${ch.task}${ch.done}${ch.note}`.includes('*'), ch.title); // (no markdown left)
      if (ch.go.talk != null) assert.ok(ch.go.talk >= 0 && ch.go.talk < 10);
      else { const p = S.spotOf(ch.go, T); assert.ok(p, `${ch.title} ${ch.go.at}`); let near = false; for (let dx = -p.r; dx <= p.r && !near; dx += 1) for (let dz = -p.r; dz <= p.r && !near; dz += 1) near = Math.hypot(dx, dz) <= p.r && T.walkable(p.x + dx, p.z + dz); assert.ok(near, ch.go.at); }
    }
  }
  const pieces = S.RESIDENTS.flat().map((ch) => ch.piece).filter(Boolean).sort();
  assert.deepEqual(pieces, [1, 2, 3, 3, 4, 5, 6, 8]); assert.equal(S.PIECES.length, 8); // (7: the log's missing page -- S2)
  assert.deepEqual(S.piecesOf({ 0: 3, 3: 2 }), [3]); assert.deepEqual(S.piecesOf({ 8: 3, 1: 3, 5: 3 }), [1, 2, 8]);
  // a chapter opens at its level (1 아는 사이, 2 친한 사이, 3 단짝), the next only after the last, none with one under way
  assert.equal(S.offerOf(0, {}, 0, null), null); assert.equal(S.offerOf(0, {}, 1, null), 0); assert.equal(S.offerOf(0, { 0: 1 }, 1, null), null);
  assert.equal(S.offerOf(0, { 0: 1 }, 2, null), 1); assert.equal(S.offerOf(0, { 0: 3 }, 3, null), null); assert.equal(S.offerOf(0, {}, 3, { n: 5, c: 0 }), null);
  assert.equal(S.talkState({ cur: { n: 4, c: 0, reached: false } }, 7, 0), 'visit'); assert.equal(S.talkState({ cur: { n: 4, c: 0, reached: true } }, 4, 1), 'hand');
  assert.equal(S.talkState({ cur: { n: 4, c: 0, reached: true } }, 7, 3), null);
  assert.equal(S.eventKind('harvest-2026'), 'harvest'); for (const k of ['harvest', 'christmas', 'countdown']) assert.ok(S.EVENTS[k].start.lines.length && S.EVENTS[k].end.lines.length);
});

test('이야기 부탁: 단계 → 제안·할게요, 한 번에 하나, 곳에 가면 ✓, 돌아가 쪽지(+호감도), 다른 주민에게 말 걸기 장, 그만둘래요, 행사 이야기', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'story-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('이야기손님'));
  await req('/api/test/island/free-residents', a, {});
  const by = async (n, i) => { const w = Npcs.residentAt(n, Date.now(), null); const [dx, dz] = SIDES[i % SIDES.length]; await req('/api/plaza/state', a, { x: w.x + dx, z: w.z + dz, yaw: 0, moving: false }); };
  const talk = async (n, body = {}) => { for (let i = 0; i < 6; i += 1) { await by(n, i); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  const bye = (n) => req('/api/island/resident/bye', a, { n });
  const story = async () => (await req('/api/island/story', a)).data;
  // 처음 본 사이: nothing to offer; 아는 사이 (5): 봄이's 1장
  assert.equal((await talk(0)).data.today.story, null); await bye(0);
  await req('/api/test/affinity', a, { n: 0, delta: 5 });
  const hi = await talk(0); assert.equal(hi.data.today.story, 'offer');
  const offered = await req('/api/island/resident/talk', a, { n: 0, topic: 'story' });
  assert.equal(offered.status, 200, JSON.stringify(offered.data)); assert.equal(offered.data.storyOffer.title, S.RESIDENTS[0][0].title); assert.match(offered.data.storyOffer.where, /대청마당/);
  assert.ok(offered.data.say.every((l) => !l.includes('{me}')) && offered.data.say[0].includes('이야기손님'));
  const took = await req('/api/island/resident/talk', a, { n: 0, topic: 'storyYes' }); assert.equal(took.status, 200); assert.equal(took.data.storyAccepted.title, S.RESIDENTS[0][0].title);
  assert.equal(took.data.story.track.ready, false); await bye(0);
  // one under way on the island: another islander at 아는 사이 offers nothing now
  await req('/api/test/affinity', a, { n: 8, delta: 5 }); assert.equal((await talk(8)).data.today.story, null); await bye(8);
  // the place: 대청마당 -- my step there, the line ✓
  const plaza = S.spotOf(S.RESIDENTS[0][0].go, T); await req('/api/plaza/state', a, { x: plaza.x + 3, z: plaza.z + 3, yaw: 0, moving: false });
  let v; for (let k = 0; k < 20 && !(v = await story()).track?.ready; k += 1) await new Promise((r) => { setTimeout(r, 100); });
  assert.equal(v.track.ready, true);
  // back to 봄이: their thanks, the note (my name in it), the chapter done, +2 호감도
  assert.equal((await talk(0)).data.today.story, 'hand');
  const done = await req('/api/island/resident/talk', a, { n: 0, topic: 'story' });
  assert.equal(done.status, 200, JSON.stringify(done.data)); assert.equal(done.data.storyNote.title, S.RESIDENTS[0][0].title); assert.equal(done.data.storyNote.note.length, 5);
  assert.ok(done.data.storyNote.note.join('').includes('이야기손님') && !done.data.storyNote.note.join('').includes('{me}'));
  assert.equal(done.data.affinity.points, 5 + 1 + 2); await bye(0);
  v = await story(); assert.deepEqual(v.chapters, { 0: 1 }); assert.equal(v.track, null);
  // 2장 waits for 친한 사이
  assert.equal((await talk(0)).data.today.story, null); await bye(0);
  // 노을 할머니 1장: 바람이에게 말 걸기, then back
  await req('/api/test/affinity', a, { n: 4, delta: 5 }); await talk(4);
  assert.equal((await req('/api/island/resident/talk', a, { n: 4, topic: 'story' })).data.storyOffer.where, '바람이에게 말 걸기');
  await req('/api/island/resident/talk', a, { n: 4, topic: 'storyYes' }); await bye(4);
  assert.equal((await talk(7)).data.today.story, 'visit');
  const visited = await req('/api/island/resident/talk', a, { n: 7, topic: 'story' }); assert.equal(visited.data.story.track.ready, true); await bye(7);
  await talk(4); assert.equal((await req('/api/island/resident/talk', a, { n: 4, topic: 'story' })).data.storyNote.n, 4); await bye(4);
  // 그만둘래요: 이솔's 1장 taken, let go -- offered again
  await talk(8); await req('/api/island/resident/talk', a, { n: 8, topic: 'story' }); await req('/api/island/resident/talk', a, { n: 8, topic: 'storyYes' }); await bye(8);
  assert.ok((await story()).track); assert.equal((await req('/api/island/story/drop', a, {})).data.track, null);
  assert.equal((await talk(8)).data.today.story, 'offer'); await bye(8);
  // 행사 이야기: during 수확제 its start story (once), after it the end one -- a stamp got
  const clock = (s) => req('/api/test/festival/clock', null, { at: Date.parse(`${s}+09:00`) });
  await clock('2026-11-20T12:00:00'); assert.deepEqual((await story()).fresh, ['harvest-2026:start']); assert.deepEqual((await story()).fresh, []);
  await clock('2026-11-28T12:00:00'); assert.deepEqual((await story()).fresh, []); // (no stamp: no end story)
  await clock('2026-11-21T12:00:00'); await req('/api/plaza/state', a, { x: T.FARM.x, z: T.FARM.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/festival/harvest', a, {})).status, 200);
  await clock('2026-11-28T12:00:00'); assert.deepEqual((await story()).fresh, ['harvest-2026:end']);
  assert.deepEqual((await story()).read, ['harvest-2026:start', 'harvest-2026:end']);
});
