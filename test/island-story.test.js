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
  // (CI X2·Q2 「never by them」: where they are by the server's own count -- each hold paused their round (its delay), which
  // residentAt(…, null) left out, so after a few talks the spot drifted off them; the place answer carries the server's state)
  let here = { x: 0, z: 0 }; const stateOf = async (n) => (await req('/api/plaza/state', a, { ...here, yaw: 0, moving: false })).data.residents?.[n] || null;
  const by = async (n, i) => { const w = Npcs.residentAt(n, Date.now(), await stateOf(n)); const [dx, dz] = SIDES[i % SIDES.length]; here = { x: w.x + dx, z: w.z + dz }; await req('/api/plaza/state', a, { ...here, yaw: 0, moving: false }); };
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
  // (Codex 검토 5차 P3-4 ③) the chapter's end saved, its 호감도's save failed: the next talk pays it
  await talk(4); await req('/api/test/store/fail', null, { method: 'affinityAdd' }); assert.notEqual((await req('/api/island/resident/talk', a, { n: 4, topic: 'story' })).status, 200);
  assert.equal((await story()).chapters[4], 1); await bye(4);
  assert.equal((await talk(4)).data.affinity.points, 5 + 1 + 2, '다음 말 걸기에 마저'); await bye(4);
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

test('S2 장면 규칙: 섬 일지 열림·빠진 쪽(조각 7), 마지막 장 조건, 받는 쪽 대사, 깜빡임 두 박자', () => {
  assert.equal(S.LOG.pages.length, 8); assert.ok(S.LOG.missing.lines.length >= 3);
  assert.ok(S.logOpen(1, {}) && S.logOpen(4, {}) && !S.logOpen(5, { 4: 2 }) && S.logOpen(8, { 4: 3 }) && !S.logOpen(9, { 4: 3 }));
  const read = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => `log:${k}`);
  assert.equal(S.missingDue({ chapters: { 9: 3 }, read }), true); assert.equal(S.missingDue({ chapters: { 9: 2 }, read }), false); assert.equal(S.missingDue({ chapters: { 9: 3 }, read: read.slice(1) }), false);
  assert.equal(S.missingDue({ chapters: { 9: 3 }, read: [...read, 'log:missing'] }), false);
  const done = Object.fromEntries([...Array(10).keys()].map((n) => [n, 3]));
  assert.deepEqual(S.piecesOf(done, ['log:missing']), [1, 2, 3, 4, 5, 6, 7, 8]); assert.equal(S.piecesOf(done, []).length, 7);
  assert.equal(S.finalOpen({ chapters: done, read: ['log:missing'] }, 3), true); assert.equal(S.finalOpen({ chapters: done, read: ['log:missing'] }, 2), false); assert.equal(S.finalOpen({ chapters: done, read: [] }, 3), false);
  assert.equal(S.finalOpen({ chapters: done, read: ['log:missing'], final: 1 }, 3), false);
  assert.equal(S.FINAL.length, 6); assert.ok(S.FINAL[2].note.some((l) => l.includes('마지막 등대지기')));
  assert.deepEqual(Object.keys(S.RECEIVE).sort(), ['0,2', '3,1', '4,0', '6,1', '7,1']);
  for (const [k, v] of Object.entries(S.RECEIVE)) { const [n, c] = k.split(',').map(Number); assert.ok(S.RESIDENTS[n][c].go.talk != null, k); assert.equal(v.length, 2); }
  // the beat: 2~4 marks a bar (short / long), rests between bars, a long rest after three; the two not the same
  const bars = (beat) => { const out = [[]]; for (let i = 0; i < beat.length; i += 2) { out[out.length - 1].push(beat[i] > 500 ? '-' : '.'); if (beat[i + 1] > 500 && i + 2 < beat.length) out.push([]); } return out.map((b) => b.join('')); };
  for (const k of ['dalmaru', 'welcome']) { const b = bars(S.BLINK[k]); assert.equal(b.length, 3, k); for (const bar of b) assert.ok(bar.length >= 2 && bar.length <= 4 && /\./.test(bar) && /-/.test(bar), `${k} ${bar}`); assert.ok(S.BLINK[k].at(-1) >= 2000); }
  assert.notDeepEqual(bars(S.BLINK.dalmaru), bars(S.BLINK.welcome)); assert.notEqual(bars(S.BLINK.dalmaru)[0], bars(S.BLINK.welcome)[0]);
});

