'use strict';
// (206 구경 C안) a visit done as a player does it -- its small task, step by step, where it is: the right pick, the timing
// waited out, the order kept, the candy put in -- for the tests of stories that go on past a visit
module.exports = function doVisit(Q, doc, id, now = Date.now(), bag = []) {
  const st = Q.storyState(doc, id); const t = Q.STORIES[id].steps[st.step]?.task; if (!t) throw new Error(`${id}: no visit task now`);
  const go = (act, input, pos, at = now, b = bag) => { const r = Q.visitAct(doc, id, act, input, pos, at, b, { trainIn: () => 7 }); if (r.error) throw new Error(`${id} ${act}: ${r.error}`); doc = r.doc; return r; };
  if (t.type === 'pick') go('choose', { choice: st.pick.answer }, t.spots ? t.spots[st.pick.answer] : t.at);
  else if (t.type === 'train') go('choose', { choice: 7 }, t.at);
  else if (t.type === 'timed' || t.type === 'cross') { go('start', {}, t.from || t.at); go('finish', {}, t.to || t.at, now + t.minMs + 1); }
  else if (t.type === 'order') t.spots.forEach((p, k) => go('tap', { choice: k }, p));
  else if (t.type === 'knock') for (let k = 0; k < t.times; k += 1) go('tap', {}, t.at, now + k * (t.gapMs + 1));
  else if (t.type === 'candy') { go('basket', {}, t.basket, now, [{ itemId: 'candy', qty: 1 }, ...bag]); go('door', {}, t.door); }
  return doc;
};
