'use strict';
// 206 구경 C안 (gamecenter-notes docs/interact-quests-20261029.md 2-1, 사용자 「c 안으로 가자」): every one of the eleven visits --
// standing there or one SPACE does not do it, a wrong answer does not, the whole small task does; walking in no longer counts
// one (one counted before stays counted)
const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../lib/island-quests');

const OCT = Date.parse('2026-10-20T12:00:00+09:00'); // (콩이's in October)
const openAt = (id) => { for (let n = 0; n < 50; n += 1) { process.env.ISLAND_QUEST_WEEK = String(n); if (Q.isOpen(id, OCT)) return; } throw new Error(`never open ${id}`); };
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const VISITS = Object.entries(Q.STORIES).flatMap(([id, s]) => s.steps.map((step, k) => ({ id, k, step }))).filter((v) => v.step.kind === 'visit');

test('구경 C안: 열한 곳 모두 작은 할 일 — 서 있기·한 번만은 안 끝남, 틀린 답 안 됨, 다 하면 끝', () => {
  assert.equal(VISITS.length, 11); assert.ok(VISITS.every((v) => v.step.task), '모든 구경에 할 일');
  const saved = process.env.ISLAND_QUEST_WEEK;
  try {
    for (const { id, k, step } of VISITS) {
      openAt(id); const t = step.task; const pick = Q.drawPick(step, seq([0.1, 0.7, 0.4, 0.9]));
      let doc = { [id]: { step: k, taken: true, count: 0, v: 2, ...(pick ? { pick } : {}) } };
      const act = (a, input, pos, now = OCT, bag = []) => Q.visitAct(doc, id, a, input, pos, now, bag, { trainIn: () => 7 });
      const apply = (r) => { assert.ok(!r.error, `${id} ${JSON.stringify(r)}`); doc = r.doc; return r; };
      const at = t.at || t.from || t.spots?.[0] || t.basket;
      // walking in does nothing now
      assert.equal(Q.note(doc, 'at', { x: at.x, z: at.z, now: OCT }), null, `${id} 걸어 들어가기만`);
      const far = { x: at.x + 40, z: at.z + 40 };
      if (t.type === 'pick') {
        const n = t.spots ? t.spots.length : 3; const wrong = (pick.answer + 1) % n; const spot = (i) => (t.spots ? t.spots[i] : t.at);
        assert.equal(act('choose', { choice: pick.answer }, far).error, 'TOO_FAR', `${id} 먼 데서`);
        assert.equal(act('choose', { choice: wrong }, spot(wrong)).error, 'VISIT_WRONG', `${id} 틀린 답`);
        assert.ok(apply(act('choose', { choice: pick.answer }, spot(pick.answer))).done, `${id} 맞는 답`);
        if (pick.options) assert.match(Q.askOf(step, { pick }), new RegExp(id === 'granny' ? Q.COLORS[pick.options[pick.answer]] : pick.options[pick.answer]));
      } else if (t.type === 'train') {
        assert.equal(act('choose', { choice: 7 }, far).error, 'TOO_FAR');
        assert.equal(act('choose', { choice: 10 }, t.at).error, 'VISIT_WRONG', `${id} 틀린 분`);
        assert.ok(apply(act('choose', { choice: 6 }, t.at)).done, `${id} ±1`);
      } else if (t.type === 'timed' || t.type === 'cross') {
        const to = t.to || t.at;
        assert.equal(act('finish', {}, to).error, 'VISIT_NOT_STARTED', `${id} 끝만`);
        assert.equal(act('start', {}, far).error, 'TOO_FAR');
        apply(act('start', {}, t.from || t.at));
        assert.equal(act('finish', {}, to, OCT + t.minMs - 100).error, 'VISIT_TOO_SOON', `${id} 너무 빨리`);
        if (t.type === 'cross') assert.equal(act('finish', {}, t.from, OCT + t.minMs + 100).error, 'TOO_FAR', `${id} 안 건넘`);
        assert.ok(apply(act('finish', {}, to, OCT + t.minMs + 100)).done, `${id} 다 함`);
      } else if (t.type === 'order') {
        assert.equal(act('tap', { choice: 1 }, t.spots[1]).error, 'VISIT_WRONG', `${id} 가운데부터`);
        apply(act('tap', { choice: 0 }, t.spots[0])); assert.equal(doc[id].count, 0, `${id} 하나만`);
        apply(act('tap', { choice: 1 }, t.spots[1])); assert.ok(apply(act('tap', { choice: 2 }, t.spots[2])).done, `${id} 차례로`);
      } else if (t.type === 'knock') {
        apply(act('tap', {}, t.at, OCT)); assert.equal(doc[id].count, 0, `${id} 한 번만`);
        assert.equal(act('tap', {}, t.at, OCT + 100).error, 'VISIT_TOO_SOON');
        apply(act('tap', {}, t.at, OCT + 500)); assert.ok(apply(act('tap', {}, t.at, OCT + 1000)).done, `${id} 세 번`);
      } else if (t.type === 'candy') {
        assert.equal(act('door', {}, t.door).error, 'VISIT_NOT_STARTED', `${id} 문만`);
        assert.equal(act('basket', {}, t.basket, OCT, []).error, 'NO_CANDY');
        const r = apply(act('basket', {}, t.basket, OCT, [{ itemId: 'candy', qty: 2 }])); assert.deepEqual(r.take, { itemId: 'candy', qty: 1 });
        assert.ok(apply(act('door', {}, t.door)).done, `${id} 바구니 → 문`);
      }
      assert.equal(doc[id].count, 1); assert.equal(Q.progress(id, doc[id], []).ready, true, `${id} 돌아가 말해요`);
      assert.equal(act('choose', { choice: 0 }, at).error, 'VISIT_DONE');
    }
  } finally { if (saved === undefined) delete process.env.ISLAND_QUEST_WEEK; else process.env.ISLAND_QUEST_WEEK = saved; }
});

test('구경 C안: 받을 때 답을 정해 두고(화면엔 보기만), 옛 count 1 기록은 그대로 인정', () => {
  const saved = process.env.ISLAND_QUEST_WEEK;
  try {
    openAt('granny'); const k = Q.STORIES.granny.steps.findIndex((s) => s.kind === 'visit');
    const doc = { granny: { step: k, taken: true, count: 0, v: 2, pick: { options: ['yellow', 'red', 'white'], answer: 0 } } };
    const t = Q.trackOf('granny', Q.storyState(doc, 'granny'), []); assert.deepEqual(t.task.options, ['yellow', 'red', 'white']); assert.equal(t.task.answer, undefined); assert.equal(JSON.stringify(t).includes('"answer"'), false); assert.equal(t.label, '강가 노란 꽃 냄새 맡기', '물은 색은 카드에도');
    const old = { granny: { step: k, taken: true, count: 1, v: 2 } }; assert.equal(Q.progress('granny', old.granny, []).ready, true); assert.equal(Q.trackOf('granny', old.granny, []).task, undefined);
  } finally { if (saved === undefined) delete process.env.ISLAND_QUEST_WEEK; else process.env.ISLAND_QUEST_WEEK = saved; }
});