test('S2 서버: 섬 일지 쪽 읽기(닫힌 쪽 막힘), 등대 문 살펴보기 → 빠진 쪽 한 번(문은 잠김), 결론 듣기 → 쪽지 여섯·등불·칭호 한 번', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'story2-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('등대이웃'));
  await req('/api/test/island/free-residents', a, {});
  const story = async () => (await req('/api/island/story', a)).data;
  // the log: 1~4 open, 5 shut until 노을 할머니 3장
  assert.equal((await req('/api/island/story/log', a, { page: 5 })).data.error, 'PAGE_SHUT');
  assert.equal((await req('/api/island/story/log', a, { page: 1 })).status, 200);
  const done = Object.fromEntries([...Array(10).keys()].map((n) => [String(n), 3]));
  await req('/api/test/story', a, { doc: { chapters: done, read: ['log:1'] } });
  for (let k = 2; k <= 7; k += 1) assert.equal((await req('/api/island/story/log', a, { page: k })).status, 200);
  // by the lighthouse: too far / not every page yet / then the missing page, once (the door still locked)
  const L = T.dalmaru.PLACES.lighthouse;
  await req('/api/plaza/state', a, { x: 0, z: -60, yaw: 0, moving: false }); assert.equal((await req('/api/island/story/inspect', a, {})).data.error, 'TOO_FAR');
  const by = async () => { for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 4]]) { const r = await req('/api/plaza/state', a, { x: L.x + dx, z: L.z + dz, yaw: 0, moving: false }); if (Math.hypot(r.data.x - L.x, r.data.z - L.z) <= 8) return; } throw new Error('never by the lighthouse'); };
  await by(); assert.equal((await req('/api/island/story/inspect', a, {})).data.found, null);
  await req('/api/island/story/log', a, { page: 8 });
  const found = await req('/api/island/story/inspect', a, {}); assert.equal(found.data.found.title, S.LOG.missing.title); assert.ok(found.data.pieces.includes(7)); assert.equal(found.data.final, false);
  assert.equal((await req('/api/island/story/inspect', a, {})).data.found, null);
  // 오 탐정: 「결론 듣기」 only with 노을 할머니 단짝; then six papers, the lamp and the title once
  let here = { x: 0, z: 0 }; const stateOf = async (n) => (await req('/api/plaza/state', a, { ...here, yaw: 0, moving: false })).data.residents?.[n] || null; // (the server's own count of where they are)
  const talk = async (n, body = {}) => { for (const [dx, dz] of SIDES) { const w = Npcs.residentAt(n, Date.now(), await stateOf(n)); here = { x: w.x + dx, z: w.z + dz }; await req('/api/plaza/state', a, { ...here, yaw: 0, moving: false }); const r = await req('/api/island/resident/talk', a, { n, ...body }); if (r.status !== 409 || r.data.error !== 'TOO_FAR') return r; } throw new Error('never by them'); };
  assert.equal((await talk(5)).data.today.final, false); await req('/api/island/resident/bye', a, { n: 5 });
  for (let k = 0; k < 3; k += 1) await req('/api/test/affinity', a, { n: 4, delta: 10 }); // (단짝: 30)
  assert.equal((await talk(5)).data.today.final, true);
  const fin = await req('/api/island/resident/talk', a, { n: 5, topic: 'final' }); assert.equal(fin.status, 200, JSON.stringify(fin.data));
  assert.equal(fin.data.finalScenes.length, 6); assert.ok(fin.data.finalScenes.flatMap((sc) => sc.note).join('').includes('등대이웃')); assert.equal(fin.data.story.final, true);
  assert.equal((await req('/api/island/resident/talk', a, { n: 5, topic: 'final' })).data.error, 'STORY_GONE');
  await story(); await story(); // (the gifts made good again: still once)
  const mine = (await req('/api/test/story', a, {})).data;
  assert.equal(mine.furniture.filter((p) => p.id === S.LANTERN).length, 1); assert.deepEqual(mine.titles, [S.TITLE]);
});
